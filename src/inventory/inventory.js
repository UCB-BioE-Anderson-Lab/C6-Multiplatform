/**
 * Stateless Inventory model + pure updates.
 *
 * Responsibilities (model/primitives only):
 *  - Define data shape (boxes, samples, indices)
 *  - Own ALL index maintenance for any mutation
 *  - Provide immutable create/clone/add/remove/move/upsert operations
 *  - Expose minimal geometry helpers (inBounds, isOccupied)
 *
 * Non-responsibilities (kept out of this module):
 *  - Placement policy/validation (lives in manage.js)
 *  - Preference/constraint queries (lives in query.js)
 *  - IO/adapters (lives in io.js)
 */

// ---- Types (JSDoc for editor help) ----

/**
 * @typedef {Object} Location
 * @property {string} boxname
 * @property {number} row
 * @property {number} col
 * @property {string} label
 * @property {string} sidelabel
 */

/**
 * @typedef {Object} Box
 * @property {string} name
 * @property {number} rows
 * @property {number} cols
 */

/**
 * @typedef {Object} Sample
 * @property {Location} location
 * @property {string} construct
 * @property {string=} concentration   // e.g., 'uM10','uM100','zymo','miniprep','dil20x','gene'
 * @property {string=} clone
 * @property {string=} strain          // the host cells, as a reference-by-identifier
 * @property {string=} culture         // 'primary','secondary','tertiary','library'
 * @property {Object.<string, any>=} metadata
 */

/**
 * @typedef {Object} Hold
 * @property {Location} location
 * @property {string} by        // who is holding it — an experiment, a sheet, a person
 * @property {string=} why      // what is expected to land here
 * @property {string=} since    // ISO date, so a stale hold can be found and let go
 *
 * @typedef {Object} Inventory
 * @property {Object.<string, Box>} boxes
 * @property {Object.<string, Sample>} samples                 // key: locKey
 * @property {Object.<string, Hold>} holds                     // key: locKey — NOT samples
 * @property {Object.<string, Set<string>>} construct_to_locations // construct lc -> Set(locKey)
 * @property {Object.<string, string>} loc_to_conc
 * @property {Object.<string, string>} loc_to_clone
 * @property {Object.<string, string>} loc_to_culture
 * @property {Object.<string, string>} loc_to_host
 */

// ---- Helpers ----

/**
 * The key a sample is stored under: "boxname:row:col".
 *
 * Rows and columns are 0-based here, so the key for row 0 column 0 is `Box1:0:0` and not `A1`.
 * Use `wellName` in manage.js to turn a location into the A1-style label written on a box.
 *
 * @param {Location} loc
 * @returns {string} the storage key
 */
export function locKey(loc) {
  // A SAMPLE CAN BE IN A BOX WITHOUT BEING IN A KNOWN WELL, and that is not a broken record.
  //
  // JCA, 2026-09-12, on pJ01: *"pJ01 is in the pink training box in the enzyme freezer. There is
  // also one in the control stocks box. It's well gets moved around, but it's in there."* That is
  // how a working freezer actually behaves — the box is stable, the well is not — and until now
  // the model could not hold it: no well meant no key, so the reader skipped the row and every
  // query answered "not in the inventory" about a tube somebody could put their hand on.
  //
  // SynThera's file already carried six such samples and said so in its own header: *"they carry
  // no well, so C6's inventory model SKIPS them. This file holds 43 samples and a query over it
  // sees 37."* A count that silently disagrees with its source is how somebody concludes a tube
  // was never made.
  //
  // So an unplaced sample gets a key of its own, distinguished by what is written on it, and
  // several can share a box. `row`/`col` stay null, which is what every well-aware caller reads.
  if (loc.row == null || loc.col == null) {
    return `${loc.boxname}:-:${loc.slot ?? loc.label ?? loc.construct ?? '?'}`;
  }
  return `${loc.boxname}:${loc.row}:${loc.col}`;
}

/** Is this sample in a box but not in a known well? */
export function isUnplaced(sample) {
  const l = (sample && sample.location) || {};
  return !!l.boxname && (l.row == null || l.col == null);
}

// ---- Index helpers (internal) ----
function _emptyIndices() {
  return {
    construct_to_locations: {},
    loc_to_conc: {},
    loc_to_clone: {},
    loc_to_culture: {},
    loc_to_host: {}
  };
}

function _indexAdd(next, key, sample) {
  const constructKey = (sample.construct || '').toLowerCase();
  if (constructKey) {
    if (!next.construct_to_locations[constructKey]) next.construct_to_locations[constructKey] = new Set();
    next.construct_to_locations[constructKey].add(key);
  }
  if (sample.concentration) next.loc_to_conc[key] = sample.concentration;
  if (sample.clone) next.loc_to_clone[key] = sample.clone;
  if (sample.culture) next.loc_to_culture[key] = sample.culture;
  if (sample.host) next.loc_to_host[key] = sample.host;
}

function _indexRemove(next, key, sample) {
  const constructKey = (sample.construct || '').toLowerCase();
  if (constructKey && next.construct_to_locations[constructKey]) {
    next.construct_to_locations[constructKey].delete(key);
    if (next.construct_to_locations[constructKey].size === 0) delete next.construct_to_locations[constructKey];
  }
  delete next.loc_to_conc[key];
  delete next.loc_to_clone[key];
  delete next.loc_to_culture[key];
  delete next.loc_to_host[key];
}

/**
 * A deep-enough copy of an inventory to be updated without touching the original.
 *
 * Every update in this module returns a NEW inventory rather than mutating the one it was given,
 * so a caller holding an inventory can rely on it not changing underneath them. The Set values in
 * `construct_to_locations` are copied as Sets, not shared.
 *
 * @param {Inventory} inv
 * @returns {Inventory} a copy
 */
export function cloneInventory(inv) {
  const out = {
    boxes: { ...inv.boxes },
    samples: { ...inv.samples },
    // CARRIED, because every builder goes through here. Without it `addBox` and `upsertSample`
    // silently dropped every hold — so recording one sample released the whole freezer's
    // reservations, and nothing said so.
    holds: { ...(inv.holds || {}) },
    construct_to_locations: {},
    loc_to_conc: { ...inv.loc_to_conc },
    loc_to_clone: { ...inv.loc_to_clone },
    loc_to_culture: { ...inv.loc_to_culture },
    loc_to_host: { ...inv.loc_to_host }
  };
  for (const k in inv.construct_to_locations) {
    // Preserve Set semantics
    out.construct_to_locations[k] = new Set(inv.construct_to_locations[k]);
  }
  return out;
}

/**
 * A new, empty inventory: no boxes, no samples, and empty lookup indices.
 *
 * The inventory carries both the data and the indices that make queries fast, so it is created
 * rather than assembled by hand.
 *
 * @returns {Inventory}
 */
export function createInventory() {
  return {
    boxes: {},
    samples: {},
    // A HOLD IS NOT A SAMPLE, AND KEEPING THEM IN SEPARATE MAPS IS THE WHOLE MECHANISM.
    //
    // JCA, 2026-09-13: *"It might be good to put a hold on spots in the inventory — I think that is
    // fine. Just don't say things are in there that aren't there."* Two different assertions: a
    // hold says KEEP THIS SPOT FREE and claims nothing about the freezer; an occupancy record says
    // THIS TUBE IS HERE, and somebody acts on it by going to look.
    //
    // Held in their own map rather than as a flag on a sample, because every reader of `samples`
    // — `getSample`, `mapSamples`, `filterSamples`, the construct index, every count — would then
    // have to remember to exclude them, and one that forgot would report a tube that does not
    // exist. A separate map cannot be read as presence by accident; it can only be read by asking.
    holds: {},
    ..._emptyIndices()
  };
}

/**
 * Add a box, returning a new inventory. An existing box of the same name is replaced.
 *
 * @param {Inventory} inv
 * @param {Box} box - name, rows and cols
 * @returns {Inventory} a new inventory containing the box
 */
/**
 * The well name a box itself would use for a 0-based row and column.
 *
 * **WHICH AXIS SUPPLIES THE LETTER IS THE BOX'S BUSINESS, NOT THE CALLER'S.** The canonical
 * layout letters its rows and numbers its columns; other inventories do the reverse — columns
 * A..I, rows 1..9 — so the tube written on the cap as `D1` sits at row index 0, column index 3,
 * and a caller computing `letter(row) + (col + 1)` calls it `A4`: a well that exists, holds
 * something else, and looks entirely plausible on a printed labsheet. `io.js` has carried that
 * warning in a comment since it learned the lesson; what it did not do was carry the LABELS, so
 * nothing outside the parser could act on it.
 *
 * Three places each defined this for themselves — the parser, `planning/issue.js` and
 * `bin/c6-holds` — and the last two used the canonical convention unconditionally. A hold was
 * therefore reserved at the right INDEX under the name of a different, occupied well, while the
 * labsheet printed the right name: the workbook sent somebody to B3 and `holds.tsv` reserved
 * "C2". On return, two tubes of four were refused with a message naming an unrelated reagent.
 * Found 2026-11-04 by a session using the toolkit cold, and reproduced on this repository's own
 * golden fixture. Every test stayed green throughout, which is what the parser's comment
 * predicts: the wrong name is always a well that exists.
 *
 * A box with no labels recorded falls back to the canonical convention, which is what every box
 * written in the canonical format means anyway.
 *
 * @param {{rowLabels?: Array, colLabels?: Array}} box - the box, as the inventory holds it
 * @param {number} row - 0-based row index
 * @param {number} col - 0-based column index
 * @return {string} the name somebody would write on the cap, letter first
 */
export function wellNameIn(box, row, col) {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return '';
  const rows = box?.rowLabels, cols = box?.colLabels;
  // **AN INDEX OUTSIDE A LABELLED BOX HAS NO NAME, AND MUST NOT BE GIVEN ONE.** Falling back to
  // the canonical letter for a missing row label while taking the real label for the column
  // mixed two conventions in one string and produced `CA` — not a well, not refused, and the
  // kind of plausible-looking nonsense a printed sheet carries straight to a freezer.
  if (Array.isArray(rows) && rows.length && row >= rows.length) return '';
  if (Array.isArray(cols) && cols.length && col >= cols.length) return '';
  const rowLabel = rows?.[row] ?? String.fromCharCode(65 + row);
  const colLabel = cols?.[col] ?? String(col + 1);
  const alpha = (t) => /^[A-Za-z]+$/.test(String(t));
  return alpha(colLabel) && !alpha(rowLabel) ? `${colLabel}${rowLabel}` : `${rowLabel}${colLabel}`;
}

/**
 * The 0-based row and column a box's own well name refers to, or null.
 *
 * The reverse of `wellNameIn`, and wrong in the same way when it assumes the canonical layout:
 * in a box that letters its columns, `B3` is column 1 of row 2, and a parser that reads it as
 * row 1 column 2 lands on a different, usually occupied, well. That is how a returned sheet
 * naming four free wells produced two collision warnings against an antibiotic and an oligo —
 * the names were right and the indices they were turned into were not.
 *
 * @param {{rowLabels?: Array, colLabels?: Array}} box - the box, as the inventory holds it
 * @param {string} name - the well name as somebody wrote it
 * @return {{row: number, col: number}|null} the indices, or null if the box has no such well
 */
export function wellIndexIn(box, name) {
  const text = String(name || '').trim();
  if (!text) return null;
  const m = text.match(/^([A-Za-z]+)(\d{1,2})$/);
  if (!m) return null;
  const [, letters, digits] = m;
  const rows = box?.rowLabels, cols = box?.colLabels;
  const same = (a, b) => String(a).toUpperCase() === String(b).toUpperCase();
  if (Array.isArray(rows) && Array.isArray(cols) && rows.length && cols.length) {
    // Letter-first is the written form either way; which axis it names is the box's business.
    const colFirst = cols.findIndex((c) => same(c, letters));
    if (colFirst >= 0) {
      const row = rows.findIndex((r) => same(r, digits));
      return row >= 0 ? { row, col: colFirst } : null;
    }
    const row = rows.findIndex((r) => same(r, letters));
    if (row >= 0) {
      const col = cols.findIndex((c) => same(c, digits));
      return col >= 0 ? { row, col } : null;
    }
    return null;
  }
  // No labels recorded: the canonical layout, which is what such a box means.
  if (letters.length !== 1) return null;
  return { row: letters.toUpperCase().charCodeAt(0) - 65, col: Number(digits) - 1 };
}

export function addBox(inv, box) {
  const next = cloneInventory(inv);
  next.boxes[box.name] = { ...box };
  return next;
}

/**
 * Remove a box AND every sample in it, returning a new inventory.
 *
 * Removing a box discards its contents: the samples in it have nowhere to be, so they go too.
 * If you mean to keep them, move them first with `moveSample`.
 *
 * @param {Inventory} inv
 * @param {string} boxname
 * @returns {Inventory} a new inventory without that box or its samples
 */
export function removeBox(inv, boxname) {
  const next = cloneInventory(inv);
  // remove samples in the box
  for (const key of Object.keys(next.samples)) {
    if (key.startsWith(`${boxname}:`)) {
      _removeSampleByKey(next, key);
    }
  }
  delete next.boxes[boxname];
  return next;
}

/**
 * Put a sample at its location, replacing whatever was there, and return a new inventory.
 *
 * Upsert rather than add: a location holds one tube, so writing to an occupied location replaces
 * the sample and re-indexes it. Nothing warns you, because re-recording what is in a well is the
 * ordinary case.
 *
 * @param {Inventory} inv
 * @param {Sample} sample - must carry its own `location`
 * @returns {Inventory}
 */
export function upsertSample(inv, sample) {
  const key = locKey(sample.location);
  const next = cloneInventory(inv);
  // if exists, remove its indices first
  if (next.samples[key]) {
    _removeSampleByKey(next, key);
  }
  next.samples[key] = { ...sample, location: { ...sample.location } };
  _indexAdd(next, key, next.samples[key]);
  return next;
}

/**
 * Remove whatever sample is at a location, returning a new inventory. A no-op if the location is
 * empty.
 *
 * @param {Inventory} inv
 * @param {Location} location
 * @returns {Inventory}
 */
export function removeSample(inv, location) {
  const key = locKey(location);
  const next = cloneInventory(inv);
  _removeSampleByKey(next, key);
  return next;
}

function _removeSampleByKey(next, key) {
  const s = next.samples[key];
  if (!s) return;
  _indexRemove(next, key, s);
  delete next.samples[key];
}

/**
 * Move a sample from one location to another, returning a new inventory.
 *
 * Returns the inventory unchanged if nothing is at the old location. The sample keeps all its
 * fields and gets the new location; anything already at the destination is replaced.
 *
 * @param {Inventory} inv
 * @param {Location} oldLoc
 * @param {Location} newLoc
 * @returns {Inventory}
 */
export function moveSample(inv, oldLoc, newLoc) {
  const keyOld = locKey(oldLoc);
  const s = inv.samples[keyOld];
  if (!s) return inv; // no-op
  const next = cloneInventory(inv);
  _removeSampleByKey(next, keyOld);
  const moved = { ...s, location: { ...newLoc } };
  return upsertSample(next, moved);
}

/**
 * Apply a transformation to every sample (must return a Sample with a valid location).
 * Rebuilds indices by routing through upsertSample.
 */
export function mapSamples(inv, fn) {
  // Holds survive a transformation over SAMPLES: they are not samples, and a filter that drops
  // them is a filter that quietly frees somebody else's wells.
  let out = { boxes: { ...inv.boxes }, samples: {}, holds: { ...(inv.holds || {}) },
              ..._emptyIndices() };
  for (const key of Object.keys(inv.samples)) {
    const s = inv.samples[key];
    const t = fn(s);
    if (t && t.location) {
      out = upsertSample(out, t);
    }
  }
  return out;
}

/**
 * Keep only samples for which predicate(sample) is true. Boxes are preserved.
 */
export function filterSamples(inv, predicate) {
  // Holds survive a transformation over SAMPLES: they are not samples, and a filter that drops
  // them is a filter that quietly frees somebody else's wells.
  let out = { boxes: { ...inv.boxes }, samples: {}, holds: { ...(inv.holds || {}) },
              ..._emptyIndices() };
  for (const key of Object.keys(inv.samples)) {
    const s = inv.samples[key];
    if (predicate(s)) {
      out = upsertSample(out, s);
    }
  }
  return out;
}

// Utility: check if a location is inside box dimensions
/**
 * Does this location exist in this inventory's box?
 *
 * False for a box that is not there at all, and for a row or column outside its dimensions.
 * Rows and columns are 0-based.
 *
 * @param {Inventory} inv
 * @param {Location} loc
 * @returns {boolean}
 */
export function inBounds(inv, loc) {
  const box = inv.boxes[loc.boxname];
  if (!box) return false;
  return loc.row >= 0 && loc.col >= 0 && loc.row < box.rows && loc.col < box.cols;
}

// Utility: is a location occupied
/**
 * Is there already a sample at this location?
 *
 * @param {Inventory} inv
 * @param {Location} loc
 * @returns {boolean}
 */
export function isOccupied(inv, loc) {
  return Boolean(inv.samples[locKey(loc)]);
}

/**
 * Is this location spoken for by somebody who has not put a tube in it yet?
 *
 * A hold is a plan and `isOccupied` is a fact; a caller choosing where to put something wants
 * `isAvailable`, which is neither.
 *
 * @param {Inventory} inv
 * @param {Location} loc
 * @returns {boolean}
 */
export function isHeld(inv, loc) {
  return Boolean(inv.holds && inv.holds[locKey(loc)]);
}

/** The hold on this location, or null. Never a sample. */
export function holdAt(inv, loc) {
  return (inv.holds && inv.holds[locKey(loc)]) || null;
}

/**
 * Can something be put here? Free of both a tube and a claim on the spot.
 *
 * **THIS IS WHAT A WELL-CHOOSER SHOULD ASK**, not `isOccupied`. Two labsheets written the same
 * afternoon that both take "the next unoccupied well" collide, and the collision is found by
 * somebody standing at the −20 with a tube in their hand.
 *
 * @param {Inventory} inv
 * @param {Location} loc
 * @returns {boolean}
 */
export function isAvailable(inv, loc) {
  return inBounds(inv, loc) && !isOccupied(inv, loc) && !isHeld(inv, loc);
}

/**
 * Put a hold on a location, returning a new inventory.
 *
 * REFUSES A HELD SPOT THAT ALREADY HAS A TUBE IN IT, because that is not a hold, it is a
 * contradiction — and the one thing a hold must never do is imply something about what is there.
 * Re-holding a location somebody else holds is also refused: a hold with two owners is a hold
 * nobody can release.
 *
 * @param {Inventory} inv
 * @param {Location} loc
 * @param {{by: string, why?: string, since?: string}} claim  who is holding it, and what for
 * @returns {Inventory} a new inventory carrying the hold
 */
export function hold(inv, loc, claim) {
  const key = locKey(loc);
  if (!claim || !claim.by) {
    throw new Error(`hold(${key}): a hold needs an owner. An unowned hold is one nobody knows to `
                  + 'release, and a freezer fills up with them.');
  }
  if (isOccupied(inv, loc)) {
    throw new Error(`hold(${key}): there is already a tube here — `
                  + `${inv.samples[key].construct}. Hold a free spot, or move the tube.`);
  }
  const existing = inv.holds && inv.holds[key];
  if (existing && existing.by !== claim.by) {
    throw new Error(`hold(${key}): already held by ${existing.by}`
                  + `${existing.why ? ` for ${existing.why}` : ''}.`);
  }
  return { ...inv, holds: { ...(inv.holds || {}),
                            [key]: { location: { ...loc }, ...claim } } };
}

/**
 * Let a hold go, returning a new inventory. Releasing a location nobody holds is not an error —
 * the point is the end state.
 *
 * @param {Inventory} inv
 * @param {Location} loc
 * @returns {Inventory}
 */
export function release(inv, loc) {
  const holds = { ...(inv.holds || {}) };
  delete holds[locKey(loc)];
  return { ...inv, holds };
}

/**
 * Every hold in the inventory, oldest first where dates are given.
 *
 * **A STALE HOLD IS THE FAILURE MODE OF THIS FEATURE**, and the reason `by` and `since` are
 * required rather than decorative. Experiments are abandoned and experiments take years; a hold
 * that outlives its reason is a well nobody can use and nobody can account for. Listing them is
 * how somebody finds the ones to let go.
 *
 * @param {Inventory} inv
 * @returns {Array<Hold>}
 */
export function holds(inv) {
  return Object.values(inv.holds || {})
    .sort((a, b) => String(a.since || '').localeCompare(String(b.since || '')));
}
