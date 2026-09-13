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
import { hold, release, isAvailable, upsertSample, locKey, holdAt } from '../../inventory/inventory.js';

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
 * @returns {{inventory, assignments: Array, problems: Array<string>}}
 */
export function issue(inv, needed, claim) {
  if (!claim || !claim.by) throw new Error('issue: an issue needs an owner — see `hold`.');
  const problems = [];
  const assignments = [];
  let next = inv;

  // Grouped by box, so a set lands together rather than wherever the walk happens to be.
  const byBox = new Map();
  for (const n of needed) {
    if (!byBox.has(n.box)) byBox.set(n.box, []);
    byBox.get(n.box).push(n);
  }

  for (const [boxname, wanted] of byBox) {
    const box = next.boxes[boxname];
    if (!box) {
      problems.push(`no box named "${boxname}" — ${wanted.length} tube(s) have nowhere to go. `
                  + 'Add the box to the inventory, or change `box=` on the step.');
      continue;
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
  return { inventory: next, assignments, problems };
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
 * @returns {{inventory, placed: Array, released: Array, problems: Array<string>}}
 */
export function resolve(inv, assignments, returned = {}) {
  let next = inv;
  const placed = [];
  const released = [];
  const problems = [];

  for (const a of assignments) {
    const said = String(returned[a.construct] ?? '').trim();
    // THE HOLD GOES EITHER WAY. Whether the tube landed where we guessed or not, the reservation
    // has done its job the moment the answer is known, and a hold left behind is the failure mode.
    next = release(next, { boxname: a.box, row: a.row, col: a.col });

    if (!said) { released.push({ ...a, why: 'nothing came back for it' }); continue; }
    const at = wellAt(said);
    if (!at) {
      problems.push(`${a.construct}: "${said}" is not a well name. The hold was released and `
                  + 'nothing recorded — fix the sheet and resolve again.');
      released.push({ ...a, why: `unreadable well "${said}"` });
      continue;
    }
    const loc = { boxname: a.box, row: at.row, col: at.col };
    const sitting = next.samples[locKey(loc)];
    if (sitting && sitting.construct !== a.construct) {
      // NOT OVERWRITTEN. Two tubes cannot be in one well, and the inventory disagreeing with the
      // freezer is the thing this whole mechanism exists to prevent — so it is reported to a
      // person rather than settled by whichever write came last.
      problems.push(`${a.construct} was written into ${a.box} ${said}, where the inventory `
                  + `already has ${sitting.construct}. Nothing was changed.`);
      continue;
    }
    const stillHeld = holdAt(next, loc);
    if (stillHeld && stillHeld.by !== assignments[0]?.by) { /* another issue's spot; sample wins */ }
    next = release(next, loc);
    next = upsertSample(next, { construct: a.construct, location: { ...loc, label: a.construct } });
    // BOTH WELLS, because the interesting case is when they differ and a report that has
    // overwritten the held one cannot say what was let go.
    placed.push({ ...a, held: a.well, well: said, asExpected: said === a.well });
  }
  return { inventory: next, placed, released, problems };
}
