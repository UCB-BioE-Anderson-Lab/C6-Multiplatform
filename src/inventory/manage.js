/**
 * Position management (actions/policies): validate positions, choose placement(s), batch placement.
 *
 * • Stateless: takes an inventory and returns a NEW inventory (never mutates input)
 * • Composes inventory primitives; never touches indices directly
 * • No IO and no preference ranking (those live in io.js and query.js)
 */

import { cloneInventory, inBounds, isOccupied, upsertSample } from './inventory.js';

// Well naming helpers
/**
 * The label written on a box: row 0, column 0 becomes "A1".
 *
 * Locations are 0-based inside the inventory and 1-based on the physical box, and this is where
 * the two meet. Reading a location as though it were already 1-based puts a sample one row and
 * one column away from where it is.
 *
 * @param {number} row - 0-based
 * @param {number} col - 0-based
 * @returns {string} e.g. 'D2'
 */
export function wellName(row, col) {
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}
/**
 * The inverse of `wellName`: "D2" becomes { row: 3, col: 1 }.
 *
 * Throws on anything that is not a letter followed by digits, rather than guessing — a well name
 * nobody can parse is a location nobody can find.
 *
 * @param {string} well - e.g. 'A1', 'h12'
 * @returns {{row:number, col:number}} 0-based
 * @throws {Error} if the well name is malformed
 */
export function fromWellName(well) {
  const m = String(well).trim().match(/^([A-Za-z])(\d+)$/);
  if (!m) throw new Error(`Invalid well: ${well}`);
  const row = m[1].toUpperCase().charCodeAt(0) - 65;
  const col = Number(m[2]) - 1;
  return { row, col };
}

// Label policy helpers (kept in manage; model stays neutral)
/**
 * A default tube label from a hint and a position, e.g. 'SAMPLE-31'.
 *
 * A fallback for when nothing better is known. A label somebody writes on a cap should be short
 * and specific to the experiment; this is neither, so prefer a real one where you have it.
 *
 * @param {string} [hint='SAMPLE']
 * @param {number} row - 0-based
 * @param {number} col - 0-based
 * @returns {string}
 */
export function makeLabel(hint = 'SAMPLE', row, col) {
  return `${hint}-${row}${col}`;
}

/**
 * Apply label policy to a sample's fields based on location and opts.
 * Returns a shallow-cloned fields object; caller sets it on the Sample before upsert.
 */
export function applyLabelPolicy(sampleFields = {}, loc, opts = {}) {
  const hint = opts.label || sampleFields.label || 'SAMPLE';
  return { ...sampleFields, label: makeLabel(hint, loc.row, loc.col) };
}

/** Validate a box exists and has sane dimensions */
export function validateBox(inv, boxname) {
  const box = inv.boxes[boxname];
  if (!box) return { ok:false, reason:'unknown box' };
  if (!(Number.isInteger(box.rows) && Number.isInteger(box.cols) && box.rows > 0 && box.cols > 0)) {
    return { ok:false, reason:'invalid box geometry' };
  }
  return { ok:true };
}

/**
 * Validate one or many target positions.
 * @returns {{ ok:boolean, reason?:string, index?:number }} index provided for array inputs
 */
export function validatePosition(inv, locationOrArray) {
  const checkOne = (loc) => {
    if (!inv.boxes[loc.boxname]) return { ok:false, reason:'unknown box' };
    if (!inBounds(inv, loc)) return { ok:false, reason:'out of bounds' };
    if (isOccupied(inv, loc)) return { ok:false, reason:'occupied' };
    return { ok:true };
  };
  if (Array.isArray(locationOrArray)) {
    for (let i = 0; i < locationOrArray.length; i++) {
      const res = checkOne(locationOrArray[i]);
      if (!res.ok) return { ...res, index:i };
    }
    return { ok:true };
  }
  return checkOne(locationOrArray);
}

/**
 * Assign the next available position in a box and PLACE the provided sample fields.
 * Options:
 *  - startAt?: {row,col}
 *  - pattern?: 'row-major'|'col-major'|'snake' (default 'row-major')
 *  - skip?: (loc) => boolean  // if returns true, location is skipped
 * All options always exclude occupied locations.
 * @returns {{ location, inventory }} with inventory updated (immutable clone inside)
 */
export function assignNext(inv, boxname, sampleFields = {}, opts = {}) {
  const box = inv.boxes[boxname];
  if (!box) throw new Error(`Box not found: ${boxname}`);
  const { startAt = { row:0, col:0 }, pattern = 'row-major', skip } = opts;
  const startR = Math.max(0, Math.min(box.rows - 1, startAt.row || 0));
  const startC = Math.max(0, Math.min(box.cols - 1, startAt.col || 0));

  const order = [];
  const pushIf = (r, c) => {
    const loc = { boxname, row: r, col: c, label: '', sidelabel: sampleFields.sidelabel || '' };
    if (skip && skip(loc)) return;
    if (!isOccupied(inv, loc) && inBounds(inv, loc)) order.push(loc);
  };

  if (pattern === 'col-major') {
    for (let c = startC; c < box.cols; c++) for (let r = startR; r < box.rows; r++) pushIf(r, c);
    for (let c = 0; c < startC; c++) for (let r = 0; r < box.rows; r++) pushIf(r, c);
  } else if (pattern === 'snake') {
    for (let r = startR; r < box.rows; r++) {
      if ((r % 2) === 0) { for (let c = startC; c < box.cols; c++) pushIf(r, c); }
      else                { for (let c = box.cols - 1; c >= 0; c--) pushIf(r, c); }
    }
    for (let r = 0; r < startR; r++) {
      if ((r % 2) === 0) { for (let c = 0; c < box.cols; c++) pushIf(r, c); }
      else                { for (let c = box.cols - 1; c >= 0; c--) pushIf(r, c); }
    }
  } else { // row-major
    for (let r = startR; r < box.rows; r++) for (let c = startC; c < box.cols; c++) pushIf(r, c);
    for (let r = 0; r < startR; r++)        for (let c = 0;       c < box.cols; c++) pushIf(r, c);
  }

  const loc = order[0];
  if (!loc) throw new Error(`No free positions in ${boxname}`);

  // Apply label policy to fields and propagate to location
  const fieldsWithLabel = applyLabelPolicy(sampleFields, loc, opts);
  const finalLoc = { ...loc, label: fieldsWithLabel.label || makeLabel('SAMPLE', loc.row, loc.col) };
  const nextSample = { ...fieldsWithLabel, location: finalLoc };

  const updated = upsertSample(cloneInventory(inv), nextSample);
  return { location: finalLoc, inventory: updated };
}

/** Convenience alias for assignNext; 4th arg may be a label string or an opts object. */
export function placeNext(inv, boxname, sampleFields, hintLabelOrOpts, maybeOpts) {
  // Back-compat: 4th param may be opts, or hint label string kept for compatibility
  const opts = typeof hintLabelOrOpts === 'string' ? { ...maybeOpts, label: hintLabelOrOpts } : (hintLabelOrOpts || {});
  const { location, inventory } = assignNext(inv, boxname, sampleFields, opts);
  return { inventory, location };
}

/** Assign N samples as a batch, in order, respecting options. */
export function assignBatch(inv, boxname, samplesArray, opts = {}) {
  let curInv = inv;
  const locations = [];
  for (const sampleFields of samplesArray) {
    const { inventory, location } = assignNext(curInv, boxname, sampleFields, opts);
    curInv = inventory;
    locations.push(location);
  }
  return { inventory: curInv, locations };
}

/**
 * Place several samples in order, returning a new inventory and what went where.
 *
 * An alias for `assignBatch`, kept because "place" is what somebody says at the bench and
 * "assign" is what the policy layer calls it. Each sample takes the next position the policy
 * allows, so a batch stays contiguous and the order you passed is the order on the box.
 *
 * @param {Inventory} inv
 * @param {Array<Object>} samples
 * @param {Object} [opts]
 * @returns {{inventory:Inventory, placements:Array}}
 */
export const placeBatch = assignBatch;
