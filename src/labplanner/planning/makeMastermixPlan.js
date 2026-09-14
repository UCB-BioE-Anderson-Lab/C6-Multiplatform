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
import { choose } from '../rules/mastermix.rules.js';

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

// THE RECIPE FOLLOWS THE CHEMISTRY, AND ONE MASTERMIX CANNOT SERVE TWO OF THEM. Taq and
// PrimeSTAR differ in buffer and in dNTP volume, so a single mastermix column covering both
// would look fine on the page and be wrong in every tube.
//
// BUT THAT IS NOT A REASON TO REFUSE. An earlier version returned an error for a mixed bin and
// told the planner to split it, which encoded a hard rule where there is discretion. JCA,
// 2026-09-10: *"You could choose to put all the pcrs in one labsheet, or split it over two
// labsheets based on different chemistries, different plasticware. There is no strict
// requirement that you have to consolidate to 1 labsheet. In the end, there is a lot of
// discretion as to how you communicate experiments. Sometimes more labsheets will be more clear
// to the experimentalist than one giant one."*
//
// So `binReactions` says what MUST be separated — steps that depend on each other — and
// everything after that is editorial. A mixed bin gets one mastermix plan per chemistry, on one
// sheet or two, and the tool names the seam rather than choosing for you.
function recipeFor(chemistry, cfg) {
  return cfg.recipe || RECIPES[chemistry] || PRIMESTAR_50;
}

const valueOf = (job, field) => (field ? String((job.args && job.args[field]) || '') : '');

/**
 * Work out what goes in the mastermix for one bin of reactions: a component is shared only if
 * every sample takes the same value for it. Below the threshold it says to set them up
 * individually instead.
 *
 * @param {Array} jobs   the PCR jobs sharing one labsheet
 * @param {Object} cfg   { excess: 1.1, recipe: PRIMESTAR_50 }
 */
export function makeMastermixPlan(jobs, cfg = {}) {
  const chemistry = (jobs || []).map((j) => j.chemistry).find(Boolean) || null;
  const recipe = recipeFor(chemistry, cfg);
  const excess = cfg.excess ?? 1.1;
  const n = (jobs || []).length;

  // **THE DECISION IS IN `rules/mastermix.rules.js`.** What is left here is the arithmetic: scale
  // each shared component by the count and the excess, and round.
  const got = choose({ jobs, recipe, excess, valueOf });
  if (!got.mastermix) {
    return { mastermix: false, reactions: n, chemistry, perReaction: recipe, why: got.note };
  }
  const shared = got.shared;
  const perTube = got.perTube;

  const scale = n * excess;
  return {
    mastermix: true,
    reactions: n,
    chemistry,
    excess,
    shared: shared.map((c) => ({ ...c, totalUL: Math.round(c.uL * scale * 10) / 10 })),
    perTube,
    mastermixPerReactionUL: Math.round(shared.reduce((s, c) => s + c.uL, 0) * 10) / 10,
    why: got.note,
  };
}

/**
 * How to set up one bin of PCRs — one group per chemistry, because one mastermix cannot serve
 * two. **Whether the groups go on one labsheet or several is not decided here.**
 */
export function planReactionSetup(jobs, cfg = {}) {
  // A SAMPLE WITH NO CHEMISTRY IS UNRESOLVED, NOT A THIRD CHEMISTRY. Chemistry is decided from
  // the product size, so a PCR that could not be simulated has none — and grouping it as
  // "unspecified" put it beside Taq and PrimeSTAR as though it were an equal third setup, and
  // triggered a "2 chemistries here" suggestion about a bin with one. It is a hole in the plan
  // and it is reported as one.
  const unresolved = (jobs || []).filter((j) => !j.chemistry);
  const byChem = new Map();
  for (const j of jobs || []) {
    if (!j.chemistry) continue;
    if (!byChem.has(j.chemistry)) byChem.set(j.chemistry, []);
    byChem.get(j.chemistry).push(j);
  }
  const groups = [...byChem.entries()].map(([chemistry, members]) => ({
    chemistry,
    jobs: members,
    protocolModule: chemistry === 'taq' ? 'taq_pcr'
                  : chemistry === 'primestar' ? 'primestar_pcr' : null,
    plan: makeMastermixPlan(members, cfg),
  }));
  return {
    groups,
    unresolved: unresolved.map((j) => ({ output: j.output, cf: j.cf,
                                         why: j.programNote || j.sizeNote || 'no product size' })),
    // A SUGGESTION, NOT A VERDICT. Splitting is always available and is often the clearer
    // choice for a reader even when nothing forces it.
    considerSplitting: groups.length > 1
      ? `${groups.length} chemistries here (${groups.map((g) => g.chemistry).join(', ')}). `
        + 'Each needs its own mastermix. One labsheet with two clearly separated setups is fine; '
        + 'so are two labsheets — whichever reads better at the bench.'
      : null,
  };
}

/**
 * Attach a setup plan to each bin of PCR jobs, **splitting a bin that needs two enzymes.**
 *
 * **A BIN WITH TWO CHEMISTRIES USED TO GET NO PROTOCOL AT ALL.** `protocolModule` was set only
 * when there was exactly one group, so a sheet whose reactions need Taq and PrimeSTAR transcluded
 * neither and the student got a table of reactions with no method under it. `c6-labplan` said so
 * — *"no protocol module for: pcr"* — which is a hole reported rather than a hole filled.
 *
 * Found 2026-09-13 on Pimar's Tlib3, whose two reactions are a 231 bp library amplicon (Taq) and a
 * 3.7 kb backbone (PrimeSTAR). Lactis3 and the golden fixture are single-chemistry, so the case
 * had never arisen.
 *
 * **The fix is the domain's own answer, and this function already computed it.** `planReactionSetup`
 * returns one group per chemistry, each with its own module and its own mastermix; a bin is what
 * becomes one table with one procedure under it, so **two chemistries are two bins.** The session
 * machinery then draws them as two sections of one page, exactly as the gel/cleanup/assembly sheet
 * already draws three — which is what the suggestion beside it has always described: *"One labsheet
 * with two clearly separated setups is fine."*
 */
export function attachMastermixPlans(bins, cfg = {}) {
  const out = [];
  for (const bin of bins || []) {
    if (bin.operation !== 'pcr') { out.push(bin); continue; }
    const setup = planReactionSetup(bin.jobs, cfg);
    // ONE BIN PER CHEMISTRY, and only when there is more than one — a single-chemistry bin is
    // untouched, which is nearly all of them and every existing test.
    if (setup.groups.length > 1) {
      for (const g of setup.groups) {
        const sub = { ...bin, jobs: g.jobs };
        const own = planReactionSetup(g.jobs, cfg);
        sub.setup = own;
        sub.mastermixPlan = own.groups.length === 1 ? own.groups[0].plan : null;
        sub.unresolved = own.unresolved;
        sub.chemistry = g.chemistry;
        sub.protocolModule = g.protocolModule;
        out.push(sub);
      }
      // A job whose chemistry could not be decided belongs to no group, and dropping it here would
      // lose the reaction from the plan entirely. It rides with the first group and stays in that
      // bin's `unresolved`, where the sheet already reports it.
      if (setup.unresolved.length && out.length) {
        const first = out[out.length - setup.groups.length];
        first.jobs = [...first.jobs, ...bin.jobs.filter((j) => !j.chemistry)];
        first.unresolved = setup.unresolved;
      }
      continue;
    }
    bin.setup = setup;
    // Kept for the common case of a single-chemistry bin, which is nearly all of them.
    bin.mastermixPlan = setup.groups.length === 1 ? setup.groups[0].plan : null;
    bin.unresolved = setup.unresolved;
    bin.chemistry = setup.groups.length === 1 ? setup.groups[0].chemistry : null;
    bin.protocolModule = setup.groups.length === 1 ? setup.groups[0].protocolModule : null;
    out.push(bin);
  }
  // The array is rebuilt rather than mutated in place, because a split adds members — so callers
  // must use the RETURN VALUE. `planExperiment` did not, and every caller is checked.
  return out;
}
