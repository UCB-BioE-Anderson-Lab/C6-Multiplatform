// assay.js — the design of an assay labsheet.
//
// AN ASSAY IS TERMINAL AND HAS NO MATERIAL OUTPUT. JCA, 2026-09-11: *"An assay returns data, and
// there is a shape to that data. But there is no material output… we are writing custom subtypes
// of assays, that are basically protocols."* So there is no tube to label here, and the design's
// job is to name the subtype and hand it its parameters — the protocol module IS the assay.
//
// WHICH IS WHY `protocol=` OVERRIDES. A characterization file names its own assay protocol, and
// that name is the one thing this design must not decide for itself.
//
// HOW MANY CULTURES IS THE NUMBER THAT MUST NOT BE DEFAULTED. `plate_reader_fluorescence` assumes
// 24, and an assay sheet that opens "Read 24 cultures" about six is wrong in its first sentence
// and in every number after it.
import { cond } from './util.js';
import { layoutFor } from '../planning/vessels.js';

export default {
  operation: 'assay',
  title: 'Assay',
  module: (ctx) => cond(ctx.samples[0]?.params, 'protocol') || null,
  // WHAT GOES UNDER THE TABLE. Declared, so a field the planner adds later cannot
  // leak onto the page. Anything in a column, in the notes, or bookkeeping is absent
  // by not being named here.
  // `replicates` is not here: it is handed to the protocol as `technical_replicates` and prints
  // in its text. Two statements of one number is one of them being edited later and not the other.
  conditions: ['reporter', 'ex', 'em', 'od'],
  columns: (x, ctx) => ({ construct: x.output, samples: ctx.from(x) }),

  // WHICH WELL IS WHAT. Without this the assay sheet named the block — `L3h` — and stopped, and
  // the map from well to sample lived on the picking sheet from a session earlier. A plate reader
  // returns a grid of numbers; a grid with no key is not data, and reconstructing it afterwards
  // from another page is where a control column gets read as a sample.
  //
  // THE SAME LAYOUT THE PICK PROPOSED, recomputed the same way rather than carried, because the
  // pick sheet and this one disagreeing about A2 is worse than either of them being wrong alone.
  // `layoutFor` is the single answer to where the nth thing goes.
  blocks: ({ samples, producer, labelOf }) => {
    const x = samples[0] || {};
    const cult = producer((x.inputs || [])[0]) || {};
    // THE CLONES ARE THE CULTURE'S OWN INPUTS, not `pick.clone`. `expandClones` overwrites that
    // field with the per-colony letter as it fans the step out, so reading it back gave `A-A`,
    // `A-B` — the bookkeeping value, rendered as though it were a construct name.
    const clones = cult._inputs || [];
    const controls = String(cult.inoculate || '').split(',').map((t) => t.trim()).filter(Boolean);
    if (!clones.length) return [];
    let wells;
    try { wells = layoutFor(clones.length + controls.length); } catch { return []; }
    const rows = clones.map((c, i) => [labelOf(c) || wells[i], c, 'sample']);
    controls.forEach((t, i) => {
      const [what, medium] = t.split(':');
      rows.push([wells[clones.length + i], what,
                 medium ? `control, grown in ${medium}` : 'control']);
    });
    const vessel = cond(cult, 'vessel');
    return [
      { kind: 'heading',
        text: `What is in each well of ${vessel ? `the ${vessel} block` : 'the block'}` },
      { kind: 'table', rows: [['well', 'what is in it', 'role'], ...rows] },
    ];
  },
  values: ({ samples, module, producer }) => {
    if (!module) return {};
    const x = samples[0] || {};
    const n = culturesOf(x, producer);
    return { [module]: {
      ...(n ? { samples: n } : {}),
      ...(cond(x.params, 'replicates')
            ? { technical_replicates: Number(cond(x.params, 'replicates')) } : {}),
    } };
  },
  recipe: () => null,
  notes: () => [],
};

// The block holds the picked clones plus whatever the culture step inoculated alongside them.
// Read off the plan rather than defaulted.
//
// THIS IS ARITHMETIC THE PLANNER SHOULD OWN. A culture job knows its own well count better than a
// design does; doing it here keeps the sheet honest today and is the thing to move when `culture`
// grows a `wells` field.
function culturesOf(assay, producer) {
  const cult = producer((assay.inputs || [])[0]) || {};
  const controls = String(cult.inoculate || '').split(',').map((t) => t.trim()).filter(Boolean);
  const pick = producer(cult._from) || {};
  const clones = Number(pick.n || 0);
  return (clones + controls.length) || null;
}
