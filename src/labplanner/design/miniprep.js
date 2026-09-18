// miniprep.js — the design of a miniprep labsheet.
//
// A HOLD IS FINE; SAYING A TUBE IS THERE IS NOT. JCA, 2026-09-13:
//
// > *"The inventory we store should reflect reality, not a prediction of future reality. Cause
// > sometimes labsheets get aborted, or just take years to finish."*
// > *"It might be good to put a hold on spots in the inventory — I think that is fine. Just don't
// > say things are in there that aren't there."*
//
// Two different assertions. A HOLD says *keep this spot free* and claims nothing about the
// freezer; an OCCUPANCY RECORD says *this tube is here*, and somebody acts on it. An abandoned
// experiment turns a predicted occupancy into a lie.
//
// The hold is sanctioned and not built — `inventory.js` has no third state, `isOccupied` being
// binary — so what this design does today is print the box, which is a standing decision, and ask
// for the well, which is a fact recorded at the −20. Nothing here writes the inventory.
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

  // **A COLUMN THAT REPEATS ITS NEIGHBOUR ON EVERY ROW IS NOISE**, and since a picked tube took
  // the clone's own name it did exactly that: `pBET8-A | pBET8-A`. The name following the sample
  // is the point — *"a label that changes at each step is a label that has to be cross-referenced
  // at each step"* — so the redundancy is inherent to the convention rather than a mistake, and
  // the answer is to stop printing it, not to rename the tube.
  //
  // WHERE THE CLONES WENT INTO A BLOCK the column still earns its place: it says `A1`, `B1`, which
  // is where to put the tip and is nowhere else on this page. So the decision is per SHEET and not
  // per row — every row of one miniprep sheet comes from the same kind of vessel — because a key
  // that appears on some rows and not others is a column the sheet never declared.
  //
  // `from block` was also the wrong words for a pick into tubes. It is `from` now, which is true
  // of both.
  // **A CHOSEN CLONE HAS NO SOURCE TO PRINT, AND PRINTING THE SET'S NAME IS WORSE THAN BLANK.**
  // Where `n=` carried eight of ninety-six forward, the choice is made from the assay's ranked
  // list after this sheet was compiled, so `from` resolved to `pTlib3U_ranked` — the same string
  // on all eight rows, naming no well and no tube. The column is what the person writes the well
  // they chose into, and the criterion is in the notes beside it.
  columns: (x, ctx) => ({
    label: x.output,
    ...(cond(x.params, 'chosenFrom') ? { from: '' }
        : ctx.from(x) === x.output ? {} : { from: ctx.from(x) }),
    // THE BOX IS A STANDING DECISION AND THE WELL IS NOT. Which box these go in was chosen when
    // the experiment was planned; which well is chosen when the tubes exist, at the freezer, and
    // is what comes back on this sheet.
    Box: cond(x.params, 'box'),
    Well: '',
  }),

  // WHICH ONES, WHERE THE SHEET CANNOT SAY. A narrowed step prints blank source wells on purpose;
  // the rule for filling them in is the whole content of the decision, and
  // `validate/characterizationFile.js` NARROWING_WITHOUT_CRITERIA refuses a compile without it.
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
  notes: ({ samples } = {}) => {
    const p = samples?.[0]?.params || {};
    const out = [
      'Write the name on the cap AND on the side of the tube. A cap in a freezer box is read from '
      + 'above and a tube in your hand is read from the side, and a box of unlabelled sides is a '
      + 'box you have to open tube by tube.',
      'Write the well for every tube before it goes in the freezer. These rows are what the '
      + 'inventory is updated from when the workbook comes back.',
    ];
    // WHICH ONES, WHERE THE SHEET CANNOT SAY. A narrowed step prints blank source wells on
    // purpose; the rule for filling them in is the whole content of the decision, and
    // `validate/characterizationFile.js` NARROWING_WITHOUT_CRITERIA refuses a compile without it.
    //
    // FIRST, like `design/pick.js`'s phenotype: it is read before the labelling advice, and the
    // labelling advice is about tubes that do not exist until this is decided.
    const from = cond(p, 'chosenFrom');
    const crit = cond(p, 'criteria');
    if (from && crit) {
      out.unshift(`Choose ${samples.length} of the ${from} clones: ${crit}.`,
                  'Write the well you took each one from in the `from` column. That is the only '
                  + 'record linking a tube to the measurement that earned it a place here.');
    }
    return out;
  },
};

/**
 * A PICK FOR A MINIPREP IS FOUR MILLILITRES. JCA, 2026-09-13: *"When picking for minipreps, it's
 * always 4mL. That's pretty standard."*
 *
 * So this is a code-defined decision, not an open one. The sheet used to tell the student that
 * nobody had said how much culture to pellet, which was true of the file and a question with a
 * standard answer — and a labsheet that asks a question everybody already knows the answer to
 * teaches people to skim the ones that matter.
 */
// **THE NUMBER LIVES IN `rules/culture.rules.js`**, beside the pick that declares the same
// millilitres. It was written down here, in `injectVerification.js`, and as a default in two
// protocol modules — four definitions of one well's volume.
export { WELL_VOLUME_ML as MINIPREP_CULTURE_ML } from '../rules/culture.rules.js';
import { WELL_VOLUME_ML as MINIPREP_CULTURE_ML, choose as chooseCulture }
  from '../rules/culture.rules.js';

/**
 * How many mL the cells grew in: whatever the step that grew them declared, or the standard.
 *
 * Read through the chain rather than off the immediate producer, because the cells are not always
 * grown by a `culture` step — a clone picked straight into a tube is minipreped from that tube, so
 * the pick is what carries the volume.
 */
function grownIn(sample, producer) {
  // WALKING THE CHAIN IS THIS FILE'S JOB; what to do with the answer is a rule.
  // → `rules/culture.rules.js`
  let upstreamML = null;
  if (typeof producer === 'function') {
    let name = (sample?.inputs || [])[0];
    for (let hop = 0; hop < 3 && name; hop += 1) {
      const step = producer(name);
      if (!step) break;
      const mL = parseFloat(String(step.volume || '').replace(/[^0-9.]/g, ''));
      if (Number.isFinite(mL) && mL > 0) { upstreamML = mL; break; }
      name = step._from;
    }
  }
  return chooseCulture({ upstreamML }).mL;
}
