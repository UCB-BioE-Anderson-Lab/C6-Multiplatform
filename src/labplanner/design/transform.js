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
    const row = (plate, product, dna, answers) => ({
      plate, product, DNA: dna, strain, antibiotic: abx, temperature: temp,
      'what it tells you': answers,
    });
    const rows = [row(ctx.tube, x.output, (x.inputs || []).join(', '),
                      'did the assembly work')];
    let n = 1;
    for (const c of x.controls || []) {
      // The streak rides on one of the plates rather than taking a third of its own — JCA,
      // 2026-09-10: *"streaking that on one of the plates"* — so it is a note, not a row.
      if (c.kind === 'plate') continue;
      n += 1;
      rows.push(row(`${ctx.tube}${n}`, `${c.kind} control`,
                    c.kind === 'negative' ? 'none (no DNA)'
                                          : (x.controlStock || c.stock || 'the control plasmid'),
                    c.answers));
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
