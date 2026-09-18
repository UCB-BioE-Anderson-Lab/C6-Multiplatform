// Gel, cleanup and transformation controls — the steps a construction file does not contain and
// a labsheet must.
import fs from 'node:fs';
import { describe, it, expect } from 'vitest';
import { injectGelJobs } from '../../src/labplanner/planning/injectGel.js';
import { injectCleanupJobs, cleanupName } from '../../src/labplanner/planning/injectCleanup.js';
import { applyTransformRecoveryNotes, normalizeAntibiotic, CONTROL_STOCKS }
  from '../../src/labplanner/planning/injectTransformRecovery.js';

const pcrBin = (jobs) => ({ operation: 'pcr', round: 0, rounds: 1, depth: 0, cfs: ['A'], jobs });
const job = (output, productBp, extra = {}) =>
  ({ operation: 'pcr', cf: 'A', line: 1, output, productBp, ...extra });

describe('gel', () => {
  it('puts one lane per product, with the size from the simulation', () => {
    const bins = injectGelJobs([pcrBin([job('p1', 1500), job('p2', 800)])]);
    const gel = bins.find((b) => b.operation === 'gel');
    expect(gel.lanes.map((l) => [l.sample, l.expectedBp])).toEqual([['p1', 1500], ['p2', 800]]);
  });

  it('says out loud when a size could not be computed', () => {
    // A blank column reads as "no band expected", which is the opposite of "we do not know".
    const bins = injectGelJobs([pcrBin([job('p1', null, { sizeNote: 'does not anneal' })])]);
    const gel = bins.find((b) => b.operation === 'gel');
    expect(gel.lanes[0].expectedBp).toBeNull();
    expect(gel.lanes[0].note).toMatch(/does not anneal/);
    expect(gel.unknownSizes).toBe(1);
  });

  it('always carries a gel checkpoint', () => {
    const gel = injectGelJobs([pcrBin([job('p1', 100)])]).find((b) => b.operation === 'gel');
    expect(gel.checkpoint.type).toBe('checkpoint.gel');
  });

  it('comes immediately after its PCR and before the cleanup', () => {
    // Every SynThera packet runs pcr -> gel -> zymo: the gel asks whether the reaction worked,
    // the cleanup prepares what worked. The planner skeleton said the opposite.
    let bins = injectGelJobs([pcrBin([job('p1', 100)])]);
    bins = injectCleanupJobs(bins);
    expect(bins.map((b) => b.operation)).toEqual(['pcr', 'gel', 'zymo']);
  });
});

describe('cleanup', () => {
  it('names tubes so the next sheet can refer to them without a lookup', () => {
    expect(cleanupName('pcr15')).toBe('zpcr15');
    const z = injectCleanupJobs([pcrBin([job('pcr15', 100)])]).find((b) => b.operation === 'zymo');
    expect(z.tubes).toEqual([{ from: 'pcr15', to: 'zpcr15', cf: 'A' }]);
  });
});

describe('transformation', () => {
  const tr = (antibiotics, extra = {}) => applyTransformRecoveryNotes([{
    operation: 'transform', cf: 'A', line: 1, output: 'p', dnaInputs: ['dna'],
    args: { dna: 'dna', strain: 'Mach1', antibiotics }, ...extra }])[0];

  it('needs no rescue for carb or amp', () => {
    for (const a of ['Carb', 'amp', 'Ampicillin', 'carbenicillin']) {
      expect(tr(a).rescue, a).toBe(false);
      expect(tr(a).controls).toHaveLength(0);
    }
  });

  it('injects a rescue step for everything else', () => {
    for (const a of ['Spec', 'kan', 'Cam', 'erythromycin']) expect(tr(a).rescue, a).toBe(true);
  });

  it('injects three controls, each answering a different question', () => {
    const t = tr('Spec');
    expect(t.controls.map((c) => c.kind)).toEqual(['positive', 'negative', 'restreak']);
    // without these, a blank plate has four causes and no way to tell them apart
    expect(new Set(t.controls.map((c) => c.answers)).size).toBe(3);
  });

  it('tells the restreak apart from the positive control', () => {
    // JCA, 2026-09-12: *"you are missing the restreak control — the third of the set where they
    // streak out E1 cells (from the controls stocks) onto a erytho plate to confirm that the
    // cells *could* grow on the plates."* They use different material and answer different
    // questions: the positive control transforms the PLASMID into this batch of competent cells;
    // the restreak streaks CELLS that already carry the resistance, and tests the plates.
    const t = tr('Spec');
    const by = Object.fromEntries(t.controls.map((c) => [c.kind, c]));
    expect(by.positive.dna).toContain('plasmid');
    expect(by.positive.strain).toBe(null);          // this batch of competent cells
    expect(by.restreak.dna).toContain('streak');
    expect(by.restreak.strain).toContain('cells');  // the control strain itself
    expect(by.restreak.what).not.toContain('transform');
  });

  // WHICH TUBE IS THE CONTROL IS A FACT ABOUT ONE LAB'S FREEZER, NOT ABOUT CLONING. `K1`, `S1`
  // and `E1` were literals in this module until 2026-09-12; they are the Anderson lab's, and the
  // next lab's are called something else and live somewhere else. JCA: *"what belongs in C6 would
  // be the generalized one... After that comes lab specific information injection by cortex."*
  it('has no control-stock table of its own', () => {
    expect(CONTROL_STOCKS).toEqual({});
  });

  it('still injects all three controls when no tube is named', () => {
    // The point of the plate is not its name. Dropping the control because nobody said what to
    // call the tube would lose the whole answer over a label.
    const t = tr('Spec');
    expect(t.controls).toHaveLength(3);
    expect(t.controls.map((c) => c.what).join(' ')).toContain('no tube is named');
    expect(t.controlStock).toBe(null);
  });

  it('uses the names the caller supplies', () => {
    const t = applyTransformRecoveryNotes(
      [{ operation: 'transform', cf: 'A', line: 1, output: 'p', dnaInputs: ['x'],
         args: { strain: 'Mach1', antibiotics: 'Spec', temperature: 37 } }],
      { controlStocks: { spec: 'S1' }, controlStocksWhere: 'the -80 control stocks box' })[0];
    expect(t.controls.map((c) => c.what).join(' ')).toContain('S1');
    expect(t.controls.find((c) => c.kind === 'restreak').what)
      .toContain('-80 control stocks box');
    expect(t.controlStock).toBe('S1');
  });

  it('finds the antibiotic in a generically-read step, where fields have no names', () => {
    // pGhost16's real CF uses `Assemble`, so parseCF rejects the file and every Transform input
    // arrives in one bucket: `Transform SL8 JTK145 AB Spec 37 pGhost16`.
    const t = applyTransformRecoveryNotes([{ operation: 'transform', cf: 'old', line: 4,
      output: 'pOut', dnaInputs: ['SL8', 'JTK145', 'AB', 'Spec', '37'], args: {} }])[0];
    expect(t.antibiotic).toBe('spec');
    expect(t.rescue).toBe(true);
  });

  it('an unreadable antibiotic is not treated as amp', () => {
    // Defaulting to no-rescue would plate a kanamycin transformation straight out of heat shock
    // and get nothing, for a reason the sheet would never mention.
    const t = tr('');
    expect(t.rescue).toBeNull();
    expect(t.controls).toHaveLength(0);
    expect(t.transformNote).toMatch(/by hand/);
  });

  it('normalizes the names a construction file actually uses', () => {
    expect(normalizeAntibiotic('Spec')).toBe('spec');
    expect(normalizeAntibiotic('CHLOR')).toBe('cam');
    expect(normalizeAntibiotic('Amp')).toBe('carb');
    expect(normalizeAntibiotic('')).toBeNull();
  });
});

/**
 * A flag's value is not a construction file.
 *
 * `c6-plan` picked its targets by filtering out `--flags` and the word after `--inventory` or
 * `--project` — a hand-written list inside the filter. Adding `--control-stocks` on 2026-09-12
 * made its JSON path a TARGET: `commonAncestor` climbed to the home directory to find a root
 * covering both it and the experiment, and `projectSequences` set off walking Dropbox and Google
 * Drive. Nothing failed. It simply never returned, which is the worst shape a bug can take in a
 * command somebody is waiting on.
 *
 * A flag list maintained in two places will be maintained in one.
 */
describe('c6-plan argument parsing', () => {
  it('treats every valued flag the same way', () => {
    const src = fs.readFileSync(new URL('../../bin/c6-plan', import.meta.url), 'utf8');
    const m = src.match(/const VALUED = new Set\(\[([^\]]*)\]\)/);
    expect(m, 'VALUED must be declared in one place').toBeTruthy();
    const declared = new Set(m[1].match(/'--[a-z-]+'/g).map((s) => s.replace(/'/g, '')));
    // Every flag this file reads a following word from must be in the set. Found by looking for
    // the two shapes that do it: indexOf(flag) + 1, and a helper that takes the next argument.
    const used = new Set([...src.matchAll(/indexOf\('(--[a-z-]+)'\)/g)].map((x) => x[1]));
    const valued = [...used].filter((f) => new RegExp(
      `indexOf\\('${f}'\\)[\\s\\S]{0,120}?(argv\\[i \\+ 1\\]|argv\\[[a-zA-Z]+ \\+ 1\\])`).test(src));
    for (const f of valued) expect(declared, `${f} takes a value`).toContain(f);
  });
});

