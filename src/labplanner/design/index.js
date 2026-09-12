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

export const DESIGNS = Object.fromEntries(
  [pcr, gel, zymo, goldengate, transform, retransform, pick, culture, assay,
   miniprep, sequencing, analysis, dilution, stock]
    .map((d) => [d.operation, d]));

/** The design for an operation, or the default one. Never throws; never guesses a protocol. */
export function designFor(operation) {
  return DESIGNS[String(operation || '').toLowerCase()] || _default;
}

// THE LABEL IS NOT THE CONSTRUCT NAME, IT IS THREE CHARACTERS, AND IT IS UNIQUE IN A HUNDRED-
// PERSON LAB.
//
// JCA, 2026-09-12, twice. First, of a column headed `tube` holding `pcr1`: *"The terms 'label'
// 'side-label' 'construct' and such are defined terms. Tube is not, and pcr1 is a shitty name. It
// is above 3 letters max, which is a rule for pcr tube labels."* Then, of the `1` and `2` that
// replaced it: *"This is a lab with 100 people. The labels need to be distinctive and unique. L3a
// and L3b or something like that."*
//
// **Both are true at once and that is the whole constraint.** Three characters, and unique against
// every other tube in a shared −20. A bare ordinal is unique only inside one sheet, which is the
// scope nobody stores tubes in.
//
// So: **two characters of experiment, then a running letter.** `Lactis3` gives `L3`; the letters
// run across the whole packet rather than restarting per sheet, so `L3a` is one tube in this
// experiment and not one tube in this session. Fifteen tubes in Lactis3, twenty-six before it
// needs a fourth character, and the check below says so when it does.
//
// AND THE COLUMNS USE THE DEFINED TERMS. `label`, `side-label`, `construct`, `concentration`,
// `clone`, `culture`, `type` are the inventory's vocabulary; a returned labsheet is read back
// into it, and a column called `tube` or `product` has to be translated by whoever does that.
export const LABEL_MAX = 3;

/**
 * Two characters standing for an experiment: its initial and its number. `Lactis3` -> `L3`,
 * `SLIP4` -> `S4`, `Tlib3` -> `T3`. With no number, the first two letters.
 *
 * TWO EXPERIMENTS CAN COLLIDE HERE — `Lactis3` and `Lymph3` both give `L3` — and nothing in one
 * project's files could detect that. The prefix is therefore an override (`--label-prefix`), and
 * this is the default rather than the rule.
 */
export function labelPrefix(experiment) {
  const name = String(experiment || '').trim();
  const m = name.match(/^([A-Za-z])[A-Za-z_-]*?(\d+)$/);
  if (m) return `${m[1].toUpperCase()}${m[2].slice(-1)}`;
  return (name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || 'X').replace(/^./, (c) => c.toUpperCase());
}

/** a, b, … z, aa, ab … — a running letter, so every tube in a packet has its own. */
export function letterAt(i) {
  let out = '';
  let n = i;
  do { out = String.fromCharCode(97 + (n % 26)) + out; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return out;
}

/**
 * A label maker for one packet: successive calls give successive labels.
 *
 * ONE COUNTER FOR THE WHOLE PACKET, not one per sheet. A freezer box holds tubes from every
 * session at once, so a label that only distinguishes within a sheet distinguishes nothing where
 * it matters.
 */
export function labeller(experiment, prefix) {
  const p = prefix || labelPrefix(experiment);
  let i = 0;
  // WHICH TUBE CURRENTLY HOLDS WHICH CONSTRUCT. Registering as labels are handed out makes the
  // lookup correct by construction: the gel is drawn before the cleanup, so it asks for
  // `Pcon-amilGFP-Term` and gets the PCR tube; the assembly is drawn after, and gets the cleaned
  // one. Latest holder wins, which is what "go and fetch it" means at a bench.
  const held = new Map();
  const next = (construct) => {
    const lab = `${p}${letterAt(i++)}`;
    if (construct) held.set(String(construct), lab);
    return lab;
  };
  next.of = (construct) => held.get(String(construct || '')) || null;
  // A STEP MAY CHANGE WHO HOLDS A CONSTRUCT WITHOUT MAKING A TUBE. Reading the traces does not
  // produce anything, and it is exactly the step after which "go and fetch pBET8" stops meaning
  // the assembly reaction and starts meaning the clone that passed.
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
  const from = (x) => (x.inputs || []).map((n) => labelOf(n) || n).join(', ');
  const hold = (n, text) => { if (typeof label.hold === 'function') label.hold(n, text); };

  return {
    title: d.title || operation,
    module: module || null,
    // A DESIGN MAY RETURN SEVERAL ROWS FOR ONE SAMPLE. A transformation is one job and three
    // plates — the assembly, a positive control and a negative — and the rows are what somebody
    // labels and counts. Returning one row per job put the controls nowhere.
    columns: samples.flatMap((x) => {
      const got = d.columns(x, { ...withModule, label, from, labelOf, hold });
      return Array.isArray(got) ? got : [got];
    }),
    // A CONDITION ALREADY STANDING IN ITS OWN COLUMN IS NOT REPEATED BELOW THE TABLE. Two
    // statements of the same temperature on one page is one of them being wrong later.
    shownAsColumn: new Set([...(d.shownAsColumn || []), 'protocol']),
    values: module ? d.values(withModule) : {},
    recipe: d.recipe(withModule),
    notes: d.notes(withModule),
  };
}
