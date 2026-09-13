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
import { cond } from './util.js';

export default {
  operation: 'miniprep',
  title: 'Miniprep',
  module: 'qiagen_miniprep',
  // WHAT GOES UNDER THE TABLE. Declared, so a field the planner adds later cannot
  // leak onto the page. Anything in a column, in the notes, or bookkeeping is absent
  // by not being named here.
  conditions: [],

  // A MINIPREP TUBE IS NAMED, NOT CODED. JCA, 2026-09-12: *"What you want them to write on the top
  // of the 1.5 mL tube is construct+"-"+clone, so pBET8-B and the like. You also want them to
  // write that on the side label. The unique part of that for the set is just the B, so if you
  // were going to ask them to put codes on the samples, it makes little sense to refer to them as
  // L3h when you are also naming them B."*
  //
  // **So this row takes no letter from the running sequence.** The three-character rule is about a
  // 200 µL PCR cap, written eight times in a row during a setup; a 1.5 mL tube goes into a freezer
  // box and is found there months later, where `pBET8-A` is the only thing that helps and `L3i` is
  // a second name for the same tube. Two naming schemes on one object is how a box ends up with
  // tubes nobody can match to a record.
  //
  // WHICH TUBE THIS IS, rather than a number. This used to say `labelMax: 24`, which is not a
  // tube — it is the length check turned off, and it turned it off for the sequencing labels on
  // the same page too. `planning/jobsToLabSheets.js § TUBE_FOR` maps the operation to `micro`,
  // whose cap is a DNA name plus a clone letter, and `models/labsheet.js § TUBE` holds the number.

  columns: (x, ctx) => ({
    label: x.output,
    'from block': ctx.from(x),
    // THE BOX IS A STANDING DECISION AND THE WELL IS NOT. Which box these go in was chosen when
    // the experiment was planned; which well is chosen when the tubes exist, at the freezer, and
    // is what comes back on this sheet.
    Box: cond(x.params, 'box'),
    Well: '',
  }),

  // `qiagen_miniprep` declares `culture_mL` and `elution_uL` and nothing else — passing
  // `samples` was a silent no-op that also suppressed the "rendered with no values" warning,
  // which is the worst of both.
  //
  // THE VOLUME COMES FROM WHATEVER THE CELLS GREW IN, which is not always a culture step. A
  // clone picked straight into a tube is minipreped from that tube, so the pick carries the
  // volume; reading only the immediate producer found nothing and let the module print its own
  // "Pellet 4 mL", which is a number, in step 1, about somebody else's experiment.
  values: ({ samples, module, producer }) => {
    const mL = grownIn(samples[0], producer);
    return { [module]: { ...(mL ? { culture_mL: mL } : {}) } };
  },
  recipe: () => null,
  notes: ({ samples = [], producer }) => [
    // SAY WHEN NOBODY HAS SAID. Without a volume the protocol prints its default and a student
    // pellets 4 mL of a 2 mL tube. `volume=` on the pick or culture step settles it.
    ...(grownIn(samples[0], producer) ? [] : [
      'Nothing in the plan says how much culture to pellet — the step these cells came from '
      + 'records no volume. Use what is in the tube, and note it here.']),
    'Write the name on the cap AND on the side of the tube. A cap in a freezer box is read from '
    + 'above and a tube in your hand is read from the side, and a box of unlabelled sides is a '
    + 'box you have to open tube by tube.',
    'Write the well for every tube before it goes in the freezer. These rows are what the '
    + 'inventory is updated from when the workbook comes back.',
  ],
};

/** How many mL the cells grew in: from the culture step, or from the pick that made the tube. */
function grownIn(sample, producer) {
  if (typeof producer !== 'function') return null;
  let name = (sample?.inputs || [])[0];
  for (let hop = 0; hop < 3 && name; hop += 1) {
    const step = producer(name);
    if (!step) return null;
    const mL = parseFloat(String(step.volume || '').replace(/[^0-9.]/g, ''));
    if (Number.isFinite(mL) && mL > 0) return mL;
    name = step._from;
  }
  return null;
}
