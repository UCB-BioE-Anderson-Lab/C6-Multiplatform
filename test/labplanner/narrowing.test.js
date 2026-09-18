import { describe, it, expect } from 'vitest';
import { parseCharacterization } from '../../src/labplanner/validate/characterizationFile.js';
import { planExperiment, FATAL } from '../../src/labplanner/planning/planExperiment.js';
import { applyDesign } from '../../src/labplanner/design/index.js';

// A SCREEN MEASURES EVERYTHING AND CARRIES A HANDFUL FORWARD, and until this ran the
// characterization grammar could not say so. Every step below a Pick was one-to-one with it, so a
// 96-well screen compiled to ninety-six minipreps and ninety-six sequencing reactions.
//
// JCA, 2026-09-18, describing the Tlib3 characterization sequence: *"pick a bunch of colonies into
// a 96-well plate (up to 96 of them) / run the tecan, reduce it to a sorted list with distribution
// shown in a histogram / checkpoint to consult jca and get go-no-go decision on proceeding / then
// Im guessing we miniprep and sequence the up-to-8 top hits?"*
//
// The narrowing is the last step of that, and the criterion is the sentence the whole result turns
// on — Tlib2 sequenced its eighteen whitest clones out of forty measured, which answers a
// different question than eighteen spanning the range, and nothing on paper recorded which
// question was being asked.

const CF = 'PCR\tbo1\tbo2\tpS\tfrag\nTransform\tfrag\tMach1\tAmp\t37\tpX\n';

const chz = (text) => ({ name: 'pX', characterization: true, text });

const SCREEN = (minirepLine) => chz(
  'Pick\tpX\tn=96 library=true phenotype=any colony, ampicillin-resistant vessel=96-well '
  + 'medium=2YT+Amp volume=0.5 clone=pX\tpX_clones\n'
  + 'Culture\tpX_clones\tmedium=2YT+Amp vessel=96-well volume=0.5 temp=37 to=saturation\tpX_cult\n'
  + 'Assay\tpX_cult\tprotocol=plate_reader_fluorescence ex=483 em=525 od=600\tpX_assay\n'
  + 'Analysis\tpX_assay\tverifies=pX expects=percent of the control\tpX_ranked\n'
  + minirepLine);

const MINIPREP_8 = 'Miniprep\tpX_ranked\tn=8 criteria=the 8 lowest on the sorted list '
                 + 'clone=pX box=B\tpX_dna\n';

const plan = (cf) => planExperiment({ cfs: [{ name: 'pX', text: CF }, cf] });

const sheetFor = (out, op) => {
  const bin = out.sheets.filter((s) => s.operation === op).at(-1);
  return applyDesign(bin, () => undefined,
    { label: Object.assign(() => 'X', { of: () => null, hold: () => {}, derived: () => '' }) });
};

describe('n= below a fan carries only that many clones forward', () => {
  it('eight minipreps, not ninety-six', () => {
    const out = plan(SCREEN(MINIPREP_8));
    const rows = out.sheets.filter((s) => s.operation === 'miniprep')
                           .flatMap((s) => s.samples || []);
    expect(rows.length).toBe(8);
    expect(rows.map((r) => r.output)).toEqual(
      ['pX-A', 'pX-B', 'pX-C', 'pX-D', 'pX-E', 'pX-F', 'pX-G', 'pX-H']);
  });

  it('and the sequencing below it follows the eight, not the ninety-six', () => {
    const out = plan(SCREEN(MINIPREP_8 + 'Sequencing\tpX_dna\toligo=o1 reads=F\tpX_reads\n'));
    const rows = out.sheets.filter((s) => s.operation === 'sequencing')
                           .flatMap((s) => s.samples || []);
    expect(rows.length).toBe(8);
  });

  it('the source well is BLANK, because the choice is made after this sheet was compiled', () => {
    // Printing `pX_ranked` on all eight rows — the name of the SET — was the behaviour before
    // this: a column that names no well and no tube, identical on every row.
    const d = sheetFor(plan(SCREEN(MINIPREP_8)), 'miniprep');
    expect(d.columns.length).toBe(8);
    for (const row of d.columns) {
      // Present and empty, not absent: the column has to be THERE for somebody to write in.
      expect(Object.prototype.hasOwnProperty.call(row, 'from')).toBe(true);
      expect(row.from).toBe('');
    }
  });

  it('and the rule for filling it in is on the same page, with its denominator', () => {
    const d = sheetFor(plan(SCREEN(MINIPREP_8)), 'miniprep');
    expect((d.notes || [])[0]).toBe('Choose 8 of the 96 clones: the 8 lowest on the sorted list.');
  });

  it('the denominator is found ACROSS the culture, assay and analysis between them', () => {
    // `clonesInBlock` looks one hop and finds a pick; a screen has three per-construct steps in
    // between, so one hop found nothing and the note had no "of 96" to print.
    const d = sheetFor(plan(SCREEN(MINIPREP_8)), 'miniprep');
    expect(JSON.stringify(d.notes)).toMatch(/of the 96 clones/);
  });
});

describe('what it does NOT change', () => {
  it('a miniprep with no n= still renames one-to-one', () => {
    const out = plan(chz('Pick\tpX\tn=4 phenotype=white clone=Mach1/pX\tpX_c\n'
                       + 'Miniprep\tpX_c\tclone=pX box=B\tpX_dna\n'));
    const rows = out.sheets.filter((s) => s.operation === 'miniprep')
                           .flatMap((s) => s.samples || []);
    expect(rows.length).toBe(4);
    expect(rows.map((r) => r.output)).toEqual(['pX-A', 'pX-B', 'pX-C', 'pX-D']);
  });

  it('an n= that is NOT smaller than the fan above it is the one-to-one case', () => {
    // Only narrowing. `n=4` under a 4-clone pick must keep the pick's own designations rather
    // than mint fresh ones and blank the source.
    const out = plan(chz('Pick\tpX\tn=4 phenotype=white clone=Mach1/pX\tpX_c\n'
                       + 'Miniprep\tpX_c\tn=4 criteria=all of them clone=pX box=B\tpX_dna\n'));
    const rows = out.sheets.filter((s) => s.operation === 'miniprep')
                           .flatMap((s) => s.samples || []);
    expect(rows.length).toBe(4);
    const d = sheetFor(out, 'miniprep');
    expect(d.columns.some((r) => r.from === '')).toBe(false);
  });
});

describe('a narrowing that will not say which ones does not compile', () => {
  it('is refused, and the refusal shows both kinds of answer', () => {
    const r = parseCharacterization('Miniprep\tpX_ranked\tn=8 clone=pX box=B\tpX_dna\n',
                                    'Characterization of pX.txt');
    expect(r.problems.length).toBe(1);
    expect(r.problems[0].code).toBe('NARROWING_WITHOUT_CRITERIA');
    expect(r.problems[0].message).toMatch(/8 lowest/);
    expect(r.problems[0].message).toMatch(/spanning the range/);
  });

  it('produces NO step, and the code is fatal', () => {
    const r = parseCharacterization('Miniprep\tpX_ranked\tn=8 clone=pX box=B\tpX_dna\n');
    expect(r.steps.length).toBe(0);
    expect(FATAL.has('NARROWING_WITHOUT_CRITERIA')).toBe(true);
  });

  it('an EMPTY criteria= is not a stated one', () => {
    for (const v of ['criteria=', 'criteria=   ']) {
      const r = parseCharacterization(`Miniprep\tpX_r\tn=8 ${v} clone=pX box=B\tpX_dna\n`);
      expect(r.problems[0]?.code, v).toBe('NARROWING_WITHOUT_CRITERIA');
    }
  });

  it('a PICK with n= and no criteria is untouched — it is not narrowing anything', () => {
    const r = parseCharacterization('Pick\tpX\tn=96 phenotype=any colony clone=pX\tpX_c\n');
    expect(r.problems).toEqual([]);
  });
});

describe('an analysis of measurements is not an analysis of reads', () => {
  it('is titled for the work it is, and carries no read verdicts', () => {
    // It used to print "Sequence analysis" over a Tecan session, telling somebody to align every
    // read against the intended sequence and score it Perfect or Missense — for 96 fluorescence
    // readings.
    const d = sheetFor(plan(SCREEN(MINIPREP_8)), 'analysis');
    expect(d.title).toBe('Assay analysis');
    const page = JSON.stringify(d);
    expect(page).not.toMatch(/Missense Mutation/);
    expect(page).not.toMatch(/Align every read/);
  });

  it('says to normalise to OD first, and to mark the floor', () => {
    const d = sheetFor(plan(SCREEN(MINIPREP_8)), 'analysis');
    const notes = JSON.stringify(d.notes);
    expect(notes).toMatch(/fluorescence by its own OD600 first/);
    expect(notes).toMatch(/cannot be ranked against each other/);
  });

  it('asks for the sorted list AND the histogram, which is the go‑no‑go evidence', () => {
    const page = JSON.stringify(sheetFor(plan(SCREEN(MINIPREP_8)), 'analysis'));
    expect(page).toMatch(/sorted list/);
    expect(page).toMatch(/histogram/);
  });

  it('an analysis over READS is unchanged', () => {
    const out = plan(chz('Pick\tpX\tn=4 phenotype=white clone=Mach1/pX\tpX_c\n'
                       + 'Miniprep\tpX_c\tclone=pX box=B\tpX_dna\n'
                       + 'Sequencing\tpX_dna\toligo=o1 reads=F\tpX_reads\n'
                       + 'Analysis\tpX_reads\tverifies=pX\tpX_verdict\n'));
    const d = sheetFor(out, 'analysis');
    expect(d.title).toBe('Sequence analysis');
    expect(JSON.stringify(d)).toMatch(/Missense Mutation/);
  });
});
