// dilution.js — the design of a dilution session.
//
// JCA, 2026-09-12: *"The bf oligos exist, and I recommend we start this experiment from 100 uM
// --> 10 uM dilutions. So, it should ask them to type in the box and well of where they find the
// bf oligos, and when they return the labsheet you can extract that information."*
//
// THE SHEET IS THE CALCULATION AND THE QUESTION AT ONCE. The volumes are printed because they are
// arithmetic; the locations are yellow cells because nobody knows them — the inventory does not
// have these oligos and the freezer does, which is a gap the returned workbook closes and nothing
// else can. `render/labpacket-to-xlsx.py` draws it, because the table has live formulas in it and
// a table with formulas is not a table.
//
// NO SAMPLES TABLE. Nothing is consumed and nothing is made that a later step refers to by tube
// label — the product of this session is four tubes whose names are the oligos' own.
export default {
  operation: 'dilution',
  title: 'Oligo dilutions',
  module: null,
  shownAsColumn: [],
  columns: () => ({}),
  values: () => ({}),
  recipe: () => null,
  notes: ({ sheet }) => {
    const d = sheet.dilution || {};
    const unlocated = (d.targets || []).filter((t) => !t.located).map((t) => t.oligo);
    if (!unlocated.length) return [];
    return [`The inventory does not record where ${unlocated.join(', ')} live. That is a gap in `
          + `the document, not proof they are missing — write down where you find them and the `
          + `inventory is updated from this sheet when it comes back.`];
  },
};
