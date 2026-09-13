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
  shownAsColumn: ['afterVerified'],
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
    out.push(stocks[0].searched
      ? `The inventory does not record a stock of ${names.join(', ')}. Check the shelf before you `
        + `weigh anything — if there is one, write down where you found it and skip this session.`
      : `No inventory was read, so nothing could be checked. If a stock of ${names.join(', ')} `
        + `already exists, use it.`);
    out.push('Plates and media are made from this stock, so it comes before everything else.');
    return out;
  },
};
