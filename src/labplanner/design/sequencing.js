// sequencing.js — the design of a Sanger submission labsheet.
//
// JCA, 2026-09-10: *"I'd say discuss this with the user. It is very contextual as to what to do.
// Depends on copy number, history of sequencing similar things, whether you need full plasmid or
// just a little region, looking up what oligos are available to sequence that are nearby the
// region you care about. not trivial."*
//
// SO THE OLIGO IS NOT DEFAULTED. `cycle_sequencing` rendered with no values reads "Submit 8 reads
// with primer G00101" — confidently wrong on a sheet submitting four reads with somebody else's
// primer, and it sits directly under the correct instruction. Where no oligo has been decided the
// column is blank and the bin carries the open decision, because a blank is a question and a
// default is an answer.
import { cond } from './util.js';

export default {
  operation: 'sequencing',
  title: 'Sequencing',
  // NO MODULE UNTIL THE OLIGO IS CHOSEN. `cycle_sequencing` defaults to "Submit 8 reads with
  // primer G00101 on dGTP chemistry" — confidently wrong about the count and about somebody
  // else's primer, printed directly under the correct instruction. A protocol rendered with its
  // defaults is worse than one not rendered, so the sheet carries the question instead.
  module: (ctx) => (cond(ctx.samples[0]?.params, 'oligo') ? 'cycle_sequencing' : null),
  shownAsColumn: ['oligo'],
  columns: (x, ctx) => ({
    label: ctx.tube,
    template: (x.inputs || []).join(', '),
    oligo: cond(x.params, 'oligo'),
  }),
  values: ({ samples, module }) => {
    const oligo = cond(samples[0]?.params, 'oligo');
    if (!module) return {};
    // `samples` is the module's own name for the read count. It is not `reads`: an undeclared key
    // is silently ignored, so the module kept its default of 8 while the sheet listed four.
    return { [module]: { samples: samples.length || 1, primer: oligo } };
  },
  recipe: () => null,
  // The open decision is already carried on the bin and printed as STILL TO DECIDE; saying it
  // twice on one page is two places for it to be answered differently.
  notes: () => [],
};
