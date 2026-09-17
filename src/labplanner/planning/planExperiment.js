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
import { applyTransformRecoveryNotes, applyRetransformControls } from './injectTransformRecovery.js';
import { planSources } from './planSources.js';
import { NON_DNA } from './job.js';
import { detectDialect } from '../validate/constructionFile.js';

/**
 * Compile construction and characterization files into a plan: which bench sessions exist, in
 * dependency order, with what is on each.
 *
 * Stage one of two. `planning/jobsToLabSheets.js` turns what this returns into pages.
 *
 * @param {Object} p
 * @param {Array<{name,text,characterization}>} p.cfs   the files, already read
 * @param {Object=} p.sequences      oligo and plasmid sequences, for product sizes
 * @param {Object=} p.inventory      merged inventory, or null to plan without one
 * @param {Object=} p.controlStocks  `{stocks, where}` — the lab's, injected not invented
 * @returns {{sheets, problems, dilutions, jobs, lifted, binned}}
 */
/**
 * Problems that make a labsheet untrustworthy rather than merely imperfect.
 *
 * **THE DISTINCTION IS WHETHER A PERSON AT THE BENCH COULD BE MISLED.** A dangling product is a
 * step doing work nothing needs — wasteful, and every sheet still says something true. A DUPLICATE
 * PRODUCT is two different DNAs under one name, so a sheet saying "fetch frag" names two tubes and
 * somebody picks one. That sheet is worse than no sheet.
 *
 * Found 2026-09-13 by compiling a file with two PCRs producing `frag`: eleven printable labsheets
 * were written, exit 0, and the problem was carried in the packet's JSON and mentioned nowhere.
 */
export const FATAL = new Set([
  'DUPLICATE_PRODUCT',      // two DNAs, one name — every later reference is ambiguous
  'USE_BEFORE_PRODUCED',    // a step consumes what does not exist yet; the order is wrong
  'NO_PRODUCT',             // a step makes nothing, so nothing downstream can name it
  'CYCLE',                  // A needs B needs A; there is no order at all
  'AMBIGUOUS_ACROSS_FILES', // one name, two files, two meanings
  'PARSE_FAILED',           // nothing was read, so nothing said here is from the file
  // **AN UNKNOWN VERB IS READ AS A GUESS, AND THAT IS WHY IT CANNOT PASS.** JCA, 2026-09-16, of a
  // packet compiled from a file beginning `Frobnicate`: *"it should not return labsheets with an
  // unknown operation."* The parser falls back to "first token is the operation, last is the
  // product, the rest are inputs", and every sheet built on that inherits the guess without saying
  // so. `c6-check` already calls the findings from such a file *"a lead, not a verdict"* — a
  // labsheet cannot carry that qualification to a bench.
  'UNKNOWN_OPERATION',
]);

// **A PCR THAT WOULD NOT SIMULATE IS DELIBERATELY NOT FATAL, AND THE ATTEMPT IS WORTH RECORDING.**
//
// JCA, 2026-09-16, of a sheet whose program column read `follows from the size`: *"That means the
// construction file is invalid. Either there is an error in the CF or in the simulator and it
// should be resolved somehow rather than return labsheets."* He is right about the SHEET. Making it
// fatal here was tried and backed out, because it is too blunt by three decisions already on the
// record:
//
//   a PCR with no oligos   compiles honestly — *"somebody may genuinely not have chosen them yet"*
//                          → `test/labplanner/malformed.test.js`
//   a missing template     `simCF` simulates a file as ONE unit, so a single absent sequence robs
//                          every PCR in that file of a size, including the ones whose own template
//                          is right there. Refusing would reject a correct file over a gap in the
//                          project's sequences. → `planning/pcrProductSize.js`
//   an unknown size        already becomes a STILL TO DECIDE on the sheet, which is the channel
//                          built for exactly this → `test/labplanner/gate6-tlib3.test.js`
//
// What he objected to is narrower than any of those and is about the ARTEFACT: a printed PCR sheet
// that tells somebody to run a reaction and cannot say the program. So the refusal lives where the
// workbook is written — `bin/c6-labplan` — and the packet still compiles, which the injection seam
// and all three decisions above require.

export function planExperiment({ cfs, sequences = null, inventory = null, controlStocks = {} } = {}) {
  // **A FILE THIS CANNOT READ IS REFUSED, NOT GUESSED AT.**
  //
  // `detectDialect` has always been able to spot the parenthetical dialect —
  // `transform pchia (Mach1, Tet)` — and `validateConstructionFile` refuses to check one, saying
  // so: *"a legacy file is not a broken one."* The PLANNER never asked. It read those lines
  // generically, took the last token of each as the product, and compiled Lactis1 into nine
  // labsheets whose constructs were `backbone)`, `pchia)` and `Tet)`.
  //
  // Nothing failed. The packet was well-formed and printable, and the only reason anybody found
  // out is that two of the garbage names collided and `models/labsheet.js` refused a duplicate
  // label — an error two layers from the cause, about a symptom.
  //
  // **A plausible labsheet with nonsense on it is the failure this toolkit exists to end**, and it
  // is strictly worse than no labsheet: somebody prints it. So a file in a dialect this reader
  // does not speak contributes no jobs and says why.
  const unreadable = [];
  const readable = [];
  for (const cf of cfs || []) {
    // A characterization file has its own grammar and its own reader; `detectDialect` is about
    // construction files and would call every one of them unknown.
    const dialect = cf.characterization ? 'current' : detectDialect(cf.text || '');
    if (dialect === 'current') { readable.push(cf); continue; }
    unreadable.push({
      code: dialect === 'legacy' ? 'LEGACY_FORMAT' : 'UNREADABLE_FORMAT',
      cf: cf.name, line: 0,
      message: dialect === 'legacy'
        ? `"${cf.name}" is in the parenthetical format — \`transform pGhost (Mach1, Amp)\`. This `
          + 'planner reads the tab-separated one and would take the last token of each line as its '
          + 'product, which gives constructs like "Tet)". No labsheets were made from it. '
          + '`c6-check` describes the format; converting the file is the fix.'
        : `"${cf.name}" is in no format this reader recognises — no tab-separated steps and no `
          + 'parenthetical ones. No labsheets were made from it.',
    });
  }

  const lifted = extractJobsFromCFs(readable);

  annotatePCRProductSizes(lifted.jobs, { cfs, sequences });
  annotatePCRPrograms(lifted.jobs, { sequences });

  // THE CONTROL STOCKS ARE THE LAB'S, and arrive the way the collector address and the sequencing
  // route do. With none given, the controls are still injected and the sheet says no tube is named
  // — losing the plate over a missing label would drop the whole answer.
  applyTransformRecoveryNotes(lifted.jobs, {
    controlStocks: controlStocks.stocks || {},
    ...(controlStocks.where ? { controlStocksWhere: controlStocks.where } : {}),
  });
  // A RETRANSFORMATION'S CONTROLS ARE NOT A CLONING TRANSFORMATION'S. Its restreak has to be the
  // same organism as the thing being tested — streaking an E. coli control onto a Lactococcus
  // plate answers nothing. Keyed by host, empty by default, supplied by the lab.
  applyRetransformControls(lifted.jobs, { controlStrains: controlStocks.strains || {} });

  const binned = binReactions(lifted);

  // AN OPEN DECISION ON A JOB BELONGS ON THE SHEET THAT CARRIES THE JOB. Injectors that run before
  // binning attach findings to jobs; injectors that run after attach them to bins. Both end up on
  // a labsheet, and without this lift the earlier ones were computed and then dropped.
  for (const bin of binned.sheets) {
    const fromJobs = (bin.jobs || []).flatMap((j) => j.open || []);
    if (fromJobs.length) bin.open = [...new Set([...(bin.open || []), ...fromJobs])];
  }

  // The steps a construction file does not contain and a labsheet must. Order-independent: each
  // injected bin carries a fractional depth and the list is re-sorted.
  //
  // THE VERIFICATION GRAMMAR IS GONE, FOLDED INTO THE CHARACTERIZATION FILE. `Verification of
  // <product>.txt` existed for one day. JCA, 2026-09-12: *"Fold it into the characterization
  // file."* Two grammars for one kind of document is the thing that ruling removed.
  binned.sheets = injectVerificationJobs(injectCleanupJobs(injectGelJobs(binned.sheets)));
  // THE RETURN VALUE, because a mixed-chemistry PCR bin is split into one bin per enzyme and the
  // array grows. Called for its side effects alone, the split bins were computed and thrown away.
  binned.sheets = attachMastermixPlans(binned.sheets, {});

  const problems = [...unreadable, ...lifted.problems, ...binned.cycles];

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
           jobs: lifted.jobs, lifted, binned, unreadable };
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
      ...(j.productRange ? { productRange: j.productRange } : {}),
      // **A NOTE BELONGS TO THE OPERATION THAT SET IT.** `programNote` is a fact about the PCR —
      // *"231 bp is under 250 — Taq rather than PrimeSTAR"* — and the SAME job objects are re-binned
      // into the gel, the cleanup and the assembly, which all print every sample's note. So a
      // sentence about polymerase choice appeared on a page about running a gel and spinning a
      // column, where it is true of nothing on the page. JCA, 2026-09-13: *"That comment does not
      // make sense on a page about gel/zymo/assembly. That belonged on the pcr page."*
      chemistry: j.chemistry ?? null, note: j.programNote || null,
      ...(j.programNote ? { noteFor: 'pcr' } : {}),
      // Omitted where there are none rather than emitted empty, so a construction sheet looks as
      // it did before characterization files existed.
      ...(paramsOf(j) ? { params: paramsOf(j) } : {}),
      // THE CONTROLS AND THE RESCUE, which were computed on every transform and printed only in
      // the text report. The packet never saw them, so the labsheet said one plate where the
      // planner had worked out three — and the whole point of the controls is that a blank plate
      // is unreadable without them.
      // THE HOST-MATCHED PLATE-BATCH CONTROL, where the lab has one. Absent is the normal case
      // today and the bin carries the gap as an open decision rather than plating an organism that
      // cannot answer the question.
      ...(j.operation === 'retransform' && j.controlStrain
          ? { controlStrain: j.controlStrain } : {}),
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
