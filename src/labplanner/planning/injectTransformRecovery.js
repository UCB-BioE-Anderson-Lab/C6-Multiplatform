// injectTransformRecovery.js — the outgrowth, and the controls that make a blank plate readable.
//
// Two rules, both from JCA 2026-09-10, and the second is the one a labsheet usually omits.
//
// 1. THE ANTIBIOTIC DECIDES WHETHER THERE IS A RESCUE STEP.
//
//    *"Look at the antibiotic being selected for, which is in the CF, if not Carb/Amp you need
//    to inject a rescue step."*
//
//    Carb and Amp select for a β-lactamase that acts outside the cell, so plating straight after
//    heat shock works. Everything else needs the resistance gene expressed before selection, so
//    the cells get an outgrowth in rich medium first. Exact, from one field of the CF.
//
// 2. WHEN THEY POURED THE PLATES THEMSELVES, THE PLATES ARE ALSO UNPROVEN.
//
//    *"If they are using something other than amp/carb, they will have made their own plates, so
//    they should include the control strain from the control stocks box in the -80 streaking
//    that on one of the plates. They should also do a tranformation control, positive and
//    negative (meaning with and without dna added) with the same competent cells and the control
//    plasmid."*
//
//    Without these, a plate with no colonies has four possible causes — bad plate, dead cells,
//    failed assembly, failed transformation — and no way to tell them apart. That is why they are
//    INJECTED and not offered.
import { NON_DNA } from './job.js';
import { choose, NO_RESCUE as RULE_NO_RESCUE } from '../rules/transformRecovery.rules.js';

// WHICH TUBE IS THE CONTROL IS A FACT ABOUT ONE LAB'S FREEZER, NOT ABOUT CLONING.
//
// `K1`, `S1`, `E1` and the box they sit in are the Anderson lab's, and they were literals here.
// JCA, 2026-09-12: *"what belongs in C6 would be the generalized one that compiles cf and
// characterization f to a labsheet... After that comes lab specific information injection by
// cortex."* The next lab's control plasmids have other names and live somewhere else.
//
// **THE DEFAULT IS EMPTY, AND AN EMPTY TABLE STILL PRODUCES THE CONTROLS.** What C6 knows is that
// a home-poured plate needs three of them and what each one answers — that is cloning. What it
// does not know is what to call the tube, so it says so on the page rather than leaving the
// control out, which would drop the whole point over a missing name.
/**
 * Which tube is the control plasmid, by antibiotic. **Empty in C6, and that is the point.**
 *
 * JCA, 2026-09-12: *"what belongs in C6 would be the generalized one that compiles cf and
 * characterization f to a labsheet... After that comes lab specific information injection by
 * cortex."* The next lab's control plasmids have other names and live somewhere else.
 *
 * AN EMPTY TABLE STILL PRODUCES THE CONTROLS. What C6 knows is that a home-poured plate needs
 * three of them and what each one answers — that is cloning. What it does not know is what to call
 * the tube, so the sheet says so rather than dropping the control over a missing name.
 */
export const CONTROL_STOCKS = {};

/** Where the control stocks live, as a phrase for the labsheet. The lab supplies it. */
export const CONTROL_STOCKS_WHERE = 'the control stocks box';

/**
 * A RESTREAK CONTROL HAS TO BE THE SAME ORGANISM AS THE THING BEING TESTED, and that is why this
 * is a second table rather than a reuse of `CONTROL_STOCKS`.
 *
 * JCA, 2026-09-13, on whether an electroporation into *L. lactis* gets the three-plate set:
 *
 * > *"The restreaking control is still relevant — to be sure the plates are good, I suppose. In
 * > the cheese case, the retransformation is into L. lactis, though, so an e. coli control isn't
 * > really relevant. What would be relevant would be to streak l. lactis control cells that had
 * > previously been transformed. That doesn't exist currently."*
 *
 * The restreak asks one question — can anything grow on this batch of plates — and it answers it
 * by streaking cells that already carry the resistance. `E1` is *E. coli*; streaking it onto an
 * M17 erm plate meant for *Lactococcus* tests nothing about that plate, because the answer is "no"
 * either way. So the strain is keyed by host, the table is empty by default, and where a host has
 * no entry the sheet says the batch went unchecked rather than plating a control that cannot
 * speak to it.
 *
 * Keyed `host` or `host/antibiotic`; the lab supplies it through `--control-stocks`.
 */
export const CONTROL_STRAINS = {};

// One canonical name per antibiotic, because a construction file writes them however it likes.
const ALIASES = {
  amp: 'carb', ampicillin: 'carb', carb: 'carb', carbenicillin: 'carb',
  kan: 'kan', kanamycin: 'kan',
  spec: 'spec', spectinomycin: 'spec', sp: 'spec',
  cam: 'cam', chlor: 'cam', chloramphenicol: 'cam', cm: 'cam',
  erm: 'erm', ery: 'erm', erythromycin: 'erm',
  tet: 'tet', tetracycline: 'tet',
};

// Exported under a test-only name so `test/antibiotics-agree.test.js` can check that C6-Sim.js
// recognises every one of them. Not part of this module's interface — normalizeAntibiotic() is
// — and named so that nothing reaches for it by accident.
export const ALIASES_FOR_TEST = ALIASES;

/** β-lactams need no outgrowth; everything else does. */
export { NO_RESCUE } from '../rules/transformRecovery.rules.js';

// THE ANTIBIOTICS THIS PLANNER CAN REASON ABOUT. Gating on the control-stock table was the same
// mistake in miniature: emptying that table would have made every transformation's antibiotic
// unreadable, and the sheet would have said "decide the rescue step by hand" about erythromycin,
// which it knows perfectly well needs one.
const KNOWN = new Set(Object.values(ALIASES));

/**
 * Every spelling of an antibiotic this planner can act on, for a reader that has to refuse one it
 * cannot. Exported from here because this is where the table lives; a second list would be a
 * second description of the same fact, which is how the sim and the planner drifted ten entries
 * apart in the first place. → `test/antibiotics-agree.test.js`
 */
export const KNOWN_ANTIBIOTICS = Object.keys(ALIASES).sort();

/**
 * One canonical name for an antibiotic, however the construction file spelled it — amp and
 * carbenicillin both become carb.
 */
export function normalizeAntibiotic(text) {
  const t = String(text || '').toLowerCase().replace(/[^a-z]/g, '');
  return ALIASES[t] || (t ? t : null);
}

function antibioticOf(job) {
  for (const f of NON_DNA.transform) {
    const v = job.args && job.args[f];
    if (!v) continue;
    const n = normalizeAntibiotic(v);
    if (n && KNOWN.has(n)) return n;
    // A generically-read Transform has no named fields; its inputs are all in `dnas`, so the
    // antibiotic is in there somewhere with the strain. Fall through to the scan below.
  }
  for (const v of [...(job.dnaInputs || []), ...Object.values(job.args || {})].flat()) {
    const n = normalizeAntibiotic(v);
    if (n && KNOWN.has(n)) return n;
  }
  return null;
}

/**
 * The host-matched strain that can answer "are these plates any good", or null.
 *
 * `host/antibiotic` first, because a lab may keep a different one per marker, then `host` alone.
 */
export function controlStrainFor(host, antibiotic, strains = CONTROL_STRAINS) {
  if (!host) return null;
  return strains[`${host}/${antibiotic}`] || strains[host] || null;
}

/**
 * Controls for a retransformation — an electroporation of verified DNA into an assay host.
 *
 * TWO OF THE THREE ARE THE SAME QUESTIONS AS A CLONING TRANSFORMATION'S and the third is not.
 * The positive control here is the parent plasmid going into the SAME host by the SAME method, in
 * parallel with the samples — JCA, 2026-09-13: *"they should definitely be retransforming the
 * control plasmid into l. lactis as a positive transformation control in parallel to the new
 * constructs."* The characterization file names it with `positive=`.
 *
 * The restreak needs a host-matched strain and usually there is not one yet, which is a finding
 * rather than a reason to drop the plate silently. And there is a way out of it that costs
 * nothing: the positive control plate IS a host carrying the control plasmid, so banking a colony
 * off it gives the lab the strain it was missing, for every retransformation after this one.
 */
export function applyRetransformControls(jobs, cfg = {}) {
  const strains = cfg.controlStrains || CONTROL_STRAINS;
  for (const job of jobs || []) {
    if (job.operation !== 'retransform') continue;
    const a = job.args || {};
    const host = a.host || a.strain || null;
    const ab = normalizeAntibiotic(a.antibiotic || a.antibiotics || '');
    const strain = controlStrainFor(host, ab, strains);
    job.controlStrain = strain;
    // A FINDING, NOT AN INSTRUCTION. What to DO about it belongs in the design's notes, where a
    // student reads it; what is carried here is the fact that one of the three questions a control
    // set answers is going unanswered in this experiment.
    if (!strain && host) {
      job.open = [...(job.open || []),
        `nothing on this sheet checks whether the ${ab || ''} plates are any good — that needs a `
        + `${host} strain already carrying the marker, and none is on file. An E. coli control `
        + `streaked onto a ${host} plate answers nothing: it would not grow either way.`];
    }
  }
  return jobs;
}

/**
 * Decide whether each transformation needs an outgrowth before plating, and attach the control
 * set where the plates were poured in-house. An antibiotic nobody could read is reported rather
 * than assumed to be carb.
 *
 * @param {Array} jobs  from extractJobsFromCFs
 * @returns {Array} the same jobs, with `antibiotic`, `rescue` and `controls` on transforms
 */
export function applyTransformRecoveryNotes(jobs, cfg = {}) {
  const stocks = cfg.controlStocks || CONTROL_STOCKS;
  const where = cfg.controlStocksWhere || CONTROL_STOCKS_WHERE;
  for (const job of jobs || []) {
    if (job.operation !== 'transform') continue;
    const ab = antibioticOf(job);
    job.antibiotic = ab;

    if (!ab) {
      // AN ANTIBIOTIC NOBODY COULD READ IS NOT AMP. Defaulting to the no-rescue case would plate
      // a kanamycin transformation straight out of heat shock and get nothing, for a reason the
      // sheet would never mention.
      const got = choose({ ab: null });
      job.rescue = got.rescue;
      job.controls = got.controls;
      job.transformNote = got.note;
      continue;
    }

    // **THE DECISION IS IN `rules/transformRecovery.rules.js`.** What is left here is reading the
    // antibiotic off the job and naming the lab's control tube; whether there is an outgrowth, and
    // which control plates go beside the real one, is a rule with a reason attached.
    const stock = stocks[ab] || null;
    // NAMED WHERE THE LAB NAMED ONE, AND ASKED FOR WHERE IT DID NOT. A control whose tube nobody
    // named is still a control; printing "the control plasmid" and letting somebody look it up
    // beats omitting the plate.
    const named = stock ? `${stock}` : `the ${ab} control plasmid (no tube is named for it here)`;
    job.controlStock = stock;

    const got = choose({ ab, named, stock, where });
    job.rescue = got.rescue;
    job.controls = got.controls;
    job.rescueWhy = got.note;
    // FOR THE RUN REPORT, NOT FOR THE SHEET. `c6-plan` prints this in its transformations table,
    // where the reader is whoever is compiling and deciding whether the controls are enough.
    // → `design/transform.js`, which deliberately does not put it on the page.
    if (!job.rescue) {
      job.transformNote = 'Amp/carb, so no rescue and no injected controls. Controls are still '
                        + 'worth a conversation — see operations/transform.md.';
    }
  }
  return jobs;
}
