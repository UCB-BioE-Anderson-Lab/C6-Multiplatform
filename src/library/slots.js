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

/**
 * Every member of every slot's bin that would carry `sites`, with the junction context included.
 *
 * **WHY THE SKELETON CANNOT ANSWER THIS.** A slot holds N in the skeleton, and N does not spell
 * CGTCTC — so `sequence.indexOf(site)` finds only the sites in constant regions and reports a clean
 * count for a pool in which some members carry an extra site and assemble wrongly. That is the
 * silent-wrong-answer this module exists to prevent, and it is invisible from the skeleton alone.
 *
 * **JUNCTION CONTEXT IS NOT OPTIONAL.** A site can be created ACROSS a slot/constant boundary by a
 * filler that carries no site itself, so each member is screened as
 * `(last k-1 of the preceding constant) + member + (first k-1 of the following constant)`.
 * Screening the filler alone misses exactly the cases nobody would think to look for.
 *
 * absence-ok, and the two absences are DIFFERENT:
 *   - a slot with a declared bin and no hits  -> [] , a real all-clear
 *   - a slot with NO bin declared             -> a finding with `unscreenable: true`
 * "No member carries a site" and "nobody said what the members are" must never render the same.
 *
 * @returns {Array<{slot, unscreenable?, members?}>} one entry per slot that is a problem; [] if none
 */
export function screenBinsForSite(poly, sites, { max = 5 } = {}) {
  if (!hasSlots(poly)) return [];
  const pats = (Array.isArray(sites) ? sites : [sites]).filter(Boolean).map((x) => x.toUpperCase());
  if (!pats.length) return [];
  const k = Math.max(...pats.map((p) => p.length));
  const seq = poly.sequence.toUpperCase();
  const out = [];

  for (const s of poly.slots) {
    const bin = s.bin;
    if (!Array.isArray(bin) || !bin.length) {
      out.push({ slot: s.name, unscreenable: true });
      continue;
    }
    const before = seq.slice(Math.max(0, s.start - (k - 1)), s.start);
    const after = seq.slice(s.end, s.end + (k - 1));
    const bad = [];
    for (let i = 0; i < bin.length; i++) {
      const entry = bin[i];
      const member = String(typeof entry === 'string' ? entry : entry.sequence || '').toUpperCase();
      const ctx = before + member + after;
      if (pats.some((p) => ctx.includes(p))) {
        bad.push(typeof entry === 'string' ? `#${i}` : (entry.name || `#${i}`));
      }
    }
    if (bad.length) out.push({ slot: s.name, members: bad, total: bin.length, shown: max });
  }
  return out;
}

/**
 * Render `screenBinsForSite`'s findings as the sentence an operation throws.
 *
 * Golden Gate throws if ANY member fails, by JCA's ruling of 2026-09-20: *"if anything fails in
 * golden gate, you throw the error."* Not a reduced pool, not a count, not a partition — a library
 * that is 95% fine still throws, because a plan that quietly drops members is worse than one that
 * stops. See docs/OLIGOPOOL-SPEC.md §8.5.
 */
export function describeSiteFindings(findings, enzymeName, operation) {
  return findings.map((f) => {
    if (f.unscreenable) {
      return `${operation} cannot guarantee that every member of slot "${f.slot}" survives ` +
             `${enzymeName}: no bin is declared for it, so its contents were never screened. ` +
             `A member carrying an extra ${enzymeName} site assembles wrongly and the skeleton ` +
             `cannot show it — N does not spell the site. Declare the bin, or simulate one member.`;
    }
    const shown = f.members.slice(0, f.shown).join(', ');
    const more = f.members.length > f.shown ? `, and ${f.members.length - f.shown} more` : '';
    return `${f.members.length} of ${f.total} members of slot "${f.slot}" carry a ${enzymeName} ` +
           `site (${shown}${more}), counting sites created at the slot's boundaries. ` +
           `${operation} throws if ANY member fails rather than assembling the rest, so this stops ` +
           `here — see docs/OLIGOPOOL-SPEC.md §8.5.`;
  }).join('\n');
}

/**
 * The slots of `poly` as they fall on `sequence.slice(start, end)`, re-based to the new origin.
 *
 * **A PARTIALLY RETAINED SLOT THROWS RATHER THAN BEING CLIPPED.** Half a variable region is a
 * different library, not a smaller one: its bin no longer describes its contents, its length range
 * is wrong, and every member's identity has changed. Silently truncating one would produce a pool
 * object that looks well-formed and describes nothing real.
 *
 * In practice this should be unreachable, because every operation guards its footprint first and a
 * cut never lands inside a slot. It throws anyway — an invariant nobody can violate is cheap to
 * check and the check is how you find out it was violable.
 *
 * absence-ok: no slots -> null, which is what an ordinary Polynucleotide carries.
 */
export function sliceSlots(poly, start, end) {
  if (!hasSlots(poly)) return null;
  const kept = [];
  for (const s of poly.slots) {
    const inside = s.start >= start && s.end <= end;
    const outside = s.end <= start || s.start >= end;
    if (outside) continue;
    if (!inside) {
      throw new Error(
        `Slot "${s.name}" (${s.start}-${s.end}) is only partly inside the retained region ` +
        `${start}-${end}. Half a variable region is a different library, not a smaller one, so ` +
        `nothing is returned — see docs/OLIGOPOOL-SPEC.md §5.3.`
      );
    }
    kept.push({ ...s, start: s.start - start, end: s.end - start });
  }
  return kept.length ? kept : null;
}

/**
 * Combine slot sets from concatenated pieces. `parts` is [{poly, from, to, pad}] in output order:
 * the piece contributes `poly.sequence.slice(from, to)`, plus `pad` characters of joining sequence
 * that belong to no piece.
 *
 * **OCCUPANCY DOES NOT SURVIVE A JOIN OF TWO DIFFERENT LIBRARIES.** Two pools each carrying their
 * own member list produce, on assembly, the product of both — which is §4.1.1, and is not
 * implemented. So this returns slots but sets occupancy to null when more than one input had it,
 * and the caller must not present the result as though its membership were known.
 */
export function concatSlots(parts) {
  const out = [];
  let offset = 0, withOccupancy = 0;
  for (const p of parts) {
    const from = p.from ?? 0;
    const to = p.to ?? (p.poly?.sequence?.length ?? 0);
    const sliced = p.poly ? sliceSlots(p.poly, from, to) : null;
    if (sliced) for (const s of sliced) out.push({ ...s, start: s.start + offset, end: s.end + offset });
    if (p.poly?.occupancy) withOccupancy++;
    offset += (to - from) + (p.pad ?? 0);
  }
  return { slots: out.length ? out : null, occupancy: withOccupancy === 1
    ? (parts.find((p) => p.poly?.occupancy)?.poly.occupancy ?? null) : null };
}

/** Copy library fields onto a freshly built product. Returns `product` for chaining. */
export function carry(product, { slots, occupancy }) {
  if (slots) product.slots = slots;
  if (occupancy) product.occupancy = occupancy;
  return product;
}

/** Slots as they fall on `revcomp(sequence)`. A slot [a,b) on length L becomes [L-b, L-a). */
export function slotsAfterRevcomp(slots, L) {
  if (!slots) return null;
  return slots.map((s) => ({ ...s, start: L - s.end, end: L - s.start }));
}

/**
 * Slots after `seq.slice(i) + seq.slice(0, i)`, the rotation PCR applies to its template.
 *
 * **A SLOT STRADDLING THE ROTATION POINT THROWS.** Rotating cuts the string at `i` and moves the
 * head to the tail; a slot spanning that cut would arrive as two disjoint pieces of one variable
 * region, which no single interval can describe. Refusing is the only honest answer, and for a
 * linear template with its forward primer at the 5' end — the ordinary case, and Tlib3's — `i` is 0
 * and nothing moves at all.
 */
export function slotsAfterRotate(slots, i, L) {
  if (!slots) return null;
  if (!i) return slots;
  return slots.map((s) => {
    if (s.start < i && s.end > i) {
      throw new Error(
        `Slot "${s.name}" (${s.start}-${s.end}) straddles the point the template is rotated about ` +
        `(${i}), so it would arrive as two disjoint pieces of one variable region. ` +
        `See docs/OLIGOPOOL-SPEC.md §5.3.`
      );
    }
    const shift = (p) => (p - i + L) % L;
    const start = shift(s.start);
    return { ...s, start, end: start + (s.end - s.start) };
  });
}

/**
 * Which slot a primer targets, and every value of that slot's bin it binds — docs/OLIGOPOOL-SPEC §5.2.
 *
 * **EVERY VALUE IS TESTED. There is no first-hit short-circuit**, and that is the one place JCA's
 * statement of the algorithm needed tightening. Stopping at the first bin value that binds costs
 * nothing to avoid — the slot's values are enumerated either way — and silently destroys the
 * assertion the whole apparatus is for: if a subpool primer bound two indices, first-hit-wins
 * reports 30 members where the truth is 60, and cross-priming becomes invisible.
 *
 * Counterexample-guided: only slots are searched, never the whole member list, so cost is
 * O(values in the implicated slot) rather than O(members).
 *
 * absence-ok: no slot binds -> []. That is "this primer matches nothing here", which is a real
 * answer and the caller's existing no-product error, not an internal failure.
 *
 * @returns {Array<{slot, values: string[]}>}
 */
export function refineForPrimer(poly, site) {
  if (!hasSlots(poly) || !site) return [];
  const s3 = String(site).toUpperCase();
  const rc = s3.split('').reverse().map((c) => ({ A: 'T', C: 'G', G: 'C', T: 'A' }[c] || c)).join('');
  const out = [];
  for (const slot of poly.slots) {
    if (!Array.isArray(slot.bin)) continue;
    const before = poly.sequence.slice(Math.max(0, slot.start - s3.length + 1), slot.start);
    const after = poly.sequence.slice(slot.end, slot.end + s3.length - 1);
    const values = slot.bin.filter((v) => {
      const ctx = (before + v + after).toUpperCase();
      return ctx.includes(s3) || ctx.includes(rc);
    });
    if (values.length) out.push({ slot: slot.name, values });
  }
  return out;
}

/**
 * A copy of `poly` with one slot resolved to a single value: that slot becomes constant sequence,
 * the remaining slots keep their N-runs at corrected offsets, and occupancy narrows to the members
 * carrying the value.
 *
 * **THE SLOT LEAVES THE PRODUCT ENTIRELY.** This is the arity collapse of §5.3: a refined pool has
 * one fewer variable region than it started with, so everything downstream of it is cheaper and
 * the frozen region is ordinary DNA from here on.
 *
 * Narrowing the member list is only possible because the slot remembers which columns of the
 * members table built its bin (`slot.cols`). Without that the result would carry the right sequence
 * and a membership count that was simply the old one — a number quietly describing a larger pool.
 */
export function refineTo(poly, slotName, value) {
  const slot = (poly.slots || []).find((s) => s.name === slotName);
  if (!slot) throw new Error(`No slot "${slotName}" to refine.`);
  const v = String(value).toUpperCase();
  const delta = v.length - (slot.end - slot.start);

  const out = Object.assign(Object.create(Object.getPrototypeOf(poly)), poly);
  out.sequence = poly.sequence.slice(0, slot.start) + v + poly.sequence.slice(slot.end);
  out.slots = poly.slots
    .filter((s) => s.name !== slotName)
    .map((s) => (s.start >= slot.end ? { ...s, start: s.start + delta, end: s.end + delta } : { ...s }));
  if (!out.slots.length) out.slots = null;

  const rows = poly.occupancy && poly.occupancy.rows;
  if (rows && Array.isArray(slot.cols)) {
    const keep = rows.filter((r) =>
      slot.cols.map((c) => String(r[c] || '')).join('').toUpperCase() === v);
    out.occupancy = { ...poly.occupancy, rows: keep, refined: [...(poly.occupancy.refined || []),
      { slot: slotName, value: v }] };

    // **THE SURVIVING SLOTS MUST BE REBUILT FROM THE MEMBERS THAT REMAIN, and this is correctness
    // rather than precision.** A slot keeping the whole pool's bin after refinement describes
    // members that are no longer in this pool: screening Tlib3's arnold subpool would test all 180
    // cassettes, and a BsmBI site in any of the other 150 would throw for a member arnold does not
    // contain. The answer would be wrong, not merely loose.
    //
    // Length ranges narrow with it. Before this, every subpool reported the whole pool's 220-248
    // when arnold is really 225-239 and utract 223-237 — a valid outer bound stated where a
    // tighter true one was available from the rows already in hand.
    if (out.slots) {
      out.slots = out.slots.map((s2) => {
        if (!Array.isArray(s2.cols) || !keep.length) return s2;
        const seen = new Set(), bin = [];
        for (const r of keep) {
          const x = s2.cols.map((c) => String(r[c] || '')).join('').toUpperCase();
          if (x && !seen.has(x)) { seen.add(x); bin.push(x); }
        }
        if (!bin.length) return s2;
        const lens = bin.map((x) => x.length);
        return { ...s2, bin, lengths: [Math.min(...lens), Math.max(...lens)] };
      });
    }
  }
  return out;
}
