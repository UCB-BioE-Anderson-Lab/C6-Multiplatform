import { describe, it, expect } from 'vitest';
import { goldengate } from 'src/C6-Sim.js';
import { dsDNA } from 'src/C6-Seq.js';

/**
 * GoldenGate under docs/OLIGOPOOL-SPEC.md §6 and §8.5.
 *
 * The screening tests are the ones that matter. A slot holds N in the skeleton and N does not spell
 * GGTCTC, so `indexOf` reports "exactly one site" for a pool in which some members carry two. The
 * skeleton's site count is a FLOOR, and every test below that throws is a case the skeleton alone
 * calls clean.
 */

// The working pair from C6-Sim.test.js, with a variable cargo cut into the first fragment.
const F1 = 'ccaaaGGTCTCAGCTTTGATCGATTCAACCTACTTCCCCTTCATAATCGGTACTAGAGACCacgac';
const F2 = 'GGTCTCATACTCAAAATTTACTGACTGGACATGGTCACCACTTAAGTAAGCTTTGAGACC';
const SLOT_START = 30, SLOT_END = 45;

function libFrag(bin) {
  const head = F1.slice(0, SLOT_START), tail = F1.slice(SLOT_END);
  const p = dsDNA(head + 'N'.repeat(SLOT_END - SLOT_START) + tail);
  p.slots = [{ name: 'cargo', start: SLOT_START, end: SLOT_END, lengths: [15, 15],
               ...(bin ? { bin } : {}) }];
  p.occupancy = { rows: new Array(bin ? bin.length : 0) };
  return p;
}

const CLEAN = ['ACTTCCCCTTCATAA', 'ACTTCCCCTTCATTT', 'GGGTCCCCTTCATAA'];

describe('a library assembles when every member is clean', () => {
  it('does not refuse a pool whose slot is clear of both sites and whose bin carries none', () => {
    expect(() => goldengate([libFrag(CLEAN), dsDNA(F2)], 'BsaI')).not.toThrow();
  });
});

describe('a site hiding in the bin stops the assembly — the skeleton calls this clean', () => {
  it('throws when one member carries a BsaI site, and counts them', () => {
    const bin = [...CLEAN, 'ACTTGGTCTCCATAA'];   // one member with GGTCTC in it
    let msg = '';
    try { goldengate([libFrag(bin), dsDNA(F2)], 'BsaI'); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/1 of 4 members of slot "cargo" carry a BsaI site/);
  });

  it('throws if ANY member fails, not only if most do — JCA 2026-09-20', () => {
    // 1 bad in 40. A partition would assemble the other 39 and report a count; the ruling is that
    // Golden Gate stops instead, because a plan that quietly drops members is worse than one that
    // does not finish.
    const bin = [...Array(39).fill('ACTTCCCCTTCATAA'), 'ACTTGGTCTCCATAA'];
    let msg = '';
    try { goldengate([libFrag(bin), dsDNA(F2)], 'BsaI'); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/1 of 40 members/);
    expect(msg).toMatch(/throws if ANY member fails rather than assembling the rest/);
  });

  it('catches a site created ACROSS the slot boundary, which no member contains', () => {
    // NEITHER SIDE CARRIES THE SITE. The constant sequence ends ...GG and the member begins TCTC;
    // only the join spells GGTCTC. Screening the filler alone misses this completely, which is why
    // `screenBinsForSite` prepends the last k-1 bases of the preceding constant.
    const p = dsDNA(F1.slice(0, 28) + 'GG' + 'N'.repeat(15) + F1.slice(45));
    p.slots = [{ name: 'edge', start: 30, end: 45, lengths: [15, 15],
                 bin: ['ACTTCCCCTTCATAA', 'TCTCACCCTTCATAA'] }];
    expect(p.slots[0].bin.every((m) => !m.includes('GGTCTC'))).toBe(true);  // no member has it

    let msg = '';
    try { goldengate([p, dsDNA(F2)], 'BsaI'); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/1 of 2 members of slot "edge" carry a BsaI site/);
    expect(msg).toMatch(/counting sites created at the slot's boundaries/);
  });
});

describe('an undeclared bin is not an all-clear', () => {
  it('refuses to guarantee anything about a slot with no bin', () => {
    let msg = '';
    try { goldengate([libFrag(null), dsDNA(F2)], 'BsaI'); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/no bin is declared for it, so its contents were never screened/);
    // The distinction that must survive: nothing found vs could not look.
    expect(msg).not.toMatch(/carry a BsaI site/);
  });
});

describe('a slot in the cut footprint refuses before screening', () => {
  it('throws when the slot overlaps the recognition site and its cut', () => {
    const p = dsDNA('ccaaa' + 'N'.repeat(15) + F1.slice(20));
    p.slots = [{ name: 'oops', start: 5, end: 20, lengths: [15, 15], bin: CLEAN }];
    let msg = '';
    try { goldengate([p, dsDNA(F2)], 'BsaI'); } catch (e) { msg = e.message; }
    // Either the site is unfindable in the skeleton, or the footprint guard fires; both are
    // refusals and neither invents a product.
    expect(msg).toMatch(/GoldenGate cannot yet resolve a library here|site GGTCTC not found/);
  });
});
