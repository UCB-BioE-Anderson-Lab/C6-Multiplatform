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

// THE LABEL IS NOT THE CONSTRUCT NAME, AND THREE CHARACTERS IS THE RULE FOR A PCR CAP.
//
// JCA, 2026-09-12, of a column headed `tube` holding `pcr1`: *"The terms 'label' 'side-label'
// 'construct' and such are defined terms. Tube is not, and pcr1 is a shitty name. It is above 3
// letters max, which is a rule for pcr tube labels."*
//
// **TWO RULES THAT THIS HAD CONFLATED.** cloning-tutorials keeps CONSTRUCT names to 4-6
// characters, "to balance uniqueness with the ability to write it on a tube cap". A PCR tube
// LABEL is a different thing and shorter still: three characters, because it is written on a
// 200 µL cap in marker, by somebody wearing gloves, eight times in a row.
//
// So the label is the number and nothing else wherever it can be — which is also what the
// protocol asks for: `primestar_pcr` tells the student *"the top label is the number from your
// labsheet for that reaction"*, and that only works if the labsheet carries a number.
//
// AND THE COLUMNS USE THE DEFINED TERMS. `label`, `side-label`, `construct`, `concentration`,
// `clone`, `culture`, `type` are the inventory's vocabulary; a returned labsheet is read back
// into it, and a column called `tube` or `product` has to be translated by whoever does that.
export const LABEL_MAX = 3;
const PREFIX = { pcr: '', zymo: 'z', goldengate: 'gg', transform: 't', retransform: 'e',
                 pick: 'p', culture: 'c', assay: 'a', miniprep: 'm', sequencing: 's',
                 analysis: '' };
export const tubeLabel = (op, i, n) => {
  const p = PREFIX[op] === undefined ? String(op).slice(0, 1) : PREFIX[op];
  return `${p}${n === 1 && p ? '' : i + 1}`;
};

/**
 * Apply a design to one planned bin: the sheet's title, its table, its recipe, the protocol it
 * transcludes and the values that protocol is rendered with.
 *
 * @param {Object} sheet     one bin from `c6-plan --json`
 * @param {Function} producer  name -> the conditions of the step that makes it
 * @returns {Object} the design's decisions, ready to be assembled into a LabSheet
 */
export function applyDesign(sheet, producer) {
  const operation = String(sheet.operation || '').toLowerCase();
  const d = designFor(operation);
  const samples = sheet.samples || [];
  const ctx = { sheet, samples, operation, mastermix: sheet.mastermix || null, producer };

  const module = typeof d.module === 'function' ? d.module(ctx) : d.module;
  const withModule = { ...ctx, module };

  return {
    title: d.title || operation,
    module: module || null,
    // A DESIGN MAY RETURN SEVERAL ROWS FOR ONE SAMPLE. A transformation is one job and three
    // plates — the assembly, a positive control and a negative — and the rows are what somebody
    // labels and counts. Returning one row per job put the controls nowhere.
    columns: samples.flatMap((x, i) => {
      const got = d.columns(x, { ...withModule, tube: tubeLabel(operation, i, samples.length) });
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
