import { describe, it, expect } from 'vitest';
import { PCR, gibson } from 'src/C6-Sim.js';
import { dsDNA, oligo, revcomp } from 'src/C6-Seq.js';

/**
 * The footprint rule from docs/OLIGOPOOL-SPEC.md §6, wired into the two operations that have one
 * today. Half of these tests assert that a library is let THROUGH, and those are the ones that
 * matter most: a guard that refuses everything is easy and useless.
 */

const C5 = 'ATTACCGCCTTTGAGTGAGCCGTCTCATAT';   // 30 nt constant head
const C3 = 'CTGAAATTCTGCCTCGTGATACGGTCTCAA'; // 30 nt constant tail

/** A library: constant flanks with a 40 nt variable cassette between them. */
function pool() {
  const p = dsDNA(C5 + 'N'.repeat(40) + C3);
  p.slots = [{ name: 'cassette', start: 30, end: 70, lengths: [34, 46] }];
  p.occupancy = { rows: new Array(120) };
  return p;
}

describe('PCR — a successful anneal is provably outside every slot', () => {
  it('amplifies a library when both primers sit in constant regions', () => {
    // Matching is exact, so this could only have succeeded outside the N-run. The cassette rides
    // through into the product as cargo, which is the whole point.
    const product = PCR(oligo(C5.slice(0, 22)), oligo(revcomp(C3.slice(-22))), pool());
    expect(product.sequence).toContain('N'.repeat(40));
    expect(product.sequence.length).toBe(100);
  });
});

describe('PCR — a primer that targets a slot fails honestly', () => {
  const targeted = oligo('ACGTACGTACGTACGTACGTACGT');  // matches nothing; stands for a subpool primer

  it('says the template is a library and names its slots', () => {
    let msg = '';
    try { PCR(oligo(C5.slice(0, 22)), targeted, pool()); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/library with 1 variable slot\(s\): "cassette"/);
  });

  it('says the oligo is not necessarily wrong, and points at the missing capability', () => {
    let msg = '';
    try { PCR(oligo(C5.slice(0, 22)), targeted, pool()); } catch (e) { msg = e.message; }
    // The failure this prefix exists to prevent: sending somebody to fix a correct primer.
    expect(msg).toMatch(/not necessarily wrong/);
    expect(msg).toMatch(/OLIGOPOOL-SPEC\.md §5\.2/);
  });

  it('stays silent on an ordinary template — no library noise on a normal failure', () => {
    let msg = '';
    try { PCR(oligo(C5.slice(0, 22)), targeted, dsDNA(C5 + 'ATGCATGCATGCATGCATGC' + C3)); }
    catch (e) { msg = e.message; }
    expect(msg).toMatch(/does not exactly anneal/);
    expect(msg).not.toMatch(/library/);
  });
});

describe('Gibson — the footprint is the terminal homology window, and only that', () => {
  const HOM = 'GGTCTCAATTCCGGAATTCC';           // 20 nt shared junction
  const tail = 'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT';

  it('joins a library whose slot is clear of the junction — cargo passes through', () => {
    const a = dsDNA('AAAACCCCGGGG' + 'N'.repeat(30) + tail + HOM);
    a.slots = [{ name: 'cargo', start: 12, end: 42, lengths: [25, 35] }];
    const b = dsDNA(HOM + 'CCCCAAAATTTT');
    expect(() => gibson([a, b], false)).not.toThrow();
  });

  it('refuses when the slot reaches into the homology region, and names it', () => {
    const a = dsDNA('AAAACCCCGGGG' + tail + HOM.slice(0, 10) + 'N'.repeat(10));
    a.slots = [{ name: 'edge', start: 52, end: 62, lengths: [8, 12] }];
    const b = dsDNA(HOM.slice(0, 10) + 'N'.repeat(10) + 'CCCCAAAATTTT');
    let msg = '';
    try { gibson([a, b], false); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/Gibson cannot yet resolve a library at this junction/);
    expect(msg).toMatch(/variable slot\(s\) "edge"/);
  });

  it('refuses rather than letting one member stand for the pool', () => {
    const a = dsDNA('AAAACCCCGGGG' + tail + HOM.slice(0, 10) + 'N'.repeat(10));
    a.slots = [{ name: 'edge', start: 52, end: 62, lengths: [8, 12] }];
    const b = dsDNA(HOM.slice(0, 10) + 'N'.repeat(10) + 'CCCCAAAATTTT');
    let msg = '';
    try { gibson([a, b], false); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/nothing is returned rather than one member's answer/);
  });
});
