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

/** Control strains and plasmids in the -80 control stocks box, by what they select. */
export const CONTROL_STOCKS = {
  kan: 'K1', spec: 'S1', erm: 'E1', cam: 'C1', carb: 'A1',
};

// One canonical name per antibiotic, because a construction file writes them however it likes.
const ALIASES = {
  amp: 'carb', ampicillin: 'carb', carb: 'carb', carbenicillin: 'carb',
  kan: 'kan', kanamycin: 'kan',
  spec: 'spec', spectinomycin: 'spec', sp: 'spec',
  cam: 'cam', chlor: 'cam', chloramphenicol: 'cam', cm: 'cam',
  erm: 'erm', ery: 'erm', erythromycin: 'erm',
  tet: 'tet', tetracycline: 'tet',
};

/** β-lactams need no outgrowth; everything else does. */
export const NO_RESCUE = ['carb'];

export function normalizeAntibiotic(text) {
  const t = String(text || '').toLowerCase().replace(/[^a-z]/g, '');
  return ALIASES[t] || (t ? t : null);
}

function antibioticOf(job) {
  for (const f of NON_DNA.transform) {
    const v = job.args && job.args[f];
    if (!v) continue;
    const n = normalizeAntibiotic(v);
    if (n && CONTROL_STOCKS[n]) return n;
    // A generically-read Transform has no named fields; its inputs are all in `dnas`, so the
    // antibiotic is in there somewhere with the strain. Fall through to the scan below.
  }
  for (const v of [...(job.dnaInputs || []), ...Object.values(job.args || {})].flat()) {
    const n = normalizeAntibiotic(v);
    if (n && CONTROL_STOCKS[n]) return n;
  }
  return null;
}

/**
 * @param {Array} jobs  from extractJobsFromCFs
 * @returns {Array} the same jobs, with `antibiotic`, `rescue` and `controls` on transforms
 */
export function applyTransformRecoveryNotes(jobs, cfg = {}) {
  for (const job of jobs || []) {
    if (job.operation !== 'transform') continue;
    const ab = antibioticOf(job);
    job.antibiotic = ab;

    if (!ab) {
      // AN ANTIBIOTIC NOBODY COULD READ IS NOT AMP. Defaulting to the no-rescue case would plate
      // a kanamycin transformation straight out of heat shock and get nothing, for a reason the
      // sheet would never mention.
      job.rescue = null;
      job.controls = [];
      job.transformNote = 'could not read which antibiotic this selects for — decide the rescue '
                        + 'step and the controls by hand.';
      continue;
    }

    job.rescue = !NO_RESCUE.includes(ab);
    job.rescueWhy = job.rescue
      ? `${ab} selection needs the resistance gene expressed before plating — outgrow in rich `
        + 'medium first.'
      : 'carb/amp selects for a secreted β-lactamase, so plate straight after heat shock.';

    // The controls ride with the home-poured plates, which is the non-carb case.
    const stock = CONTROL_STOCKS[ab];
    job.controls = job.rescue ? [
      { kind: 'plate', what: `streak ${stock} from the control stocks box (-80) on one plate`,
        answers: `these ${ab} plates select at all — a bad plate looks exactly like a failed transformation` },
      { kind: 'positive', what: `transform the same competent cells with the ${stock} control plasmid`,
        answers: 'the cells are competent' },
      { kind: 'negative', what: 'the same competent cells with no DNA added',
        answers: 'the plate is not simply growing untransformed cells' },
    ] : [];
    if (!job.rescue) {
      job.transformNote = 'Amp/carb, so no rescue and no injected controls. Controls are still '
                        + 'worth a conversation — see operations/transform.md.';
    }
  }
  return jobs;
}
