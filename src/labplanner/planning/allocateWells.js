// allocateWells.js — which well each clone sits in, decided once the session is known.
//
// **A WELL IS A PROPERTY OF THE SESSION, NOT OF A JOB**, and that is the whole reason this file
// exists rather than a fix inside `expandClones`.
//
// `expandClones` lays a step's clones out with `layoutFor(n, shape)`, a pure function of the count,
// so every construct starts again at the top-left corner. One construct picking four colonies gets
// A1–D1 and is right. Four constructs picking four each is sixteen tubes going into ONE 24-well
// block, and four of them are told to sit in A1:
//
//     addSample(s10-pick-culture): label "A1" is used twice.
//
// **A RUNNING CURSOR THROUGH `expandClones` WOULD FIX THAT CASE AND BE WRONG IN GENERAL.** The same
// operation appears in two different sessions of one experiment — a verification pick after the
// cloning transformation, and a host pick after the electroporation — and those are two genuinely
// different pieces of plastic, weeks apart. A cursor that runs over the jobs cannot see the
// boundary between them, so it would carry the second block's numbering on from the first and put
// the first host colony in E1 of a block whose A1 is empty.
//
// So the allocation happens after `groupIntoSessions`, where the boundary is known, and it is the
// session that owns a cursor.
//
// ## What it does not do
//
// **It does not decide the clone designation.** A clone is `A` because it is the first colony of
// ITS construct; a well is `E1` because it is the fifth thing in the block. For one construct those
// coincide and for four they cannot, and holding them as one fact is what `naming.js` and
// `vessels.js` already separate — *"the vessel is about count; the name is about what kind of
// experiment it is."* A library is the exception and stays one: its clones are named by plate
// address because there are hundreds of them, and that address is the well.
//
// **It does not spill into a second block.** `layoutFor` already refuses to, and says why: *"Two
// blocks is a decision about the session, not about the layout."* That is still true when the
// session is what is counting, so a session whose clones outgrow their vessel is reported here and
// the plan carries the finding.
import { shapeOf, wellAt } from './vessels.js';

/** Steps whose products occupy a well of something shared. Anything else is not being placed. */
const PLACED = ['pick', 'culture'];


/**
 * Give every clone in a session a well of its own, counting across the whole sitting.
 *
 * One cursor per session per vessel, because that is the piece of plastic on the bench: four
 * constructs picked into one 24-well block fill A1 through D4, and the same operation in a later
 * session starts again at A1 of a new block.
 *
 * Mutates the jobs' `args.well` in place, which is where `design/pick.js` and `design/culture.js`
 * already read it from — so nothing downstream changes, and a session the allocator does not
 * recognise keeps whatever `expandClones` gave it.
 *
 * @param {Array} sessions  from `groupIntoSessions`
 * @returns {Array} problems, one per session-and-vessel whose clones outgrow it. **The caller must
 *   refuse on these rather than warn.** A session that outgrew its block leaves the clones it
 *   could not seat holding whatever `expandClones` guessed, which for two constructs is two sets
 *   of the same addresses — so a run that carried on would print the sentence that explains the
 *   problem AND, underneath it, `label "A1" is used twice`, which is the confusing pairing this
 *   whole file exists to remove.
 */
export function allocateWells(sessions) {
  const problems = [];
  for (const session of sessions || []) {
    // **ONCE PER SITTING PER VESSEL, NOT ONCE PER BIN.** The cursor spans the session and so does
    // the problem, so reporting from inside the job loop said the same sentence once for every bin
    // that overflowed — four times for four constructs. `expandClones` states the standard: report
    // *"once, here, where the cause is visible — not thirty times downstream where only the
    // symptom is."*
    const said = new Set();
    // ONE CURSOR PER VESSEL NAME, not one per session: a sitting that fills a 24-well block and a
    // 96-well plate is filling two different things, and a shared cursor would leave a hole in one
    // of them.
    const cursor = new Map();
    for (const bin of session.bins || []) {
      if (!PLACED.includes(bin.operation)) continue;
      // **THE CONTROLS SHARE THE BLOCK, AND SOMETHING HAS TO PLACE THEM TOO.** `design/culture.js`
      // and `design/assay.js` each worked their wells out with `layoutFor(picked + controls)`,
      // which is the count of ONE construct's clones and was right while an experiment had one.
      // With four constructs in one block the clones run to D4 and both pages went on saying the
      // control was in A2 — a well holding somebody else's culture. Whoever owns the cursor owns
      // every seat at the table, so the allocator places them and the designs read what it wrote.
      if (bin.operation === 'culture') {
        for (const job of bin.jobs || bin.samples || []) {
          const held = job.params || job.args;
          const vessel = held?.vessel;
          if (!vessel || vessel === 'tubes') continue;
          const controls = String(held.inoculate || '').split(',').map((t) => t.trim())
            .filter(Boolean);
          if (!controls.length) continue;
          const shape = shapeOf(vessel);
          const seats = [];
          for (let k = 0; k < controls.length; k += 1) {
            const i = cursor.get(vessel) ?? 0;
            const well = wellAt(i, shape);
            if (!well) break;
            seats.push(well);
            cursor.set(vessel, i + 1);
          }
          const next = { ...held, controlWells: seats.join(',') };
          if (job.params) job.params = next; else job.args = next;
        }
        continue;
      }
      for (const job of bin.jobs || bin.samples || []) {
        // **`args` ON A JOB, `params` ON A PLANNED SAMPLE, AND THIS RUNS AFTER THE RENAME.**
        // `cfToJobs` builds jobs carrying `args`; `planExperiment` projects them into bins whose
        // samples carry `params`, and `groupIntoSessions` works on those. Reading only `args` made
        // this a correct allocator that placed nothing, which is the shape the repository keeps
        // finding — so it reads whichever the object actually has and writes back to the same one.
        const held = job.params || job.args;
        const vessel = held?.vessel;
        // `tubes` IS A DECLARED ANSWER AND NOT AN ABSENT ONE. A clone in a tube has no well, and
        // giving it one would put an address on a thing that has no addresses.
        if (!vessel || vessel === 'tubes' || !held?.well) continue;
        const shape = shapeOf(vessel);
        const i = cursor.get(vessel) ?? 0;
        const well = wellAt(i, shape);
        if (!well) {
          if (!said.has(vessel)) {
            said.add(vessel);
            problems.push({ code: 'SESSION_OUTGROWS_VESSEL',
              cf: job.cf, line: job.line,
              message: `session ${session.index + 1}`
                + `${session.name ? ` (${session.name})` : ''} puts more than `
                + `${shape.rows * shape.cols} clones in one ${shape.name}. Two blocks is a decision `
                + 'about the session, not about the layout — split the picking across two sittings, '
                + `or say a larger \`vessel=\` on the line.` });
          }
          break;
        }
        if (job.params) job.params = { ...job.params, well };
        else job.args = { ...job.args, well };
        cursor.set(vessel, i + 1);
      }
    }
  }
  return problems;
}
