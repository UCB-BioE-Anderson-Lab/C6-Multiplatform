// makeMastermixPlan.js — what goes in the mastermix, and what is added per tube.
//
// JCA, 2026-09-10: *"If you are doing mastermix, figure out what all goes into it. Like, if the
// samples differ only by the template, then everything but the template goes into the mastermix.
// This step can be done with code precisely."*
//
// THE GENERAL RULE, of which that is the common case: **a component belongs in the mastermix iff
// every sample in this bin takes the same value for it.** Anything that varies is added to each
// tube separately. Six samples sharing a primer pair and differing by template put water,
// buffer, dNTPs, both primers and enzyme in the mix; samples differing by primer *and* template
// put only water, buffer, dNTPs and enzyme.
//
// Stated that way it is set arithmetic over the jobs in the bin, and it stays correct for cases
// nobody enumerated — one shared primer and one varying primer, say, which the "differ only by
// the template" phrasing does not cover and which happens constantly in a library.
import { MASTERMIX_THRESHOLD } from './config.js';

// The 50 µL PrimeSTAR reaction, as the labsheets have always written it. Which component is
// which VARIABLE matters more than the volumes: `template` tracks the template, `primer1` the
// forward oligo, and those are what can differ between samples in a bin.
export const PRIMESTAR_50 = [
  { key: 'water', label: 'ddH2O (white)', uL: 32, varies: null },
  { key: 'buffer', label: '5X PrimeSTAR GXL Buffer (green)', uL: 10, varies: null },
  { key: 'dNTP', label: 'PrimeSTAR dNTP Mixture (2.5 mM each, yellow)', uL: 4, varies: null },
  { key: 'primer1', label: '10 uM primer 1 (white)', uL: 1, varies: 'forward_oligo' },
  { key: 'primer2', label: '10 uM primer 2 (white)', uL: 1, varies: 'reverse_oligo' },
  { key: 'template', label: 'dil20x plasmid template (white)', uL: 1, varies: 'template' },
  { key: 'enzyme', label: 'PrimeSTAR GXL DNA Polymerase', uL: 1, varies: null },
];

// The Taq reaction, JCA 2026-09-10. Water is "up to 50 uL", so it is what the others leave.
export const TAQ_50 = [
  { key: 'water', label: 'ddH2O (to 50 uL)', uL: 36, varies: null },
  { key: 'buffer', label: '10X Taq Buffer', uL: 5, varies: null },
  { key: 'dNTP', label: 'dNTP mix (2 mM each)', uL: 5, varies: null },
  { key: 'primer1', label: '10 uM primer 1', uL: 1, varies: 'forward_oligo' },
  { key: 'primer2', label: '10 uM primer 2', uL: 1, varies: 'reverse_oligo' },
  { key: 'template', label: 'template', uL: 1, varies: 'template' },
  { key: 'enzyme', label: 'Taq Polymerase', uL: 1, varies: null },
];

export const RECIPES = { primestar: PRIMESTAR_50, taq: TAQ_50 };

// THE RECIPE FOLLOWS THE CHEMISTRY, AND THE BIN MUST AGREE ON ONE. A labsheet is one bench
// setup; a bin holding both a Taq reaction and a PrimeSTAR one has two different buffers and two
// different dNTP volumes in a single mastermix column, and the page would look fine. Mixed bins
// are refused rather than averaged — which is a real possibility, since `choosePCRProgram`
// decides chemistry per product size and a bin can hold a 200 bp and a 5 kb amplicon.
function recipeFor(jobs, cfg) {
  if (cfg.recipe) return { recipe: cfg.recipe, mixed: null };
  const kinds = [...new Set((jobs || []).map((j) => j.chemistry).filter(Boolean))];
  if (kinds.length > 1) return { recipe: RECIPES[kinds[0]], mixed: kinds };
  return { recipe: RECIPES[kinds[0]] || PRIMESTAR_50, mixed: null };
}

const valueOf = (job, field) => (field ? String((job.args && job.args[field]) || '') : '');

/**
 * @param {Array} jobs   the PCR jobs sharing one labsheet
 * @param {Object} cfg   { excess: 1.1, recipe: PRIMESTAR_50 }
 */
export function makeMastermixPlan(jobs, cfg = {}) {
  const { recipe, mixed } = recipeFor(jobs, cfg);
  const excess = cfg.excess ?? 1.1;
  const n = (jobs || []).length;

  if (mixed) {
    return { mastermix: false, reactions: n, mixedChemistry: mixed, perReaction: recipe,
             why: `these ${n} reactions are not all the same chemistry (${mixed.join(' and ')}) — `
                + 'different buffer and a different dNTP volume, so they cannot share a mastermix '
                + 'or a labsheet. Split them.' };
  }

  if (n < MASTERMIX_THRESHOLD) {
    return { mastermix: false, reactions: n, perReaction: recipe,
             why: `${n} reaction(s) — under ${MASTERMIX_THRESHOLD}, so set them up individually. `
                + 'A scaled total has no meaning at the bench when you would pipette the ones.' };
  }

  const shared = [];
  const perTube = [];
  for (const c of recipe) {
    if (!c.varies) { shared.push(c); continue; }
    const values = new Set(jobs.map((j) => valueOf(j, c.varies)));
    // AN EMPTY VALUE IS NOT A SHARED VALUE. If the field is missing on every job the set has one
    // member — "" — and the component would join the mastermix on the strength of nobody having
    // written it down. Varying components stay per-tube unless they are positively identical.
    const allKnown = [...values].every((v) => v !== '');
    (allKnown && values.size === 1 ? shared : perTube).push(c);
  }

  const scale = n * excess;
  return {
    mastermix: true,
    reactions: n,
    excess,
    shared: shared.map((c) => ({ ...c, totalUL: Math.round(c.uL * scale * 10) / 10 })),
    perTube,
    mastermixPerReactionUL: Math.round(shared.reduce((s, c) => s + c.uL, 0) * 10) / 10,
    why: `${n} reactions share ${shared.map((c) => c.key).join(', ')}; `
       + (perTube.length ? `${perTube.map((c) => c.key).join(' and ')} differ between samples `
                         + 'and go in tube by tube'
                         : 'every component is common, so the whole reaction is one mix'),
  };
}

/** Attach a plan to each bin of PCR jobs. */
export function attachMastermixPlans(bins, cfg = {}) {
  for (const bin of bins || []) {
    if (bin.operation !== 'pcr') continue;
    bin.mastermixPlan = makeMastermixPlan(bin.jobs, cfg);
    bin.chemistry = bin.mastermixPlan.mixedChemistry
      ? null : (bin.jobs.find((j) => j.chemistry) || {}).chemistry || null;
    // The protocol module the sheet should transclude follows from the chemistry.
    bin.protocolModule = bin.chemistry === 'taq' ? 'taq_pcr'
                       : bin.chemistry === 'primestar' ? 'primestar_pcr' : null;
  }
  return bins;
}
