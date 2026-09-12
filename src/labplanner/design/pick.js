// pick.js — the design of a colony-picking labsheet.
//
// CONTROL PLATES ARE NOT PICKED FROM. JCA, 2026-09-11: *"there is no reason to pick untransformed
// colonies. makes no sense."* Picking means SELECTING AMONG candidates, and a control plate
// offers nothing to select between — every colony on it is the same thing, so four picked wells
// are four copies of one measurement pretending to be four. The control is inoculated once, from
// its restreak, at the culture step.
//
// So the plate count here is the SAMPLE plates only, which is what `dnaInputs` holds.
//
// THE ANTIBIOTIC COMES FROM THE PLATE, NOT FROM THIS STEP. A pick step does not record what is in
// the block's medium; the plate it picks from records what it was selected on. Without that,
// `picking_colonies_into_block` prints its default — "carb" — onto a sheet about Lactococcus.
import { cond } from './util.js';

export default {
  operation: 'pick',
  title: 'Picking colonies',
  module: 'picking_colonies_into_block',
  shownAsColumn: ['n', 'criteria', 'max'],
  columns: (x, ctx) => ({
    label: ctx.label(x.output),
    construct: x.output,
    'from plate': ctx.from(x),
    'colonies to pick': cond(x.params, 'n'),
  }),
  values: ({ samples, module, producer }) => {
    const x = samples[0] || {};
    const plate = producer((x.inputs || [])[0]) || {};
    const abx = cond(plate, 'antibiotic', 'antibiotics');
    return { [module]: {
      samples: (x.inputs || []).length || 1,
      ...(cond(x.params, 'n') ? { colonies_per_sample: Number(cond(x.params, 'n')) } : {}),
      ...(abx ? { antibiotic: abx } : {}),
    } };
  },
  recipe: () => null,
  notes: ({ samples }) => {
    const p = samples[0]?.params || {};
    const out = [];
    // THE CRITERIA ARE THE DECISION, so they go in the words the decision was made in rather than
    // as a key=value row. JCA's workbook: *"Go with just 2 unless there is significant phenotypic
    // diversity."*
    const crit = cond(p, 'criteria');
    if (crit) {
      const max = cond(p, 'max');
      out.push(`How many to pick: ${crit}${max ? ` — up to ${max}.` : '.'} Write the clone letter `
             + `(A, B, C …) next to each colony you pick.`);
    }
    const lighting = cond(p, 'lighting');
    if (lighting)
      out.push(`Photograph the plates under ${lighting.replace('+', ' and ')} before picking. `
             + 'The photographs are the record of what you chose between.');
    return out;
  },
};
