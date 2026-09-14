// zymo.js — the design of a column cleanup labsheet.
//
// THE SIZE IS HERE BECAUSE IT SETS THE ELUTION, not because the sheet is about sizes: a 6.5 kb
// product does not come off a Zymo column the way a 1.4 kb one does, and the person doing the
// cleanup is the person who has to know that.
import { bp } from './util.js';

// **BELOW THIS, ADB ALONE WASHES THE FRAGMENT STRAIGHT THROUGH** and the tube comes off the column
// empty. `protocols/modules/zymo_cleanup.js` has carried the remedy since it was written — bind
// with 1 part ADB + 3 parts isopropanol — behind a declared `small_fragment` input, and **nothing
// ever set it.** A correct mechanism wired to nothing, which is this repository's recurring shape;
// found 2026-09-13 when Tlib3's 231 bp library amplicon came up for cleanup with the plain
// protocol and no warning.
//
// **NOT `choosePCRProgram.SHORT_BP`, WHICH IS ALSO 250.** That one is about polymerase choice —
// *"for short sequences, like <250 bp, I would recommend a Taq reaction instead of primestar"* —
// and this one is about how silica binds short DNA in a chaotropic salt. Two different facts that
// happen to agree today; collapsing them into one constant would mean a change to either silently
// moving the other. → `docs/LOOKS-WRONG.md`, on two ladders that are not duplication.
export const SMALL_FRAGMENT_BP = 250;

/** The smallest this sample could be: a library's floor, or its one size. */
const floorOf = (x) => (x.productRange?.min ?? x.productBp ?? null);

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
  values: ({ samples, module }) => {
    // A LIBRARY'S FLOOR, NOT ITS MEAN. Tlib3's amplicon is 231 bp mean over 225-239, and it is the
    // 225 bp members that wash through — so a pool straddling the threshold still gets the
    // small-fragment bind, because losing the short half is the failure and the extra isopropanol
    // costs a larger fragment nothing.
    const small = samples.filter((x) => {
      const n = floorOf(x);
      return n != null && n < SMALL_FRAGMENT_BP;
    });
    return { [module]: {
      reactions: samples.length || 1,
      ...(small.length ? { small_fragment: true } : {}),
    } };
  },
  recipe: () => null,
  notes: ({ samples }) => {
    const small = samples.filter((x) => { const n = floorOf(x); return n != null && n < SMALL_FRAGMENT_BP; });
    if (!small.length) return [];
    // NAME THE TUBES WHEN THEY DISAGREE. The protocol renders once for the sheet, so a sheet
    // cleaning a 231 bp amplicon beside a 3.7 kb backbone would otherwise tell somebody to use
    // isopropanol without saying which tube needed it — true, and unreadable at the bench.
    const rest = samples.length - small.length;
    return [`${small.map((x) => x.output).join(', ')} `
      + `${small.length === 1 ? 'is' : 'are'} under ${SMALL_FRAGMENT_BP} bp, so the bind is `
      + '1 part ADB + 3 parts isopropanol — with ADB alone the fragment washes straight through '
      + 'and the tube comes off the column empty.'
      + (rest ? ` The other ${rest === 1 ? 'tube is' : `${rest} tubes are`} larger; the extra `
              + 'isopropanol costs them nothing, so the whole set is bound the same way.' : '')];
  },
};
