// src/labplanner/planning/recorded.js
//
// IS THE EXPERIMENT ACTUALLY RECORDED? Phase 5's gate, and the one stage whose failure is
// invisible from inside it.
//
// `c6-issue` holds a well for every tube the packet says will exist; `c6-receive` resolves those
// holds against the workbook that came back. Both halves work. What neither answers is the
// question somebody asks three months later: did everything that was promised get made, and is
// everything that was made written down?
//
// **A HOLD WITH NO SAMPLE AND A SAMPLE WITH NO HOLD ARE BOTH NORMAL, AND NEITHER IS NOTHING.**
// An experiment abandoned halfway leaves holds nobody will resolve, which is freezer space
// quietly promised to work that stopped. A tube made that nothing planned is a student doing
// something sensible that no record anticipated — a repeat, an extra clone — and it is the half
// that goes missing, because the inventory has it and the plan never mentions it.

/**
 * Did everything the experiment promised actually get made, and is every tube that exists
 * written down? Compares the wells held when the labsheet was issued against the samples the
 * returned sheet recorded.
 *
 * Matching is by construct, because that is what a hold carries: `c6-issue` writes the construct
 * into the hold's `why`, and a sample names its `construct` directly. Wells are deliberately not
 * matched on — THE SHEET WINS, and a tube that went into a different well than was held for it
 * is the normal case rather than a discrepancy.
 *
 * @param {Array<{why?: string, construct?: string, location?: Object}>} holds - holds placed at
 *   issue, as `labsheet.holds` reports them
 * @param {Array<{construct: string, location?: Object}>} samples - what the returned sheet
 *   recorded
 * @return {{resolved: string[], unresolved: Array, unplanned: Array, complete: boolean}} the
 *   constructs held and made, those held and not made, those made and never planned, and whether
 *   nothing is outstanding
 */
export function recordedAgainstHeld(holds, samples) {
  const made = new Map();
  for (const s of samples || []) {
    const c = String(s.construct ?? '');
    if (!c) continue;
    made.set(c, (made.get(c) || 0) + 1);
  }

  const held = new Set();
  const unresolved = [];
  for (const h of holds || []) {
    const c = String(h.construct ?? h.why ?? '');
    if (!c) continue;
    held.add(c);
    if (!made.has(c)) unresolved.push({ construct: c, location: h.location });
  }

  const resolved = [...held].filter((c) => made.has(c)).sort();
  const unplanned = [...made.keys()].filter((c) => !held.has(c)).sort()
    .map((c) => ({ construct: c, n: made.get(c) }));

  return { resolved, unresolved, unplanned, complete: unresolved.length === 0 };
}
