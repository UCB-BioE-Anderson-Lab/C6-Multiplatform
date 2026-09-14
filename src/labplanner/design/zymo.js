// zymo.js — the design of a column cleanup labsheet.
//
// THE SIZE IS HERE BECAUSE IT SETS THE ELUTION, not because the sheet is about sizes: a 6.5 kb
// product does not come off a Zymo column the way a 1.4 kb one does, and the person doing the
// cleanup is the person who has to know that.
import { bp } from './util.js';
import { choose, SMALL_FRAGMENT_BP } from '../rules/cleanup.rules.js';

export { SMALL_FRAGMENT_BP };


export default {
  operation: 'zymo',
  title: 'Cleanup',
  module: 'zymo_cleanup',
  // WHAT GOES UNDER THE TABLE. Declared, so a field the planner adds later cannot
  // leak onto the page. Anything in a column, in the notes, or bookkeeping is absent
  // by not being named here.
  conditions: [],
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
  // **THE BIND IS A DECISION** — `rules/cleanup.rules.js`. The protocol module has carried a
  // `small_fragment` mode since it was written and nothing set it, so a 231 bp library amplicon
  // came up for cleanup with the plain protocol and no warning. ADB alone washes it through.
  values: ({ samples, module }) => {
    const got = choose({ samples });
    return { [module]: { reactions: samples.length || 1,
                         ...(got.smallFragment ? { small_fragment: true } : {}) } };
  },
  recipe: () => null,
  notes: ({ samples }) => {
    const got = choose({ samples });
    return got.note ? [got.note] : [];
  },
};
