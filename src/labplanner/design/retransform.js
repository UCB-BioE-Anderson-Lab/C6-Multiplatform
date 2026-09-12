// retransform.js — the design of an assay-associated transformation labsheet.
//
// JCA, 2026-09-11: *"I think an assay-associated transformation visually resembles a cloning
// transformation, but at an operation level, they are two separate things. Perhaps it is a
// retransformation."*
//
// It takes in VERIFIED plasmid rather than an assembly reaction, which changes the procedure —
// less DNA, few colonies to pick because the DNA is already known good — and it usually goes into
// something that cannot be heat-shocked. Hence `method`, the field a cloning transform does not
// have, and hence no module here: there is no electroporation protocol in the library, and naming
// `heat_shock_transformation` would put the wrong procedure on the page.
//
// THE CONTROLS ARE PLATED HERE. JCA, 2026-09-11: *"They should run that pTRK parent plasmid as a
// positive control on the electroporation. So, 3 plates."* They are conditions of this step and
// appear under it, and they are NOT picked from — see `pick.js`.
import { cond } from './util.js';

export default {
  operation: 'retransform',
  title: 'Electroporation',
  module: null,
  shownAsColumn: ['host', 'strain', 'antibiotic', 'antibiotics', 'temp', 'temperature', 'method'],
  columns: (x, ctx) => ({
    label: ctx.label(x.output),
    construct: x.output,
    DNA: ctx.from(x),
    host: cond(x.params, 'host', 'strain'),
    antibiotic: cond(x.params, 'antibiotic', 'antibiotics'),
    temperature: cond(x.params, 'temp', 'temperature'),
    method: cond(x.params, 'method'),
  }),
  values: () => ({}),
  recipe: () => null,
  notes: ({ samples }) => {
    const p = samples[0]?.params || {};
    const controls = [cond(p, 'negative') && `${cond(p, 'negative')} (negative)`,
                      cond(p, 'positive') && `${cond(p, 'positive')} (positive)`].filter(Boolean);
    const out = [];
    if (controls.length)
      out.push(`${controls.length + 1} plates: the sample, plus ${controls.join(' and ')}. `
             + `Every plate is electroporated the same way.`);
    out.push('No electroporation protocol is in the library yet, so this sheet carries the '
           + 'conditions and not the procedure. Nothing here tells you the cuvette gap, the '
           + 'voltage or the recovery medium.');
    return out;
  },
};
