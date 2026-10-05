// mapMatch.js — does a simulated molecule match the map somebody recorded for it?
//
// Separate from `bin/c6-sim` because the comparison is the part worth testing and a bin is the
// part that is hard to test. The bin decides WHICH products have a map; this decides whether a
// product and a map are the same DNA.
import { revcomp } from '../../C6-Seq.js';

const RC = (s) => revcomp(String(s).toUpperCase());

/**
 * Two circular molecules are the same molecule when one is a rotation of the other, or of its
 * reverse complement — a plasmid has no first base, and which strand got written down is a
 * property of the file rather than of the DNA. Compare accordingly, and when they differ, say
 * where: a length delta alone sends somebody to diff 3.5 kb by eye.
 */
export function compareToMap(productSeq, mapSeq) {
  const P = String(productSeq).toUpperCase(), M = String(mapSeq).toUpperCase();
  const delta = P.length - M.length;
  if (P.length === M.length) {
    if ((P + P).includes(M)) return { status: 'match', orientation: 'same strand', delta: 0 };
    const R = RC(P);
    if ((R + R).includes(M)) return { status: 'match', orientation: 'reverse complement', delta: 0 };
  }
  // ALIGN BEFORE REPORTING A DIFFERENCE, or every rotation reads as a difference at base 1.
  //
  // **THE ANCHOR HAS TO BE UNIQUE, NOT MERELY FOUND.** A plasmid is full of repeats — a doubled
  // terminator, two copies of one promoter, the same 24 bp linker at both ends of an insert — and
  // an anchor that occurs twice aligns the two molecules at the wrong copy, which reports a
  // difference at a base where nothing is wrong and buries the real one. So anchors are tried
  // along the map until one occurs exactly once; only if none does is a repeated one used, and
  // then the result says the alignment is a guess.
  for (const [strand, orientation] of [[P, 'same strand'], [RC(P), 'reverse complement']]) {
    const doubled = strand + strand;
    let fallback = null;
    for (let off = 0; off + ANCHOR <= M.length; off += STRIDE) {
      const hits = occurrences(doubled, M.slice(off, off + ANCHOR), strand.length);
      if (!hits.length) continue;
      const start = ((hits[0] - off) % strand.length + strand.length) % strand.length;
      if (hits.length > 1) { fallback ||= { start, ambiguous: true }; continue; }
      return walk(doubled, strand.length, start, M, delta, orientation, false);
    }
    if (fallback) return walk(doubled, strand.length, fallback.start, M, delta, orientation, true);
  }
  return { status: 'differs', delta, orientation: null, first_difference: null,
           note: `the two share no common ${ANCHOR} bp anchor, so they could not be aligned at all` };
}

// 24 bp is long enough to be unique in a plasmid and short enough to survive a point change
// beside it; stepping by 60 tries a fresh anchor roughly once per GenBank ORIGIN line.
const ANCHOR = 24;
const STRIDE = 60;

/** Every start index of `q` in `doubled` that begins within the first turn of the circle. */
function occurrences(doubled, q, limit) {
  const out = [];
  for (let i = doubled.indexOf(q); i >= 0 && i < limit; i = doubled.indexOf(q, i + 1)) out.push(i);
  return out;
}

/** Compare base by base from an aligned start and report the first place they part company. */
function walk(doubled, len, start, M, delta, orientation, ambiguous) {
  const aligned = doubled.slice(start, start + len);
  const note = ambiguous
    ? 'every anchor tried occurs more than once (the molecule is repetitive), so this alignment is one of several and the position is approximate'
    : undefined;
  const n = Math.min(aligned.length, M.length);
  for (let k = 0; k < n; k++) {
    if (aligned[k] !== M[k]) {
      return { status: 'differs', delta, orientation,
               first_difference: { at: k + 1, simulated: aligned[k], map: M[k] }, ...(note && { note }) };
    }
  }
  // Identical as far as the shorter one goes: the difference is an insertion or deletion at the
  // far end of the alignment, which is exactly what a delta with no mismatch means.
  return { status: 'differs', delta, orientation,
           first_difference: { at: n + 1, simulated: aligned[n] ?? '(end)', map: M[n] ?? '(end)' },
           ...(note && { note }) };
}

