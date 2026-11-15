/**
 * Gibson self-closure: a fragment whose two ends share a direct repeat.
 *
 * THE CASE THIS WAS WRITTEN FROM. pCBA11 (CBA-Ligase1, iGEM, Nov 2026) is a two-fragment Gibson:
 * a T4 ligase amplicon into a pDel7 backbone amplicon. All four clones sequenced on 2026-11-14
 * carried no insert at all; they were the backbone amplicon closed on itself, having lost 59 bp
 * including both homology arms, across a 7 bp repeat CGCACTG. The repeat is in all four oligos,
 * so it sits at BOTH ends of the backbone amplicon, and the closure is first order where insert
 * capture is second order. Simulating the drawn assembly said nothing about any of this: it
 * returned the intended plasmid, which was never the product on the plate.
 *
 * JCA, 2026-11-14: *"We should probably also be validating internal k-mers when we simulate
 * gibson reactions in C6's simCF --- there should be a warning when there is a possibility of a
 * single-fragment reaction."*
 *
 * The fragment ends below are the real ones: oCBA6 is the backbone amplicon's 5' end, and oCBA4
 * (the reverse complement of oCBA7, the reverse primer) is its 3' end.
 */
import { describe, it, expect, vi } from 'vitest';
import { dsDNA } from 'src/C6-Seq.js';
import {
  gibson,
  selfClosureRepeat,
  gibsonSelfClosureWarnings,
  SELF_CLOSURE_MIN_K,
} from 'src/C6-Sim.js';

// The two ends of pcba_pcr, from the ordered oligos, with inert filler between them. The middle
// of the amplicon is pDel7 and plays no part: the whole question is what the two ENDS share.
const OCBA6 = 'GCTTACTTAGAAACAATTGTCGCACTGGCTCACCTTCGGGTGGG';
const OCBA4 = 'CAGCAGGACGCACTGACCGGATCCGATTTATAATAGAGCTGTAAACC';
const FILLER = 'AGTTCATCCGCCATCGGAACGTAGGTCTGTCCAGCGAGCTATAGCTACCAACCCACACGG' +
               'TATGGCCGCGTAGGCCTTAAGGATGTCACGTGGGTTAATATGCCCAGTGGCAATGAACAG';
const BACKBONE = OCBA6 + FILLER + OCBA4;

// A fragment of the same shape whose two ends share nothing. Random sequence, checked rather than
// assumed: a hand-written "clean" control picked up a chance 7-mer on the first try.
const CLEAN = 'TTTTTTGAAGGTTGCCGGAGTGGTCGTCATATACAGAGTGGTTA' +
              'TAATACGTAAGCGTGCTCAGAGTTACCCGTTTGGAACGTCACGCGACATGTAAGTGGAGA' +
              'GAGCAATCGGACTCCAACTCTAACCTGACTTTCTCTAGCTAGGTGCCCGTCGGGAACCAG' +
              'GAGCGGGTGGTAGACAGTTTAAGGAGTACATACAGCGTAAAGACG';

describe('Gibson self-closure warnings', () => {
  it('finds the CGCACTG repeat at both ends of the pCBA11 backbone amplicon', () => {
    const hit = selfClosureRepeat(BACKBONE);
    expect(hit).not.toBeNull();
    expect(hit.repeat).toBe('CGCACTG');
    expect(hit.length).toBe(7);
    expect(hit.headStart).toBe(20);
    // The circle keeps one copy and loses everything outside the two: both homology arms. 59 bp,
    // which is what the four reads lost on the bench.
    expect(hit.circleLength).toBe(hit.tailStart - hit.headStart);
    expect(hit.lost).toBe(BACKBONE.length - hit.circleLength);
    expect(hit.lost).toBe(59);
  });

  it('says nothing about a fragment whose ends share no repeat', () => {
    expect(selfClosureRepeat(CLEAN)).toBeNull();
  });

  it('does not report a repeat shorter than the floor', () => {
    // A 6 bp repeat is left alone on purpose: at this window it comes up by chance in most
    // random fragments, and a warning that common is one nobody reads.
    const sixOnly = 'ACGTTA' +
      'AGTTCAATAGCTCGTAGTTTGAGACGGATCTGAGATCTCTCAGGACAATGCTCAACCTTAACGGCCGCGTTCATTTCGTATATAATCATAGCCCTGTTT' +
      'ACGTTA';
    expect(SELF_CLOSURE_MIN_K).toBe(7);
    expect(selfClosureRepeat(sixOnly)).toBeNull();
  });

  it('ignores an inverted repeat, which gives a hairpin rather than a circle', () => {
    const inverted = 'CGCACTG' + FILLER + 'CAGTGCG';
    expect(selfClosureRepeat(inverted)).toBeNull();
  });

  it('warns once per risky fragment, naming the repeat and the circle', () => {
    const warn = vi.fn();
    const warnings = gibsonSelfClosureWarnings(
      [dsDNA(BACKBONE), dsDNA(CLEAN)],
      { warn }
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0].index).toBe(0);
    expect(warnings[0].repeat).toBe('CGCACTG');
    expect(warnings[0].message).toContain('CGCACTG');
    expect(warnings[0].message).toContain('close on itself');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('stays quiet when one fragment is handed in to circularise on its own', () => {
    const warn = vi.fn();
    const warnings = gibsonSelfClosureWarnings([dsDNA(BACKBONE)], { warn });
    expect(warnings).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('is reached by gibson() itself, and does not stop the assembly', () => {
    // Two fragments that really do assemble, one of which can also close on itself.
    const shared = 'TAGACAACATAATACGGACA';          // the designed 20 nt junction
    const repeat = 'CGCACTG';
    const fragA = dsDNA('GG' + repeat +
      'CCGTGGATCTGGCTTGACCCTCAAGAACCTGGTCGTTTTAACCACTTTACATTCTTACGC' +
      repeat + 'TT' + shared);
    const fragB = dsDNA(shared +
      'CCGCTCGACGATGCCGAGTCTTATGGACATTCCGTCTCGAAACTTCCAGCGTAATAGTTGAGGAAGCGGGATGACGGGCC');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const product = gibson([fragA, fragB], false);
      expect(product.sequence.length).toBeGreaterThan(0);
      const said = warn.mock.calls.map((c) => String(c[0])).join('\n');
      expect(said).toContain('can close on itself');
      expect(said).toContain(repeat);
    } finally {
      warn.mockRestore();
    }
  });
});
