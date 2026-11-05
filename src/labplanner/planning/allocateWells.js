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
  // **A CULTURE INHERITS THE WELL ITS COLONY WAS PICKED INTO, AND DOES NOT CHOOSE AGAIN.** The
  // picking sheet states the physical fact — "the block is inoculated as it is picked" — so the
  // colony and its culture are the same well by definition. JCA, 2026-11-04, on whether the
  // layout was even a question: *"you pick a colony into a well, and that well IS the culture."*
  //
  // Until now TWO things chose that address: this allocator, and the design modules' own
  // `layoutFor`. They agreed only because picking and inoculation are usually separate sessions,
  // so both cursors started at zero and both said A1, B1, C1, D1. With four constructs the pick
  // seats sixteen tubes in one order and the culture session starts counting again in another —
  // the pick fills B1 while the assay's well map says A2. A wrong address reads exactly like a
  // right one, so the cure is to delete a chooser rather than to make two agree.
  //
  // SPANS SESSIONS, because the pick and the inoculation usually are not the same sitting.
  const wellOfClone = new Map();
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
    // **WHAT IS ALREADY SITTING IN THIS VESSEL.** A culture that inherits its colony's well does
    // not advance the cursor — the seat was taken by the pick, not by this step — so the controls
    // seated from that cursor started at A1, on top of the first sample. Counting is not enough
    // once some wells arrive from somewhere else; the names that are taken have to be known.
    const seated = new Map();
    const take = (vessel, well) => {
      if (!seated.has(vessel)) seated.set(vessel, new Set());
      seated.get(vessel).add(well);
    };
    const nextFree = (vessel, shape) => {
      let i = cursor.get(vessel) ?? 0;
      let well = wellAt(i, shape);
      while (well && seated.get(vessel)?.has(well)) { i += 1; well = wellAt(i, shape); }
      cursor.set(vessel, i + 1);
      return well;
    };
    for (const bin of session.bins || []) {
      if (!PLACED.includes(bin.operation)) continue;
      // **THE CONTROLS SHARE THE BLOCK, AND SOMETHING HAS TO PLACE THEM TOO.** `design/culture.js`
      // and `design/assay.js` each worked their wells out with `layoutFor(picked + controls)`,
      // which is the count of ONE construct's clones and was right while an experiment had one.
      // With four constructs in one block the clones run to D4 and both pages went on saying the
      // control was in A2 — a well holding somebody else's culture. Whoever owns the cursor owns
      // every seat at the table, so the allocator places them and the designs read what it wrote.
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
        if (!vessel || vessel === 'tubes') continue;

        // INHERIT, AND DO NOT ADVANCE THE CURSOR — the seat is already taken by the colony that
        // is sitting in it. A culture with no pick above it (inoculated straight from a stock)
        // finds nothing here and is placed below, like anything else.
        //
        // **CHECKED BEFORE THE `well` GUARD, DELIBERATELY.** That guard exists so the allocator
        // only RE-seats a provisional address somebody already proposed; a culture arrives with
        // none, so skipping it here meant the inheritance never ran, the block's seats were never
        // counted, and the control was then seated at A1 on top of the first sample.
        // **`inputs` ON A PLANNED SAMPLE, `dnaInputs` ON A JOB** — the same split this file's
        // other comment records for `args`/`params`, and reading only one of them made the
        // inheritance a correct lookup that never matched: a culture sample carries `inputs`,
        // so `from` was always undefined and every culture fell through to being seated afresh.
        const upstream = job.inputs || job.dnaInputs || [];
        const from = upstream.map((n) => wellOfClone.get(String(n))).find(Boolean);
        if (bin.operation === 'culture' && from) {
          if (job.params) job.params = { ...job.params, well: from };
          else job.args = { ...job.args, well: from };
          take(vessel, from);
          continue;
        }
        if (!held?.well) continue;

        const shape = shapeOf(vessel);
        const well = nextFree(vessel, shape);
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
        // What the culture below will inherit. Keyed on the product name, which is what a
        // culture's `dnaInputs` names.
        // Under every name a later step might call it by.
        for (const n of [job.output, job.construct]) if (n) wellOfClone.set(String(n), well);
        take(vessel, well);
      }
      // **CONTROLS AFTER THE CLONES, NOT BEFORE THEM.** This ran first and `continue`d past the
      // job loop, so it seated controls from an empty cursor — right while a culture was one row
      // per construct, and wrong the moment a culture inherits its colony's well, because those
      // seats are taken before this chooses. The control was printed in A1, on top of the first
      // sample it shares the block with.
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
            const well = nextFree(vessel, shape);
            if (!well) break;
            seats.push(well);
            take(vessel, well);
          }
          const next = { ...held, controlWells: seats.join(',') };
          if (job.params) job.params = next; else job.args = next;
        }
      }
    }
  }
  return problems;
}
