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

export default {
  operation: 'assay',
  title: 'Assay',
  module: (ctx) => cond(ctx.samples[0]?.params, 'protocol') || null,
  shownAsColumn: ['picked'],
  columns: (x, ctx) => ({ construct: x.output, samples: ctx.from(x) }),
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
