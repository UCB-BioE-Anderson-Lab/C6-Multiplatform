// miniprep.js — the design of a miniprep labsheet.
//
// JCA, 2026-09-10: *"this is straightforward, but need to specify and reserve a place to put the
// samples in an existing box or a new box… make calls on the inventory to find a good spot."*
//
// THE TUBE HAS TO GO SOMEWHERE AND THE SHEET HAS TO SAY WHERE, before anybody is holding it.
// Reserving beats suggesting: two labsheets written the same afternoon that both take "the next
// free well" collide, and the collision is found by somebody standing at the −20 with a tube.
//
// THE BOX AND WELL COLUMNS ARE LEFT EMPTY ON PURPOSE UNTIL THAT RESERVATION EXISTS. A blank the
// student fills in is a record; a well this design picked without consulting the inventory is a
// collision waiting to be discovered at the freezer. The bin carries the open decision and
// `c6-labplan` counts it.
//
// NO CHECKPOINT. *"Miniprep has no checkpoint. Samples just get logged on the sheet. When the
// full experiment is over, they send you back that sheet, so you can update the inventory with
// the new samples at the end."*
export default {
  operation: 'miniprep',
  title: 'Miniprep',
  module: 'qiagen_miniprep',
  shownAsColumn: [],
  columns: (x, ctx) => ({
    label: ctx.label(x.output),
    construct: x.output,
    'from block': ctx.from(x),
    Box: '',
    Well: '',
  }),
  // `qiagen_miniprep` declares `culture_mL` and `elution_uL` and nothing else — passing
  // `samples` was a silent no-op that also suppressed the "rendered with no values" warning,
  // which is the worst of both. The volume comes from the block the culture grew in.
  values: ({ samples, module, producer }) => {
    const block = producer((samples[0]?.inputs || [])[0]) || {};
    const mL = parseFloat(String(block.volume || '').replace(/[^0-9.]/g, ''));
    return { [module]: { ...(Number.isFinite(mL) && mL > 0 ? { culture_mL: mL } : {}) } };
  },
  recipe: () => null,
  notes: () => ['Write the box and well for every tube before it goes in the freezer. These rows '
              + 'are what the inventory is updated from when the workbook comes back.'],
};
