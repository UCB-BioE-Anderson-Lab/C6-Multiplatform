// Gel, cleanup and transformation controls — the steps a construction file does not contain and
// a labsheet must.
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
    expect(t.controls.map((c) => c.kind)).toEqual(['plate', 'positive', 'negative']);
    // without these, a blank plate has four causes and no way to tell them apart
    expect(t.controls[0].what).toContain('S1');
    expect(new Set(t.controls.map((c) => c.answers)).size).toBe(3);
  });

  it('names the right control stock for each antibiotic', () => {
    expect(CONTROL_STOCKS).toEqual({ kan: 'K1', spec: 'S1', erm: 'E1', cam: 'C1', carb: 'A1' });
    expect(tr('kanamycin').controls[0].what).toContain('K1');
    expect(tr('chloramphenicol').controls[0].what).toContain('C1');
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
