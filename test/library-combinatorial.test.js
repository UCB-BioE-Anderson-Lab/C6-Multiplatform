import { describe, it, expect } from 'vitest';
import { goldengate } from 'src/C6-Sim.js';
import { dsDNA } from 'src/C6-Seq.js';
import { lengthRange, occupancyCount } from 'src/library/slots.js';

/**
 * §4.1.1 — assembly over several bins, which is the operation that CREATES membership.
 *
 * JCA's case: *"we could be describing G00101.promoter.rbs.cds.terminator.ca998 where promoter was
 * any of a bin, rbs any of a bin, etc. So, I think for both the oligopool and the combinatorial
 * parts library, we are really describing the full combinatorial space, even though the oligopool
 * describes a sparse region of it."*
 *
 * Tlib3 is the sparse end of that: 180 of 194,400 points, arriving from a synthesiser. This is the
 * dense end: every combination forms, in the tube, and the count is something the simulator works
 * out rather than something the pool was declared with.
 */

// Golden Gate parts with BsaI: [pad] GGTCTC a <overhang> <body> <overhang> a GAGACC [pad].
// Overhangs chain GCTT -> TACT -> CCAG -> GCTT, so the three parts close into a circle.
function part(oh5, body, oh3, slot) {
  const head = 'ccaaa' + 'GGTCTCa' + oh5;
  const p = dsDNA(head + body + oh3 + 'a' + 'GAGACC' + 'acgac');
  if (slot) {
    p.slots = [{ ...slot, start: head.length + slot.at, end: head.length + slot.at + slot.n }];
    p.occupancy = 'dense';
  }
  return p;
}

const promoters = ['AAAACCCCAA', 'AAAACCCCAC', 'AAAACCCCAG', 'AAAACCCCAT', 'AAAACCCCCA', 'AAAACCCCCC'];
const rbss = ['TTTTGGGG', 'TTTTGGGA', 'TTTTGGGC', 'TTTTGGGT'];
const terms = ['CCCCAAAATTTT', 'CCCCAAAATTTA', 'CCCCAAAATTTC'];

const lib = () => [
  part('GCTT', 'AT' + 'N'.repeat(10) + 'AT', 'TACT',
       { name: 'promoter', at: 2, n: 10, lengths: [10, 10], bin: promoters }),
  part('TACT', 'AT' + 'N'.repeat(8) + 'AT', 'CCAG',
       { name: 'rbs', at: 2, n: 8, lengths: [8, 8], bin: rbss }),
  part('CCAG', 'AT' + 'N'.repeat(12) + 'AT', 'GCTT',
       { name: 'terminator', at: 2, n: 12, lengths: [12, 12], bin: terms }),
];

describe('a parts library assembles into a combinatorial pool', () => {
  it('carries every bin into the product', () => {
    const out = goldengate(lib(), 'BsaI');
    expect(out.slots.map((s) => s.name).sort()).toEqual(['promoter', 'rbs', 'terminator']);
  });

  it('MULTIPLIES the bins: 6 x 4 x 3 = 72 combinations', () => {
    const out = goldengate(lib(), 'BsaI');
    expect(out.occupancy.kind).toBe('product');
    expect(occupancyCount(out.occupancy, out.slots)).toBe(72);
  });

  it('keeps it a count, never a list — nothing is enumerated during simulation', () => {
    expect(goldengate(lib(), 'BsaI').occupancy.rows).toBeUndefined();
  });

  it('every slot still lands on its own N-run after the cuts and the sort', () => {
    const out = goldengate(lib(), 'BsaI');
    for (const s of out.slots) {
      expect(out.sequence.slice(s.start, s.end)).toBe('N'.repeat(s.end - s.start));
    }
  });

  it('calls a fully dense product TIGHT, unlike a sparse pool', () => {
    // Every combination exists, so the extremes of each slot DO co-occur in some real member and
    // summing them describes something that is actually in the tube. Tlib3 gets 'outer' for
    // exactly the opposite reason — see §7.5.
    expect(lengthRange(goldengate(lib(), 'BsaI')).bound).toBe('tight');
  });

  it('assembles ordinary parts into an ordinary plasmid', () => {
    const plain = [part('GCTT', 'ATATATATATATAT', 'TACT'),
                   part('TACT', 'ATATATATATAT', 'CCAG'),
                   part('CCAG', 'ATATATATATATATAT', 'GCTT')];
    const out = goldengate(plain, 'BsaI');
    expect(out.slots).toBeNull();
    expect(out.occupancy).toBeNull();
  });
});
