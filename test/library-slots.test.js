import { describe, it, expect } from 'vitest';
import { hasSlots, slotsOverlapping, assertNoSlotInFootprint, lengthRange } from 'src/library/slots.js';
import { dsDNA } from 'src/C6-Seq.js';

/**
 * The guard from docs/OLIGOPOOL-SPEC.md §7.2, tested against Tlib3's real geometry.
 *
 * THE POINT OF THIS FILE IS THE THROWING CASES. A guard that has only ever been seen to pass is a
 * claim, not an enforcer — the failure this whole module exists to prevent is an untaught operation
 * answering confidently for a library, and that failure is INVISIBLE unless the refusal is
 * exercised on purpose.
 */

// Tlib3's real geometry, from Pimar/experiments/TPcon6/Tlib3/data/tlib3_constructs.tsv.
// 180 members; skeleton constant in all of them; slot bounds are the mean-span N-runs.
function tlib3() {
  const p = dsDNA('A'.repeat(42) + 'N'.repeat(85) + 'C'.repeat(42) + 'N'.repeat(20)
                + 'G'.repeat(22) + 'N'.repeat(22) + 'T'.repeat(22));
  p.slots = [
    { name: 'cassette', start: 42,  end: 127, lengths: [73, 98] },
    { name: 'tail',     start: 169, end: 189, lengths: [19, 22] },
    { name: 'index',    start: 211, end: 233, lengths: [22, 22] },
  ];
  p.occupancy = { source: 'data/tlib3_constructs.tsv', rows: new Array(180) };
  return p;
}

describe('a plain Polynucleotide is the zero-slot case', () => {
  it('has no slots and is not a library', () => {
    const p = dsDNA('ATGCATGCATGC');
    expect(p.slots).toBeNull();
    expect(p.occupancy).toBeNull();
    expect(hasSlots(p)).toBe(false);
  });

  it('never refuses, wherever the footprint falls', () => {
    const p = dsDNA('ATGCATGCATGC');
    expect(() => assertNoSlotInFootprint(p, 0, 12, 'Gibson')).not.toThrow();
  });

  it('reports its own length as an exact range — one molecule IS its range', () => {
    expect(lengthRange(dsDNA('ATGCATGCATGC')))
      .toEqual({ min: 12, max: 12, exact: true, bound: 'tight' });
  });
});

describe('a slot outside the footprint passes through — the case that must NOT refuse', () => {
  it('lets a constant-region footprint through', () => {
    // The 5' head, 0-42: all constant. This is a Gibson junction on a library and it must work.
    expect(() => assertNoSlotInFootprint(tlib3(), 0, 42, 'Gibson')).not.toThrow();
    expect(slotsOverlapping(tlib3(), 0, 42)).toEqual([]);
  });

  it('lets the 3\' constant tail through', () => {
    expect(() => assertNoSlotInFootprint(tlib3(), 233, 255, 'PCR')).not.toThrow();
  });
});

describe('a slot INSIDE the footprint refuses, by name', () => {
  it('throws when the footprint lands in the index slot', () => {
    expect(() => assertNoSlotInFootprint(tlib3(), 211, 233, 'PCR', "the primer's annealing footprint"))
      .toThrow(/variable slot "index" \(211-233\)/);
  });

  it('names the operation and points at the spec, not at the user\'s file', () => {
    let msg = '';
    try { assertNoSlotInFootprint(tlib3(), 45, 60, 'GoldenGate'); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/GoldenGate cannot yet resolve a library here/);
    expect(msg).toMatch(/OLIGOPOOL-SPEC\.md/);
    // The distinction the guard exists to preserve: a missing CAPABILITY, not a broken library.
    expect(msg).not.toMatch(/invalid|corrupt|broken/i);
  });

  it('names every slot when a footprint spans more than one', () => {
    let msg = '';
    try { assertNoSlotInFootprint(tlib3(), 100, 220, 'Digest'); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/slots .*cassette.*tail.*index/);
  });

  it('catches a footprint that only CLIPS a slot edge by one base', () => {
    // Off-by-one here is the whole failure: 42 is the first base of `cassette`.
    expect(() => assertNoSlotInFootprint(tlib3(), 20, 43, 'Gibson')).toThrow(/cassette/);
    expect(() => assertNoSlotInFootprint(tlib3(), 20, 42, 'Gibson')).not.toThrow();
  });
});

describe('length on a library is a range, because the sequence length is a mean', () => {
  /**
   * THE ONE-BASE GAP HERE IS THE POINT, and it is measured, not invented. Slot-bound arithmetic
   * gives 242-270. The 180 real members span 243-270, because the member with the shortest cassette
   * (73 nt) carries a 21 nt tail rather than the shortest one (19) — so the (73,19) corner of the
   * box is occupied by nothing.
   *
   * A sparse library is a SUBSET of its combinatorial space, so summing each slot's extremes bounds
   * it rather than measuring it. A test asserting 243 would be asserting a fact this function
   * cannot know without the member list.
   */
  it('bounds Tlib3 at 242-270, one base wider than the real 243-270', () => {
    expect(lengthRange(tlib3())).toMatchObject({ min: 242, max: 270, bound: 'outer' });
  });

  it('calls a sparse range an OUTER bound, not a measurement', () => {
    expect(lengthRange(tlib3()).bound).toBe('outer');
  });

  it('calls a dense range tight, because every corner is occupied', () => {
    const dense = tlib3(); dense.occupancy = 'dense';
    expect(lengthRange(dense).bound).toBe('tight');
  });

  it('marks itself inexact, so nothing builds an exact assertion on it', () => {
    expect(lengthRange(tlib3()).exact).toBe(false);
  });
});
