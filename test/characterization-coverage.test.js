/**
 * Phase 4's gate: does the characterization file account for everything the construction files
 * build?
 *
 * **THE CASE THAT MATTERS IS THE PLASMID NOBODY MEASURES.** `c6-labplan` refuses an experiment
 * with no characterization file at all, so the gap that survives is the file that exists and
 * covers three constructs of four — which passes every check there is today and ends with one
 * plasmid built, verified, and never used for anything.
 */
import { describe, it, expect } from 'vitest';
import { characterizationCoverage } from '../src/labplanner/validate/coverage.js';
import { parseCharacterization } from '../src/labplanner/validate/characterizationFile.js';

const chain = (p) => [
  { operation: 'retransform', dnas: [p], output: `${p}_host`, line: 1 },
  { operation: 'pick', dnas: [`${p}_host`], output: `${p}_clones`, line: 2 },
  { operation: 'assay', dnas: [`${p}_clones`], output: `${p}_assay`, line: 3 },
];

describe('coverage follows the chain', () => {
  it('a construct reached through retransform, pick and assay is covered', () => {
    const out = characterizationCoverage(['pBET8'], chain('pBET8'));
    expect(out.covered).toEqual(['pBET8']);
    expect(out.uncovered).toEqual([]);
  });

  it('REPORTS THE ONE CONSTRUCT OF FOUR THAT NOTHING TOUCHES', () => {
    const steps = [...chain('pBET8'), ...chain('pBET9'), ...chain('pBET10')];
    const out = characterizationCoverage(['pBET8', 'pBET9', 'pBET10', 'pBET11'], steps);
    expect(out.uncovered).toEqual(['pBET11']);
    expect(out.covered).toEqual(['pBET8', 'pBET9', 'pBET10']);
  });

  it('a product that only gets retransformed is still covered — something happens to it', () => {
    const out = characterizationCoverage(['pX'], [{ operation: 'retransform', dnas: ['pX'], output: 'pX_host', line: 1 }]);
    expect(out.covered).toEqual(['pX']);
  });

  it('clone-only is a DECISION and stops being reported, without being called covered', () => {
    const out = characterizationCoverage(['pA', 'pB'], chain('pA'), { cloneOnly: ['pB'] });
    expect(out.uncovered).toEqual([]);
    expect(out.cloneOnly).toEqual(['pB']);
    expect(out.covered).toEqual(['pA']);
  });
});

describe('orphans', () => {
  it('A STEP ON A NAME THAT EXISTS NOWHERE IS NAMED, with its line', () => {
    const steps = [...chain('pBET8'), { operation: 'assay', dnas: ['pBET88_clones'], output: 'x', line: 9 }];
    const out = characterizationCoverage(['pBET8'], steps);
    expect(out.orphans).toEqual([{ operation: 'assay', name: 'pBET88_clones', line: 9 }]);
  });

  it('does not call a legitimate intermediate an orphan', () => {
    const out = characterizationCoverage(['pBET8'], chain('pBET8'));
    expect(out.orphans).toEqual([]);
  });

  it('order does not matter — the chain is walked, not read top to bottom', () => {
    const out = characterizationCoverage(['pBET8'], [...chain('pBET8')].reverse());
    expect(out.covered).toEqual(['pBET8']);
    expect(out.orphans).toEqual([]);
  });
});

describe('against the real parser', () => {
  // The Pick carries `phenotype=` because the parser REFUSES one without it — "nothing can infer
  // it, which marker matters here is a judgement about this experiment". Written without it, the
  // step is dropped and its product becomes an orphan downstream, which is this check doing its
  // job on a file the parser had already rejected.
  const text = [
    'Retransform\tpBET8\thost=L.lactis antibiotic=Erm temp=30\tpBET8_lactis',
    'Pick\tpBET8_lactis\tn=4 phenotype=green, erythromycin-resistant\tpBET8_clones',
    'Assay\tpBET8_clones\treporter=amilGFP ex=483 em=525 od=600\tlactis3_1_assay',
  ].join('\n');

  it('reads a real characterization file and covers its construct', () => {
    const { steps, problems } = parseCharacterization(text, 'test');
    expect(problems).toEqual([]);
    const out = characterizationCoverage(['pBET8'], steps);
    expect(out.covered).toEqual(['pBET8']);
    expect(out.uncovered).toEqual([]);
  });

  it('and reports the sibling construct the file never mentions', () => {
    const { steps } = parseCharacterization(text, 'test');
    expect(characterizationCoverage(['pBET8', 'pBET9'], steps).uncovered).toEqual(['pBET9']);
  });
});
