// slots.js — the guard that makes the simulator SAFE for libraries before it is CAPABLE of them.
//
// See docs/OLIGOPOOL-SPEC.md §7.2. This module is step 2 of four, and it is deliberately the one
// that goes in first and everywhere.
//
// WHY THIS EXISTS AND WHY IT IS ONLY A GUARD. A Polynucleotide carrying `slots` has an inert N-run
// standing in for each variable region. Every operation that does NOT look inside a slot is already
// correct for a library, for free, because concatenation preserves an N-run — a Gibson join whose
// homology lies in constant sequence assembles a library exactly as it assembles one molecule.
//
// **That free correctness is also the hazard.** It means a half-taught simulator is not half-right:
// the taught operations answer, the untaught ones ALSO answer, confidently and wrongly, and from
// outside the two are indistinguishable. Partial library support without this guard is worse than
// no library support.
//
// So: every operation declares the region in which it makes a structural decision — its FOOTPRINT —
// and asserts no slot lies in it. An operation that has not been taught to refine then refuses
// instead of guessing, which is the same discipline C6-Sim.js already applies at the Gibson
// junction (see `assertNoSlotInFootprint`'s note on the degenerate-homology throw).
//
// THE FOOTPRINT PER OPERATION, from the spec's §6 table:
//
//   Gibson              the terminal HOMOLOGY_LENGTH at each junction
//   GoldenGate/Digest   recognition site + spacer + 4 nt overhang
//   PCR                 the primer annealing footprint; the 3' end is decisive
//   Transform           none — nothing about it is sequence-dependent
//
// A slot OUTSIDE the footprint passes through untouched. That is the whole rule.

/** True if this Polynucleotide describes a library rather than one molecule. */
export function hasSlots(poly) {
  return !!(poly && Array.isArray(poly.slots) && poly.slots.length);
}

/**
 * Every slot overlapping [start, end) on `poly.sequence`. Half-open, like `String.slice`.
 *
 * absence-ok: an ordinary Polynucleotide has no slots and yields [], which is the answer, not a
 * failure. A library whose slots all lie outside the window yields [] too, and that is the case
 * this whole module exists to let through.
 */
export function slotsOverlapping(poly, start, end) {
  if (!hasSlots(poly)) return [];
  const lo = Math.min(start, end), hi = Math.max(start, end);
  return poly.slots.filter((s) => s.start < hi && s.end > lo);
}

/**
 * Refuse, by name, if any slot lies in the region where `operation` makes a structural decision.
 *
 * **Fails closed and says which slot**, because "this operation cannot answer for a library" and
 * "this library is broken" are different findings and the caller must not confuse them. The error
 * names the operation, the slot and the window, so the message points at the missing capability
 * rather than at the user's construction file.
 *
 * This generalises the throw already at `C6-Sim.js`'s Gibson junction, which refuses degenerate
 * bases in the 20 nt that establish a join while letting degeneracy elsewhere ride through into the
 * product. That line is this rule, written for one operation before the rule had a name.
 *
 * @param {Polynucleotide} poly       the input being inspected
 * @param {number} start              footprint start, inclusive, into `poly.sequence`
 * @param {number} end                footprint end, exclusive
 * @param {string} operation          'Gibson' | 'GoldenGate' | 'Digest' | 'PCR' | ...
 * @param {string} [what]             what the footprint IS, for the message
 * @throws {Error} if any slot overlaps the footprint
 */
export function assertNoSlotInFootprint(poly, start, end, operation, what = 'its decision region') {
  const hit = slotsOverlapping(poly, start, end);
  if (!hit.length) return;
  const names = hit.map((s) => `"${s.name}" (${s.start}-${s.end})`).join(', ');
  throw new Error(
    `${operation} cannot yet resolve a library here: ${what} spans ${start}-${end}, which overlaps ` +
    `variable ${hit.length > 1 ? 'slots' : 'slot'} ${names}. The answer depends on which member ` +
    `you mean, so nothing is returned rather than one member's answer standing for the pool. ` +
    `Refining this slot is not implemented for ${operation} — see docs/OLIGOPOOL-SPEC.md §6.`
  );
}

/**
 * The declared length range of a slotted Polynucleotide, since `sequence.length` is a mean.
 *
 * **`sequence.length` on a library is a plausible WRONG number** and that is by ruling, not by
 * accident: the N-run sits at the pool's mean span so the size is useful for reading a gel and
 * choosing a PCR program, which is all it is for. Anything wanting a range asks here; anything
 * wanting an exact length is asking a question a library cannot answer.
 *
 * **`bound` is 'tight' or 'outer', and the difference is occupancy.** Summing each slot's extremes
 * assumes the extremes CO-OCCUR in some member — true for a dense library, where every combination
 * exists, and false for a sparse one, where the corners of the box may be empty.
 *
 * Measured on Tlib3, 2026-09-20: slot bounds give 242-270, the 180 real members span **243-270**.
 * The single member with the shortest cassette (73 nt) carries a 21 nt tail, not the shortest (19),
 * so (73,19) is a corner nothing occupies. One base, and harmless inside this number's declared
 * scope — reading a gel, choosing a PCR program — but it is an OVER-estimate and says so rather
 * than presenting a bounding box as a measurement.
 *
 * A tight range for a sparse library requires the member list, which is `enumerate(pool)` and
 * deliberately not in the simulation path. See docs/OLIGOPOOL-SPEC.md §8b.
 *
 * absence-ok: no slots -> {min, max} both the real length, because a single molecule IS its range.
 */
export function lengthRange(poly) {
  const n = poly?.sequence?.length ?? 0;
  if (!hasSlots(poly)) return { min: n, max: n, exact: true, bound: 'tight' };
  let min = n, max = n;
  for (const s of poly.slots) {
    const span = s.end - s.start;
    const [lo, hi] = Array.isArray(s.lengths) ? s.lengths : [s.length ?? span, s.length ?? span];
    min += lo - span;
    max += hi - span;
  }
  // Dense occupancy reaches every corner, so the arithmetic is exact. Anything else is an outer
  // bound, and an unknown occupancy is treated as sparse — assuming density would overstate.
  return { min, max, exact: false, bound: poly.occupancy === 'dense' ? 'tight' : 'outer' };
}
