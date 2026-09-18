import { describe, it, expect } from 'vitest';
import { parseCharacterization } from '../../src/labplanner/validate/characterizationFile.js';
import { planExperiment } from '../../src/labplanner/planning/planExperiment.js';
import { applyDesign } from '../../src/labplanner/design/index.js';

// A PICK MUST SAY WHAT TO PICK. JCA, 2026-09-18: "this phenotype is a necessary field for a pick
// operation."
//
// THE CASE. He reviewed a crRNA transformation checkpoint, saw plenty of colonies and healthy
// controls, and passed it. The labsheet said the clones should be WHITE — the amilGFP is cut out
// in that reaction — and they were not. "I did not re-read the labsheet and note that the colonies
// should be white… it is also the context of the labsheet that is missing from the review
// process." The student was told how many to pick and to photograph the plates, never which
// colonies. The reviewer saw the photo and no statement of what a correct colony looks like.

const CF = 'PCR\tbo1\tbo2\tpS\tfrag\nTransform\tfrag\tMach1\tErm\t37\tpX\n';
const chz = (pickLine) => ({ name: 'pX', characterization: true,
  text: `Retransform\tpX\thost=L.lactis antibiotic=Erm\tpX_h\n${pickLine}` });

describe('a Pick without a phenotype does not compile', () => {
  it('is refused, and the refusal names the field and why nothing can infer it', () => {
    const r = parseCharacterization('Pick\tpX\tn=4 clone=Mach1/pX\tpX_c\n', 'Characterization of pX.txt');
    expect(r.problems.length).toBe(1);
    expect(r.problems[0].code).toBe('PICK_WITHOUT_PHENOTYPE');
    expect(r.problems[0].message).toMatch(/phenotype=/);
    expect(r.problems[0].message).toMatch(/judgement about this experiment/);
  });

  it('produces NO step — a refused line must not compile a sheet anyway', () => {
    const r = parseCharacterization('Pick\tpX\tn=4 clone=Mach1/pX\tpX_c\n');
    expect(r.steps.length).toBe(0);
  });

  it('an EMPTY phenotype is not a declared one', () => {
    // `phenotype=` with nothing after it would otherwise read as "stated, and the answer is
    // nothing" — the absence-as-zero failure, on the one field that exists to prevent it.
    for (const v of ['phenotype=', 'phenotype=   ']) {
      const r = parseCharacterization(`Pick\tpX\tn=4 ${v} clone=Mach1/pX\tpX_c\n`);
      expect(r.problems[0]?.code, v).toBe('PICK_WITHOUT_PHENOTYPE');
    }
  });

  it('only PICK is affected — a miniprep has no colonies to choose between', () => {
    const r = parseCharacterization('Miniprep\tpX_c\tclone=pX box=B\tpX_dna\n');
    expect(r.problems).toEqual([]);
    expect(r.steps.length).toBe(1);
  });

  it('accepts prose, because the relevant phenotype is contextual', () => {
    // "we wouldn't be saying 'pick big colonies' as size in this experiment isn't explicitly
    // relevant" — so this is free text and never a vocabulary.
    const r = parseCharacterization(
      'Pick\tpX\tn=4 phenotype=white, kanamycin-resistant clone=Mach1/pX\tpX_c\n');
    expect(r.problems).toEqual([]);
    expect(r.steps[0].args.phenotype).toBe('white, kanamycin-resistant');
  });
});

describe('the sheet tells the student which colonies, before how many', () => {
  // THE CHARACTERIZATION PICK, NOT THE CLONING ONE. A plan has TWO pick sheets — the injected
  // cloning pick off the transformation, and the authored one off the retransform — and
  // `find(op === 'pick')` returns the first, which is the injected one and carries no phenotype.
  // Picking it made this test fail for the right reason and measure the wrong sheet.
  const sheetFor = (pickLine) => {
    const out = planExperiment({ cfs: [{ name: 'pX', text: CF }, chz(pickLine)] });
    const bin = out.sheets.filter((s) => s.operation === 'pick')
                          .find((s) => ((s.samples || [])[0]?.inputs || []).includes('pX_h'));
    return applyDesign(bin, () => undefined,
      { label: Object.assign(() => 'X', { of: () => null, hold: () => {} }) });
  };

  it('renders the phenotype as a note', () => {
    const d = sheetFor('Pick\tpX_h\tn=4 phenotype=white, kanamycin-resistant '
                     + 'criteria=go with 2 clone=L.lactis/pX\tpX_c\n');
    const notes = JSON.stringify(d);
    expect(notes).toMatch(/Pick only colonies that are white, kanamycin-resistant/);
  });

  it('and puts it BEFORE the count — the count is meaningless without it', () => {
    const d = sheetFor('Pick\tpX_h\tn=4 phenotype=white, kanamycin-resistant '
                     + 'criteria=go with 2 clone=L.lactis/pX\tpX_c\n');
    const notes = d.notes || [];
    const iPheno = notes.findIndex((t) => /Pick only colonies that are/.test(t));
    const iCount = notes.findIndex((t) => /How many to pick/.test(t));
    expect(iCount, 'the count note is missing').toBeGreaterThanOrEqual(0);
    // FIRST, not merely before the count. `toBeLessThan(iCount)` passed with the note appended
    // rather than unshifted, because the count note is written after it either way — so the
    // assertion agreed with both orders and measured nothing. Index 0 is the actual intent:
    // before the layout too, because which colonies precedes everything about how many.
    expect(iPheno, 'the phenotype note is not first').toBe(0);
  });

  it('says what to do when NOTHING on the plate matches', () => {
    // Otherwise the instruction "pick 4 that are white" on a plate of green ones is answered by
    // picking the four least-green, which is the failure it exists to prevent.
    const d = sheetFor('Pick\tpX_h\tn=4 phenotype=white clone=L.lactis/pX\tpX_c\n');
    expect(JSON.stringify(d)).toMatch(/photograph the plate and say so/);
  });
});
