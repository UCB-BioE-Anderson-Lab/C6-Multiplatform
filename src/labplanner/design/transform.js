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
  shownAsColumn: ['strain', 'antibiotic', 'antibiotics', 'temperature', 'afterVerified'],
  // ONE ROW PER PLATE, AND A TRANSFORMATION IS USUALLY THREE. JCA, 2026-09-12: *"The
  // transformation experiment should include the E1 control stock experiment (the transformation,
  // not the retransformation). So, 3 plates for that."* The planner has worked the controls out
  // since 2026-09-10 and the projection dropped them, so the sheet said one plate.
  //
  // A BLANK PLATE HAS FOUR CAUSES and no way to tell them apart without these: a bad plate, dead
  // cells, a failed assembly, a failed transformation. The control plate answers the first, the
  // positive the second, the negative rules out growth that is not selection at all.
  // THE SAMPLES TABLE HOLDS THE SAMPLES. The three controls used to be rows in it, which forced
  // them to answer questions a sample row asks and they do not have: `construct` held `E1` on two
  // rows and `(none)` on a third, and each took a label out of the packet's running sequence.
  //
  // JCA, 2026-09-12: *"This 3-plate control set is something we will be using very often, so we
  // should come up with good names specifically for it. The only thing that differs between those
  // controls (i think) is what antibiotic it is governing. In that the samples don't live in a
  // specific well, and are all in one box, and the actual plasmid name of the control isn't really
  // important to the instruction, I don't think we need to represent the control experiments the
  // same way as other things. We should present it in its own maximally clear way."*
  //
  // So they are a block of their own — see `blocks` below — named for the antibiotic they govern,
  // which is the only thing that varies between one transformation's set and the next.
  columns: (x, ctx) => ({
    label: ctx.label(x.output),
    construct: x.output,
    DNA: ctx.from(x),
    strain: cond(x.params, 'strain'),
    antibiotic: cond(x.params, 'antibiotics', 'antibiotic'),
    temperature: cond(x.params, 'temperature'),
  }),

  /**
   * The control set, as a table of its own.
   *
   * Named by what each one governs and what it answers, not by which plasmid is in it: the plasmid
   * lives in one box, has no well, and is not part of the instruction. Where to fetch it is a
   * `source:` row, which is where fetching belongs.
   */
  blocks: ({ samples }) => {
    const x = samples[0] || {};
    const controls = x.controls || [];
    if (!controls.length) return [];
    const ab = cond(x.params, 'antibiotics', 'antibiotic') || 'the antibiotic';
    const cells = x.strain || cond(x.params, 'strain') || 'the same competent cells';
    const stock = x.controlStock || null;
    const row = {
      positive: [`${ab} +`, `${cells} + the ${ab} control plasmid`,
                 'the cells are competent and took up DNA'],
      negative: [`${ab} −`, `${cells}, no DNA added`,
                 'the plate is not simply growing untransformed cells'],
      restreak: [`${ab} streak`, `the ${ab} control strain, streaked — not transformed`,
                 `anything could have grown on this batch of ${ab} plates`],
    };
    const rows = controls.map((c) => row[c.kind]).filter(Boolean);
    if (!rows.length) return [];
    return [
      { kind: 'heading', text: `Controls — three plates, the same for every ${ab} transformation` },
      { kind: 'table', rows: [['plate', 'what goes on it', 'it answers'], ...rows] },
      { kind: 'text',
        text: stock
          ? `Both control plasmid and control strain are ${stock}, in the control stocks box. `
            + 'They have no well; the box is the location.'
          : `Nothing here names the ${ab} control stock. It is in the control stocks box; ask `
            + 'whoever keeps that box which tube it is.' },
    ];
  },

  // `heat_shock_transformation` defaults to Amp; rendered with no values it prints "plate on Amp"
  // directly under a table saying erm.
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
  notes: ({ samples }) => {
    const out = [];
    for (const x of samples) {
      if (x.rescueWhy) out.push(x.rescueWhy);
      if (x.transformNote) out.push(x.transformNote);
      // ONLY WHAT THE CONTROL TABLE CANNOT SAY: that the streak goes on a plate from the same
      // batch, which is the whole point of it and is procedure rather than a column.
      for (const c of x.controls || []) {
        if (c.kind !== 'restreak') continue;
        out.push('Streak the control strain onto a plate from the same batch as the others — it '
               + 'is that batch the plate is testing.');
      }
    }
    // WHY THREE PLATES, said once. A blank plate has four causes and no way to tell them apart
    // without these; a student given three plates and no reason runs two of them carelessly.
    if (samples.some((x) => (x.controls || []).length))
      out.push('A plate with no colonies has four possible causes — a badly poured plate, dead '
             + 'cells, a failed assembly, a failed transformation. The three control plates are '
             + 'how you tell them apart, so run them as carefully as the real one.');
    return out;
  },
};
