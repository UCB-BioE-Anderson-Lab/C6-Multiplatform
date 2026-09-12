// goldengate.js — the design of a Golden Gate assembly labsheet.
//
// WHICH FRAGMENTS AND WHICH ENZYME. The enzyme is a CONDITION of the step, not a material, so it
// lives in `job.args` under `NON_DNA` — where nothing downstream read it, and the sheet named no
// enzyme at all while the construction file said BsaI on every line.
import { cond } from './util.js';

export default {
  operation: 'goldengate',
  title: 'Golden Gate assembly',
  module: 'golden_gate_assembly',
  shownAsColumn: ['enzyme'],
  columns: (x, ctx) => ({
    label: ctx.tube,
    construct: x.output,
    fragments: (x.inputs || []).join('  +  '),
    enzyme: cond(x.params, 'enzyme'),
  }),
  values: ({ samples, module }) => ({ [module]: {
    reactions: samples.length || 1,
    fragments: Math.max(...samples.map((x) => (x.inputs || []).length), 1),
    ...(cond(samples[0]?.params, 'enzyme') ? { enzyme: cond(samples[0].params, 'enzyme') } : {}),
  } }),
  recipe: () => null,
  notes: () => [],
};
