/**
 * CF text -> a plan: which labsheets, in what order, with what on each.
 *
 * **THIS WAS THE BODY OF `bin/c6-plan`,** and that is why `C6-LabPlanner.generateLabPacket` was a
 * fiction. The entry point named eleven stages behind `typeof X === 'function'` guards; four of
 * them did not exist, two existed under other names, and the real sequence — the one that actually
 * produces a plan — lived in a shell script's middle where nothing else could call it. So the
 * library had an API that returned an empty packet and a CLI that worked, and neither could see
 * the other.
 *
 * Pure given its inputs: file reading, flags and printing stay in `bin/c6-plan`. Everything here
 * is the sequence itself, in the order it must run, with the reason each stage sits where it does.
 */
import { extractJobsFromCFs } from './cfToJobs.js';
import { binReactions } from './binReactions.js';
import { planDilutions } from './planDilutions.js';
import { annotatePCRProductSizes } from './pcrProductSize.js';
import { annotatePCRPrograms } from './choosePCRProgram.js';
import { attachMastermixPlans } from './makeMastermixPlan.js';
import { injectGelJobs } from './injectGel.js';
import { injectCleanupJobs } from './injectCleanup.js';
import { injectVerificationJobs } from './injectVerification.js';
import { injectDilutionJobs } from './injectDilution.js';
import { injectAntibioticStockJobs } from './injectAntibioticStock.js';
import { applyTransformRecoveryNotes } from './injectTransformRecovery.js';
import { planSources } from './planSources.js';
import { NON_DNA } from './job.js';

/**
 * @param {Object} p
 * @param {Array<{name,text,characterization}>} p.cfs   the files, already read
 * @param {Object=} p.sequences      oligo and plasmid sequences, for product sizes
 * @param {Object=} p.inventory      merged inventory, or null to plan without one
 * @param {Object=} p.controlStocks  `{stocks, where}` — the lab's, injected not invented
 * @returns {{sheets, problems, dilutions, jobs, lifted, binned}}
 */
export function planExperiment({ cfs, sequences = null, inventory = null, controlStocks = {} } = {}) {
  const lifted = extractJobsFromCFs(cfs);

  annotatePCRProductSizes(lifted.jobs, { cfs, sequences });
  annotatePCRPrograms(lifted.jobs, { sequences });

  // THE CONTROL STOCKS ARE THE LAB'S, and arrive the way the collector address and the sequencing
  // route do. With none given, the controls are still injected and the sheet says no tube is named
  // — losing the plate over a missing label would drop the whole answer.
  applyTransformRecoveryNotes(lifted.jobs, {
    controlStocks: controlStocks.stocks || {},
    ...(controlStocks.where ? { controlStocksWhere: controlStocks.where } : {}),
  });

  const binned = binReactions(lifted);

  // The steps a construction file does not contain and a labsheet must. Order-independent: each
  // injected bin carries a fractional depth and the list is re-sorted.
  //
  // THE VERIFICATION GRAMMAR IS GONE, FOLDED INTO THE CHARACTERIZATION FILE. `Verification of
  // <product>.txt` existed for one day. JCA, 2026-09-12: *"Fold it into the characterization
  // file."* Two grammars for one kind of document is the thing that ruling removed.
  binned.sheets = injectVerificationJobs(injectCleanupJobs(injectGelJobs(binned.sheets)));
  attachMastermixPlans(binned.sheets, {});

  const problems = [...lifted.problems, ...binned.cycles];

  let dilutions = null;
  if (inventory) {
    dilutions = planDilutions(lifted.jobs, inventory);
    if (dilutions.error) {
      problems.push({ code: 'INVENTORY_UNREADABLE', cf: '', line: 0, message: dilutions.error });
    }
  }

  // WHERE EVERY MATERIAL COMES FROM — run with or without an inventory, because the half that
  // matters most needs none: whether a thing is made by an earlier step of this plan or comes out
  // of the freezer. A labsheet that sends somebody to search a box for a PCR product that will not
  // exist until next session is worse than one that says nothing.
  const sources = planSources(lifted, inventory);

  // THE WORKING STOCKS HAVE TO EXIST BEFORE THE PCR, whether or not the inventory knows where they
  // are. Injected last because it needs the dilution plan, and sorted into place by depth like the
  // other injectors rather than appended.
  binned.sheets = injectDilutionJobs(binned.sheets, dilutions);
  // AND THE ANTIBIOTIC BEFORE THE PLATES. Same test as the oligo stocks: made when the freezer
  // cannot be shown to have one, so a lab that keeps aliquots is not told to weigh powder and a
  // lab that does not is not told at the bench.
  binned.sheets = injectAntibioticStockJobs(binned.sheets, inventory);

  return { sheets: projectBins(binned.sheets, sources), problems, dilutions,
           jobs: lifted.jobs, lifted, binned };
}

/**
 * THE CONDITIONS OF A STEP, as against its materials. `dnaInputs` and `oligos` already carry what
 * goes into the tube; this carries what the step is *done at* — the enzyme a Golden Gate uses, the
 * strain and antibiotic a transform plates on, every key=value a characterization step was written
 * with. A projection that drops them hands the renderer a step it cannot describe.
 *
 * IT WAS CHARACTERIZATION-ONLY, AND THAT WAS THE BUG THE PCR SHEET SHOWED. A construction step's
 * conditions live in `job.args` under the names parseCF gave them, and nothing downstream read
 * them — so the Golden Gate sheet named no enzyme and the transformation sheet named no strain, on
 * the strength of a filter that had only ever been written for assays.
 *
 * `NON_DNA` is the existing statement of which fields are conditions; using it here rather than a
 * second list is what keeps the two from drifting apart.
 */
export function paramsOf(j) {
  const a = j.args || {};
  // AN INJECTED STEP'S ARGUMENTS ARE ALL CONDITIONS. It came from `injectVerification.js` rather
  // than from a file, so there is no parseCF field list to consult and `NON_DNA` has no entry for
  // `pick` or `miniprep` — which meant the injected pick's colony count and well volume were
  // computed, attached, and dropped one step later. The miniprep then rendered with no values at
  // all, and the only reason anybody saw it was the seam's warning.
  const keep = (a._characterization || a._injected)
    ? Object.keys(a).filter((k) => typeof a[k] === 'string' && !k.startsWith('_')
                                   && k !== 'operation' && k !== 'output')
    : (NON_DNA[j.operation] || []).filter((k) => a[k] !== undefined && a[k] !== null && a[k] !== '');
  if (!keep.length) return null;
  return Object.fromEntries(keep.map((k) => [k, String(a[k])]));
}

/** The bins, as the wire shape `jobsToLabSheets` and `bin/c6-plan --json` both read. */
export function projectBins(bins, sources) {
  return bins.map((s) => ({
    index: s.index, operation: s.operation, round: s.round, rounds: s.rounds, cfs: s.cfs,
    // A DERIVED BIN SHARES ITS JOBS WITH THE ONE IT CAME FROM — `injectGelJobs` pushes the very
    // same job objects — so a gel's samples carry the PCR's oligos and template. True of the
    // reaction, false of the gel, which consumes a tube of PCR product and nothing else. Said here
    // so a projection can tell the two apart instead of printing "fetch bf029" on a gel.
    ...(s.derivedFrom ? { derivedFrom: s.derivedFrom } : {}),
    ...(s.injected ? { injected: true } : {}),
    ...(s.dilution ? { dilution: s.dilution } : {}),
    ...(s.stocks ? { stocks: s.stocks } : {}),
    // DECISIONS THIS PLANNER WILL NOT MAKE, carried to the sheet rather than defaulted. Which
    // oligo reads into a junction is a lookup against the project's own oligos; guessing one
    // produces an unreadable trace.
    ...(s.open ? { open: s.open } : {}),
    mastermix: s.mastermixPlan || null,
    // WHICH PROTOCOL THE PLANNER ACTUALLY CHOSE, and what it could not choose for. Chemistry is
    // decided from the product size, so a PCR that would not simulate has none — and a projection
    // that falls back to a fixed pcr module puts "PrimeSTAR GXL PCR" on a sheet the planner
    // deliberately declined to pick a chemistry for, with no recipe under it and nothing saying why.
    ...(s.operation === 'pcr' ? { protocolModule: s.protocolModule || null,
                                  unresolved: s.unresolved || [] } : {}),
    samples: s.jobs.map((j) => ({
      output: j.output, cf: j.cf, line: j.line,
      inputs: j.dnaInputs, oligos: j.oligos,
      productBp: j.productBp ?? null, program: j.program ?? null,
      chemistry: j.chemistry ?? null, note: j.programNote || null,
      // Omitted where there are none rather than emitted empty, so a construction sheet looks as
      // it did before characterization files existed.
      ...(paramsOf(j) ? { params: paramsOf(j) } : {}),
      // THE CONTROLS AND THE RESCUE, which were computed on every transform and printed only in
      // the text report. The packet never saw them, so the labsheet said one plate where the
      // planner had worked out three — and the whole point of the controls is that a blank plate
      // is unreadable without them.
      ...(j.operation === 'transform'
          ? { rescue: j.rescue ?? null,
              ...(j.rescueWhy ? { rescueWhy: j.rescueWhy } : {}),
              ...(j.transformNote ? { transformNote: j.transformNote } : {}),
              ...(j.controlStock ? { controlStock: j.controlStock } : {}),
              controls: j.controls || [] }
          : {}),
      sources: (sources && sources.get(j.id)) || [],
      approximate: !!j.approximate,
    })),
  }));
}
