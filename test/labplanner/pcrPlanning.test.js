// The PCR stage: product size, thermocycler program, mastermix composition.
//
// JCA, 2026-09-10: *"simulate the cf, look at the pcr product, get its size. Divide by 1000 and
// round up. That number is x. Insert that number into 'PGxK55'… When doing degenerate oligos
// (not all bases in the oligos are in [ATCG]), I will typically use a 45 degree anneal instead…
// For really short sequences, like <250 bp, I would recommend a Taq reaction instead of
// primestar… The recipe is different for taq too."*
//
// All of it is exact, which is why it is code. Every test below is a rule that has one right
// answer for everybody.
import { describe, it, expect } from 'vitest';
import { annotatePCRPrograms, isDegenerate, SHORT_BP } from '../../src/labplanner/planning/choosePCRProgram.js';
import { makeMastermixPlan, PRIMESTAR_50, TAQ_50 } from '../../src/labplanner/planning/makeMastermixPlan.js';
import { MASTERMIX_THRESHOLD } from '../../src/labplanner/planning/config.js';

const pcr = (output, productBp, oligos = ['oF', 'oR'], args = {}) =>
  ({ operation: 'pcr', cf: 'A', line: 1, output, productBp, oligos, args });
const CLEAN = { oF: 'ACGTACGTACGTACGTACGT', oR: 'TTTTGGGGCCCCAAAATTTT' };
const DEGEN = { ...CLEAN, oN: 'ACGTNNNNACGTACGTACGT' };

describe('thermocycler program', () => {
  it('divides by 1000 and rounds UP', () => {
    const cases = [[1, 1], [999, 1], [1000, 1], [1001, 2], [5081, 6]];
    for (const [bp, kb] of cases) {
      const [j] = annotatePCRPrograms([pcr('p', bp)], { sequences: { oligos: CLEAN } });
      if (bp >= SHORT_BP) expect(j.program, `${bp} bp`).toBe(`PG${kb}K55`);
    }
  });

  it('anneals degenerate oligos at 45, not 55', () => {
    const [j] = annotatePCRPrograms([pcr('p', 3000, ['oF', 'oN'])], { sequences: { oligos: DEGEN } });
    expect(j.program).toBe('PG3K45');
  });

  it('recognises any IUPAC ambiguity code, not just N', () => {
    expect(isDegenerate('aagnvwggrdtatacat')).toBe(true);   // a real SynThera oligo, oGho12
    expect(isDegenerate('ctgtaGGTCTCcgcgtgccatttacccccattcactg')).toBe(false);
    expect(isDegenerate('')).toBe(false);
  });

  it('switches to Taq below 250 bp, and says the recipe changes too', () => {
    const [j] = annotatePCRPrograms([pcr('p', 200)], { sequences: { oligos: CLEAN } });
    expect(j.chemistry).toBe('taq');
    expect(j.program).toBe('55');                 // the bare numeric programs are the Taq ones
    expect(j.programNote).toMatch(/enzyme and buffer/);
  });

  it('a short degenerate product gets the Taq 45 program', () => {
    const [j] = annotatePCRPrograms([pcr('p', 100, ['oF', 'oN'])], { sequences: { oligos: DEGEN } });
    expect(j.chemistry).toBe('taq');
    expect(j.program).toBe('45');
  });

  it('refuses to invent a program when the size is unknown', () => {
    // SynThera's pGhost17 cannot be simulated — C6 requires an exact 18 nt 3' match and its
    // mutagenic primers put a designed base inside that window. A default of 1 kb here would
    // set an extension time wrong by 8 kb on a product that is in the freezer.
    const [j] = annotatePCRPrograms([{ ...pcr('p', null), sizeNote: 'does not anneal' }],
                                    { sequences: { oligos: CLEAN } });
    expect(j.program).toBeNull();
    expect(j.programNote).toMatch(/cannot be computed/);
  });

  it('does not call an oligo clean just because its sequence is missing', () => {
    // Concluding "not degenerate" from an empty list anneals a library at 55 °C — the exact
    // failure this annotation exists to prevent, arriving silently.
    const [j] = annotatePCRPrograms([pcr('p', 3000, ['oF', 'oUnknown'])],
                                    { sequences: { oligos: CLEAN } });
    expect(j.programNote).toMatch(/could not be checked/);
  });
});

describe('mastermix', () => {
  const jobs = (n, vary) => Array.from({ length: n }, (_, i) => pcr(`p${i}`, 3000, ['oF', 'oR'], {
    forward_oligo: 'oF', reverse_oligo: 'oR',
    template: vary === 'template' ? `t${i}` : 'tSame',
  }));

  it(`is used at ${MASTERMIX_THRESHOLD} samples and not at ${MASTERMIX_THRESHOLD - 1}`, () => {
    // JCA ruled `>=4`; two earlier statements disagreed at exactly this number.
    expect(makeMastermixPlan(jobs(MASTERMIX_THRESHOLD - 1, 'template')).mastermix).toBe(false);
    expect(makeMastermixPlan(jobs(MASTERMIX_THRESHOLD, 'template')).mastermix).toBe(true);
  });

  it('puts everything but the template in the mix when only the template differs', () => {
    const p = makeMastermixPlan(jobs(6, 'template'));
    expect(p.shared.map((c) => c.key)).toEqual(['water', 'buffer', 'dNTP', 'primer1', 'primer2', 'enzyme']);
    expect(p.perTube.map((c) => c.key)).toEqual(['template']);
  });

  it('keeps a primer out of the mix when the primers differ too', () => {
    const js = jobs(5, 'template').map((j, i) => ({ ...j, args: { ...j.args, forward_oligo: `o${i}` } }));
    const p = makeMastermixPlan(js);
    expect(p.perTube.map((c) => c.key).sort()).toEqual(['primer1', 'template']);
    expect(p.shared.map((c) => c.key)).toContain('primer2');
  });

  it('scales by count times excess', () => {
    const p = makeMastermixPlan(jobs(5, 'template'), { excess: 1.1 });
    const water = p.shared.find((c) => c.key === 'water');
    expect(water.totalUL).toBe(176);            // 32 uL x 5 x 1.1
  });

  it('does not share a component just because nobody recorded its value', () => {
    // An empty field on every job makes a set of one member — "" — and the component would join
    // the mix on the strength of nothing being written down.
    const js = Array.from({ length: 5 }, (_, i) => pcr(`p${i}`, 3000, ['oF', 'oR'], {}));
    const p = makeMastermixPlan(js);
    expect(p.perTube.map((c) => c.key).sort()).toEqual(['primer1', 'primer2', 'template']);
  });

  it('explains itself, because the composition is the thing a human checks', () => {
    expect(makeMastermixPlan(jobs(6, 'template')).why).toMatch(/template.*differ/);
    expect(makeMastermixPlan(jobs(2, 'template')).why).toMatch(/individually/);
  });

  it('the 50 uL PrimeSTAR reaction still adds to 50', () => {
    expect(PRIMESTAR_50.reduce((s, c) => s + c.uL, 0)).toBe(50);
  });

  it('the Taq reaction adds to 50, with water making up the balance', () => {
    // JCA, 2026-09-10: 5 buffer + 5 dNTP + 1 + 1 + 1 template + 1 enzyme, "up to 50 uL with
    // ddH2O". 14 named, so 36 water.
    expect(TAQ_50.reduce((s, c) => s + c.uL, 0)).toBe(50);
    expect(TAQ_50.find((c) => c.key === 'water').uL).toBe(36);
  });

  it('uses the Taq recipe for a Taq bin, not the PrimeSTAR one', () => {
    const taq = Array.from({ length: 4 }, (_, i) => ({
      ...pcr(`p${i}`, 200), chemistry: 'taq',
      args: { forward_oligo: 'oF', reverse_oligo: 'oR', template: `t${i}` } }));
    const p = makeMastermixPlan(taq);
    expect(p.shared.find((c) => c.key === 'buffer').totalUL).toBe(22);     // 5 x 4 x 1.1
    expect(p.shared.find((c) => c.key === 'water').totalUL).toBe(158.4);   // 36 x 4 x 1.1
  });

  it('refuses to mastermix a bin that is not all one chemistry', () => {
    // choosePCRProgram picks chemistry per PRODUCT SIZE, so a bin can hold a 200 bp and a 5 kb
    // amplicon. Averaging two buffers into one mastermix column would look entirely fine on the
    // page and be wrong in every tube.
    const mixed = [
      { ...pcr('a', 200), chemistry: 'taq', args: { template: 't1' } },
      { ...pcr('b', 5000), chemistry: 'primestar', args: { template: 't2' } },
      { ...pcr('c', 5000), chemistry: 'primestar', args: { template: 't3' } },
      { ...pcr('d', 5000), chemistry: 'primestar', args: { template: 't4' } },
    ];
    const p = makeMastermixPlan(mixed);
    expect(p.mastermix).toBe(false);
    expect(p.mixedChemistry.sort()).toEqual(['primestar', 'taq']);
    expect(p.why).toMatch(/Split them/);
  });
});
