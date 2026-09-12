// culture.js — the design of an overnight-growth labsheet.
//
// WHAT GOES IN THE BLOCK IS THE PICKED CLONES PLUS THE CONTROLS, and the controls arrive here
// rather than at the pick because a control plate offers nothing to select between. `inoculate=`
// names them with the medium each is grown in, which is not always the sample's: an untransformed
// control grows on plain M17 because it has no resistance to select with.
//
// NO MODULE. `preparation_of_starter_culture` is a flask protocol and this is a 24-well block;
// transcluding it would print the wrong vessel, the wrong volume and the wrong shaker.
import { cond } from './util.js';

export default {
  operation: 'culture',
  title: 'Culture',
  module: null,
  shownAsColumn: ['medium', 'vessel', 'volume'],
  columns: (x, ctx) => ({
    label: ctx.label(x.output),
    construct: x.output,
    from: ctx.from(x),
    medium: cond(x.params, 'medium'),
    vessel: cond(x.params, 'vessel'),
    volume: cond(x.params, 'volume'),
  }),
  values: () => ({}),
  recipe: () => null,
  notes: ({ samples }) => {
    const p = samples[0]?.params || {};
    const out = [];
    for (const t of String(cond(p, 'inoculate')).split(',').map((s) => s.trim()).filter(Boolean)) {
      const [what, medium] = t.split(':');
      out.push(`Control: inoculate ${what} into ${medium || cond(p, 'medium')}, one well, from its `
             + `restreak. It is not picked from — every colony on a control plate is the same thing.`);
    }
    if (cond(p, 'to') === 'saturation')
      out.push('Grow to saturation. If a well has not grown, go back to picking or give the '
             + 'shaker more time — do not read a well that did not grow.');
    return out;
  },
};
