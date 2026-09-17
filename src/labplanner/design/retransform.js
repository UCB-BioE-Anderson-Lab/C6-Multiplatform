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

/**
 * Which protocol covers a method into a host, if any.
 *
 * Keyed on the organism because the numbers are the organism's: the field a Gram-positive wall
 * needs is not E. coli's, and neither is the recovery medium or the temperature. A host that is not
 * in here has no procedure in this toolkit — `planning/cfToJobs.js` refuses the file rather than
 * printing the nearest one.
 *
 * Matched loosely on the strain string, because a file says `L.lactis`, `L. lactis` or
 * `L. lactis NZ9000` and all three mean the same species.
 */
export const PROTOCOLS = [
  { method: 'electroporation', host: /^l\.? ?lactis\b/i, module: 'lactis_electroporation' },
];

/** The module for a step's method and host, or null. */
export function protocolFor(params) {
  const method = String(cond(params, 'method') || '').trim().toLowerCase();
  const host = String(cond(params, 'host', 'strain') || '').trim();
  const hit = PROTOCOLS.find((x) => x.method === method && x.host.test(host));
  return hit ? hit.module : null;
}

/** The DNA a retransformation takes in — its first input, which is the verified plasmid. */
const ctxDna = (x) => (x.inputs || [])[0] || '';

/**
 * How a plasmid is got into an assay host, and the words each way needs.
 *
 * **THE SHEET USED TO SAY "ELECTROPORATION" WHATEVER THE FILE SAID.** With `method=conjugation` it
 * still titled itself Electroporation, said the controls were "all electroporated the same way",
 * that "the cells survived the pulse", and that nothing on the page gave "the cuvette gap, the
 * voltage". Six statements about a procedure nobody was doing — and cuvette gap and voltage are
 * not merely unhelpful for a conjugation, they are meaningless.
 *
 * A method C6 has no words for gets NEUTRAL ones rather than another method's. `took up the DNA`
 * is true of every route; `survived the pulse` is true of one.
 */
export const METHODS = {
  electroporation: {
    title: 'Electroporation',
    sameWay: 'all electroporated the same way',
    survived: 'the cells survived the pulse and will take up DNA',
    knownTo: 'known to electroporate into this host',
    blame: 'the cells or the pulse',
    missing: 'Nothing here tells you the cuvette gap, the voltage or the recovery medium.',
  },
  conjugation: {
    title: 'Conjugation',
    sameWay: 'all mated the same way',
    survived: 'the mating works and this host will take up the plasmid',
    knownTo: 'known to transfer into this host by mating',
    blame: 'the donor or the mating',
    missing: 'Nothing here tells you the donor strain, the mating ratio or how long to mate for.',
  },
};

/** Neutral words, for a route this toolkit has no specific language for. */
export const ANY_METHOD = {
  title: 'Transformation into the assay host',
  sameWay: 'all done the same way',
  survived: 'this host will take up the plasmid by this route',
  knownTo: 'known to go into this host by this route',
  blame: 'the cells or the procedure',
  missing: 'Nothing here tells you the conditions.',
};

/** The words for a method, or neutral ones. Never another method's. */
export function wordsFor(method) {
  return METHODS[String(method || '').trim().toLowerCase()] || ANY_METHOD;
}

export default {
  operation: 'retransform',
  // THE TITLE FOLLOWS THE FILE, AND ONLY WHEN THE FILE SAID SOMETHING. A sheet headed
  // Electroporation over a conjugation is wrong in the first thing anybody reads — but a file that
  // declared no method at all has said nothing to contradict, and the session pairing's name is
  // the lab's own word for that sitting. So: `null` when nothing was declared, which lets the
  // pairing stand; the method's own title when it was.
  title: (ctx) => {
    const m = cond(ctx.samples?.[0]?.params, 'method');
    return m ? wordsFor(m).title : null;
  },
  /**
   * The protocol for THIS method into THIS organism, or none.
   *
   * **A PROTOCOL IS PER ORGANISM, NOT PER METHOD.** JCA, 2026-09-17: *"the rescue volume, temps,
   * voltage are all about a different organism, and not the same as e. coli."* So the lookup is
   * keyed on both, and a host with no entry gets no procedure rather than somebody else's — which
   * is the same rule this module already applies to conjugation. → `PROTOCOLS`
   */
  module: (ctx) => protocolFor(ctx.samples?.[0]?.params),

  // WHAT GOES UNDER THE TABLE. Declared, so a field the planner adds later cannot
  // leak onto the page. Anything in a column, in the notes, or bookkeeping is absent
  // by not being named here.
  // The controls are a plate table, not two key=value rows — see `blocks` below. Nothing else on
  // a retransform step is a condition: host, antibiotic, temperature and method are all columns.
  conditions: [],

  /**
   * What the electroporation protocol is told, taken from the characterization file.
   *
   * **A PROTOCOL RENDERED WITH NO VALUES PRINTS ITS DEFAULTS**, and a default reads exactly like an
   * answer — `heat_shock_transformation` said "plate on Amp" under a table saying erm. Everything
   * here is passed only where the file said it, so a value nobody supplied stays absent and the
   * protocol says so in the step that needs it, instead of a number nobody chose.
   *
   * The bench quantities — cell volume, DNA volume, recovery volume and time — are read from the
   * same `key=value` args as everything else, so a file that knows its host's numbers gets them on
   * the page. → `protocols/modules/electroporation.js § inputs`
   */
  /**
   * What the protocol is told: the four things that vary per experiment.
   *
   * **AND NOTHING ELSE**, because everything else is the organism's and lives in the protocol. An
   * earlier version passed cuvette gap, voltage, recovery medium and four volumes through from the
   * file — which made a file able to describe a pulse, and made every file obliged to.
   */
  values: ({ samples, module }) => {
    if (!module) return {};
    const x = samples[0] || {};
    const p = x.params || {};
    const v = { plasmid: ctxDna(x), product_name: x.output || '' };
    const host = cond(p, 'host', 'strain');
    const ab = cond(p, 'antibiotic', 'antibiotics');
    if (host) v.host = host;
    if (ab) v.antibiotics = ab;
    return { [module]: v };
  },

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
    const w = wordsFor(cond(p, 'method'));
    const rows = [];
    if (pos) rows.push([`${ab} +`, `${host} + ${pos}`,
                        `${w.survived} — this plasmid is ${w.knownTo}`]);
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
    if (strain) rows.push([`${ab} streak`, `${strain}, streaked — not transformed`,
                           `anything could have grown on this batch of ${ab} plates`]);
    if (!rows.length) return [];
    return [
      { kind: 'heading', text: `Controls — ${rows.length + 1} plates, ${w.sameWay}` },
      { kind: 'table', rows: [['plate', 'what goes on it', 'it answers'], ...rows] },
    ];
  },
  recipe: () => null,
  notes: ({ samples }) => {
    const p = samples[0]?.params || {};
    const out = [];
    // THE CRITERION, NOT THE PROVENANCE. An earlier version said "the backbone came from it",
    // which is true of pTRKH3-slpGFP in Lactis3 and is not something this design can know about
    // whatever `positive=` names in the next experiment. State what makes a positive control
    // worth running and let the file's choice stand on it.
    const w = wordsFor(cond(p, 'method'));
    if (cond(p, 'positive'))
      out.push(`${cond(p, 'positive')} works as the positive control because it is already known `
             + 'to go into this host by this method. A control that has never been through the '
             + `procedure tells you nothing when it fails. If its plate is empty too, the answer `
             + `is ${w.blame} — not the assembly.`);
    // THE WAY OUT OF THE MISSING CONTROL, and it costs nothing. The positive control plate is this
    // host carrying the control plasmid — which is exactly the strain a restreak control needs. One
    // colony off it, banked, and every retransformation after this one can check its plate batch.
    // JCA, 2026-09-13: *"What would be relevant would be to streak l. lactis control cells that had
    // previously been transformed. That doesn't exist currently."*
    if (cond(p, 'positive') && !(samples[0] || {}).controlStrain)
      out.push(`Pick one colony off the ${cond(p, 'positive')} control plate and save it as a `
             + `stock. It is ${cond(p, 'host', 'strain') || 'this host'} carrying the control `
             + 'plasmid, which is the strain a plate-batch control needs and the lab does not have '
             + 'yet. Doing it now costs one tube and answers the question for every run after '
             + 'this one.');
    // WHAT IS MISSING IS NAMED IN THE METHOD'S OWN TERMS. Telling somebody doing a conjugation
    // that the sheet omits "the cuvette gap, the voltage" describes a procedure they are not doing.
    //
    // **AND ONLY WHERE IT IS STILL MISSING.** Electroporation has a protocol as of 2026-09-17 —
    // JCA: *"We should make an electroporation sheet"* — so saying it does not would be the page
    // lying about itself, which is worse than the gap it was written to admit. The protocol states
    // its own missing NUMBERS in the step that needs each one, which is where somebody can act on
    // them. → `protocols/modules/electroporation.js`
    const method = String(cond(p, 'method') || '').trim().toLowerCase();
    if (method !== 'electroporation') {
      out.push(`No ${method || 'transfer'} protocol is in the `
             + `library yet, so this sheet carries the conditions and not the procedure. ${w.missing}`);
    }
    return out;
  },
};
