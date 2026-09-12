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

/** The reaction's own name, out of the job's output: `pBET8-Bf_seq` -> `pBET8-Bf`. */
const reactionName = (output) => String(output || '').replace(/_seq$/, '') || null;

export default {
  operation: 'sequencing',
  title: 'Sequencing',
  // The reaction is named, not coded — see the label comment. A strip tube's cap is small, but a
  // trace file nobody can match to a clone is worse than a cramped label.
  labelMax: 24,
  // NO MODULE UNTIL THE OLIGO IS CHOSEN. `cycle_sequencing` defaults to "Submit 8 reads with
  // primer G00101 on dGTP chemistry" — confidently wrong about the count and about somebody
  // else's primer, printed directly under the correct instruction. A protocol rendered with its
  // defaults is worse than one not rendered, so the sheet carries the question instead.
  module: (ctx) => (cond(ctx.samples[0]?.params, 'oligo') ? 'cycle_sequencing' : null),
  shownAsColumn: ['oligo'],
  columns: (x, ctx) => ({
    // THE FULL NAME, BECAUSE THE DATA COMES BACK LATER AND HAS TO BE MATCHED TO IT. JCA,
    // 2026-09-12: *"sequencing labels should be 'pBET8-B', or maybe 'pBET8-Bf' and 'pBET8-Br' if
    // there are two reads. When sequencing comes back, we need to be able to precisely map it to
    // the data. Just 'B' will not be enough to distinguish samples."*
    //
    // A bare `B` is unique on the strip and nowhere else. The file that returns is named for what
    // was on the tube, and it lands in a folder beside every other experiment's.
    label: reactionName(x.output) || ctx.label(x.output),
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
