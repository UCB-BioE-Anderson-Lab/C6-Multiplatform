/**
 * The three phases of a labsheet, and the only one with consequences.
 *
 * JCA, 2026-09-13, settling when the inventory may be written:
 *
 * > *"The checkpoint system we have said is activated once it is issued to the students by cortex.
 * > I think at that point you'd want to put in the holds, and then resolve the holds when the
 * > labsheet is returned. That will distinguish a planning phase, where the experiment may be
 * > revised many times and should not have consequences, to one where an official plan has been
 * > said and the process initiated."*
 *
 * | phase | what exists | the inventory |
 * |---|---|---|
 * | **planning** | a packet, recompiled as often as anybody likes | untouched |
 * | **issued** | it has been handed to somebody, and the checkpoints are live | spots are **held** |
 * | **returned** | a filled-in workbook | holds **resolved** to samples, or let go |
 *
 * **A COMPILE HAS NO CONSEQUENCES, AND THAT IS THE POINT.** An experiment gets revised — a
 * different oligo, one more clone, a whole branch abandoned — and every revision recompiles. If
 * compiling reserved freezer space, a morning's thinking would leave a trail of holds nobody
 * placed deliberately and nobody knows to release. Issuance is a deliberate act by a person, and
 * it is the same act that starts the checkpoints, so the two states stay in step by construction.
 *
 * **AND THE STUDENT IS THE SOURCE OF TRUTH ON RETURN.** A hold says where we expected the tube to
 * go; the returned sheet says where it went. They disagree often, and when they do the sheet wins
 * and the hold is let go — an inventory that recorded the expectation would be a prediction
 * written down as a fact, which is exactly what holds exist to avoid.
 */
import { hold, release, isAvailable, upsertSample, locKey, holdAt, addBox } from '../../inventory/inventory.js';
// WHAT ONE ROW OF A RETURNED SHEET MEANS is a rule set of its own.
import { choose } from '../rules/receipt.rules.js';

/** A1-style name for a 0-based row and column, for what a person writes on a box. */
const wellName = (row, col) => `${String.fromCharCode(65 + row)}${col + 1}`;

/** Parse `A1` back to 0-based row and column, or null. */
export function wellAt(name) {
  const m = String(name || '').trim().match(/^([A-Za-z])(\d{1,2})$/);
  if (!m) return null;
  return { row: m[1].toUpperCase().charCodeAt(0) - 65, col: Number(m[2]) - 1 };
}

/**
 * Every tube this packet will produce that needs a home, in the order the sessions run.
 *
 * A sheet asks for a home by carrying a `Box` column — which is how the miniprep design says *this
 * set belongs in that box, and the well is a fact nobody has yet*. Anything without one is a tube
 * that goes somewhere else, or no tube at all.
 *
 * @param {Object} packet  from `bin/c6-packet`
 * @returns {Array<{sheet: string, construct: string, box: string}>}
 */
export function spotsNeeded(packet) {
  const out = [];
  for (const sheet of packet.sheets || []) {
    for (const row of sheet.samples || []) {
      const box = String(row.Box ?? '').trim();
      if (!box) continue;
      const construct = String(row.label ?? row.construct ?? '').trim();
      if (!construct) continue;
      out.push({ sheet: sheet.id, construct, box });
    }
  }
  return out;
}

/**
 * Issue a packet: choose a well for every tube it will make, and hold it.
 *
 * **CHOOSES BY `isAvailable`, NEVER `isOccupied`.** Two packets issued the same afternoon that
 * both take "the next unoccupied well" collide, and the collision is found by somebody standing at
 * the −20 with a tube in their hand. A held spot is not available.
 *
 * **CONSECUTIVE WHERE IT CAN BE.** A set that will be used together goes in adjacent wells,
 * because a person retrieving four clones of one construct reads along a row, not around a box.
 * This is a preference and not a requirement: it takes the first run long enough, and failing that
 * takes what is free.
 *
 * A box that cannot fit the set is a problem reported, not a partial issue — half a set placed and
 * half refused is worse than knowing before anybody starts.
 *
 * @param {Object} inv     the inventory
 * @param {Array} needed   from `spotsNeeded`
 * @param {{by: string, since?: string}} claim  who is issuing, and when
 * @param {{newBoxes?: Object.<string,{rows,cols}>}=} opts  shapes for boxes not yet defined
 * @returns {{inventory, assignments, problems, proposed}}
 */
export function issue(inv, needed, claim, opts = {}) {
  if (!claim || !claim.by) throw new Error('issue: an issue needs an owner — see `hold`.');
  const problems = [];
  const assignments = [];
  const proposed = [];
  let next = inv;

  // **IDEMPOTENT BY OWNER AND CONSTRUCT.** Re-issuing the same experiment used to mint a SECOND
  // set of holds and orphan the first: four holds for two tubes, two of them belonging to nobody
  // who would ever release them — the stale-hold failure mode, created by the tool that exists to
  // avoid it. Somebody re-runs a command; that must not be a way to lose freezer space.
  //
  // Same rule `promise.declare` follows, for the same reason: *"Re-running must not fail and must
  // not mint a second code."* A hold this owner already has for this construct IS the answer.
  const already = new Map();
  for (const h of Object.values(inv.holds || {})) {
    if (h.by === claim.by && h.why) already.set(`${h.location.boxname}\u0000${h.why}`, h);
  }

  // Grouped by box, so a set lands together rather than wherever the walk happens to be.
  const byBox = new Map();
  for (const n of needed) {
    const kept = already.get(`${n.box}\u0000${n.construct}`);
    if (kept) {
      assignments.push({ ...n, well: wellName(kept.location.row, kept.location.col),
                         row: kept.location.row, col: kept.location.col,
                         key: locKey(kept.location), kept: true });
      continue;
    }
    if (!byBox.has(n.box)) byBox.set(n.box, []);
    byBox.get(n.box).push(n);
  }

  for (const [boxname, wanted] of byBox) {
    let box = next.boxes[boxname];

    // A BOX MAY BE REAL AND UNDEFINED. JCA, 2026-09-13, on `cheese_temp`: *"I think it is a real
    // box in the lab, but I bet I never made a box file for it. LabPlanner will sometimes need to
    // define and name a new box, and upon receipt of the completed labsheet, it would need to
    // AddBox(boxname) to the inventory to account for it."*
    //
    // So a name nothing defines is not an error — it is a box that has not been written down yet,
    // and the phases apply to it exactly as they do to a tube. **Proposed at issue, created on
    // receipt.** An experiment that is abandoned never brings a box into being, which is the same
    // reason a hold is not an occupancy record.
    //
    // THE SHAPE IS NOT GUESSED. A box's geometry is physical, and getting it wrong means holding
    // wells that do not exist. The caller supplies it; `issue` refuses without one rather than
    // taking the commonest shape in the inventory, which is an inference about a plastic object
    // from a spreadsheet.
    if (!box) {
      const shape = (opts.newBoxes || {})[boxname];
      if (!shape) {
        problems.push(`no box named "${boxname}" is defined — ${wanted.length} tube(s) would go `
                    + 'there. It may be a real box nobody has written down yet: say its shape to '
                    + 'propose it, or change `box=` on the step.');
        continue;
      }
      box = { name: boxname, rows: shape.rows, cols: shape.cols };
      next = addBox(next, box);
      proposed.push({ ...box, why: `named by ${wanted.length} tube(s) and not in the inventory` });
    }
    const free = [];
    for (let r = 0; r < box.rows; r += 1) {
      for (let c = 0; c < box.cols; c += 1) {
        if (isAvailable(next, { boxname, row: r, col: c })) free.push({ row: r, col: c });
      }
    }
    if (free.length < wanted.length) {
      problems.push(`"${boxname}" has ${free.length} free well(s) and this needs `
                  + `${wanted.length}. Nothing was held for it.`);
      continue;
    }
    const run = firstRun(free, wanted.length, box.cols) || free.slice(0, wanted.length);
    for (const [i, n] of wanted.entries()) {
      const loc = { boxname, row: run[i].row, col: run[i].col };
      next = hold(next, loc, { by: claim.by, why: n.construct,
                               ...(claim.since ? { since: claim.since } : {}) });
      assignments.push({ ...n, well: wellName(loc.row, loc.col), row: loc.row, col: loc.col,
                         key: locKey(loc) });
    }
  }
  // `proposed` is carried OUT rather than written anywhere: a proposed box exists in this
  // function's working inventory so wells can be counted in it, and becomes real only when
  // `c6-receive` sees that the tubes were actually made.
  return { inventory: next, assignments, problems, proposed };
}

/** The first run of `n` consecutive free wells reading along rows, or null. */
function firstRun(free, n, cols) {
  for (let i = 0; i + n <= free.length; i += 1) {
    let ok = true;
    for (let k = 1; k < n; k += 1) {
      const a = free[i + k - 1];
      const b = free[i + k];
      const consecutive = (b.row === a.row && b.col === a.col + 1)
                       || (b.row === a.row + 1 && a.col === cols - 1 && b.col === 0);
      if (!consecutive) { ok = false; break; }
    }
    if (ok) return free.slice(i, i + n);
  }
  return null;
}

/**
 * Resolve an issue against what came back: the sheet says where the tube went.
 *
 * Three outcomes per assignment, and the second is the common one:
 *
 *   **placed where we expected** — the hold becomes a sample at that well
 *   **placed somewhere else**    — the sample goes where the SHEET says, and the held well is let
 *                                  go. The student was standing at the freezer and we were not.
 *   **never made**               — no well came back, so the hold is released and nothing is
 *                                  recorded. An aborted experiment leaves no trace in the freezer.
 *
 * @param {Object} inv
 * @param {Array} assignments  from `issue`
 * @param {Object.<string,string>} returned  construct -> the well written on the returned sheet
 * @param {{proposed?: Array<{name,rows,cols}>}=} opts  boxes the issue proposed
 * @returns {{inventory, placed, released, problems, created}}
 */
export function resolve(inv, assignments, returned = {}, opts = {}) {
  let next = inv;
  const placed = [];
  const released = [];
  const problems = [];
  const created = [];

  // A PROPOSED BOX IS BROUGHT INTO BEING HERE, and only far enough to put something in it — the
  // rest of the check is below, after we know whether anything landed. JCA, 2026-09-13: *"upon
  // receipt of the completed labsheet, it would need to AddBox(boxname) to the inventory to
  // account for it."* Receipt, not issue: an experiment that was abandoned should not leave a box
  // in the inventory any more than it leaves a tube in a well.
  for (const box of opts.proposed || []) {
    if (!next.boxes[box.name]) next = addBox(next, { name: box.name, rows: box.rows, cols: box.cols });
  }

  for (const a of assignments) {
    // **WHAT ONE ROW MEANS IS A RULE** — `rules/receipt.rules.js`. Six outcomes, ordered by how
    // sure we are, and the order matters: an unreadable well has to be caught before an occupied
    // one, or the occupancy check runs against a parsed nonsense coordinate.
    const box = next.boxes[a.box];
    const parsed = wellAt(String(returned[a.construct] ?? '').trim());
    const loc = parsed ? { boxname: a.box, row: parsed.row, col: parsed.col } : null;
    const sitting = loc ? next.samples[locKey(loc)] : null;
    const well = parsed ? wellName(parsed.row, parsed.col) : '';

    const got = choose({ returned: returned[a.construct], construct: a.construct,
                         boxName: a.box, box, sitting, well, wellAt, wellName });

    // THE HOLD GOES EITHER WAY, except where the well is occupied — there we do not yet know what
    // happened, and letting the reservation go would lose the only record that something was
    // expected. Whether the tube landed where we guessed or not, the reservation has done its job
    // the moment the answer is known, and a hold left behind is the failure mode.
    if (got.outcome !== 'conflict') {
      next = release(next, { boxname: a.box, row: a.row, col: a.col });
    }
    if (got.problem) problems.push(got.note);

    if (got.outcome === 'released') { released.push({ ...a, why: got.tag }); continue; }
    if (got.outcome === 'conflict') continue;
    if (got.already) {
      placed.push({ ...a, held: a.well, well, asExpected: well === a.well, already: true });
      continue;
    }
    next = release(next, loc);
    next = upsertSample(next, { construct: a.construct, location: { ...loc, label: a.construct } });
    // BOTH WELLS, because the interesting case is when they differ and a report that has
    // overwritten the held one cannot say what was let go.
    placed.push({ ...a, held: a.well, well, asExpected: well === a.well });
  }
  // **A BOX NOBODY PUT ANYTHING IN IS NOT A BOX.** It was proposed on the strength of a plan, and
  // if every tube that was going there was never made, creating it records a plastic object that
  // may not exist — the same error as recording a tube that was never made, one container up.
  for (const box of opts.proposed || []) {
    const landed = placed.some((p) => p.box === box.name);
    if (landed) { created.push(box); continue; }
    // MEMBERSHIP OF `proposed` IS THE PROOF THAT THIS ISSUE MADE IT. `issue` only proposes a box
    // the inventory did not have, so there is nothing here that predates the issue — an earlier
    // version checked `inv.boxes` instead and could never be false, because `issue` returns an
    // inventory it has already added the box to.
    const boxes = { ...next.boxes };
    delete boxes[box.name];
    next = { ...next, boxes };
  }
  return { inventory: next, placed, released, problems, created };
}
