// util.js — the two things every design needs and neither should restate.

/**
 * A product size as a labsheet writes it, or nothing where the simulation could not compute one.
 *
 * Empty rather than `0 bp` or `unknown`: a blank size column reads as "no band expected", which is
 * wrong, so the gel design says so in words instead of letting this invent a number.
 *
 * @param {Object} x  a planned sample
 * @returns {string}
 */
// **BLANK MEANT "ASK THE STUDENT", AND THAT IS NOT WHAT AN UNKNOWN SIZE MEANS.** The renderer
// detects entry cells as the trailing run of empty columns, so a size the compiler could not work
// out came out as a yellow box beside `program`, also yellow — two questions put to somebody at a
// bench who has no way to answer either. An amplicon length is arithmetic on a template sequence
// and the thermocycler program follows from it; neither is an observation.
//
// JCA, 2026-09-13, looking at the Tlib3 PCR sheet: *"I don't think the right answer is to ask the
// student to put in a number. It is meaningless to cite a single number."*
//
// So it says what it is. The gap becomes a STILL TO DECIDE line on the sheet — the mechanism that
// already exists for a decision the compiler refuses to make — and `c6-labplan` prints every one
// at the end of a run, which is where somebody can close it before the sheet is issued.
export const bp = (x) => (x.productBp ? `${x.productBp} bp` : 'not computed');

/** The one value every sample agrees on, or null where they do not all agree. */
export const only = (xs) => (new Set(xs.filter(Boolean)).size === 1 ? xs.find(Boolean) : null);

/** A condition of a step, under any of the names the two file formats give it. */
export const cond = (params, ...names) => {
  for (const n of names) if (params && params[n]) return params[n];
  return '';
};
