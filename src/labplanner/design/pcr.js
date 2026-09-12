// pcr.js — the design of a PCR labsheet.
//
// WHAT ONLY THIS SHEET CAN SAY: which oligo pair, on which template, to what expected size, under
// which thermocycler program. None of it is on the pcr cheatsheet and none of it is derivable at
// the bench — the sheet is the only place those four facts meet.
//
// JCA, 2026-09-12, of the version that printed none of them: *"there are no oligos or recipe in
// that pcr. It has like none of the critical info, and is identical to the gel."*
import { bp, only } from './util.js';

export default {
  operation: 'pcr',
  title: 'PCR',

  // THE PLANNER'S CHOICE, NOT A FIXED NAME. Chemistry follows the product size, so a PCR that
  // would not simulate has none — and naming `primestar_pcr` anyway puts a chemistry on the page
  // that nobody picked, with no recipe under it and nothing saying why.
  module: (ctx) => ('protocolModule' in ctx.sheet ? ctx.sheet.protocolModule : 'primestar_pcr'),

  shownAsColumn: [],

  columns: (x, ctx) => ({
    label: ctx.label(x.output),
    construct: x.output,
    'forward oligo': (x.oligos || [])[0] || '',
    'reverse oligo': (x.oligos || [])[1] || '',
    template: (x.inputs || []).join(', '),
    'expected size': bp(x),
    program: x.program || '',
  }),

  // A NAME IS PASSED ONLY WHERE EVERY REACTION AGREES ON IT. Two PCRs with different primer pairs
  // have no forward oligo, and filling the field with one of them makes a specific claim about
  // both; `per_sample` is how the module is told to point at the table instead.
  values: ({ samples, mastermix, module }) => {
    const f = only(samples.map((x) => (x.oligos || [])[0]));
    const r = only(samples.map((x) => (x.oligos || [])[1]));
    const t = only(samples.map((x) => (x.inputs || [])[0]));
    return { [module]: {
      reactions: samples.length || 1,
      ...(mastermix ? { use_mastermix: !!mastermix.mastermix } : {}),
      per_sample: !(f && r && t),
      ...(f ? { primer1_name: f } : {}),
      ...(r ? { primer2_name: r } : {}),
      ...(t ? { template_name: t } : {}),
    } };
  },

  // FROM THE PLANNER'S OWN ARITHMETIC. `makeMastermixPlan` has already worked out which
  // components every tube in this bin shares; the renderer re-derives the same split from each
  // component's `varies`, so the planner's decision is carried across in that field rather than
  // left to a generic recipe's opinion.
  recipe: ({ mastermix, sheet }) => {
    if (!mastermix) return null;
    const comp = (c, varies) => ({ name: c.label, amount: c.uL,
                                   varies: varies === undefined ? (c.varies || null) : varies });
    const components = mastermix.mastermix
      ? [...(mastermix.shared || []).map((c) => comp(c, null)),
         ...(mastermix.perTube || []).map((c) => comp(c))]
      : (mastermix.perReaction || []).map((c) => comp(c));
    return components.length ? { operation: sheet.operation, components } : null;
  },

  notes: ({ mastermix, sheet }) => {
    const out = [];
    // Below the threshold the renderer already says "set the reaction up directly" in its own
    // words; the planner's `why` adds something only where there IS a mastermix, because then it
    // names which components are shared and nothing else on the page does.
    if (mastermix && mastermix.mastermix && mastermix.why) out.push(mastermix.why);
    for (const u of sheet.unresolved || [])
      out.push(`No reaction is written for ${u.output}: ${u.why}. The chemistry follows the `
             + `product size, so nothing here says which buffer and which volumes to use.`);
    return out;
  },
};
