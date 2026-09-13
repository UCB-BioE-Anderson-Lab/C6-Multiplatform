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
export const bp = (x) => (x.productBp ? `${x.productBp} bp` : '');

/** The one value every sample agrees on, or null where they do not all agree. */
export const only = (xs) => (new Set(xs.filter(Boolean)).size === 1 ? xs.find(Boolean) : null);

/** A condition of a step, under any of the names the two file formats give it. */
export const cond = (params, ...names) => {
  for (const n of names) if (params && params[n]) return params[n];
  return '';
};
