// choosePrimerSource.js — for one oligo, the tube to pull, or the reason there isn't one.
//
// This file was an empty module. So were `chooseTemplateSample.js`, `binPCRRuns.js` and
// `jobsToLabSheets.js`: four names describing work that had been designed and never written, and
// nothing anywhere said which was which. JCA, 2026-09-12, of a rendered PCR sheet: *"It has no
// source info."* It had none because this returned nothing, and nothing asked.
//
// FOUR ANSWERS, AND THEY ARE NOT FOUR DEGREES OF THE SAME THING — the distinction `planDilutions`
// makes, applied one oligo at a time so a labsheet row can carry it:
//
//   ready     a tube at working strength. A box and a well go on the sheet.
//   box-only  it is in a named box and the well is not recorded. JCA, 2026-09-12: *"It's well
//             gets moved around, but it's in there."* The box is printed and the well is asked
//             for, which is the only honest rendering of a record that is right about the part
//             that is stable and silent about the part that is not.
//   dilute    only the 100 µM stock is there. A dilution happens on an earlier day.
//   present   it is in the freezer at some other concentration. A person decides.
//   absent    it is not in the inventory. That is a purchase with a lead time, not a step.
//
// AND A FIFTH THAT IS NOT AN ANSWER AT ALL. With no inventory to search, every oligo looks
// absent, and "we have not looked" must never print as "it is not there".
import { chooseOligoForPCR } from '../../inventory/query.js';
import { concentrationUM, WORKING_UM, STOCK_UM } from './planDilutions.js';

const near = (a, b) => a != null && Math.abs(a - b) <= Math.max(0.05, b * 0.05);

/** Box and well as somebody standing at the freezer reads them. Rows are 0-based here, 1-based there. */
export function whereOf(sample) {
  const l = (sample && sample.location) || {};
  // IN A BOX, IN NO KNOWN WELL. Not an error and not a location: the box is the answer and the
  // well is a question. Returned as an empty well so nothing downstream prints a guess.
  if (l.boxname && (l.row == null || l.col == null) && !l.well)
    return { box: l.boxname, well: '', label: l.label || '', wellUnknown: true };
  // THE SOURCE'S OWN WELL NAME WINS. A grid inventory labels columns with letters and rows with
  // numbers, which is the transpose of what `wellName(row, col)` assumes — so computing the name
  // from the indices sends somebody to a well that exists and holds something else. Computed only
  // where the source recorded none.
  if (l.well) return { box: l.boxname || '', well: String(l.well), label: l.label || '' };
  if (l.row == null || l.col == null) return { box: l.boxname || '', well: '', label: l.label || '' };
  return { box: l.boxname || '',
           well: `${String.fromCharCode(65 + Number(l.row))}${Number(l.col) + 1}`,
           label: l.label || '' };
}

/**
 * Where one oligo comes from, for one use.
 *
 * @param {Inventory|null} inv
 * @param {string} name
 * @param {string} operation  'pcr' | 'sequence' | 'sequencing' — sequencing works at 2.66 µM
 * @returns {{status:string, where?:Object, note?:string}}
 */
export function choosePrimerSource(inv, name, operation = 'pcr') {
  const workingUM = WORKING_UM[operation] ?? WORKING_UM.pcr;
  if (!inv || !inv.samples || Object.keys(inv.samples).length === 0) {
    return { status: 'unsearched', note: 'no inventory was read, so nothing was looked up' };
  }
  const all = chooseOligoForPCR(inv, name, { min_uM: 0 }).all;
  if (!all.length) return { status: 'absent', note: `not in the inventory — ${name} must be ordered` };

  const at = (um) => all.find((s) => near(concentrationUM(s.concentration), um));
  const ready = at(workingUM);
  if (ready) {
    const w = whereOf(ready);
    return { status: w.wellUnknown ? 'box-only' : 'ready', where: w,
             note: w.wellUnknown ? `${workingUM} µM, in ${w.box} — the well is not recorded`
                                 : `${workingUM} µM` };
  }

  const stock = at(STOCK_UM);
  if (stock) return { status: 'dilute', where: whereOf(stock),
                      note: `only the ${STOCK_UM} µM stock is here — dilute to ${workingUM} µM first` };

  return { status: 'present', where: whereOf(all[0]),
           note: `in the freezer at ${all[0].concentration || 'an unrecorded concentration'}, `
               + `not at ${workingUM} µM` };
}
