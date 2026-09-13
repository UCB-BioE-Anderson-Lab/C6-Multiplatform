// retransform.js — the design of an assay-associated transformation labsheet.
//
// JCA, 2026-09-11: *"I think an assay-associated transformation visually resembles a cloning
// transformation, but at an operation level, they are two separate things. Perhaps it is a
// retransformation."*
//
// It takes in VERIFIED plasmid rather than an assembly reaction, which changes the procedure —
// less DNA, few colonies to pick because the DNA is already known good — and it usually goes into
// something that cannot be heat-shocked. Hence `method`, the field a cloning transform does not
// have, and hence no module here: there is no electroporation protocol in the library, and naming
// `heat_shock_transformation` would put the wrong procedure on the page.
//
// THE CONTROLS ARE PLATED HERE. JCA, 2026-09-11: *"They should run that pTRK parent plasmid as a
// positive control on the electroporation. So, 3 plates."* They are conditions of this step and
// appear under it, and they are NOT picked from — see `pick.js`.
import { cond } from './util.js';

export default {
  operation: 'retransform',
  title: 'Electroporation',
  module: null,
  // WHAT GOES UNDER THE TABLE. Declared, so a field the planner adds later cannot
  // leak onto the page. Anything in a column, in the notes, or bookkeeping is absent
  // by not being named here.
  // The controls are a plate table, not two key=value rows — see `blocks` below. Nothing else on
  // a retransform step is a condition: host, antibiotic, temperature and method are all columns.
  conditions: [],
  columns: (x, ctx) => ({
    label: ctx.label(x.output),
    construct: x.output,
    DNA: ctx.from(x),
    host: cond(x.params, 'host', 'strain'),
    antibiotic: cond(x.params, 'antibiotic', 'antibiotics'),
    temperature: cond(x.params, 'temp', 'temperature'),
    method: cond(x.params, 'method'),
  }),
  // THE CONTROLS GET THE SAME PRESENTATION AS THE TRANSFORM'S, because they are the same kind of
  // thing and a student meets both in one experiment. They were rendering as `negative |
  // untransformed` and `positive | pTRKH3-slpGFP` under "For this experiment" — true, and it does
  // not tell somebody what to put on a plate or what the plate would prove.
  //
  // TWO CONTROLS HERE, NOT THREE. The restreak belongs to the cloning transformation; JCA,
  // 2026-09-12, asked for the three-plate set on *"the transformation, not the
  // retransformation"*. This DNA is already known good, so the question "is this batch of plates
  // any good" was answered upstream.
  blocks: ({ samples }) => {
    const x = samples[0] || {};
    const p = x.params || {};
    const host = cond(p, 'host', 'strain') || 'the same cells';
    const ab = cond(p, 'antibiotic', 'antibiotics') || 'the antibiotic';
    const neg = cond(p, 'negative');
    const pos = cond(p, 'positive');
    const rows = [];
    if (pos) rows.push([`${ab} +`, `${host} + ${pos}`,
                        'the cells survived the pulse and will take up DNA — this plasmid is '
                        + 'known to electroporate into this host']);
    if (neg) rows.push([`${ab} −`, `${host}, no DNA added`,
                        `the plate is not simply growing ${neg} cells`]);
    // THE THIRD PLATE, AND ONLY WHEN IT CAN SPEAK TO THIS HOST. It is not a transformation: the
    // strain already carries the marker, so it grows unless the plates cannot support growth at
    // all — which is the one failure the other two plates cannot distinguish from a dead pulse.
    //
    // Where the lab has no such strain the row is absent and the bin carries the gap as an open
    // decision, because a plate streaked with the wrong organism is not a weaker control, it is
    // a control that answers nothing. → `planning/injectTransformRecovery.js § CONTROL_STRAINS`
    const strain = x.controlStrain || null;
    if (strain) rows.push([`${ab} streak`, `${strain}, streaked — not electroporated`,
                           `anything could have grown on this batch of ${ab} plates`]);
    if (!rows.length) return [];
    return [
      { kind: 'heading',
        text: `Controls — ${rows.length + 1} plates, all electroporated the same way` },
      { kind: 'table', rows: [['plate', 'what goes on it', 'it answers'], ...rows] },
    ];
  },
  values: () => ({}),
  recipe: () => null,
  notes: ({ samples }) => {
    const p = samples[0]?.params || {};
    const out = [];
    // THE CRITERION, NOT THE PROVENANCE. An earlier version said "the backbone came from it",
    // which is true of pTRKH3-slpGFP in Lactis3 and is not something this design can know about
    // whatever `positive=` names in the next experiment. State what makes a positive control
    // worth running and let the file's choice stand on it.
    if (cond(p, 'positive'))
      out.push(`${cond(p, 'positive')} works as the positive control because it is already known `
             + 'to go into this host by this method. A control that has never been through the '
             + 'procedure tells you nothing when it fails. If its plate is empty too, the answer '
             + 'is the cells or the pulse — not the assembly.');
    // THE WAY OUT OF THE MISSING CONTROL, and it costs nothing. The positive control plate is this
    // host carrying the control plasmid — which is exactly the strain a restreak control needs. One
    // colony off it, banked, and every retransformation after this one can check its plate batch.
    // JCA, 2026-09-13: *"What would be relevant would be to streak l. lactis control cells that had
    // previously been transformed. That doesn't exist currently."*
    if (cond(p, 'positive') && !(samples[0] || {}).controlStrain)
      out.push(`Pick one colony off the ${cond(p, 'positive')} control plate and save it as a `
             + `stock. It is ${cond(p, 'host', 'strain') || 'this host'} carrying the control `
             + 'plasmid, which is the strain a plate-batch control needs and the lab does not have '
             + 'yet. Doing it now costs one tube and answers the question for every '
             + 'electroporation after this one.');
    out.push('No electroporation protocol is in the library yet, so this sheet carries the '
           + 'conditions and not the procedure. Nothing here tells you the cuvette gap, the '
           + 'voltage or the recovery medium.');
    return out;
  },
};
