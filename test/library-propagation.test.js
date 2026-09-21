import { describe, it, expect } from 'vitest';
import { PCR } from 'src/C6-Sim.js';
import { dsDNA, oligo, revcomp } from 'src/C6-Seq.js';
import { sliceSlots, concatSlots, slotsAfterRevcomp, slotsAfterRotate, lengthRange }
  from 'src/library/slots.js';

/**
 * §5.3 — a library in is a library out.
 *
 * The failure this prevents is silent: without propagation an amplicon comes back with the right
 * BASES and none of the metadata, so the next step treats a pool as one molecule and nothing says
 * otherwise. Losing the metadata is worse than losing the sequence.
 */

const C5 = 'ATTACCGCCTTTGAGTGAGCCGTCTCATAT';
const C3 = 'CTGAAATTCTGCCTCGTGATACGGTCTCAA';

function pool() {
  const p = dsDNA(C5 + 'N'.repeat(40) + C3);
  p.slots = [{ name: 'cassette', start: 30, end: 70, lengths: [34, 46], bin: ['A'.repeat(40)] }];
  p.occupancy = { source: 'somewhere.tsv', rows: new Array(120) };
  return p;
}

describe('PCR carries the library through to the amplicon', () => {
  const product = () => PCR(oligo(C5.slice(0, 22)), oligo(revcomp(C3.slice(-22))), pool());

  it('keeps the slot, re-based onto the product', () => {
    const p = product();
    expect(p.slots).toHaveLength(1);
    expect(p.slots[0].name).toBe('cassette');
    // The amplicon starts at the forward primer, which begins 8 nt into the template's head.
    expect(p.sequence.slice(p.slots[0].start, p.slots[0].end)).toBe('N'.repeat(40));
  });

  it('keeps the bin and the length range with it', () => {
    const p = product();
    expect(p.slots[0].bin).toEqual(['A'.repeat(40)]);
    expect(lengthRange(p).bound).toBe('outer');
  });

  it('keeps occupancy — 120 members in, 120 out', () => {
    expect(product().occupancy.rows).toHaveLength(120);
  });

  it('leaves an ordinary template alone — no slots invented', () => {
    const plain = dsDNA(C5 + 'ATGC'.repeat(10) + C3);
    const p = PCR(oligo(C5.slice(0, 22)), oligo(revcomp(C3.slice(-22))), plain);
    expect(p.slots).toBeNull();
    expect(p.occupancy).toBeNull();
  });
});

describe('a slot must survive whole or not at all', () => {
  it('drops a slot that falls entirely outside the retained region', () => {
    const p = pool();
    expect(sliceSlots(p, 0, 20)).toBeNull();
  });

  it('throws on a slot only partly retained — half a library is a different library', () => {
    expect(() => sliceSlots(pool(), 0, 50))
      .toThrow(/only partly inside the retained region/);
  });
});

describe('coordinate transforms the template goes through', () => {
  const slots = [{ name: 's', start: 10, end: 20 }];

  it('mirrors slots under reverse complement', () => {
    expect(slotsAfterRevcomp(slots, 100)).toEqual([{ name: 's', start: 80, end: 90 }]);
  });

  it('is a no-op when the rotation point is 0, which is the ordinary case', () => {
    expect(slotsAfterRotate(slots, 0, 100)).toBe(slots);
  });

  it('shifts slots past the rotation point', () => {
    expect(slotsAfterRotate(slots, 5, 100)).toEqual([{ name: 's', start: 5, end: 15 }]);
  });

  it('throws when a slot straddles the rotation point rather than splitting it', () => {
    expect(() => slotsAfterRotate(slots, 15, 100)).toThrow(/straddles the point/);
  });
});

describe('concatenation combines slot sets', () => {
  it('offsets each piece by what precedes it, padding included', () => {
    const a = pool(), b = pool();
    const { slots } = concatSlots([{ poly: a, from: 0, to: 100, pad: 4 }, { poly: b }]);
    expect(slots.map((s) => s.start)).toEqual([30, 134]);   // 100 + 4 padding
  });

  it('drops occupancy when two libraries are joined, because that product is not implemented', () => {
    // Joining two pools yields the product of both memberships -- §4.1.1 -- so claiming either
    // one's member list for the result would be a number that is simply wrong.
    const { occupancy } = concatSlots([{ poly: pool() }, { poly: pool() }]);
    expect(occupancy).toBeNull();
  });

  it('keeps occupancy when only one input is a library', () => {
    const { occupancy } = concatSlots([{ poly: pool() }, { poly: dsDNA('ATGCATGC') }]);
    expect(occupancy.rows).toHaveLength(120);
  });
});
