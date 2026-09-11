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
 * @property {string=} culture         // 'primary','secondary','tertiary','library'
 * @property {string=} type            // e.g., 'oligo','plasmid','gBlock','amplicon','buffer'
 * @property {Object.<string, any>=} metadata
 */

/**
 * @typedef {Object} Inventory
 * @property {Object.<string, Box>} boxes
 * @property {Object.<string, Sample>} samples                 // key: locKey
 * @property {Object.<string, Set<string>>} construct_to_locations // construct lc -> Set(locKey)
 * @property {Object.<string, string>} loc_to_conc
 * @property {Object.<string, string>} loc_to_clone
 * @property {Object.<string, string>} loc_to_culture
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
  return `${loc.boxname}:${loc.row}:${loc.col}`;
}

// ---- Index helpers (internal) ----
function _emptyIndices() {
  return {
    construct_to_locations: {},
    loc_to_conc: {},
    loc_to_clone: {},
    loc_to_culture: {}
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
    construct_to_locations: {},
    loc_to_conc: { ...inv.loc_to_conc },
    loc_to_clone: { ...inv.loc_to_clone },
    loc_to_culture: { ...inv.loc_to_culture }
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
  let out = { boxes: { ...inv.boxes }, samples: {}, ..._emptyIndices() };
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
  let out = { boxes: { ...inv.boxes }, samples: {}, ..._emptyIndices() };
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
