// index.js — the registry of labsheet designs, and the one function that applies one.
//
// JCA, 2026-09-12: *"once the list of labsheets is established, the rest of the details for a
// labsheet are pretty deterministic… With a specific design algorithm per labsheet type, that
// should be pretty generalizable and expandable."*
//
// So: planning decides WHICH sheets there are; a design decides what goes on one. Adding an
// operation is adding a file here and nothing else. An operation with no design gets `_default`,
// and the resulting sheet is thin ON PURPOSE — a thin sheet is the signal that nobody has written
// the design yet, where a plausible generic page would hide it.
import _default from './_default.js';
import pcr from './pcr.js';
import gel from './gel.js';
import zymo from './zymo.js';
import goldengate from './goldengate.js';
import transform from './transform.js';
import retransform from './retransform.js';
import pick from './pick.js';
import culture from './culture.js';
import assay from './assay.js';
import miniprep from './miniprep.js';
import sequencing from './sequencing.js';
import analysis from './analysis.js';
import dilution from './dilution.js';
import stock from './stock.js';

/** The defaults every design gets, so a module only states what is unusual about it.
 *
 * NORMALIZED HERE AND NOWHERE ELSE. These were being defaulted inside `applyDesign`, which meant
 * the registry and the applied design disagreed: `DESIGNS.pcr.fetches` was `undefined` while the
 * thing the packet used said `true`. Anything reasoning about designs in the aggregate — a test,
 * a doc generator, the next tool — read the wrong one.
 */
const DEFAULTS = { conditions: [], fetches: true };
const normalize = (d) => ({ ...DEFAULTS, ...d });

export const DESIGNS = Object.fromEntries(
  [pcr, gel, zymo, goldengate, transform, retransform, pick, culture, assay,
   miniprep, sequencing, analysis, dilution, stock]
    .map((d) => [d.operation, normalize(d)]));

const DEFAULT_DESIGN = normalize(_default);

/** The design for an operation, or the default one. Never throws; never guesses a protocol. */
export function designFor(operation) {
  return DESIGNS[String(operation || '').toLowerCase()] || DEFAULT_DESIGN;
}

// THE NAMING DECISIONS LIVE IN `planning/naming.js`, one callable function each.
//
// They were expressions in this file until GATE 2, which is why JCA corrected seven of them in one
// afternoon from a rendered sheet: a rule you cannot call is a rule you find out about on paper.
// What is left here is the bookkeeping — who holds which construct right now — because that is
// about the packet rather than about a name.
import { experimentPrefix, letterAt, derivedLabel, labelLimitFor, referToInput } from '../planning/naming.js';

export { experimentPrefix as labelPrefix, letterAt, labelLimitFor };

/** The longest a label may be by default; a design may say otherwise for the tube it labels. */
export const LABEL_MAX = labelLimitFor('pcr');

/**
 * A label maker for one packet: successive calls give successive labels, and it remembers which
 * tube currently holds which construct.
 *
 * ONE COUNTER FOR THE WHOLE PACKET, not one per sheet. A freezer box holds tubes from every session
 * at once, so a counter that restarts per sheet distinguishes nothing where it matters.
 */
export function labeller(experiment, prefix) {
  const p = prefix || experimentPrefix(experiment);
  let i = 0;
  // WHICH TUBE CURRENTLY HOLDS WHICH CONSTRUCT. Registering as labels are handed out makes the
  // lookup correct by construction: the gel is drawn before the cleanup, so it asks for the PCR
  // tube; the assembly is drawn after and gets the cleaned one. Latest holder wins, which is what
  // "go and fetch it" means at a bench.
  const held = new Map();
  const next = (construct) => {
    const lab = `${p}${letterAt(i++)}`;
    if (construct) held.set(String(construct), lab);
    return lab;
  };
  next.of = (construct) => held.get(String(construct || '')) || null;
  // A step that changes the tube without changing the molecule — see `naming.derivedLabel`.
  next.derived = (operation, source, construct) => {
    const base = held.get(String(source || '')) || String(source || '');
    const lab = derivedLabel(operation, base);
    if (construct) held.set(String(construct), lab);
    return lab;
  };
  // A step may change who holds a construct without making a tube: reading the traces is exactly
  // when "fetch pBET8" stops meaning the assembly and starts meaning the clone that passed.
  next.hold = (construct, text) => { if (construct) held.set(String(construct), text); };
  return next;
}

/**
 * Apply a design to one planned bin: the sheet's title, its table, its recipe, the protocol it
 * transcludes and the values that protocol is rendered with.
 *
 * @param {Object} sheet     one bin from `c6-plan --json`
 * @param {Function} producer  name -> the conditions of the step that makes it
 * @returns {Object} the design's decisions, ready to be assembled into a LabSheet
 */
export function applyDesign(sheet, producer, opts = {}) {
  const operation = String(sheet.operation || '').toLowerCase();
  const d = designFor(operation);
  const samples = sheet.samples || [];
  const ctx = { sheet, samples, operation, mastermix: sheet.mastermix || null, producer };

  const module = typeof d.module === 'function' ? d.module(ctx) : d.module;
  const withModule = { ...ctx, module };
  // `label()` RETURNS A FRESH ONE EACH CALL, because a design may draw more than one row per job
  // — a transformation is one job and three plates — and each of those is a thing somebody
  // labels. A value would have given all three the same one.
  const label = opts.label || labeller(sheet.metadata?.experiment || 'X');
  // WHAT A STEP CONSUMES, NAMED BY THE TUBE AND NOT BY THE DNA. JCA, 2026-09-12: *"there are
  // sample labels, and there are dna names... In a labsheet, you should not mix these concepts.
  // Here you are referring to what is encoded in the dna, not what the sample is. At the bench,
  // you primarily want to know the label, not what's in it (though is nice for sanity checking to
  // see both)."*
  //
  // `Pcon-amilGFP-Term` says what the DNA encodes and that is why a construction file uses it. It
  // is not a thing on a rack. So an input made earlier in this packet is shown as the label of the
  // tube that holds it, and the construct name rides alongside for the sanity check — never
  // instead of it. A material nobody here made keeps its own name, because that is what is written
  // on the tube in the freezer.
  const labelOf = (n) => (typeof label.of === 'function' ? label.of(n) : null) || null;
  const from = (x) => (x.inputs || []).map((n) => referToInput(n, labelOf)).join(', ');
  const hold = (n, text) => { if (typeof label.hold === 'function') label.hold(n, text); };
  const derived = (prefix, source, construct) =>
    (typeof label.derived === 'function' ? label.derived(prefix, source, construct)
                                         : `${prefix}${source}`);

  return {
    // A TITLE MAY BE A FUNCTION OF THE STEP, because some depend on HOW: a retransformation is
    // titled Electroporation or Conjugation by what the file said. `module` and `submits` had
    // always been allowed to be functions and this had not, so a function here was stringified —
    // the sheet's heading came out as the source code of the arrow function that should have
    // produced it. The guard below is what makes that impossible rather than merely fixed.
    title: (typeof d.title === 'function' ? d.title(withModule) : d.title) || operation,
    // **A COMPUTED TITLE BEATS A SESSION NAME; A STATIC ONE DOES NOT.** A pairing names a sitting
    // in the lab's own words — "Picking", "Gel, cleanup and assembly" — and those are better than
    // any design's, so the session name normally wins. But a design that computes its title from
    // the step is saying no static name can be right: a retransformation is Electroporation or
    // Conjugation by what the file said, and the pairing's name put the first over the second.
    // True only when the design ACTUALLY produced one. A design may return null to say "the file
    // told me nothing, so the pairing's name is better than anything I could invent".
    titleFromStep: typeof d.title === 'function' && Boolean(d.title(withModule)),
    module: module || null,
    // A DESIGN MAY RETURN SEVERAL ROWS FOR ONE SAMPLE. A transformation is one job and three
    // plates — the assembly, a positive control and a negative — and the rows are what somebody
    // labels and counts. Returning one row per job put the controls nowhere.
    columns: samples.flatMap((x) => {
      const got = d.columns(x, { ...withModule, label, from, labelOf, hold, derived });
      return Array.isArray(got) ? got : [got];
    }),
    // WHAT BELONGS UNDER THE TABLE IS DECLARED, NOT SUBTRACTED.
    //
    // It used to be every `key=value` on the step minus a per-design exclusion list, which meant
    // every field the PLANNER added leaked onto the page: `clone | B`, `read | R`, `picked | 4`,
    // `afterVerified | pBET8`. Worse, the params are reduced across the samples, so a per-row
    // field showed the LAST row's value as though it described the session — the miniprep sheet
    // announced "clone: B" over a table of A and B.
    //
    // An exclusion list has to be updated every time the planner learns to annotate something, and
    // it will not be. A design naming its own conditions cannot leak.
    conditions: d.conditions,
    // WHERE THIS SHEET'S PRODUCT IS SENT, when it leaves the building. Only sequencing has one
    // today. The renderer prints a submission link for it and must not guess which sheets qualify.
    submits: typeof d.submits === 'function' ? d.submits(withModule) : (d.submits || null),
    // WHETHER THIS OPERATION FETCHES ANYTHING. True for all but analysis, whose inputs are trace
    // files. The Source block's only question is which box and which well, and a step whose
    // materials are emails has no answer to give.
    fetches: d.fetches,
    values: module ? d.values(withModule) : {},
    // `program:` and `destination:` — the two fields of the spec's that survived GATE 0. The
    // program is per-sample and already in the table; the destination is the sheet's.
    destination: typeof d.destination === 'function' ? d.destination(withModule)
               : d.destination || null,
    // A DESIGN MAY CARRY A TABLE THAT IS NOT ITS SAMPLES. A vocabulary somebody picks a verdict
    // from is neither a sample nor a note; it is a table, and a note is where tables go to become
    // unreadable.
    // `labelOf` goes to blocks too: the assay's well map needs the label the PICK wrote on each
    // clone, held two sessions earlier. Recomputing it here would be a second answer to a question
    // already answered on another page.
    blocks: typeof d.blocks === 'function'
      ? d.blocks({ ...withModule, labelOf, from, hold }) : [],
    // HOW LONG A LABEL MAY BE HERE. Three is the PCR cap's rule and it is not every tube's: a
    // 1.5 mL miniprep is named rather than coded, and checking it against a strip tube's limit
    // would flag every correct row.
    recipe: d.recipe(withModule),
    notes: d.notes(withModule),
  };
}
