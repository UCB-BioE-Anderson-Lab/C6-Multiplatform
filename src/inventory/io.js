/**
 * IO: parse/serialize/pretty/CSV for the inventory.
 * The parser supports the '>>' multi-block grid format used in cloning-tutorials.
 * All functions are pure and return new inventories; no side effects.
 */

import { createInventory, addBox, upsertSample, cloneInventory } from './inventory.js';

function normalizeHeaders(line) {
  const trimmed = line.trim();
  // Prefer tab if present; otherwise fall back to comma.
  const parts = (trimmed.indexOf('\t') >= 0 ? trimmed.split('\t') : trimmed.split(','));
  return parts.map(t => t.trim());
}

function parseBlocks(text) {
  const rawBlocks = text.split('>>').map(b => b.trim()).filter(b => b.length > 0);
  if (rawBlocks.length === 0) return null;
  const boxWide = rawBlocks[0].split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const dataBlocks = rawBlocks.slice(1);
  return { boxWide, dataBlocks };
}

function parseBoxWideFields(lines) {
  const fields = {};
  for (const line of lines) {
    if (!line.startsWith('>')) continue;
    const parts = line.slice(1).split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim().toLowerCase();
      const value = parts.slice(1).join(':').trim();
      fields[key] = value;
    }
  }
  return fields;
}

function parsePlate(dataBlocks) {
  if (!Array.isArray(dataBlocks) || dataBlocks.length === 0) {
    return null;
  }
  // Inspect the first block to determine initial dimensions
  const firstLines = String(dataBlocks[0] || '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l !== '');
  if (firstLines.length < 2) return null;

  const headerTokens0 = normalizeHeaders(firstLines[0] || '');
  if (!Array.isArray(headerTokens0) || headerTokens0.length < 2) {
    throw new Error('Malformed grid: header row must include a field name and at least one column index.');
  }
  let numCols = headerTokens0.length - 1; // initial column count derived from first block

  // We'll build up row labels and wells dynamically to tolerate ragged blocks
  const rowLabels = [];
  const wellArray = [];

  // Prime rows from the first block's data lines (use letters if a row label is missing)
  for (let r = 1; r < firstLines.length; r++) {
    const tokens = normalizeHeaders(firstLines[r] || '');
    const rowLabel = (tokens && typeof tokens[0] !== 'undefined' && tokens[0] !== '') ? tokens[0] : letterForRow(r - 1);
    rowLabels.push(rowLabel);
    wellArray.push(Array.from({ length: numCols }, () => ({})));
  }

  // Process each block; allow different column counts, expanding as needed
  for (const block of dataBlocks) {
    const lines = String(block || '')
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l !== '');
    if (lines.length < 2) continue;

    const headerTokens = normalizeHeaders(lines[0] || '');
    if (!Array.isArray(headerTokens) || headerTokens.length < 2) {
      // Skip malformed block header but continue parsing others
      continue;
    }

    // Track the widest block and expand existing rows accordingly
    const thisNumCols = Math.max(0, headerTokens.length - 1);
    if (thisNumCols > numCols) {
      for (let rr = 0; rr < wellArray.length; rr++) {
        // expand each existing row to new width
        while (wellArray[rr].length < thisNumCols) wellArray[rr].push({});
      }
      numCols = thisNumCols;
    }

    let fieldName = String(headerTokens[0] || '').toLowerCase();
    if (fieldName === 'field') {
      const canonical = ['construct','label','side-label','concentration','clone','culture','type'];
      const idx = dataBlocks.indexOf(block);
      if (idx >= 0 && idx < canonical.length) {
        fieldName = canonical[idx];
      }
    }

    for (let r = 1; r < lines.length; r++) {
      const tokens = normalizeHeaders(lines[r] || '');
      // Ensure we have a row for this index; add one if needed
      if (!wellArray[r - 1]) {
        const newLabel = (tokens && typeof tokens[0] !== 'undefined' && tokens[0] !== '') ? tokens[0] : letterForRow(r - 1);
        rowLabels[r - 1] = newLabel;
        wellArray[r - 1] = Array.from({ length: numCols }, () => ({}));
      } else if (!rowLabels[r - 1]) {
        rowLabels[r - 1] = (tokens && typeof tokens[0] !== 'undefined' && tokens[0] !== '') ? tokens[0] : letterForRow(r - 1);
      }

      for (let c = 0; c < numCols; c++) {
        const val = (Array.isArray(tokens) && typeof tokens[c + 1] !== 'undefined') ? tokens[c + 1] : '';
        // Ensure the cell object exists (rows may have been expanded)
        if (!wellArray[r - 1][c]) wellArray[r - 1][c] = {};
        wellArray[r - 1][c][fieldName] = val;
      }
    }
  }

  // Recompute headers now that we may have expanded columns
  const headers = [headerTokens0[0]].concat(Array.from({ length: numCols }, (_, i) => String(i + 1)));

  return { headers, rowLabels, wellArray };
}

// --- Serialization helpers ---
function letterForRow(r) {
  // A, B, C... for 0-based r
  return String.fromCharCode(65 + r);
}

function serializePlate(boxname, box, samples) {
  const rows = box.rows;
  const cols = box.cols;
  // Build a 2D matrix of sample objects indexed by [r][c]
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({})));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const key = `${boxname}:${r}:${c}`;
      const s = samples[key];
      if (s) {
        grid[r][c] = {
          construct: s.construct || '',
          label: s.location?.label || '',
          'side-label': s.location?.sidelabel || '',
          concentration: s.concentration || '',
          clone: s.clone || '',
          culture: s.culture || '',
          type: s.type || ''
        };
      } else {
        grid[r][c] = { construct: '', label: '', 'side-label': '', concentration: '', clone: '', culture: '', type: '' };
      }
    }
  }

  const fields = ['construct','label','side-label','concentration','clone','culture','type'];
  const blocks = [];
  for (const field of fields) {
    const colHeader = [field].concat(Array.from({ length: cols }, (_, i) => String(i + 1))).join('\t');
    const lines = [colHeader];
    for (let r = 0; r < rows; r++) {
      const rowLabel = letterForRow(r);
      const cells = [rowLabel];
      for (let c = 0; c < cols; c++) {
        cells.push(String(grid[r][c][field] ?? ''));
      }
      lines.push(cells.join('\t'));
    }
    blocks.push(lines.join('\n'));
  }

  // Prepend a minimal box-wide section (could be extended later)
  const boxWide = [
    `>box:${boxname}`,
    `>rows:${rows}`,
    `>cols:${cols}`
  ].join('\n');

  return boxWide + '\n>>' + blocks.join('\n>>');
}

/**
 * Parse one TSV/CSV text into an Inventory, with a single Box named after basename.
 */
export function parseGridFile(filename, fileText, boxRows=8, boxCols=12) {
  const parsed = parseBlocks(fileText);
  if (!parsed) return createInventory();
  const { boxWide, dataBlocks } = parsed;
  if (!Array.isArray(dataBlocks) || dataBlocks.length === 0) {
    throw new Error('No grid blocks found (missing ">>" sections). Expected at least one block beginning with a header like "field\\t1\\t2...".');
  }
  const boxHints = parseBoxWideFields(boxWide);
  const plate = parsePlate(dataBlocks);
  if (!plate) {
    throw new Error('Malformed grid: header row and at least one data row are required in each block.');
  }

  const baseName = (filename || 'BOX').split('.')[0];
  const { headers, rowLabels, wellArray } = plate;
  const numCols = headers.length - 1;
  const derivedRows = rowLabels.length;
  const derivedCols = numCols;
  // Prefer explicit hints if present and numeric; otherwise use derived sizes from the data grid.
  const rows = Number.isFinite(Number(boxHints.rows)) ? Number(boxHints.rows) : derivedRows;
  const cols = Number.isFinite(Number(boxHints.cols)) ? Number(boxHints.cols) : derivedCols;
  let inv = addBox(createInventory(), { name: baseName, rows, cols });

  for (let r = 0; r < rowLabels.length; r++) {
    for (let c = 0; c < numCols; c++) {
      const sample = wellArray[r][c];
      const hasData = Object.values(sample).some(v => (v || '').trim() !== '');
      if (!hasData) continue;
      const construct = (sample.construct || '').trim();
      const rowLabel = rowLabels[r];
      const colLabel = headers[c + 1];
      const well = `${rowLabel}${colLabel}`;
      const location = { boxname: baseName, row: r, col: c, label: (sample.label || well), sidelabel: (sample['side-label'] || '') };
      inv = upsertSample(inv, {
        location,
        construct,
        concentration: (sample.concentration || '').trim() || undefined,
        clone: (sample.clone || '').trim() || undefined,
        culture: (sample.culture || '').trim() || undefined,
        type: (sample.type || '').trim() || undefined,
        metadata: sample
      });
    }
  }
  return inv;
}

/**
 * Read the tab-separated inventory format: one row per sample, a header naming the columns.
 *
 * Recognised columns are box, well (or row and col), construct, label, side-label, type,
 * concentration, clone and culture; anything else is ignored. Box dimensions are inferred from
 * the furthest-used well, with a floor of 8x12.
 *
 * @param {string} text
 * @returns {Inventory}
 */
export function parseTabular(text) {
  // A `#` LINE IS A COMMENT, INCLUDING BEFORE THE HEADER. Without this the first comment line
  // was read as the column header, nothing matched, every row was skipped, and the result was a
  // valid empty inventory — which downstream is indistinguishable from a freezer with nothing in
  // it. SynThera's inventory opens with six lines recording where it was transcribed from and
  // what was deliberately not inferred; that provenance is worth more than the parser's
  // convenience, and a file is allowed to explain itself.
  const lines = String(text || '').split(/\r?\n/)
    .filter((l) => l.trim() !== '' && !l.trim().startsWith('#'));
  if (lines.length === 0) return createInventory();
  const headers = normalizeHeaders(lines[0]);
  const idx = (name) => headers.findIndex(h => h.toLowerCase() === name);

  const iBox = Math.max(idx('box'), idx('boxname'));
  const iWell = idx('well');
  const iRow = idx('row');
  const iCol = idx('col');
  const iConstruct = idx('construct');
  const iLabel = idx('label');
  const iSide = Math.max(idx('side-label'), idx('sidelabel'));
  const iType = idx('type');
  const iConc = Math.max(idx('concentration'), idx('conc'), idx('um'));
  const iClone = idx('clone');
  const iCulture = idx('culture');

  // First pass: infer per-box dimensions
  const dims = new Map(); // box -> {rows, cols}
  for (let li = 1; li < lines.length; li++) {
    const cols = normalizeHeaders(lines[li]);
    const boxname = (iBox >= 0 ? cols[iBox] : 'BOX') || 'BOX';
    let r = null, c = null;
    if (iWell >= 0) {
      const m = String(cols[iWell] || '').trim().match(/^([A-Za-z])(\d{1,2})$/);
      if (m) { r = m[1].toUpperCase().charCodeAt(0) - 65; c = parseInt(m[2], 10) - 1; }
    }
    if (r == null && iRow >= 0) {
      const tok = cols[iRow];
      if (/^[A-Za-z]$/.test(tok || '')) r = tok.toUpperCase().charCodeAt(0) - 65; else if (Number.isFinite(Number(tok))) r = Math.max(0, Number(tok));
    }
    if (c == null && iCol >= 0) {
      const tok = cols[iCol];
      if (Number.isFinite(Number(tok))) c = Math.max(0, Number(tok));
    }
    if (r == null || c == null) continue;
    const d = dims.get(boxname) || { rows: 0, cols: 0 };
    d.rows = Math.max(d.rows, r + 1);
    d.cols = Math.max(d.cols, c + 1);
    dims.set(boxname, d);
  }

  // Build inventory with inferred (min 8x12) dimensions
  let inv = createInventory();
  if (dims.size === 0) {
    inv = addBox(inv, { name: 'BOX', rows: 8, cols: 12 });
  } else {
    for (const [name, d] of dims.entries()) {
      inv = addBox(inv, { name, rows: Math.max(8, d.rows), cols: Math.max(12, d.cols) });
    }
  }

  // Second pass: place samples
  for (let li = 1; li < lines.length; li++) {
    const cols = normalizeHeaders(lines[li]);
    const boxname = (iBox >= 0 ? cols[iBox] : 'BOX') || 'BOX';
    let row = null, col = null;
    if (iWell >= 0) {
      const m = String(cols[iWell] || '').trim().match(/^([A-Za-z])(\d{1,2})$/);
      if (m) { row = m[1].toUpperCase().charCodeAt(0) - 65; col = parseInt(m[2], 10) - 1; }
    }
    if (row == null && iRow >= 0) {
      const tok = cols[iRow];
      if (/^[A-Za-z]$/.test(tok || '')) row = tok.toUpperCase().charCodeAt(0) - 65; else if (Number.isFinite(Number(tok))) row = Math.max(0, Number(tok));
    }
    if (col == null && iCol >= 0) {
      const tok = cols[iCol];
      if (Number.isFinite(Number(tok))) col = Math.max(0, Number(tok));
    }
    if (row == null || col == null) continue;

    const construct = (iConstruct >= 0 ? cols[iConstruct] : '') || '';
    const label = (iLabel >= 0 ? cols[iLabel] : construct) || '';
    const sidelabel = (iSide >= 0 ? cols[iSide] : '') || '';
    const type = (iType >= 0 ? cols[iType] : '') || '';
    const concentration = (iConc >= 0 ? cols[iConc] : '') || '';
    const clone = (iClone >= 0 ? cols[iClone] : '') || '';
    const culture = (iCulture >= 0 ? cols[iCulture] : '') || '';

    inv = upsertSample(inv, {
      construct: construct || undefined,
      type: type || undefined,
      concentration: concentration || undefined,
      clone: clone || undefined,
      culture: culture || undefined,
      location: { boxname, row, col, label, sidelabel }
    });
  }
  return inv;
}

/**
 * Spreadsheet-friendly table
 */
export function toRows(inv) {
  // Spreadsheet-friendly table
  const rows = [];
  for (const [key, s] of Object.entries(inv.samples)) {
    const well = `${String.fromCharCode(65 + s.location.row)}${s.location.col + 1}`;
    rows.push({
      box: s.location.boxname,
      row: s.location.row,
      col: s.location.col,
      well,
      construct: s.construct,
      label: s.location.label,
      'side-label': s.location.sidelabel,
      concentration: s.concentration || '',
      clone: s.clone || '',
      culture: s.culture || '',
      type: s.type || ''
    });
  }
  return rows;
}

/**
 * Write the inventory as the tab-separated format `parseTabular` reads.
 *
 * One row per sample with a header line. This is the round trip, so a file written here can be
 * read back without loss of the fields it carries.
 *
 * @param {Inventory} inv
 * @returns {string}
 */
export function toTabular(inv) {
  const cols = ['box','row','col','well','construct','label','side-label','concentration','clone','culture','type'];
  const rows = [cols.join('\t')];
  for (const s of Object.values(inv.samples || {})) {
    const well = `${String.fromCharCode(65 + s.location.row)}${s.location.col + 1}`;
    rows.push([
      s.location.boxname,
      s.location.row,
      s.location.col,
      well,
      s.construct || '',
      s.location.label || '',
      s.location.sidelabel || '',
      s.concentration || '',
      s.clone || '',
      s.culture || '',
      s.type || ''
    ].join('\t'));
  }
  return rows.join('\n');
}

/**
 * Serialize an Inventory to the multi-block TSV format used by parseGridFile.
 * If `boxname` is provided, serializes that box only. If omitted and multiple
 * boxes exist, concatenates the serialized boxes separated by two newlines.
 */
export function serializeGrid(inv, boxname) {
  const names = boxname ? [boxname] : Object.keys(inv.boxes || {});
  if (names.length === 0) return '';
  const out = names.map(name => serializePlate(name, inv.boxes[name], inv.samples));
  return out.join('\n\n');
}

/**
 * Read an inventory from text, working out the format from the text itself.
 *
 * JSON if it starts with `{` or `[`, otherwise the tabular or multi-block grid reader. Empty
 * text gives an empty inventory rather than an error, because "nothing here yet" is a real state.
 *
 * @param {string} text
 * @returns {Inventory}
 */
export function parse(text) {
  const txt = String(text || '').trim();
  if (txt === '') return createInventory();
  // JSON: starts with {
  if (txt.startsWith('{') || txt.startsWith('[')) return fromJSON(txt);
  // Grid layout: starts with '>' or contains block separators
  if (txt.startsWith('>') || txt.includes('\n>>')) return parseGridFile('BOX.tsv', txt);
  // Otherwise treat as tabular (TSV/CSV)
  return parseTabular(txt);
}

/**
 * Read an inventory from a string in a NAMED format — 'json', 'grid' or tabular.
 *
 * Use this when you know what you are holding. `parse` sniffs the format instead, and
 * `ensureInventory` also accepts an inventory object unchanged.
 *
 * @param {string|Inventory} input
 * @param {string} [format] - 'json' | 'grid' | omitted for tabular
 * @returns {Inventory}
 */
export function inventoryFrom(input, format) {
  if (typeof input !== 'string') return ensureInventory(input);
  const fmt = (format || '').toLowerCase();
  if (fmt === 'json') return fromJSON(input.trim());
  if (fmt === 'grid') return parseGridFile('BOX.tsv', input.trim());
  if (fmt === 'tabular') return parseTabular(input.trim());
  return parse(input);
}

/**
 * Give me an inventory, whatever I hand you — a string to parse, an inventory to pass through,
 * or nothing at all.
 *
 * The forgiving entry point, for callers that do not want to know which they have. Nothing
 * becomes an EMPTY inventory, and an empty inventory is indistinguishable from a freezer with
 * nothing in it — so a caller that cares about the difference must check, as `planDilutions`
 * does after this returned a valid empty inventory from a file whose header it could not read.
 *
 * @param {string|Inventory|null} input
 * @param {string} [filenameHint] - used to guess the format
 * @returns {Inventory}
 */
export function ensureInventory(input, filenameHint) {
  if (!input) return createInventory();
  if (typeof input === 'string') {
    return parse(input);
  }
  if (typeof input === 'object' && input.boxes && input.samples) {
    return cloneInventory(input);
  }
  throw new Error('Unsupported inventory input type');
}

/**
 * Combine two inventories, with the SECOND winning any conflict.
 *
 * Right-biased on purpose: merging a freshly read box into a project inventory should let the
 * box say what is in it. Reverse the arguments if you meant the other precedence.
 *
 * @param {Inventory} invA
 * @param {Inventory} invB - wins where both hold the same location
 * @returns {Inventory}
 */
export function mergeInventories(invA, invB) {
  // Right-bias: B overwrites conflicts
  let out = invA;
  for (const [k, sample] of Object.entries(invB.samples || {})) {
    out = upsertSample(out, sample);
  }
  for (const [name, box] of Object.entries(invB.boxes || {})) {
    if (!out.boxes[name]) out = addBox(out, box);
  }
  return out;
}

/**
 * The inventory as a JSON string, with its Set indices flattened to arrays.
 *
 * Sets do not survive JSON, so `construct_to_locations` is written as arrays and rebuilt by
 * `fromJSON`. Passing this output anywhere that expects a live inventory without parsing it
 * first gives an object whose indices are the wrong type.
 *
 * @param {Inventory} inv
 * @returns {string}
 */
export function toJSON(inv) {
  // Convert Sets to arrays for JSON friendliness
  const constructIdx = {};
  for (const [k, set] of Object.entries(inv.construct_to_locations)) {
    constructIdx[k] = Array.from(set);
  }
  return JSON.stringify({
    boxes: inv.boxes,
    samples: inv.samples,
    construct_to_locations: constructIdx,
    loc_to_conc: inv.loc_to_conc,
    loc_to_clone: inv.loc_to_clone,
    loc_to_culture: inv.loc_to_culture
  }, null, 2);
}

/**
 * Read an inventory back from `toJSON`, rebuilding the Set indices.
 *
 * @param {string} jsonStr
 * @returns {Inventory}
 */
export function fromJSON(jsonStr) {
  const raw = JSON.parse(jsonStr);
  const inv = {
    boxes: raw.boxes || {},
    samples: raw.samples || {},
    construct_to_locations: {},
    loc_to_conc: raw.loc_to_conc || {},
    loc_to_clone: raw.loc_to_clone || {},
    loc_to_culture: raw.loc_to_culture || {}
  };
  for (const k in (raw.construct_to_locations || {})) {
    inv.construct_to_locations[k] = new Set(raw.construct_to_locations[k]);
  }
  return inv;
}

/**
 * Write an inventory out in a named format: 'object' (unchanged), 'json', 'tabular' or 'rows'.
 *
 * @param {Inventory} inv
 * @param {string} [format='object']
 * @returns {Inventory|string|Array}
 */
export function inventoryTo(inv, format = 'object') {
  switch ((format || 'object').toLowerCase()) {
    case 'object':
      return inv;
    case 'json':
      return toJSON(inv);
    case 'rows':
      return toRows(inv);
    case 'tabular':
      return toTabular(inv);
    case 'tsv':
      return serializeGrid(inv);
    default:
      throw new Error(`Unknown output format: ${format}`);
  }
}

/**
 * Convenience alias for parsing TSV/CSV grid text.
 * Usage:
 *   fromTSV('MyBox.tsv', text)  // with explicit filename
 *   fromTSV(text)               // filename defaults to 'BOX.tsv'
 * Throws a friendly error message when malformed.
 */
export function fromTSV(filenameOrText, maybeText) {
  try {
    if (typeof maybeText === 'undefined') {
      // Only text provided — assume grid layout text
      return parseGridFile('BOX.tsv', filenameOrText);
    }
    return parseGridFile(filenameOrText, maybeText);
  } catch (err) {
    const msg = err?.message || String(err);
    throw new Error(`TSV parse error: ${msg}`);
  }
}
