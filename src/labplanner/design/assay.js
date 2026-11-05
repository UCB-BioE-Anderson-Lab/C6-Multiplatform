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
  // WHAT GOES UNDER THE TABLE. Declared, so a field the planner adds later cannot
  // leak onto the page. Anything in a column, in the notes, or bookkeeping is absent
  // by not being named here.
  // `replicates` is not here: it is handed to the protocol as `technical_replicates` and prints
  // in its text. Two statements of one number is one of them being edited later and not the other.
  //
  // `inducer` IS HERE BECAUSE AN INDUCED ASSAY WAS PRINTING WITHOUT ITS INDUCER. Lysis8 asked for
  // `inducer=aTc` on 2026-10-29 and the compiled sheet named aTc nowhere — the condition was not
  // declared, so it was dropped in silence, and the bench would have read a plain growth sheet
  // for an induction experiment. An undeclared condition is invisible rather than refused, which
  // is why this list has to grow whenever a real characterization file names something new.
  //
  // `reference` is NOT here, for the `replicates` reason: it is handed to the protocol below,
  // where `od600_and_colour` prints it as the thing the result is scored against. It was being
  // dropped too, and that silence is what left "STILL TO DECIDE" on a sheet whose reference had
  // been named.
  conditions: ['reporter', 'ex', 'em', 'od', 'inducer'],
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
    // **EVERY CULTURE IN THE BLOCK, NOT THE FIRST ONE.** This read `samples[0]` alone, which is
    // one construct's worth — so a plate reader returning sixteen wells got a key to four of them
    // and the other twelve were numbers with nothing to attribute them to. One assay row per
    // construct, one block, one map.
    const rows = [];
    const controlRows = [];
    let vessel = null;
    for (const x of samples) {
      // **EVERY CULTURE THIS ASSAY READS, NOT ITS FIRST.** `inputs[0]` was the whole block while a
      // culture was one row per construct. One culture per picked colony makes it four, and
      // reading only the first keyed four wells of sixteen — the pick filled B1 and the map said
      // A1, A2, A3, A4. An assay is one plate-reader session over the block; its inputs are the
      // wells it reads.
      const cults = (x.inputs || []).map((n) => producer(n)).filter(Boolean);
      // THE CLONES ARE THE CULTURE'S OWN INPUTS, not `pick.clone`. `expandClones` overwrites that
      // field with the per-colony letter as it fans the step out, so reading it back gave `A-A`,
      // `A-B` — the bookkeeping value, rendered as though it were a construct name.
      const clones = cults.flatMap((c) => c._inputs || []);
      if (!clones.length) continue;
      const cult = cults[0] || {};
      vessel = vessel || cond(cult, 'vessel');
      // THE WELL THE PICK ACTUALLY WROTE. `labelOf` resolves the clone to what the picking sheet
      // put on it, which since `planning/allocateWells.js` is an address counted across the whole
      // sitting rather than from the top-left corner of each construct's own imaginary block.
      // ONE ROW PER WELL, WHATEVER READS IT. Two Assay lines over the same cultures — a
      // two-channel read — walked the same block twice and rendered ten rows for five wells,
      // with A1 appearing three times. A plate map with a well in it twice is not a map.
      for (const c of clones) {
        const well = labelOf(c);
        if (well && !rows.some((r) => r[0] === well && r[1] === c)) rows.push([well, c, 'sample']);
      }
      // ALLOCATED, NOT RECOMPUTED — see `design/culture.js` for the same correction.
      const seats = String(cond(cult, 'controlWells') || '').split(',').map((t) => t.trim())
        .filter(Boolean);
      String(cult.inoculate || '').split(',').map((t) => t.trim()).filter(Boolean)
        .forEach((t, i) => {
          const [what, medium] = t.split(':');
          // ONCE, like the sample rows above. Two Assay lines over one block walked the same
          // controls twice and printed each of them twice in the map.
          if (seats[i] && !controlRows.some((r) => r[0] === seats[i] && r[1] === what)) {
            controlRows.push([seats[i], what, medium ? `control, grown in ${medium}` : 'control']);
          }
        });
    }
    if (!rows.length) return [];
    rows.push(...controlRows);
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
      ...(cond(x.params, 'reference') ? { reference: cond(x.params, 'reference') } : {}),
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
