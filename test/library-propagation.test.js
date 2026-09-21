import { describe, it, expect } from 'vitest';
import { PCR, goldengate } from 'src/C6-Sim.js';
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

  it('MULTIPLIES membership when two libraries are joined — §4.1.1', () => {
    // Assembly is the one operation that creates membership: any member of one bin joins any
    // member of the other, so 120 x 120 plasmids come out of one tube.
    const { occupancy } = concatSlots([{ poly: pool() }, { poly: pool() }]);
    expect(occupancy.kind).toBe('product');
    expect(occupancy.count).toBe(120 * 120);
  });

  it('keeps the product a COUNT and never a list', () => {
    const { occupancy } = concatSlots([{ poly: pool() }, { poly: pool() }]);
    expect(occupancy.rows).toBeUndefined();
  });

  it('reports an unknown product rather than the product of the known factors', () => {
    // One factor whose size nobody knows makes the whole count unknown. Multiplying the rest
    // would look like an answer while silently omitting a library.
    const vague = pool(); vague.occupancy = 'dense';   // dense, but its slot has a 1-value bin
    const blank = pool(); blank.occupancy = { kind: 'product', count: null, factors: [] };
    const { occupancy } = concatSlots([{ poly: vague }, { poly: blank }]);
    expect(occupancy.count).toBeNull();
  });

  it('keeps occupancy when only one input is a library', () => {
    const { occupancy } = concatSlots([{ poly: pool() }, { poly: dsDNA('ATGCATGC') }]);
    expect(occupancy.rows).toHaveLength(120);
  });
});

describe('assembly carries the library into the product', () => {
  const F1 = 'ccaaaGGTCTCAGCTTTGATCGATTCAACCTACTTCCCCTTCATAATCGGTACTAGAGACCacgac';
  const F2 = 'GGTCTCATACTCAAAATTTACTGACTGGACATGGTCACCACTTAAGTAAGCTTTGAGACC';

  function libFrag() {
    const p = dsDNA(F1.slice(0, 30) + 'N'.repeat(15) + F1.slice(45));
    p.slots = [{ name: 'cargo', start: 30, end: 45, lengths: [12, 18],
                 bin: ['ACTTCCCCTTCATAA'] }];
    p.occupancy = { rows: new Array(64) };
    return p;
  }

  it('GoldenGate keeps the slot and its membership', () => {
    const out = goldengate([libFrag(), dsDNA(F2)], 'BsaI');
    expect(out.slots.map((s) => s.name)).toEqual(['cargo']);
    expect(out.occupancy.rows).toHaveLength(64);
  });

  it('the surviving slot still lands on its own N-run after the sort and the cuts', () => {
    const out = goldengate([libFrag(), dsDNA(F2)], 'BsaI');
    const s = out.slots[0];
    expect(out.sequence.slice(s.start, s.end)).toBe('N'.repeat(15));
  });

  it('DROPS a slot the enzyme cuts away — arity collapses through the chemistry', () => {
    // Tlib3 does this for real: BsmBI cuts inside the amplicon and discards the index and the
    // ca998 flank, so the product plasmid carries two slots where the amplicon carried three.
    // Nothing instructs that; it falls out of the cut.
    // BsaI's retained fragment here is [16, 50). A slot at 61-65 sits beyond the reverse site,
    // in the flank the enzyme cuts off, so it cannot reach the product.
    const p = dsDNA(F1.slice(0, 61) + 'NNNN' + F1.slice(65));
    // The bin is required even though this slot is discarded: an extra site ANYWHERE in the input
    // would break GoldenGate's "exactly one forward site" assumption, so position does not excuse
    // it from screening.
    p.slots = [{ name: 'discarded', start: 61, end: 65, lengths: [4, 4], bin: ['ACGT', 'TGCA'] }];
    p.occupancy = { rows: new Array(9) };
    const out = goldengate([p, dsDNA(F2)], 'BsaI');
    expect(out.slots).toBeNull();
  });

  it('leaves an ordinary assembly alone', () => {
    const out = goldengate([dsDNA(F1), dsDNA(F2)], 'BsaI');
    expect(out.slots).toBeNull();
    expect(out.occupancy).toBeNull();
  });
});
