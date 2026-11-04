// src/design/audit.js
//
// WHETHER A DESIGN WAS DERIVED OR IMPROVISED. JCA, 2026-11-04, on the failure this answers:
//
//   "in a recent design, instead of using C6's findBestAnneal to design an oligo, you instead
//   just picked an arbitrary 30 bp sequence. It might work, but it was bad design. And I had no
//   easy way of reviewing how you computed your design to see that you were improvising rather
//   than using the well-tested tools."
//
// A construction file carries results. An oligo chosen by eye and an oligo from `findanneal`
// are the same thirty characters in it, and nothing downstream distinguishes them. So the
// deliverable of a design is the SCRIPT that produced the file, and these are the two checks
// that can be run over a design without trusting whoever wrote it.
//
// NEITHER OF THESE PROVES A DESIGN IS GOOD, and they are not meant to. They answer the narrower
// question of whether the tools that exist were used, which is the one that was unanswerable.

import { findanneal, scoreanneal } from '../C6-Oligos.js';
import { revcomp } from '../C6-Seq.js';

/** How far upstream of a chosen anneal's 3' end the tool is allowed to look when re-deriving. */
export const ANNEAL_WINDOW = 40;

/**
 * Score a chosen annealing sequence against the one `findanneal` would have picked for it.
 *
 * **THE 3' END IS THE ANCHOR, AND THAT IS WHAT MAKES THIS WELL DEFINED.** Re-deriving a primer
 * exactly would need the window the designer passed, which a construction file does not record.
 * What it does record is where the oligo anneals, and a primer's 3' end is fixed by the junction
 * it was designed for. So the question asked here is the answerable one: *given that 3' end, is
 * this what the tool would have chosen?* The window is the `ANNEAL_WINDOW` bases ending there,
 * and `findanneal` is run locked to the same 3' end.
 *
 * A worse score than the tool's is not proof of improvisation — a designer may have had a reason
 * — but it is the thing to look at, and it comes with the alternative so the reason can be
 * judged rather than assumed.
 *
 * @param {string} chosen - the annealing sequence as the design used it
 * @param {string} template - the sequence it anneals to, either strand, linear
 * @return {{found: boolean, strand?: string, chosen?: string, chosenScore?: number,
 *   best?: string, bestScore?: number, delta?: number}} the comparison, or `found: false` when
 *   the anneal is not in the template at all — which is a different finding, not a bad score
 */
export function auditAnneal(chosen, template) {
  const seq = chosen.toUpperCase();
  const top = template.toUpperCase();
  const bottom = revcomp(top);

  let strand = null, at = top.indexOf(seq);
  if (at >= 0) strand = 'top';
  else {
    at = bottom.indexOf(seq);
    if (at >= 0) strand = 'bottom';
  }
  // A primer that does not appear in its own template is not a scoring question. It is either
  // the wrong template or a sequence nobody checked, and reporting it as a low score would
  // bury it among designs that are merely suboptimal.
  if (!strand) return { found: false };

  const strandSeq = strand === 'top' ? top : bottom;
  const end = at + seq.length;
  const window = strandSeq.slice(Math.max(0, end - ANNEAL_WINDOW), end);
  const best = findanneal(window, false, true);
  const chosenScore = scoreanneal(seq);
  const bestScore = scoreanneal(best);

  return {
    found: true, strand, chosen: seq, chosenScore, best, bestScore,
    delta: Number((bestScore - chosenScore).toFixed(6)),
  };
}

/** A string literal of twelve or more bases is DNA somebody typed, wherever it appears. */
const DNA_LITERAL = /(['"`])([ACGTacgt]{12,})\1/g;
/** An import is C6's own if it resolves inside this repository. */
const IMPORT = /^\s*import\s[^;]*?from\s+['"]([^'"]+)['"]/gm;
const NODE_BUILTIN = /^node:/;

/**
 * Read a design script and report what it did by hand.
 *
 * Two findings, both deterministic and both about the script's text rather than its output:
 *
 * **A bare DNA literal** — twelve or more bases in a quoted string. This is the whole mechanism
 * that makes a design script reviewable: an improvised oligo is glaring here in a way the same
 * thirty characters are not inside a construction file. Not every literal is wrong — a known
 * cut site or a short linker is legitimately typed — so these are REPORTED, each with its line,
 * for a person to accept or reject.
 *
 * **A foreign import** — anything that is not this repository or a node builtin. A second
 * implementation of an oligo designer smuggled in from elsewhere would make every other check
 * here meaningless, because the script would genuinely be calling a tool; it would just not be
 * C6's.
 *
 * **WHAT THIS CANNOT SEE IS A VALUE COMPUTED CORRECTLY FOR THE WRONG REASON.** It reads text.
 * It cannot tell that a number came from the right function, only that a function was called and
 * no sequence was typed. `auditAnneal` is the half that checks an actual value.
 *
 * @param {string} source - the design script's source
 * @return {{literals: Array<{line: number, text: string}>, foreignImports: Array<{line: number,
 *   module: string}>}} every hand-typed sequence and every import from outside C6
 */
export function auditScript(source) {
  const lineOf = (index) => source.slice(0, index).split('\n').length;
  const literals = [];
  for (const m of source.matchAll(DNA_LITERAL)) {
    literals.push({ line: lineOf(m.index), text: m[2].toUpperCase() });
  }
  const foreignImports = [];
  for (const m of source.matchAll(IMPORT)) {
    const mod = m[1];
    const own = mod.startsWith('.') || mod.startsWith('/');
    if (!own && !NODE_BUILTIN.test(mod)) foreignImports.push({ line: lineOf(m.index), module: mod });
  }
  return { literals, foreignImports };
}
