import { describe, it, expect } from 'vitest';
import { enumerate, countMembers, TooLarge } from 'src/library/enumerate.js';
import { readPool } from 'src/library/readPool.js';
import { dsDNA } from 'src/C6-Seq.js';

/**
 * §8b — enumeration as a separate instrument, never part of simulation.
 *
 * The tests that matter are the three OUTCOMES staying distinct. "Too large", "no bin declared" and
 * "no members" are three different findings, and rendering any two of them alike is how somebody
 * concludes a library is empty when it is merely enormous.
 */

function sparse() {
  // Two slots, correlated: three members, NOT the 3x3 their bins would give independently.
  const p = dsDNA('AAAA' + 'NNN' + 'CCCC' + 'NN' + 'GGGG');
  p.slots = [{ name: 'x', start: 4, end: 7, lengths: [3, 3], bin: ['TTT', 'ATA', 'CGC'], cols: ['x'] },
             { name: 'y', start: 11, end: 13, lengths: [2, 2], bin: ['GG', 'TT'], cols: ['y'] }];
  p.occupancy = { rows: [{ x: 'TTT', y: 'GG' }, { x: 'ATA', y: 'TT' }, { x: 'CGC', y: 'GG' }] };
  return p;
}

function dense() {
  const p = dsDNA('AAAA' + 'NNN' + 'CCCC' + 'NN' + 'GGGG');
  p.slots = [{ name: 'x', start: 4, end: 7, lengths: [3, 3], bin: ['TTT', 'ATA', 'CGC'] },
             { name: 'y', start: 11, end: 13, lengths: [2, 2], bin: ['GG', 'TT'] }];
  p.occupancy = 'dense';
  return p;
}

describe('an ordinary molecule is a library of one', () => {
  it('returns itself, not an empty list', () => {
    const r = enumerate(dsDNA('ATGCATGC'));
    expect(r.total).toBe(1);
    expect(r.members[0].sequence).toBe('ATGCATGC');
  });
});

describe('a sparse library enumerates its MEMBERS, not its slot combinations', () => {
  it('gives 3, not the 6 its bins would give independently', () => {
    // This is the whole sparse/dense distinction. Enumerating the slots independently would
    // produce molecules that were never synthesised.
    expect(enumerate(sparse()).total).toBe(3);
    expect(enumerate(dense()).total).toBe(6);
  });

  it('rebuilds each member by substituting its own row', () => {
    const m = enumerate(sparse()).members;
    expect(m.map((x) => x.sequence)).toEqual([
      'AAAATTTCCCCGGGGGG', 'AAAAATACCCCTTGGGG', 'AAAACGCCCCCGGGGGG']);
  });

  it('keeps each member paired with the row it came from', () => {
    expect(enumerate(sparse()).members[1].row).toEqual({ x: 'ATA', y: 'TT' });
  });
});

describe('a dense library is the cross product of its bins', () => {
  it('builds every combination', () => {
    const r = enumerate(dense());
    expect(r.total).toBe(6);
    expect(new Set(r.members.map((m) => m.sequence)).size).toBe(6);
  });

  it('counts without building', () => {
    expect(countMembers(dense())).toBe(6);
    expect(countMembers(sparse())).toBe(3);
  });
});

describe('the three refusals stay three different findings', () => {
  it('TOO LARGE reports the count, so nobody reads it as empty', () => {
    const big = dense();
    big.slots[0].bin = Array.from({ length: 500 }, (_, i) => String(i).padStart(3, '0'));
    big.slots[1].bin = Array.from({ length: 500 }, (_, i) => String(i).padStart(2, '0').slice(0, 2));
    let err;
    try { enumerate(big, { limit: 100 }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(TooLarge);
    expect(err.message).toMatch(/That is a fact about the library, not an empty one/);
  });

  it('NO BIN is a different message from too large', () => {
    const p = dense();
    delete p.slots[0].bin;
    expect(() => enumerate(p)).toThrow(/has no declared bin, so nobody has said what its contents are/);
    expect(() => enumerate(p)).not.toThrow(/over the limit/);
  });

  it('a sample is returned instead of a refusal when one is asked for', () => {
    const big = dense();
    big.slots[0].bin = Array.from({ length: 500 }, (_, i) => `x${i}`);
    const r = enumerate(big, { limit: 10, sample: 7 });
    expect(r.sampled).toBe(7);
    expect(r.members).toHaveLength(7);
    expect(r.total).toBe(1000);        // the true size is still reported
  });
});

describe('against a real pool file', () => {
  it('reconstructs Demo.gb from its skeleton and bins', () => {
    const pool = readPool('test/fixtures/pool/Demo.gb');
    const p = dsDNA(pool.sequence);
    p.slots = pool.slots; p.occupancy = pool.occupancy;
    const r = enumerate(p);
    // Three rows, two of which share an alpha value -- so the members are 3, not 2 x 2.
    expect(r.total).toBe(3);
    for (const m of r.members) expect(m.sequence).not.toMatch(/N/);
  });
});
