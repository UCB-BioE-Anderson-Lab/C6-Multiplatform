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
import { describeLayout } from '../planning/vessels.js';

export default {
  operation: 'pick',
  title: 'Picking colonies',
  module: 'picking_colonies_into_block',
  // `picked` and `well` are bookkeeping the planner put on the step; they are said in the table
  // and in the notes, and a "For this experiment" row repeating them is the same fact twice.
  shownAsColumn: ['n', 'criteria', 'max', 'well', 'vessel', 'clone', 'library', 'picked'],
  // THE LAYOUT IS PROPOSED, NOT LEFT TO THE BENCH. JCA, 2026-09-12: *"it would be helpful to
  // propose the clone layout within the plate in the labsheet so the experimentalist doesn't have
  // to write that out elsewhere on their own. In such cases, arranging them in some logical way
  // within the plate makes setting things up more communicable."*
  //
  // A block gets a `well` column and tubes get a `label`: in a block the well IS the identity, and
  // a tube needs something written on it. `colonies to pick` is gone — there is one row per
  // colony now, and a count beside each of them was the same number four times.
  columns: (x, ctx) => {
    const well = cond(x.params, 'well');
    if (!well) return { label: ctx.label(x.output), clone: x.output, 'from plate': ctx.from(x) };
    // IN A BLOCK THE WELL IS THE IDENTITY, so it is what later steps refer to. Without this the
    // culture sheet listed its inoculum as `B.subtilis/pGOLD-A, …` — the clone names, which are
    // not written on anything, in a column that is supposed to say where to put a tip.
    const from = ctx.from(x);
    ctx.hold(x.output, well);
    return { well, clone: x.output, 'from plate': from };
  },
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
    // Say which plasticware and why, once, rather than leaving a `well` column to be inferred.
    // `n` WHERE IT IS THERE. An injected pick is one job carrying `n=4`; counting its rows said
    // "1 clone, one tube each" about four colonies.
    const count = Number(cond(p, 'n')) || samples.length;
    if (count) out.push(describeLayout(count, cond(p, 'vessel') || null));
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
