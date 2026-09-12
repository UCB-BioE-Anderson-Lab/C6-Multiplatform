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
  columns: (x, ctx) => ({ label: ctx.tube, construct: x.output, size: bp(x) }),
  values: ({ samples, module }) => ({ [module]: { reactions: samples.length || 1 } }),
  recipe: () => null,
  notes: () => [],
};
