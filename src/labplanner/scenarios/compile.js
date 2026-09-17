/**
 * Compile a generated scenario folder the whole way — plan, sheets, issue, and the sheets coming
 * back — and say which of the two states it ended in.
 *
 * **THE ISSUE-AND-RECEIVE HALF BELONGS IN HERE, not in whatever is calling.** The `receipt.*` rules
 * live past the end of a compile and are the highest-consequence set in the toolkit: they are the
 * one place human-entered data gets in. A caller that stops at `jobsToLabSheets` is not measuring
 * them, and the last time a measurement stopped there it reported six rules as unreachable that a
 * test had been exercising all along. → `test/labplanner/scenarios.test.js § COLD`
 *
 * This module exists because that test and `coverage.js` both need the same compile, and two copies
 * of it are two descriptions of one thing, free to disagree — the defect this repository keeps
 * finding in its own inputs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { planExperiment } from '../planning/planExperiment.js';
import { jobsToLabSheets } from '../planning/jobsToLabSheets.js';
import { projectSequences } from '../planning/projectSequences.js';
import { ensureInventory } from '../../inventory/io.js';
import { spotsNeeded, issue, resolve } from '../planning/issue.js';

/** The construction and characterization files in a folder, in the shape `planExperiment` wants. */
export function filesOf(dir) {
  return fs.readdirSync(dir)
    .filter((f) => /^(construction|characterization) of .*\.txt$/i.test(f))
    .map((n) => ({ name: n.replace(/^(construction|characterization) of |\.txt$/gi, ''),
                   text: fs.readFileSync(path.join(dir, n), 'utf8'),
                   characterization: /^characterization/i.test(n) }));
}

/**
 * @returns {{outcome:'compiles', packet, plan, issued}|{outcome:'refuses', message:string}}
 */
export function compileScenario(dir) {
  const cfs = filesOf(dir);
  const invPath = path.join(dir, 'inventory.txt');
  const inv = fs.existsSync(invPath)
    ? ensureInventory(fs.readFileSync(invPath, 'utf8'), 'inventory.txt') : null;
  // QUIET, BECAUSE A COMPILE REPORTS AS IT GOES and a caller running twenty-seven of them would
  // drown. What was reported is on `plan.problems`, which is where a caller should read it.
  const log = console.log;
  console.log = () => {};
  try {
    const plan = planExperiment({ cfs, sequences: projectSequences(dir), inventory: inv });
    // **THE ANSWERS FILE IS PART OF THE FOLDER AND WAS BEING IGNORED HERE.** `bin/c6-packet` passes
    // it and this did not, so the one scenario built to show a fully-answered compile still came
    // out of the test path carrying an open decision, while the report — which does pass it —
    // showed the same folder with none. Two readings of one folder, disagreeing, which is the
    // defect this module exists to prevent. Found 2026-09-17 while checking a claim by hand.
    const aPath = path.join(dir, 'answers.json');
    const answers = fs.existsSync(aPath) ? JSON.parse(fs.readFileSync(aPath, 'utf8')) : {};
    const packet = jobsToLabSheets(plan, { experiment: path.basename(dir), answers });
    const needed = spotsNeeded({ sheets: packet.sheets });
    let issued = null;
    if (needed.length && inv) {
      issued = issue(inv, needed, { by: 'scenarios', since: '2026-09-15' });
      const back = {};
      for (const [i, a] of issued.assignments.entries()) back[a.construct] = i === 0 ? '' : a.well;
      resolve(issued.inventory, issued.assignments, back, { proposed: issued.proposed });
    }
    return { outcome: 'compiles', packet, plan, issued };
  } catch (e) {
    return { outcome: 'refuses', message: String(e.message || e) };
  } finally { console.log = log; }
}

/**
 * Send four differently-wrong answers back for one issued set, and keep what happened.
 *
 * Each of the four is one string somebody could write in the well column of a returned workbook:
 * prose instead of a well, a well outside the box, the right one, and the right one twice.
 */
export function returnedSheets(r) {
  if (!r || !r.issued || r.issued.assignments.length < 2) return null;
  const [a, b] = r.issued.assignments;
  const send = (inv, one, said, opts = {}) => resolve(inv, [one], { [one.construct]: said }, opts);
  const { proposed } = r.issued;
  const unreadable = send(r.issued.inventory, a, 'top shelf', { proposed });
  const outside = send(r.issued.inventory, a, 'Z99', { proposed });
  const landed = send(r.issued.inventory, a, a.well, { proposed });
  return { unreadable, outside, landed,
           overwritten: send(landed.inventory, b, a.well),
           twice: send(landed.inventory, a, a.well) };
}
