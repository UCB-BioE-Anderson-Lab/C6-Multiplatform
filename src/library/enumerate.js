// enumerate.js — materialise a library's members, OUTSIDE the simulation path.
//
// JCA, 2026-09-20, ruling on where this belongs:
//
//   "I don't think we ever fully enumerate anything during simulation. We always do one variable
//    region at a time. But we could have a separate algorithm that inputs a library/oligopool and
//    enumerates its members. That might be useful for debugging and convincing ourselves that we
//    did this all right."
//
// So nothing in C6-Sim.js imports this, and nothing should. Occupancy stays symbolic inside the
// simulator; a 960-member parts library is a number there, not a structure.
//
// **IT IS ALSO THE VALIDATION INSTRUMENT**, which is the stronger reason for it to exist. The
// agreement test in docs/OLIGOPOOL-SPEC.md §7.4 uses Tlib3's hand-written 180-member sweep as an
// oracle because that sweep happens to exist. `enumerate` + per-member simulation is that same
// oracle for ANY library, which is what lets the check outlive Tlib3.
//
// THE THREE OUTCOMES ARE DIFFERENT AND MUST STAY DIFFERENT:
//
//   sparse, enumerated      read the member list                    Tlib3: 180
//   dense over finite bins  cross product of the bins               6 x 4 x 3 = 72
//   dense over a pattern    REFUSE, with the count                  N20: 4^20
//
// "Too large to enumerate" and "this library has no members" must never render the same. The
// second is a fabrication error (§8.2); the first is a fact about the request.
import { hasSlots, occupancyCount } from './slots.js';

export class TooLarge extends Error {
  constructor(count, limit) {
    super(`This library has ${count == null ? 'an unknown number of' : count.toLocaleString()} ` +
          `members, over the limit of ${limit.toLocaleString()}. That is a fact about the library, ` +
          `not an empty one — pass {limit} to raise it or {sample} to take some at random.`);
    this.count = count; this.limit = limit; this.name = 'TooLarge';
  }
}

/** Substitute one value per slot into the skeleton, right to left so offsets stay valid. */
function build(poly, values) {
  let seq = poly.sequence;
  const ordered = [...poly.slots].sort((a, b) => b.start - a.start);
  for (const s of ordered) {
    const v = values[s.name];
    if (v == null) continue;
    seq = seq.slice(0, s.start) + String(v).toUpperCase() + seq.slice(s.end);
  }
  return seq;
}

/**
 * Every member of `poly`, as `{ total, members: [{ sequence, slots, row? }], sampled? }`.
 *
 * @param {Polynucleotide} poly
 * @param {{limit?: number, sample?: number, seed?: number}} opts
 *        limit  — refuse above this many (default 100000)
 *        sample — return this many at random instead of refusing
 * @throws {TooLarge} when the count exceeds `limit` and no `sample` was asked for
 */
export function enumerate(poly, opts = {}) {
  const limit = opts.limit ?? 100000;

  // An ordinary molecule is a library of one. Returning [] here would be the "empty" answer, which
  // is a different thing entirely.
  if (!hasSlots(poly)) return { total: 1, members: [{ sequence: poly.sequence, slots: {} }] };

  const unbinned = poly.slots.filter((s) => !Array.isArray(s.bin) || !s.bin.length);
  if (unbinned.length) {
    throw new Error(
      `Cannot enumerate: variable ${unbinned.map((s) => `"${s.name}"`).join(', ')} ` +
      `${unbinned.length > 1 ? 'have' : 'has'} no declared bin, so nobody has said what its ` +
      `contents are. This is not an empty library — see docs/OLIGOPOOL-SPEC.md §8b.`);
  }

  const rows = poly.occupancy && poly.occupancy.rows;
  const fromRows = rows && poly.slots.every((s) => Array.isArray(s.cols));

  // --- sparse: the member list IS the answer, and the cross product would be wrong -------------
  // Tlib3 occupies 180 of 194,400 points. Enumerating its slots independently would produce
  // 194,220 molecules that were never synthesised.
  if (fromRows) {
    if (rows.length > limit && !opts.sample) throw new TooLarge(rows.length, limit);
    const pick = opts.sample ? sampleOf(rows, opts.sample) : rows;
    return {
      total: rows.length,
      sampled: opts.sample ? pick.length : undefined,
      members: pick.map((r) => {
        const values = {};
        for (const s of poly.slots) values[s.name] = s.cols.map((c) => String(r[c] || '')).join('');
        return { sequence: build(poly, values), slots: values, row: r };
      }),
    };
  }

  // --- dense: every combination of the bins ----------------------------------------------------
  const total = poly.slots.reduce((n, s) => n * s.bin.length, 1);
  if (total > limit && !opts.sample) throw new TooLarge(total, limit);

  const members = [];
  if (opts.sample && total > opts.sample) {
    for (let i = 0; i < opts.sample; i++) {
      const values = {};
      for (const s of poly.slots) values[s.name] = s.bin[Math.floor(Math.random() * s.bin.length)];
      members.push({ sequence: build(poly, values), slots: values });
    }
    return { total, sampled: members.length, members };
  }
  const walk = (i, values) => {
    if (i === poly.slots.length) {
      members.push({ sequence: build(poly, values), slots: { ...values } });
      return;
    }
    const s = poly.slots[i];
    for (const v of s.bin) { values[s.name] = v; walk(i + 1, values); }
  };
  walk(0, {});
  return { total, members };
}

function sampleOf(arr, n) {
  if (n >= arr.length) return [...arr];
  const idx = new Set();
  while (idx.size < n) idx.add(Math.floor(Math.random() * arr.length));
  return [...idx].map((i) => arr[i]);
}

/** How many members, without building any of them. Null means unknown, which is not zero. */
export function countMembers(poly) {
  if (!hasSlots(poly)) return 1;
  return occupancyCount(poly.occupancy, poly.slots);
}
