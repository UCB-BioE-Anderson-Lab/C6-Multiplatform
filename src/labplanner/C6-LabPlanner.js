import * as Models from './models/index.js';

import * as PlanningConfig from './planning/config.js';
import * as CfToJobs from './planning/cfToJobs.js';
import * as PcrProductSize from './planning/pcrProductSize.js';
import * as ChooseTemplateSample from './planning/chooseTemplateSample.js';
import * as ChoosePrimerSource from './planning/choosePrimerSource.js';
import * as PlanDilutions from './planning/planDilutions.js';
import * as ChoosePCRProgram from './planning/choosePCRProgram.js';
import * as BinPCRRuns from './planning/binPCRRuns.js';
import * as InjectCleanup from './planning/injectCleanup.js';
import * as InjectGel from './planning/injectGel.js';
import * as InjectTransformRecovery from './planning/injectTransformRecovery.js';
import * as MakeMastermixPlan from './planning/makeMastermixPlan.js';
import * as JobsToLabSheets from './planning/jobsToLabSheets.js';

/**
 * Public API surface for LabPlanner.
 *
 * This module is intended to be stable as the rest of the implementation grows.
 * The planning modules it imports are implemented incrementally and tested in isolation.
 */

/**
 * Export models and planning modules for direct use and unit testing.
 */
export { Models };
export const Planning = {
  PlanningConfig,
  CfToJobs,
  PcrProductSize,
  ChooseTemplateSample,
  ChoosePrimerSource,
  PlanDilutions,
  ChoosePCRProgram,
  BinPCRRuns,
  InjectCleanup,
  InjectGel,
  InjectTransformRecovery,
  MakeMastermixPlan,
  JobsToLabSheets,
};

/**
 * @typedef {Object} LabPlannerConfig
 * @property {Object=} metadata
 */

/**
 * Generate a LabPacket from CF objects and an inventory.
 *
 * Current behavior:
 * - Returns an empty but valid LabPacket until all planning stages are implemented.
 * - As stages come online, they can be enabled without changing the public API.
 *
 * @param {Array<Object>} cfs
 * @param {Inventory} inventory
 * @param {LabPlannerConfig=} config
 * @returns {import('./models/labpacket.js').LabPacket}
 */
export function generateLabPacket(cfs, inventory, config) {
  const packet = Models.createLabPacket({
    id: 'LabPacket',
    metadata: (config && config.metadata) ? config.metadata : {},
  });

  // If the lower-level planning modules are not yet implemented,
  // keep returning an empty packet.
  const canPlan =
    typeof CfToJobs.extractJobsFromCFs === 'function' &&
    typeof JobsToLabSheets.jobsToLabSheets === 'function';

  if (!canPlan) {
    Models.sortSheets(packet);
    return packet;
  }

  // Normalize config when available.
  const cfg = (typeof PlanningConfig.normalizeConfig === 'function')
    ? PlanningConfig.normalizeConfig(config)
    : (config || {});

  // 1) CF -> base jobs
  let jobs = CfToJobs.extractJobsFromCFs(cfs, cfg);

  // 2) Resolve inventory inputs (templates/primers) and plan dilutions
  if (typeof ChooseTemplateSample.applyTemplateSelection === 'function') {
    jobs = ChooseTemplateSample.applyTemplateSelection(jobs, inventory, cfg);
  }
  if (typeof ChoosePrimerSource.applyPrimerSelection === 'function') {
    jobs = ChoosePrimerSource.applyPrimerSelection(jobs, inventory, cfg);
  }
  if (typeof PlanDilutions.injectDilutionJobs === 'function') {
    jobs = PlanDilutions.injectDilutionJobs(jobs, inventory, cfg);
  }

  // 3) PCR product size annotation (via C6-Sim adapter)
  if (typeof PcrProductSize.annotatePCRProductSizes === 'function') {
    jobs = PcrProductSize.annotatePCRProductSizes(jobs, cfg);
  }

  // 4) PCR program selection + run binning
  if (typeof ChoosePCRProgram.annotatePCRPrograms === 'function') {
    jobs = ChoosePCRProgram.annotatePCRPrograms(jobs, cfg);
  }
  if (typeof BinPCRRuns.binPCRRuns === 'function') {
    jobs = BinPCRRuns.binPCRRuns(jobs, cfg);
  }

  // 5) Policy injection: Cleanup after PCR/Digest; Gel after PCR cleanup; Transform recovery rule
  if (typeof InjectCleanup.injectCleanupJobs === 'function') {
    jobs = InjectCleanup.injectCleanupJobs(jobs, cfg);
  }
  if (typeof InjectGel.injectGelJobs === 'function') {
    jobs = InjectGel.injectGelJobs(jobs, cfg);
  }
  if (typeof InjectTransformRecovery.applyTransformRecoveryNotes === 'function') {
    jobs = InjectTransformRecovery.applyTransformRecoveryNotes(jobs, cfg);
  }

  // 6) Mastermix planning
  if (typeof MakeMastermixPlan.attachMastermixPlans === 'function') {
    jobs = MakeMastermixPlan.attachMastermixPlans(jobs, cfg);
  }

  // 7) Jobs -> LabSheets
  const sheets = JobsToLabSheets.jobsToLabSheets(jobs, inventory, cfg);
  for (const sheet of sheets) {
    Models.addSheet(packet, sheet);
  }

  Models.sortSheets(packet);
  return packet;
}

/**
 * Convenience helper to push a pre-built sheet into a packet.
 * Useful for early tests.
 *
 * @param {import('./models/labpacket.js').LabPacket} packet
 * @param {import('./models/labsheet.js').LabSheet} sheet
 */
export function addLabSheet(packet, sheet) {
  Models.addSheet(packet, sheet);
}

/**
 * Re-export commonly used model constructors.
 */
export const createLabPacket = Models.createLabPacket;
export const createLabSheet = Models.createLabSheet;
export const createRecipe = Models.createRecipe;
export const createMastermix = Models.createMastermix;
