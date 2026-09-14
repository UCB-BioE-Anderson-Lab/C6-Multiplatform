// choosePrimerSource.js — for one oligo, the tube to pull, or the reason there isn't one.
//
// **THE RULES ARE IN `rules/primerSource.rules.js`, AND THIS IS THE ADAPTER.** What is left here is
// the part about inventories rather than about the decision: read the location off a row, rank the
// candidates, and hand the facts over.
//
// This file was an empty module. So were `chooseTemplateSample.js`, `binPCRRuns.js` and
// `jobsToLabSheets.js`: four names describing work that had been designed and never written, and
// nothing anywhere said which was which. JCA, 2026-09-12, of a rendered PCR sheet: *"It has no
// source info."* It had none because this returned nothing, and nothing asked.
//
import { chooseOligoForPCR } from '../../inventory/query.js';
import { concentrationUM, WORKING_UM, STOCK_UM } from './planDilutions.js';
import { choose, near } from '../rules/primerSource.rules.js';

/** Box and well as somebody standing at the freezer reads them. Rows are 0-based here, 1-based there. */
export function whereOf(sample) {
  const l = (sample && sample.location) || {};
  // IN A BOX, IN NO KNOWN WELL. Not an error and not a location: the box is the answer and the
  // well is a question. Returned as an empty well so nothing downstream prints a guess.
  if (l.boxname && (l.row == null || l.col == null) && !l.well)
    return { box: l.boxname, well: '', label: l.label || '',
             // UNKNOWN AND UNTRACKED ARE DIFFERENT ANSWERS. One is a question for the labsheet;
             // the other is the box saying the question has no stable answer.
             wellUnknown: !l.untracked, untracked: !!l.untracked };
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
 * Where one oligo comes from, for one use. → `rules/primerSource.rules.js`
 *
 * @param {Inventory|null} inv
 * @param {string} name
 * @param {string} operation  'pcr' | 'sequence' | 'sequencing' — sequencing works at 2.66 µM
 * @returns {{status:string, where?:Object, note?:string}}
 */
export function choosePrimerSource(inv, name, operation = 'pcr') {
  const workingUM = WORKING_UM[operation] ?? WORKING_UM.pcr;
  const has = !!(inv && inv.samples && Object.keys(inv.samples).length);
  // Every tube of this oligo at any strength, each carrying the concentration as a number so the
  // rules never have to parse a label.
  const tubes = (has ? chooseOligoForPCR(inv, name, { min_uM: 0 }).all : [])
    .map((s) => ({ ...s, uM: concentrationUM(s.concentration) }));

  const atWorking = tubes.find((s) => near(s.uM, workingUM)) || null;
  const atStock = tubes.find((s) => near(s.uM, STOCK_UM)) || null;

  const got = choose({
    inv, name, tubes, workingUM, stockUM: STOCK_UM,
    where: atWorking ? whereOf(atWorking) : {},
    stockWhere: atStock ? whereOf(atStock) : {},
    firstWhere: tubes.length ? whereOf(tubes[0]) : {},
  });

  return { status: got.status,
           ...(got.where ? { where: got.where } : {}),
           ...(got.note ? { note: got.note } : {}) };
}
