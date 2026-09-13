/**
 * LabPlanner's public API: construction files in, a LabPacket out.
 *
 * ## What this was, and why it is worth saying
 *
 * Until 2026-09-13 `generateLabPacket` **returned an empty packet on its first line and said
 * nothing about it.** It guarded the whole pipeline behind
 *
 *     const canPlan = typeof CfToJobs.extractJobsFromCFs === 'function'
 *                  && typeof JobsToLabSheets.jobsToLabSheets === 'function';
 *
 * and `planning/jobsToLabSheets.js` was the two characters `export {}`. Below that guard, every
 * one of eleven stages was called through its own `typeof X === 'function'` — so four stages that
 * did not exist were skipped in silence and two that existed under other names were skipped too.
 * The function could not fail; it could only produce nothing.
 *
 * It survived because nothing called it. `bin/c6-plan` spelled the stages out in its own middle
 * and `bin/c6-packet` did `jobsToLabSheets`'s job inline, so the pipeline that worked and the
 * pipeline that was the published API were two different things, and only one of them ran.
 *
 * JCA, 2026-09-12: *"I'm not sure if we've gone off the rails because we have bypassed the
 * labsheet generation code we wrote, or we never really wrote it."* The second one.
 *
 * ## What it is now
 *
 * Two stages, neither optional, both of which the CLI also calls:
 *
 *   `planning/planExperiment.js`   CF text -> which labsheets, in what order, with what on each
 *   `planning/jobsToLabSheets.js`  that plan -> LabSheets, built through `models/labsheet.js`
 *
 * **No `typeof` guards.** A missing stage is a crash with a name in it, which is the only way a
 * missing stage can be noticed. The guards were there to let the pipeline be built incrementally,
 * and their cost was that finishing it was indistinguishable from not starting.
 */
import * as Models from './models/index.js';
import { planExperiment } from './planning/planExperiment.js';
import { jobsToLabSheets } from './planning/jobsToLabSheets.js';
import { labeller, labelPrefix } from './design/index.js';

export { Models };
export { planExperiment, jobsToLabSheets };

/**
 * Compile construction and characterization files into a packet of labsheets.
 *
 * @param {Array<{name:string, text:string, characterization?:boolean}>} cfs
 * @param {Object|null} inventory   merged inventory, or null to plan without one
 * @param {Object=} config
 * @param {string=} config.experiment      names the sheets and prefixes the labels
 * @param {Object=} config.sequences       oligo and plasmid sequences, for product sizes
 * @param {Object=} config.controlStocks   `{stocks, where}` — the lab's, injected not invented
 * @param {string=} config.sequenceId      force a session pairing rather than inferring one
 * @param {string=} config.labelPrefix     override the two-letter experiment prefix
 * @param {Object=} config.metadata
 * @returns {import('./models/labpacket.js').LabPacket}
 */
export function generateLabPacket(cfs, inventory, config = {}) {
  const experiment = config.experiment || 'LabPacket';

  const plan = planExperiment({
    cfs,
    sequences: config.sequences || null,
    inventory: inventory || null,
    controlStocks: config.controlStocks || {},
  });

  const label = config.label
    || labeller(experiment, config.labelPrefix || labelPrefix(experiment));
  const { sheets, warnings, unplaced } = jobsToLabSheets(plan, {
    experiment, label, sequenceId: config.sequenceId || null,
  });

  const packet = Models.createLabPacket({
    id: experiment,
    metadata: {
      title: `LabSheets — ${experiment}`,
      experiment,
      ...(config.metadata || {}),
      // CARRIED OUT RATHER THAN DROPPED. A planner that cannot say what it could not read is the
      // failure this repository keeps finding; `bin/c6-labplan` gates a run on these.
      ...(plan.problems && plan.problems.length ? { problems: plan.problems } : {}),
      ...(warnings.length ? { warnings } : {}),
      ...(unplaced.length ? { unplaced: unplaced.map((b) => b.operation) } : {}),
    },
  });

  // NOT `sortSheets`. It orders by a static operation list — Dilution, PCR, Cleanup, Gel… — which
  // is right for a packet whose sheets arrived in no order and wrong for this one, where the
  // session order IS the dependency order the planner computed. An experiment that picks twice
  // would have had its second pick sorted up beside its first, ahead of the analysis between them.
  for (const sheet of sheets) Models.addSheet(packet, sheet);
  return packet;
}

/** Push a pre-built sheet into a packet. */
export function addLabSheet(packet, sheet) {
  Models.addSheet(packet, sheet);
}

export const createLabPacket = Models.createLabPacket;
export const createLabSheet = Models.createLabSheet;
export const createRecipe = Models.createRecipe;
export const createMastermix = Models.createMastermix;
