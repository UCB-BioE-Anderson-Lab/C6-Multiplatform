// zymo.js — the design of a column cleanup labsheet.
//
// THE SIZE IS HERE BECAUSE IT SETS THE ELUTION, not because the sheet is about sizes: a 6.5 kb
// product does not come off a Zymo column the way a 1.4 kb one does, and the person doing the
// cleanup is the person who has to know that.
import { bp } from './util.js';

export default {
  operation: 'zymo',
  title: 'Cleanup',
  module: 'zymo_cleanup',
  shownAsColumn: [],
  columns: (x, ctx) => {
    // WHAT IS CLEANED IS THE PCR'S PRODUCT — the job's own output, not its inputs, which are the
    // PCR's template. And READ BEFORE ASSIGNING: `ctx.label()` makes this tube the construct's
    // current holder, so asking afterwards returns the tube being made rather than the one going
    // in.
    const source = ctx.labelOf(x.output) || x.output;
    // `zL3a` — the z convention, so the label says what it is and what it came from. A fresh
    // letter would have made `L3c` and `L3a` look like two unrelated tubes.
    return { label: ctx.derived('zymo', x.output, x.output), from: source,
             construct: x.output, size: bp(x) };
  },
  values: ({ samples, module }) => ({ [module]: { reactions: samples.length || 1 } }),
  recipe: () => null,
  notes: () => [],
};
