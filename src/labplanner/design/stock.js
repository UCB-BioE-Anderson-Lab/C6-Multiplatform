// stock.js — the design of an antibiotic-stock session.
//
// JCA, 2026-09-12: *"we should inject into this the protocol for making erythromycin stock, as
// that has been a recent historical pitfall for this group."*
//
// **THE PROTOCOL IS THE SHEET.** Nothing here is specific to one experiment — a 1000x stock is a
// mass, a solvent and a volume — so the design's whole job is to name the antibiotic and let
// `preparation_of_antibiotic_1000x_stock` say the rest. It already knows what makes each one
// awkward, and for erythromycin that is the entire point: it does not dissolve in water at all,
// dissolution is slow, and it precipitates when squirted into hot agar and redissolves on
// swirling. Each of those reads as a failed prep to somebody who has not been told.
//
// **ONE SESSION, ONE MODULE, SEVERAL ANTIBIOTICS.** The module is a function of one antibiotic, so
// a session needing two transcludes it twice — the first through the sheet's own module slot and
// the rest as sections, which is what `c6-packet` does with any multi-operation session.
export default {
  operation: 'stock',
  title: 'Antibiotic stocks',
  module: (ctx) => ((ctx.sheet.stocks || []).length ? 'preparation_of_antibiotic_1000x_stock'
                                                    : null),
  // WHAT GOES UNDER THE TABLE. Declared, so a field the planner adds later cannot
  // leak onto the page. Anything in a column, in the notes, or bookkeeping is absent
  // by not being named here.
  conditions: [],
  // NO SAMPLES TABLE. Nothing is consumed and the product is a labelled tube whose name is the
  // antibiotic's own; a one-column table saying "Erm" would be a row of ink.
  columns: () => ({}),
  values: ({ sheet, module }) => {
    const first = (sheet.stocks || [])[0];
    return first ? { [module]: { antibiotic: first.antibiotic } } : {};
  },
  recipe: () => null,
  notes: ({ sheet }) => {
    const stocks = sheet.stocks || [];
    if (!stocks.length) return [];
    const names = stocks.map((s) => s.antibiotic);
    const out = [];
    // WHY THIS SESSION IS HERE AT ALL, said on the page. A student handed a weighing step with no
    // reason assumes the lab has none of it anywhere, which is a different and more alarming
    // claim than the one being made.
    // THE REASON IS THE CHEMISTRY, and it is the reason the session was injected at all —
    // `rules/antibioticStock.rules.js § tricky`. A routine stock gets no session, so a sheet
    // reaching this line is always for one with something about it worth saying.
    //
    // It used to read "the inventory does not record a stock of amp" — true, and beside the
    // point, because a DNA box was never going to record a reagent. JCA, 2026-09-21: *"Labsheets
    // should not be looking up location of stock reagents."*
    //
    // THE REASON IS NAMED, not gestured at. "Read the solvent line above" is the right pointer for
    // erythromycin and the wrong one for kanamycin, whose solvent is water and whose problem is
    // light — and a note that points at the wrong line is how a person learns the notes are
    // decorative.
    const why = stocks.map((s) => s.why).filter(Boolean)[0];
    out.push(why
      ? `This one is worth reading before you weigh anything: ${why}. If the lab already has a `
        + `${names.join(', ')} stock made up, use that and skip this session.`
      : `${names.join(', ')} gets its own session because making it is not routine. If the lab `
        + `already has a stock made up, use that and skip this session.`);
    out.push('Plates and media are made from this stock, so it comes before everything else.');
    return out;
  },
};
