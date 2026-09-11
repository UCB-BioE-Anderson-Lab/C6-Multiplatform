// eipcr.js — design the oligos for Golden Gate EIPCR site-directed mutagenesis.
//
// Inverse PCR right round a plasmid, with a Type IIS site on each primer's tail so the product
// closes back on itself through one 4 bp overhang. Whatever you write between the overhang and
// the annealing region replaces that stretch of the template: degenerate codes make a library,
// fixed bases make a single clone.
//
// THE PROCEDURE IS JCA'S, 2026-09-10, and the numbered steps below are his. It is written down
// as code because every step of it is determinate — and because doing it by hand, as this
// session did first, produced three wrong answers in a row from index arithmetic that looked
// fine. The one judgement call is which four bases to use as the overhang, and even that is a
// short scored search rather than a preference.
//
// ANNEALING IS `findanneal` FROM C6-Oligos, NOT A LENGTH RULE. It scores GC clamp, GC content,
// base balance and randomness over 18-25 nt. JCA: *"there is no simple anneal button in c6. You
// need to give it 2 oligos and a template"* — so nothing here decides whether a primer anneals;
// it hands the finished pair to `simCF` and reads the verdict.
import { findanneal } from '../../C6-Oligos.js';

/**
 * Reverse complement, preserving IUPAC degeneracy codes so a library oligo survives the round
 * trip.
 */
export const rc = (s) => String(s).toUpperCase().split('').reverse()
  .map((c) => ({ A: 'T', T: 'A', G: 'C', C: 'G', N: 'N', R: 'Y', Y: 'R', S: 'S', W: 'W',
                 K: 'M', M: 'K', B: 'V', V: 'B', D: 'H', H: 'D' }[c] || 'N')).join('');

// Step 8's ladder. The first enzyme whose site does NOT occur in the template wins, because a
// second site anywhere would cut the product somewhere nobody intended.
export const ENZYMES = [
  { name: 'BsaI', site: 'GGTCTC' },
  { name: 'BsmBI', site: 'CGTCTC' },
  { name: 'BbsI', site: 'GAAGAC' },
  { name: 'BseRI', site: 'GAGGAG' },
  { name: 'AarI', site: 'CACCTGC' },
  { name: 'SapI', site: 'GCTCTTC' },
];

/**
 * Pick the Type IIS enzyme to use: the first in the ladder whose site does not occur in the
 * template, on either strand. A second site anywhere would cut the product somewhere nobody
 * intended.
 */
export function chooseEnzyme(sequence, order = ENZYMES) {
  const s = String(sequence).toUpperCase();
  for (const e of order) {
    if (!s.includes(e.site) && !s.includes(rc(e.site))) return { ...e, reason: 'absent from the template' };
  }
  return null;
}

const isPalindrome = (s) => s.toUpperCase() === rc(s);
const gc = (s) => (s.toUpperCase().match(/[GC]/g) || []).length;

/**
 * Step 3-4: a 4 bp overhang sitting 1-5 bp away from the mutated window, on either side.
 *
 * NOT ABUTTING THE WINDOW, and that gap is the whole reason for the rule: a sticky end
 * immediately beside an N biases which variants ligate, so the library comes out skewed in a way
 * no downstream measurement can separate from biology. For a single clone the gap does not
 * matter, which is why `spaced` is only enforced when the replacement is degenerate.
 */
export function chooseOverhang(seq, winStart, winEnd, { degenerate = true, maxGap = 5 } = {}) {
  const s = String(seq).toUpperCase();
  const cands = [];
  for (const side of ['left', 'right']) {
    for (let gap = degenerate ? 1 : 0; gap <= maxGap; gap++) {
      const start = side === 'left' ? winStart - 1 - gap - 4 : winEnd + gap;
      const oh = s.slice(start, start + 4);
      if (oh.length !== 4 || /[^ACGT]/.test(oh)) continue;
      if (isPalindrome(oh)) continue;                       // would ligate to itself
      const g = gc(oh);
      if (g < 1 || g > 3) continue;                          // "some CG to it", not all of it
      cands.push({ overhang: oh, side, gap, start: start + 1, end: start + 4,
                   score: (g === 2 ? 2 : 1) - gap * 0.1 });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  return cands;
}

/**
 * Design the forward and reverse oligos for a Golden Gate EIPCR that replaces one window of a
 * template. Returns every viable design, best overhang first; nothing here is verified until
 * `verify` has simulated it.
 *
 * @param {Object} p
 * @param {string} p.sequence      the template, as a plain string (circular assumed)
 * @param {number} p.windowStart   1-based, first base replaced
 * @param {number} p.windowEnd     1-based, last base replaced
 * @param {string} p.replacement   what goes in its place — 'NNNNN' for a library
 * @returns {Array} one design per viable overhang, best first
 */
export function designEIPCR({ sequence, windowStart, windowEnd, replacement, enzyme }) {
  const s = String(sequence).toUpperCase();
  const L = s.length;
  const degenerate = /[^ACGT]/.test(String(replacement).toUpperCase());
  const enz = enzyme || chooseEnzyme(s);
  if (!enz) throw new Error('every Type IIS site in the ladder occurs in this template');

  const at = (i, n) => { // 1-based, wraps
    let out = ''; for (let k = 0; k < n; k++) out += s[(((i - 1 + k) % L) + L) % L]; return out;
  };

  const designs = [];
  for (const oh of chooseOverhang(s, windowStart, windowEnd, { degenerate })) {
    // Step 5: the overhang may fall either side of the window. Both are built; simulation says
    // which survives.
    let fwdCarries, fwdAnnealSource, revAnnealSource;
    if (oh.side === 'left') {
      //  5'seq . [overhang] . [gap] . [window] . 3'seq
      fwdCarries = oh.overhang + at(oh.end + 1, oh.gap) + replacement;
      fwdAnnealSource = at(windowEnd + 1, 30);                       // step 6
      revAnnealSource = rc(at(oh.start - 30, 30) + oh.overhang);      // step 7
    } else {
      //  5'seq . [window] . [gap] . [overhang] . 3'seq   — the mutant rides on the reverse oligo
      fwdCarries = oh.overhang;
      fwdAnnealSource = at(oh.end + 1, 30);
      revAnnealSource = rc(at(windowStart - 30, 30) + replacement + at(windowEnd + 1, oh.gap)
                           + oh.overhang);
    }
    let fwdAnneal, revAnneal;
    try {
      fwdAnneal = findanneal(fwdAnnealSource, true, false);            // lock the 5' end
      // For the reverse oligo the fixed part (overhang, and the mutant on the right-side case)
      // must be kept verbatim; only the template tail is scored.
      const fixed = oh.side === 'left' ? rc(oh.overhang)
                                       : rc(oh.overhang + at(windowEnd + 1, oh.gap) + replacement);
      const tail = revAnnealSource.slice(fixed.length);
      revAnneal = fixed + findanneal(tail, true, false);
    } catch { continue; }
    if (!fwdAnneal || fwdAnneal === 'N/A' || !revAnneal) continue;

    designs.push({
      enzyme: enz.name,
      overhang: oh.overhang, overhangSide: oh.side, overhangGap: oh.gap,
      overhangAt: [oh.start, oh.end],
      // Steps 9 and 10.
      forward: ('ccaaa' + enz.site + 'a' + fwdCarries + fwdAnneal).toUpperCase(),
      reverse: ('ccaaa' + enz.site + 'a' + revAnneal).toUpperCase(),
      score: oh.score,
    });
  }
  return designs;
}

/** The construction file for a design: PCR, Golden Gate, Transform. */
export function constructionFile({ design, templateName, productName, strain = 'Mach1',
                                   antibiotic, temperature = 37, fwdName, revName }) {
  const f = fwdName || `o${productName}F`, r = revName || `o${productName}R`;
  return [
    `PCR\t${f}\t${r}\t${templateName}\tpcr_${productName}`,
    `GoldenGate\tpcr_${productName}\t${design.enzyme}\t${productName}`,
    `Transform\t${productName}\t${strain}\t${antibiotic}\t${temperature}\t${productName}_t`,
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------
// Verification. JCA's last two steps: *"Simulate the construction file. Check that the product
// plasmid is the right size, and that the mutations are in the right place."*
//
// THIS IS THE ONLY THING THAT DECIDES WHETHER A DESIGN IS GOOD. Everything above is a proposal.
// A design that looks right and does not simulate is discarded without argument, and a design
// that simulates to the wrong size or puts the mutation somewhere else is worse than one that
// fails outright, because it would be ordered.
import { parseCF, simCF } from '../../C6-Sim.js';

const _log = console.log;
const quietly = (fn) => { console.log = () => {}; try { return fn(); } finally { console.log = _log; } };

/**
 * Simulate a design and say whether C6 actually builds it: the right product length, and the
 * replacement sitting against the base that followed the window. A design that simulates to the
 * wrong size is worse than one that fails, because it would be ordered.
 *
 * @returns {{ok:boolean, bp:number, expectedBp:number, mutationAt:number, context:string, why:string}}
 */
export function verify(design, { sequence, windowStart, windowEnd, replacement, templateName = 'TPL' }) {
  const s = String(sequence).toUpperCase();
  const expectedBp = s.length - (windowEnd - windowStart + 1) + replacement.length;
  const cf = [
    `PCR\tF\tR\t${templateName}\tpcrX`,
    `GoldenGate\tpcrX\t${design.enzyme}\tlibX`,
    `oligo\tF\t${design.forward}`,
    `oligo\tR\t${design.reverse}`,
    `plasmid\t${templateName}\t${s}`,
  ].join('\n');
  let product;
  try {
    const out = new Map(quietly(() => simCF(parseCF(cf)))
      .map(([k, v]) => [k, String(v && v.sequence != null ? v.sequence : v).toUpperCase()]));
    product = out.get('libX');
    if (!product) return { ok: false, why: 'the Golden Gate produced nothing' };
  } catch (e) {
    return { ok: false, why: String(e.message || e).split('\n')[0] };
  }

  if (product.length !== expectedBp)
    return { ok: false, bp: product.length, expectedBp,
             why: `product is ${product.length} bp, expected ${expectedBp}` };

  // WHERE the mutation landed, checked against the template's own flanks rather than an index.
  // The product is circular and C6 rotates it, so a position comparison would be meaningless.
  const flank = s.slice(windowEnd, windowEnd + 16);
  const doubled = product + product;
  const i = doubled.indexOf(replacement.toUpperCase() + flank);
  if (i < 0) return { ok: false, bp: product.length, expectedBp,
                      why: 'the replacement is not sitting against the base that followed the window' };
  return { ok: true, bp: product.length, expectedBp,
           mutationAt: (i % product.length) + 1,
           context: `${doubled.slice(i - 12, i)} [${replacement.toUpperCase()}] ${flank}`,
           why: 'right size, and the mutation is where the window was' };
}

/** Design and verify in one call; returns only what C6 confirms, best first. */
export function designAndVerify(spec) {
  const out = [];
  for (const d of designEIPCR(spec)) {
    const v = verify(d, spec);
    out.push({ ...d, verified: v.ok, check: v });
  }
  return { verified: out.filter((d) => d.verified), rejected: out.filter((d) => !d.verified) };
}
