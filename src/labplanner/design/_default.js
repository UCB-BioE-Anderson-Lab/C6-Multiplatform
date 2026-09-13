// _default.js — the design for an operation nobody has written one for.
//
// It says only what is true of ANY step: what comes out, what went in, and the conditions the
// file recorded. No protocol module, because guessing one would put another procedure on the
// page; no recipe, because there is none to know.
//
// A LABSHEET FROM HERE IS THIN, AND IT SHOULD LOOK THIN. That is the signal that the operation
// has no design yet — which is a thing to notice and add, not a thing to paper over with a
// plausible-looking generic page.
export default {
  operation: '_default',
  title: null,                       // the operation's own name
  module: null,
  // WHAT GOES UNDER THE TABLE. Declared, so a field the planner adds later cannot
  // leak onto the page. Anything in a column, in the notes, or bookkeeping is absent
  // by not being named here.
  conditions: [],
  columns: (x, ctx) => ({
    label: ctx.label(x.output),
    construct: x.output,
    from: ctx.from(x),
    ...(x.productBp ? { size: `${x.productBp} bp` } : {}),
    ...(x.program ? { program: x.program } : {}),
  }),
  values: () => ({}),
  recipe: () => null,
  notes: () => [],
};
