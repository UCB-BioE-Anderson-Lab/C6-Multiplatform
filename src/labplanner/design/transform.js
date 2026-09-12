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
  // ONE ROW PER PLATE, AND A TRANSFORMATION IS USUALLY THREE. JCA, 2026-09-12: *"The
  // transformation experiment should include the E1 control stock experiment (the transformation,
  // not the retransformation). So, 3 plates for that."* The planner has worked the controls out
  // since 2026-09-10 and the projection dropped them, so the sheet said one plate.
  //
  // A BLANK PLATE HAS FOUR CAUSES and no way to tell them apart without these: a bad plate, dead
  // cells, a failed assembly, a failed transformation. The control plate answers the first, the
  // positive the second, the negative rules out growth that is not selection at all.
  columns: (x, ctx) => {
    const strain = cond(x.params, 'strain');
    const abx = cond(x.params, 'antibiotics', 'antibiotic');
    const temp = cond(x.params, 'temperature');
    const row = (label, construct, dna, answers) => ({
      label, construct, DNA: dna, strain, antibiotic: abx, temperature: temp,
      'what it tells you': answers,
    });
    const dnaIn = ctx.from(x);
    const rows = [row(ctx.label(x.output), x.output, dnaIn, 'did the assembly work')];
    // THE CONTROLS TAKE THEIR OWN LABELS. A suffixed one — `L3f+` — is four characters and is a
    // second naming scheme on one page; every other row in the packet is a letter from the same
    // running sequence, and a control plate is as much a thing somebody labels as the plate it
    // controls for. Which one it is, is in `construct` and in what it tells you.
    for (const c of x.controls || []) {
      // The streak rides on one of the plates rather than taking a third of its own — JCA,
      // 2026-09-10: *"streaking that on one of the plates"* — so it is a note, not a row.
      if (c.kind === 'plate') continue;
      // `construct` IS THE CONSTRUCT, on every row. Putting "positive control" there made the
      // column mean two different things down one table — a name on three rows and a role on two
      // — and the inventory reads this column back by its defined meaning.
      const dna = c.kind === 'negative' ? '' : (x.controlStock || c.stock || 'the control plasmid');
      rows.push(row(ctx.label(), dna || '(no DNA)', dna || 'none', c.answers));
    }
    return rows;
  },
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
      for (const c of x.controls || []) {
        if (c.kind !== 'plate') continue;
        out.push(`${c.what[0].toUpperCase()}${c.what.slice(1)} — it answers whether ${c.answers}.`);
      }
    }
    // WHY THREE PLATES, said once. A blank plate has four causes and no way to tell them apart
    // without these; a student given three plates and no reason runs two of them carelessly.
    if (samples.some((x) => (x.controls || []).length))
      out.push('A plate with no colonies has four possible causes — a bad plate, dead cells, a '
             + 'failed assembly, a failed transformation. These three plates are how you tell '
             + 'them apart, so run them as carefully as the real one.');
    return out;
  },
};
