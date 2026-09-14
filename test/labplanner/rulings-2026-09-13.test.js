/**
 * Four rulings JCA gave on 2026-09-13, reading the audit. Each is here because implementing a
 * ruling and enforcing it are different things, and this repository keeps finding the gap.
 */
import { describe, it, expect } from 'vitest';
import { TUBE, DNA_NAME_MAX, DNA_NAME_LIMIT, CLONE_MAX } from '../../src/labplanner/models/labsheet.js';
import { tubeFor } from '../../src/labplanner/planning/jobsToLabSheets.js';
import { validateConstructionFile } from '../../src/labplanner/validate/constructionFile.js';
import { applyRetransformControls, controlStrainFor } from '../../src/labplanner/planning/injectTransformRecovery.js';
import { MINIPREP_CULTURE_ML } from '../../src/labplanner/design/miniprep.js';
import { DESIGNS, applyDesign } from '../../src/labplanner/design/index.js';
import { planExperiment } from '../../src/labplanner/planning/planExperiment.js';
import { describeLayout, shapeOf } from '../../src/labplanner/planning/vessels.js';

const cfEndingIn = (product) =>
  `PCR\tbo1\tbo2\tpSRC\tfrag\nTransform\tfrag\tMach1\tErm\t37\t${product}\n`;
const longNames = (cf) => validateConstructionFile(cf, 'x.txt').findings
  .filter((f) => f.code === 'LONG_NAME');

describe('a zymo product is on a 1.5 mL tube', () => {
  // JCA: *"true. zymo is always a 1.5 mL. The columns only fit in such a tube."*
  it('never on a strip tube', () => {
    expect(tubeFor('zymo')).toBe('micro');
  });

  it('and the z-prefix convention fits on it', () => {
    // `zL3a` is the PCR's three-character label with the zymo prefix. Four, on a cap that takes 3.
    expect('zL3a'.length).toBeLessThanOrEqual(TUBE[tubeFor('zymo')].cap);
    expect('zL3a'.length).toBeGreaterThan(TUBE.pcr.cap);
  });
});

describe('how long a name and a label may be', () => {
  // JCA: *"Maybe 6 cap on a name (a rule on CF drafting more) plus 2 more for the clone… Even a
  // pBET12-4B3 is writeable. I think we've been too strict on names."*
  it('a 1.5 mL holds a name plus a plate-address clone', () => {
    expect('pBET12-4B3'.length).toBeLessThanOrEqual(TUBE.micro.cap);
    expect(CLONE_MAX).toBe(3);
  });

  it('a sequencing tube holds one more, for the read direction', () => {
    expect(TUBE.sequencing.cap).toBe(TUBE.micro.cap + 1);
    expect('pBET12-4B3R'.length).toBeLessThanOrEqual(TUBE.sequencing.cap);
  });

  // TWO NUMBERS, BECAUSE HE GAVE TWO: 6 is the aim and 8 is *"about the limit"*. Collapsing them
  // flags `pGhost17`, a plasmid this lab has used for years — and a warning that fires on names
  // already in use is one people learn to skip.
  it('keeps the aim and the limit apart', () => {
    expect(DNA_NAME_MAX).toBeLessThan(DNA_NAME_LIMIT);
  });
});

describe('name length is said while the CF is being drafted', () => {
  // JCA: *"the length on a name more needs to happen earlier when designing the CF. It's
  // aspirational to keep things short, but isn't like a make it or break it thing. But you can't
  // be making up gigantic labels is more the point."*
  it('warns, and does not fail the file', () => {
    const r = validateConstructionFile(cfEndingIn('pLongConstructName'), 'x.txt');
    const f = r.findings.filter((x) => x.code === 'LONG_NAME');
    expect(f).toHaveLength(1);
    expect(f[0].level).toBe('warn');
  });

  it('says nothing about a name the lab already uses', () => {
    expect(longNames(cfEndingIn('pGhost17'))).toHaveLength(0);
    expect(longNames(cfEndingIn('pBET8'))).toHaveLength(0);
  });

  // AN INTERMEDIATE NEVER WEARS ITS OWN NAME ON A TUBE. `Pcon-amilGFP-Term` is a PCR fragment and
  // what goes on its cap is `L3a`, three characters, from the labeller. The file's LAST product is
  // the one that goes on a 1.5 mL, gets a clone suffix, and outlives the experiment.
  it('is about the file’s product, not its intermediates', () => {
    const cf = 'PCR\tbo1\tbo2\tpSRC\tPcon-amilGFP-Term\n'
             + 'Transform\tPcon-amilGFP-Term\tMach1\tErm\t37\tpBET8\n';
    expect(longNames(cf)).toHaveLength(0);
  });

  it('names the aim and the limit in what it says', () => {
    const m = longNames(cfEndingIn('pLongConstructName'))[0].message;
    expect(m).toMatch(new RegExp(`${DNA_NAME_MAX} or fewer is the aim`));
    expect(m).toMatch(new RegExp(`${DNA_NAME_LIMIT} is about the limit`));
  });
});

describe('a restreak control has to be the same organism', () => {
  // JCA: *"In the cheese case, the retransformation is into L. lactis, though, so an e. coli
  // control isn't really relevant. What would be relevant would be to streak l. lactis control
  // cells that had previously been transformed. That doesn't exist currently."*
  const job = () => ({ operation: 'retransform', output: 'L.lactis/pX',
                       args: { host: 'L.lactis', antibiotic: 'Erm', positive: 'pCTRL' } });

  it('uses a host-matched strain when the lab has one', () => {
    const jobs = [job()];
    applyRetransformControls(jobs, { controlStrains: { 'L.lactis/erm': 'LL-E1' } });
    expect(jobs[0].controlStrain).toBe('LL-E1');
    expect(jobs[0].open || []).toHaveLength(0);
  });

  it('reports the gap rather than plating one that cannot answer', () => {
    const jobs = [job()];
    applyRetransformControls(jobs, { controlStrains: {} });
    expect(jobs[0].controlStrain).toBe(null);
    expect(jobs[0].open[0]).toMatch(/would not grow either way/);
  });

  it('falls back from host/antibiotic to host', () => {
    expect(controlStrainFor('L.lactis', 'erm', { 'L.lactis': 'LL' })).toBe('LL');
    expect(controlStrainFor('L.lactis', 'erm', { 'L.lactis/erm': 'LLE', 'L.lactis': 'LL' }))
      .toBe('LLE');
    expect(controlStrainFor('L.lactis', 'erm', {})).toBe(null);
  });

  // THE WAY OUT, AND IT COSTS ONE TUBE. The positive control plate is this host carrying the
  // control plasmid — which is exactly the strain a restreak needs.
  it('tells them to bank a colony off the positive control plate', () => {
    const d = applyDesign({ operation: 'retransform',
                            samples: [{ output: 'L.lactis/pX', inputs: ['pX'],
                                        params: { host: 'L.lactis', antibiotic: 'Erm',
                                                  positive: 'pCTRL', negative: 'untransformed' } }] },
                          () => undefined, { label: Object.assign(() => 'X', { of: () => null }) });
    expect(d.notes.join(' ')).toMatch(/save it as a stock/);
    // Two rows while there is no strain: the third is absent, not faked.
    const t = d.blocks.find((b) => b.kind === 'table');
    expect(t.rows).toHaveLength(3);          // header + positive + negative
  });

  it('draws the third plate once a strain exists', () => {
    const d = applyDesign({ operation: 'retransform',
                            samples: [{ output: 'L.lactis/pX', inputs: ['pX'], controlStrain: 'LL-E1',
                                        params: { host: 'L.lactis', antibiotic: 'Erm',
                                                  positive: 'pCTRL', negative: 'untransformed' } }] },
                          () => undefined, { label: Object.assign(() => 'X', { of: () => null }) });
    const t = d.blocks.find((b) => b.kind === 'table');
    expect(t.rows).toHaveLength(4);
    expect(t.rows[3].join(' ')).toMatch(/LL-E1/);
    expect(d.notes.join(' ')).not.toMatch(/save it as a stock/);
  });
});

describe('a miniprep pick is four millilitres', () => {
  // JCA: *"When picking for minipreps, it's always 4mL. That's pretty standard."*
  it('is a code-defined decision, not a question on the page', () => {
    expect(MINIPREP_CULTURE_ML).toBe(4);
    const d = applyDesign({ operation: 'miniprep',
                            samples: [{ output: 'pX-A', inputs: ['host/pX-A'], params: {} }] },
                          () => undefined, { label: Object.assign(() => '', { of: () => null }) });
    expect(d.values.qiagen_miniprep.culture_mL).toBe(4);
    expect(d.notes.join(' ')).not.toMatch(/how much culture to pellet/);
  });

  it('still defers to a volume the plan actually declared', () => {
    const d = applyDesign({ operation: 'miniprep',
                            samples: [{ output: 'pX-A', inputs: ['block'], params: {} }] },
                          (n) => (n === 'block' ? { volume: '2mL' } : undefined),
                          { label: Object.assign(() => '', { of: () => null }) });
    expect(d.values.qiagen_miniprep.culture_mL).toBe(2);
  });
});

describe('a sheet does not contradict itself about the plastic', () => {
  /**
   * **FOUND 2026-09-13 BY CHANGING ONE FIELD.** A characterization file saying `vessel=96-well`
   * produced a culture table reading `96-well` and, four lines below it, a note reading *"4 clones
   * in a 24-well block"* — with the wells laid out 4×6 for a plate that is 8×12.
   *
   * Two bugs, one on top of the other:
   *
   *   `downstreamVessel` returned `jobs.some(...)` — a BOOLEAN — so it could say whether a vessel
   *   had been declared downstream and never which one.
   *
   *   and the call site read `a || b ? 'block' : c`, which parses as `(a || b) ? 'block' : c`, so
   *   a declared `96-well` was replaced by the literal string "block" — a word that names no piece
   *   of plastic, handed to every reader downstream.
   */
  const cfs = (vessel) => [
    { name: 'pX', text: 'PCR\tbo1\tbo2\tpS\tfrag\nTransform\tfrag\tMach1\tErm\t37\tpX\n' },
    { name: 'pX', characterization: true,
      text: `Retransform\tpX\thost=L.lactis antibiotic=Erm\tpX_h\n`
          + `Pick\tpX_h\tn=6 clone=L.lactis/pX\tpX_c\n`
          + `Culture\tpX_c\tmedium=M17 vessel=${vessel} volume=1mL\tpX_cult\n` },
  ];
  // THE LAST pick, not the first: a verification chain is injected ahead of the characterization
  // file's own pick, and that one has no vessel because nothing downstream of it declares one.
  const pickSheet = (vessel) => {
    const out = planExperiment({ cfs: cfs(vessel) });
    const picks = out.sheets.filter((s) => String(s.operation) === 'pick');
    return picks[picks.length - 1];
  };

  it('lays the wells out in the vessel the file named', () => {
    const wide = pickSheet('96-well').samples.map((x) => x.params.well);
    // 8 rows before the column turns over, not 4.
    expect(wide.slice(0, 6)).toEqual(['A1', 'B1', 'C1', 'D1', 'E1', 'F1']);
    const narrow = pickSheet('24-well').samples.map((x) => x.params.well);
    expect(narrow.slice(0, 6)).toEqual(['A1', 'B1', 'C1', 'D1', 'A2', 'B2']);
  });

  it('keeps the vessel’s name, not the word "block"', () => {
    expect(pickSheet('96-well').samples[0].params.vessel).toBe('96-well');
  });

  it('describes the one it laid out', () => {
    expect(describeLayout(6, '96-well')).toMatch(/96-well block/);
    expect(describeLayout(6, '24-well')).toMatch(/24-well block/);
  });

  // An unknown name gets the default shape and says it is not known, so a caller can decide
  // whether to pass it to a protocol that would otherwise state a well count as fact.
  it('says when it does not know the vessel', () => {
    expect(shapeOf('96-well').known).toBe(true);
    expect(shapeOf('eppendorf rack').known).toBe(false);
    expect(shapeOf(null).known).toBe(true);            // nothing named: the default IS the answer
  });
});
