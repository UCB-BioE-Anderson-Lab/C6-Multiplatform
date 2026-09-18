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
import { describeLayout, shapeOf } from '../planning/vessels.js';
import { cloneName } from '../planning/naming.js';

export default {
  operation: 'pick',
  title: 'Picking colonies',
  module: 'picking_colonies_into_block',
  // `picked` and `well` are bookkeeping the planner put on the step; they are said in the table
  // and in the notes, and a "For this experiment" row repeating them is the same fact twice.
  // WHAT GOES UNDER THE TABLE. Declared, so a field the planner adds later cannot
  // leak onto the page. Anything in a column, in the notes, or bookkeeping is absent
  // by not being named here.
  // `volume` is how much medium goes in each tube or well — said nowhere else on the page;
  // `vessel` is, in the layout note, and `lighting` and `criteria` are in their own notes.
  conditions: ['medium', 'volume'],
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
    // **WHAT GOES ON A PICKING TUBE.** JCA, 2026-09-15: *"When you pick colonies, you put like
    // pBET8-C on the tube. So, the clone designation is determined during picking. The labsheets
    // presume a certain number of colonies and thus a specific bag of letters, is used."*
    //
    // It used to take the next letter out of the packet's running sequence — `L3h` — which is two
    // naming schemes for one object, and `design/miniprep.js` argues against exactly that: *"if
    // you were going to ask them to put codes on the samples, it makes little sense to refer to
    // them as L3h when you are also naming them B."* It is the same tube's name all the way
    // through: the colony is picked into `pBET8-C`, grown, minipreped into `pBET8-C`, and
    // submitted for sequencing as `pBET8-C`. A label that changes at each step is one that has to
    // be cross-referenced at each step.
    //
    // The clone column still carries the job's own product, because a colony is a STRAIN and the
    // cap says the DNA it holds — both on the page, which is the split the toolkit rests on.
    const base = cond(x.params, 'cloneBase');
    const designation = cond(x.params, 'clone');
    const named = base && designation ? cloneName(base, designation) : null;
    if (!well) {
      // **REGISTER IT, OR THE NEXT SHEET CANNOT FIND THE TUBE.** `ctx.label()` both MINTS a label
      // and records which tube now holds the construct, and taking the name from the clone instead
      // skipped the second half — so the miniprep's source column read `Mach1/pGOLD-A`, a strain
      // name, where the thing to pick up off the rack is a tube with `pGOLD-A` on it.
      if (named) ctx.hold(x.output, named);
      return { label: named || ctx.label(x.output), clone: x.output, 'from plate': ctx.from(x) };
    }
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
    // THE PROTOCOL IS TOLD WHICH BLOCK, or it says the one it defaults to. `picking_colonies_into
    // _block` defaults to 24 wells, and a sheet whose culture table says `96-well` carried a
    // protocol saying "1 × 24-well block" — two statements about one piece of plastic on one page.
    const shape = shapeOf(cond(x.params, 'vessel'));
    const volume = parseFloat(String(cond(x.params, 'volume') || '').replace(/[^0-9.]/g, ''));
    return { [module]: {
      samples: (x.inputs || []).length || 1,
      ...(cond(x.params, 'n') ? { colonies_per_sample: Number(cond(x.params, 'n')) } : {}),
      ...(abx ? { antibiotic: abx } : {}),
      ...(shape.known ? { block_wells: shape.rows * shape.cols } : {}),
      ...(Number.isFinite(volume) && volume > 0 ? { well_volume_mL: volume } : {}),
    } };
  },
  recipe: () => null,
  notes: ({ samples }) => {
    const p = samples[0]?.params || {};
    const out = [];
    // Say which plasticware and why, once, rather than leaving a `well` column to be inferred.
    //
    // **THE ROWS WHERE THERE ARE ROWS, `n` ONLY WHERE THERE ARE NOT.** `n` is one construct's clone
    // count. Preferring it unconditionally printed *"4 clones in a 24-well block"* over a table of
    // SIXTEEN — four constructs' picks binned onto one sheet, wells A1 through D4 — so the sentence
    // describing the layout disagreed with the layout underneath it. Six sheets across the matrix
    // said it, and nothing failed, because no test reads a note against its own table.
    //
    // `n` is still preferred for a single row, which is the case it was added for: an injected pick
    // is one job carrying `n=4`, and counting its rows said "1 clone, one tube each" about four
    // colonies. Both cases are now right for the same reason — the note describes what is actually
    // going into the vessel.
    const count = samples.length > 1 ? samples.length
                                     : (Number(cond(p, 'n')) || samples.length);
    if (count) out.push(describeLayout(count, cond(p, 'vessel') || null));
    // WHICH COLONIES COMES BEFORE HOW MANY, and it used to be absent entirely. A sheet that says
    // "pick 4 and photograph the plates" has told a student everything except the one thing they
    // are standing at the bench to decide. → `validate/characterizationFile.js`, PICK_WITHOUT_
    // PHENOTYPE, for the review this cost.
    //
    // Unshifted to the FRONT of the notes rather than appended: it is read before the count, and
    // the count is meaningless without it.
    const pheno = cond(p, 'phenotype');
    if (pheno) out.unshift(`Pick only colonies that are ${pheno}. Colonies that are not, are not `
                         + `candidates — if none of them look right, photograph the plate and say `
                         + `so rather than picking the best of a bad plate.`);
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
