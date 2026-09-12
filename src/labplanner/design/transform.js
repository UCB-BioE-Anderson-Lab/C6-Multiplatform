// transform.js — the design of a cloning transformation labsheet.
//
// THE ANTIBIOTIC IS THE ONE THAT MUST NOT BE WRONG, and it was: `heat_shock_transformation`
// defaults to Amp, the sheet transcluded it with no values, and the page read *"plate on Amp"*
// directly under its own table saying erm. Nothing about that is visible on paper.
import { cond } from './util.js';

export default {
  operation: 'transform',
  title: 'Transformation',
  module: 'heat_shock_transformation',
  shownAsColumn: ['strain', 'antibiotic', 'antibiotics', 'temperature'],
  columns: (x, ctx) => ({
    plate: ctx.tube,
    product: x.output,
    DNA: (x.inputs || []).join(', '),
    strain: cond(x.params, 'strain'),
    antibiotic: cond(x.params, 'antibiotics', 'antibiotic'),
    temperature: cond(x.params, 'temperature'),
  }),
  values: ({ samples, module }) => {
    const x = samples[0] || {};
    const p = x.params || {};
    return { [module]: {
      plasmid: (x.inputs || [])[0] || '',
      ...(cond(p, 'strain') ? { host: cond(p, 'strain') } : {}),
      ...(cond(p, 'antibiotics', 'antibiotic')
            ? { antibiotics: cond(p, 'antibiotics', 'antibiotic') } : {}),
      ...(cond(p, 'temperature') ? { temperature_C: Number(cond(p, 'temperature')) } : {}),
      product_name: x.output || '',
    } };
  },
  recipe: () => null,
  notes: () => [],
};
