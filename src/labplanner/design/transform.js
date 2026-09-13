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
  columns: (x, ctx) => {
    const strain = cond(x.params, 'strain');
    const abx = cond(x.params, 'antibiotics', 'antibiotic');
    const temp = cond(x.params, 'temperature');
    // `strain` IS WHAT GOES ON THE PLATE. For the sample and the two transformations that is the
    // competent-cell strain; for the restreak it is the control strain itself, which is the
    // distinction the whole control turns on.
    const row = (label, construct, dna, answers, who) => ({
      // `null` means the same competent cells as the sample — the two transformation controls
      // use this batch, which is the only reason their result says anything about it.
      label, construct, DNA: dna, strain: who == null ? strain : who,
      antibiotic: abx, temperature: temp, 'what it tells you': answers,
    });
    const dnaIn = ctx.from(x);
    const rows = [row(ctx.label(x.output), x.output, dnaIn, 'did the assembly work')];
    // EVERY CONTROL IS A PLATE AND EVERY PLATE TAKES A LABEL. A suffixed one — `L3f+` — is four
    // characters and a second naming scheme on one page; every other row in the packet is a
    // letter from the same running sequence, and a control plate is as much a thing somebody
    // labels as the plate it controls for. Which one it is, is in `construct` and in what it
    // tells you.
    //
    // `construct` IS THE CONSTRUCT on every row: putting "positive control" there made the column
    // mean two things down one table, and the inventory reads it back by its defined meaning.
    // The restreak's material is a STRAIN rather than a plasmid, which is the distinction the
    // whole control turns on.
    for (const c of x.controls || []) {
      rows.push(row(ctx.label(), c.construct || '', c.dna || 'none', c.answers, c.strain));
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
      // ONLY WHAT THE TABLE CANNOT SAY. Every row already carries its material and what it tells
      // you; repeating that below is one more thing to read and one more place to disagree. The
      // restreak is the exception — that it is streaked rather than transformed, and onto a plate
      // from the same batch, is procedure and not a column.
      for (const c of x.controls || []) {
        if (c.kind !== 'restreak') continue;
        out.push(`${c.what[0].toUpperCase()}${c.what.slice(1)}. It is not a transformation — `
               + `${c.stock || 'the control strain'} already carries the resistance.`);
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
