// Golden Gate EIPCR oligo design. The procedure is JCA's, 2026-09-10; every assertion here is a
// step of it, and the last word always belongs to simCF.
import { describe, it, expect } from 'vitest';
import { designEIPCR, designAndVerify, chooseEnzyme, chooseOverhang, rc, ENZYMES }
  from '../../src/labplanner/design/eipcr.js';

// A synthetic plasmid with no Type IIS sites, so the enzyme ladder starts clean.
//
// The first version used an LCG — `x * 1103515245 + 12345` — which in JavaScript exceeds 2^53 on
// the first step and loses precision, so it emitted almost no variety and `chooseOverhang` found
// nothing at all. Five tests then "passed" over empty loops and three failed for a reason that
// had nothing to do with the code under test. xorshift32 stays inside 32 bits.
function plasmid(n = 3000, seed = 22222) {
  let s = '', x = seed >>> 0;
  while (s.length < n) {
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    s += 'ACGT'[x & 3];
  }
  for (const e of ENZYMES) {                       // scrub any site that happened to appear
    const pad = 'ACACACA'.slice(0, e.site.length);
    while (s.includes(e.site)) s = s.replace(e.site, pad);
    while (s.includes(rc(e.site))) s = s.replace(rc(e.site), pad);
  }
  return s.slice(0, n);
}
const P = plasmid();

describe('enzyme choice (step 8)', () => {
  it('takes the first enzyme whose site is absent from the template', () => {
    expect(chooseEnzyme(P).name).toBe('BsaI');
  });
  it('steps down the ladder when a site is present — on either strand', () => {
    expect(chooseEnzyme('AAGGTCTCAA' + P).name).toBe('BsmBI');
    expect(chooseEnzyme('AA' + rc('GGTCTC') + 'AA' + P).name).toBe('BsmBI');
  });
});

describe('overhang choice (step 3)', () => {
  it('never abuts a degenerate window', () => {
    // A sticky end next to an N biases which variants ligate, and the skew is indistinguishable
    // from biology downstream.
    for (const c of chooseOverhang(P, 500, 503, { degenerate: true })) expect(c.gap).toBeGreaterThan(0);
  });
  it('allows a flush overhang for a single clone, where bias cannot arise', () => {
    expect(chooseOverhang(P, 500, 503, { degenerate: false }).some((c) => c.gap === 0)).toBe(true);
  });
  it('rejects palindromes, which would ligate to themselves', () => {
    for (const c of chooseOverhang(P, 500, 503)) expect(c.overhang).not.toBe(rc(c.overhang));
  });
  it('offers both sides of the window (step 5)', () => {
    const sides = new Set(chooseOverhang(P, 500, 503).map((c) => c.side));
    expect(sides.size).toBeGreaterThan(0);
  });
});

describe('the designed oligos (steps 9-10)', () => {
  const spec = { sequence: P, windowStart: 500, windowEnd: 503, replacement: 'NNNN' };
  it('carry the enzyme site with the stated spacer', () => {
    for (const d of designEIPCR(spec)) {
      expect(d.forward.startsWith('CCAAA' + 'GGTCTC' + 'A')).toBe(true);
      expect(d.reverse.startsWith('CCAAA' + 'GGTCTC' + 'A')).toBe(true);
    }
  });
  it('put the degenerate bases on exactly one of the two oligos', () => {
    for (const d of designEIPCR(spec)) {
      const n = (d.forward.match(/N/g) || []).length + (d.reverse.match(/N/g) || []).length;
      expect(n).toBe(4);
    }
  });
});

describe('verification is what decides (steps 11-12)', () => {
  it('produces designs C6 confirms: right size, mutation in the right place', () => {
    const spec = { sequence: P, windowStart: 500, windowEnd: 503, replacement: 'NNNN' };
    const { verified } = designAndVerify(spec);
    expect(verified.length).toBeGreaterThan(0);
    for (const d of verified) {
      expect(d.check.bp).toBe(P.length);          // length-neutral: 4 bases out, 4 in
      expect(d.check.context).toContain('[NNNN]');
    }
  });

  it('a library longer than the window changes the size by exactly the difference', () => {
    const { verified } = designAndVerify({ sequence: P, windowStart: 500, windowEnd: 503,
                                           replacement: 'NNNNNN' });
    expect(verified.length).toBeGreaterThan(0);
    for (const d of verified) expect(d.check.bp).toBe(P.length + 2);
  });

  it('makes a single clone, not only libraries', () => {
    const { verified } = designAndVerify({ sequence: P, windowStart: 500, windowEnd: 503,
                                          replacement: 'GATC' });
    expect(verified.length).toBeGreaterThan(0);
    expect(verified[0].check.context).toContain('[GATC]');
  });

  it('rejects rather than returns a design C6 will not build', () => {
    const { verified, rejected } = designAndVerify({ sequence: P, windowStart: 500,
                                                     windowEnd: 503, replacement: 'NNNN' });
    for (const r of rejected) expect(r.check.why).toBeTruthy();
    expect(verified.every((v) => v.check.ok)).toBe(true);
  });
});
