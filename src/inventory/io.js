/**
 * IO: parse/serialize/pretty/CSV for the inventory.
 * The parser supports the '>>' multi-block grid format used in cloning-tutorials.
 * All functions are pure and return new inventories; no side effects.
 */

import { createInventory, addBox, upsertSample, cloneInventory, hold } from './inventory.js';

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

// THE BOX-WIDE HEADER IS TAB-SEPARATED, LIKE EVERY OTHER LINE IN THE FORMAT. This split on `:`
// alone, so `>name\t\tCheese1` — the first line of every inventory written this way — parsed to
// nothing, and with it the box's declared name, its location, its plate type and its temperature.
// Nothing failed: the box simply fell back to being called after the file, or "BOX".
function parseBoxWideFields(lines) {
  const fields = {};
  for (const line of lines) {
    if (!line.startsWith('>')) continue;
    const body = line.slice(1);
    const parts = body.indexOf('\t') >= 0 ? body.split('\t') : body.split(':');
    const key = parts[0].trim().toLowerCase();
    const value = parts.slice(1).map((t) => t.trim()).filter(Boolean).join(' ');
    if (key && value) fields[key] = value;
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

  // THE FILE'S OWN COLUMN LABELS, KEPT. The line above replaces them with 1..N, which is right
  // for the canonical model this module writes — rows A..N, columns 1..N — and destroys the only
  // record of how a box that numbers its rows and letters its columns actually labels a well.
  // The Cheese team's inventory is exactly that box, so every location derived from the indices
  // came out transposed: pJ01, written on the tube as D1, printed as A4.
  const colLabels = Array.from({ length: numCols },
    (_, i) => (headerTokens0[i + 1] !== undefined && String(headerTokens0[i + 1]).trim() !== ''
                 ? String(headerTokens0[i + 1]).trim() : String(i + 1)));

  return { headers, colLabels, rowLabels, wellArray };
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

  // THE NAME THE BOX CALLS ITSELF, then the file it came in, then a placeholder. A labsheet that
  // sends somebody to box "BOX" has told them nothing, and that is what every grid inventory
  // produced: `ensureInventory` took a filename hint and dropped it, and `>name` never parsed.
  const baseName = (boxHints.name || filename || 'BOX').split('.')[0];
  const { headers, colLabels = [], rowLabels, wellArray } = plate;
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
      const construct = (sample.construct || '').trim() || constructFromLabel(sample.label);
      const rowLabel = rowLabels[r];
      const colLabel = headers[c + 1];
      // THE WELL NAME THE BOX ITSELF USES.
      //
      // A well name is a LETTER AND A NUMBER, and which axis supplies which is the box's business,
      // not this parser's. The canonical format here letters its rows and numbers its columns;
      // the Cheese team's inventory does the reverse — columns A..I, rows 1..9 — so the tube
      // written on the cap as D1 is at row index 0, column index 3, and `wellName(row, col)`
      // turns that into "A4". A well that exists, holds something else, and looks entirely
      // plausible on a printed labsheet.
      //
      // So the name is assembled from the file's own labels, letter first, whichever axis it came
      // from. Both layouts then produce the name somebody would write down.
      const cl = colLabels[c] !== undefined ? String(colLabels[c]) : String(c + 1);
      const alpha = (t) => /^[A-Za-z]+$/.test(t);
      const well = alpha(cl) && !alpha(String(rowLabel)) ? `${cl}${rowLabel}`
                 : `${rowLabel}${cl}`;
      const location = { boxname: baseName, row: r, col: c, well,
                         label: (sample.label || well), sidelabel: (sample['side-label'] || '') };
      inv = upsertSample(inv, {
        location,
        construct,
        concentration: (sample.concentration || '').trim() || undefined,
        clone: (sample.clone || '').trim() || undefined,
        culture: (sample.culture || '').trim() || undefined,
        type: (sample.type || '').trim() || undefined,
        metadata: (sample.construct || '').trim() ? sample
                                                  : { ...sample, construct_from_label: true }
      });
    }
  }
  return inv;
}


// THE NAME ON THE TUBE, WHEN THE CONSTRUCT COLUMN IS EMPTY.
//
// The grid format has a `>>construct` grid and the Cheese team's inventory leaves it entirely
// blank — every one of its 62 samples carries its name in the LABEL instead ("10uM bf001",
// "pPTPi-G14"), which is what is actually written on the tube. Read strictly, that inventory
// indexes nothing: `findByConstruct` is empty for every name, so `planDilutions` reports a
// freezer full of oligos as "order these" and a labsheet quietly carries no source at all.
//
// That is the failure `planDilutions` already names — *"an inventory with nothing in it is not a
// freezer with nothing in it"* — arriving through a door its guard does not cover, because the
// inventory is not empty. It has samples and no index.
//
// So the label is parsed the way a person reading the box parses it: a leading concentration
// token, if there is one, then the name. Derived rather than asserted — the sample records that
// this is where its construct came from, so a count of them can be shown rather than assumed.
const CONC_PREFIX = /^\s*[0-9]*\.?[0-9]+\s*(?:u|µ|n|m)m\s+/i;
export function constructFromLabel(label) {
  const t = String(label || '').trim();
  if (!t) return '';
  return t.replace(CONC_PREFIX, '').trim();
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
  // A BOX CAN BE DECLARED, AND UNTIL 2026-09-13 IT COULD NOT BE.
  //
  // Dimensions were inferred from the rows present, so a box with nothing in it had no name and no
  // shape — an empty file parsed as `BOX 8x12`. That made a real, empty box unrecordable, which is
  // exactly the state a box is in the moment somebody writes it down: JCA, on `cheese_temp`, *"it
  // is a real box in the lab, but I bet I never made a box file for it."*
  //
  // **THE BOX EXISTING AND THE BOX HAVING SOMETHING IN IT ARE TWO DIFFERENT FACTS**, and a format
  // that can only express the second cannot record the first. `>box <name> <rows>x<cols>` says so,
  // borrowing the grid format's own `>` convention for a directive.
  const declared = [];
  const raw = String(text || '').split(/\r?\n/);
  for (const l of raw) {
    const m = l.trim().match(/^>\s*box\s+(.+?)\s+(\d+)\s*[xX]\s*(\d+)\s*$/);
    if (m) declared.push({ name: m[1].trim(), rows: Number(m[2]), cols: Number(m[3]) });
  }
  const lines = raw
    .filter((l) => l.trim() !== '' && !l.trim().startsWith('#') && !l.trim().startsWith('>'));
  if (lines.length === 0) {
    let empty = createInventory();
    for (const d of declared) empty = addBox(empty, d);
    return empty;
  }
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
  const iStatus = idx('status');
  const iHeldBy = Math.max(idx('held-by'), idx('heldby'));
  const iHeldSince = Math.max(idx('held-since'), idx('heldsince'));
  const iHeldFor = Math.max(idx('held-for'), idx('heldfor'));

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

  // A BOX WHOSE SAMPLES ARE ALL UNPLACED STILL EXISTS. The dimension pass reads wells, so a box
  // with none contributed nothing and was never added — and its samples then had no box to be in.
  for (let li = 1; li < lines.length; li++) {
    const cols = normalizeHeaders(lines[li]);
    const b = (iBox >= 0 ? cols[iBox] : '') || '';
    if (b && !dims.has(b)) dims.set(b, { rows: 0, cols: 0 });
  }

  // A DECLARED SHAPE IS NOT A FLOOR, IT IS THE SHAPE. Inference takes the largest row and column
  // seen and rounds up to 8x12, which is a reasonable guess and only a guess; `>box` is somebody
  // saying what the plastic actually is, and a guess must not override it.
  let inv = createInventory();
  for (const d of declared) inv = addBox(inv, d);
  if (dims.size === 0 && !declared.length) {
    inv = addBox(inv, { name: 'BOX', rows: 8, cols: 12 });
  } else {
    for (const [name, d] of dims.entries()) {
      if (inv.boxes[name]) continue;                      // declared above; do not widen it
      inv = addBox(inv, { name, rows: Math.max(8, d.rows), cols: Math.max(12, d.cols) });
    }
  }

  // Second pass: place samples
  for (let li = 1; li < lines.length; li++) {
    const cols = normalizeHeaders(lines[li]);
    const boxname = (iBox >= 0 ? cols[iBox] : 'BOX') || 'BOX';
    let row = null, col = null;
    // A BOX THAT DOES NOT TRACK WELLS SAYS SO, and that is not the same as a well nobody wrote
    // down. JCA, 2026-09-12: *"It is not worthwhile to speak of the location of pJ01. It is often
    // used, and it moves around in that box as a result."* An empty well is a question a labsheet
    // should ask; `untracked` is a question it must not, because the answer goes stale in days and
    // a question whose answer goes stale trains people to skip the ones that do not.
    const untracked = iWell >= 0 && /^untracked$/i.test(String(cols[iWell] || '').trim());
    if (iWell >= 0 && !untracked) {
      const m = String(cols[iWell] || '').trim().match(/^([A-Za-z])(\d{1,2})$/);
      if (m) { row = m[1].toUpperCase().charCodeAt(0) - 65; col = parseInt(m[2], 10) - 1; }
    }
    // AN EMPTY CELL IS NOT ROW ZERO. `Number('')` is `0` and `Number.isFinite(0)` is true, so a
    // blank row or column read as 0 — and a sample with no well came back as A1, a location
    // nobody recorded and somebody would act on. It bit the round trip hardest: `toTabular`
    // writes empty row/col for an unplaced sample, so writing a file and reading it back moved
    // every such tube to the first well of its box.
    //
    // JCA, on why those tubes have no well at all: *"It is not worthwhile to speak of the location
    // of pJ01. It is often used, and it moves around in that box as a result."*
    const numeric = (tok) => {
      const t = String(tok ?? '').trim();
      return t !== '' && Number.isFinite(Number(t)) ? Math.max(0, Number(t)) : null;
    };
    if (row == null && iRow >= 0) {
      const tok = cols[iRow];
      if (/^[A-Za-z]$/.test(String(tok || '').trim())) row = tok.trim().toUpperCase().charCodeAt(0) - 65;
      else row = numeric(tok);
    }
    if (col == null && iCol >= 0) col = numeric(cols[iCol]);
    const construct = (iConstruct >= 0 ? cols[iConstruct] : '') || '';
    const label = (iLabel >= 0 ? cols[iLabel] : construct) || '';
    // A ROW WITH NO WELL IS A TUBE WITH NO WELL, NOT A BROKEN ROW. Skipping it made a real
    // sample invisible to every query — see `locKey` for the case and the quote. The box is
    // enough to find it; the well is what the labsheet asks for. A row naming NOTHING is still
    // skipped, because that is a blank line.
    if ((row == null || col == null) && !construct && !label) continue;
    // A HELD ROW IS A HOLD AND NEVER A SAMPLE. It carries no construct and says so in its own
    // column, so this cannot be reached by accident — but it is checked BEFORE building a sample
    // rather than after, because the one thing a hold must never do is become a claim that
    // something is in a well. → `inventory.js § hold`
    if (iStatus >= 0 && String(cols[iStatus] || '').trim().toLowerCase() === 'held') {
      if (row != null && col != null) {
        inv = hold(inv, { boxname, row, col },
                   { by: (iHeldBy >= 0 ? cols[iHeldBy] : '') || 'unnamed',
                     ...(iHeldSince >= 0 && cols[iHeldSince] ? { since: cols[iHeldSince] } : {}),
                     ...(iHeldFor >= 0 && cols[iHeldFor] ? { why: cols[iHeldFor] } : {}) });
      }
      continue;
    }
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
      location: { boxname, row, col, label, sidelabel, ...(untracked ? { untracked: true } : {}) }
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
    // See `toTabular`: an unplaced sample has no well, and inventing one is how a tube that moves
    // around a box acquires a location somebody goes and looks for.
    const placed = s.location.row != null && s.location.col != null;
    const well = placed
      ? `${String.fromCharCode(65 + s.location.row)}${s.location.col + 1}`
      : 'untracked';
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
  // `status` AND `held-by` ARE WHY A HOLD CAN BE WRITTEN DOWN WITHOUT BECOMING A CLAIM.
  //
  // JCA, 2026-09-13: *"It might be good to put a hold on spots in the inventory — I think that is
  // fine. Just don't say things are in there that aren't there."* A hold row carries no construct
  // and says `held` in a column of its own, so neither a person reading the file nor
  // `parseTabular` can mistake it for a tube. The reader refuses to build a sample out of one.
  const cols = ['box','row','col','well','construct','label','side-label','concentration',
                'clone','culture','type'];
  const rows = [cols.join('\t')];
  for (const s of Object.values(inv.samples || {})) {
    // AN UNPLACED SAMPLE IS WRITTEN AS `untracked`, NOT AS A1. `String.fromCharCode(65 + null)` is
    // "A" and `null + 1` is 1, so the obvious expression invents a well for every tube that
    // deliberately has none — and a file written and read back moved pJ01 to the first well of its
    // box. The box is what is true about it; the well is what nobody records.
    const placed = s.location.row != null && s.location.col != null;
    const well = placed
      ? `${String.fromCharCode(65 + s.location.row)}${s.location.col + 1}`
      : 'untracked';
    rows.push([
      s.location.boxname,
      placed ? s.location.row : '',
      placed ? s.location.col : '',
      well,
      s.construct || '',
      s.location.label || '',
      s.location.sidelabel || '',
      s.concentration || '',
      s.clone || '',
      s.culture || '',
      s.type || '',
    ].join('\t'));
  }
  // **HOLDS ARE NOT WRITTEN HERE.** They were, briefly, when a hold was going to live in the
  // samples' own file — and that design was replaced the same day by `holdsDocument`, because a
  // hold is not a sample and re-serializing a box's file to record one destroyed its comments and
  // its format. Leaving the code here left TWO writers for one thing, and only one of them learned
  // about `held-for`: a round trip through this function silently dropped what each hold was for.
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
export function parse(text, filenameHint) {
  const txt = String(text || '').trim();
  if (txt === '') return createInventory();
  // JSON: starts with {
  if (txt.startsWith('{') || txt.startsWith('[')) return fromJSON(txt);
  // Grid layout: starts with '>' or contains block separators
  if (txt.startsWith('>') || txt.includes('\n>>'))
    return parseGridFile(filenameHint || 'BOX.tsv', txt);
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
    // The hint was accepted and thrown away, so every caller that passed one was passing it into
    // nothing and every grid box was named "BOX".
    //
    // AND IT IS ALSO PROVENANCE. A write has to go back to the document it came from, and the hint
    // is the only thing that knows which that is. → `stampSource`, `writeBack`
    return stampSource(parse(input, filenameHint), filenameHint);
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
/**
 * Remember which document each box was read from.
 *
 * **A WRITE HAS TO GO BACK WHERE IT CAME FROM.** A lab's inventory is several files kept by
 * several people — JCA, 2026-09-12: *"pJ01 is in the pink training box in the enzyme freezer.
 * There is also one in the control stocks box."* — and `--inventory <dir>` merges all of them. Put
 * a hold in the merged object and there is no way back to a file: the writer either guesses, or
 * rewrites every file it read, and either one can lose somebody else's box.
 *
 * So a box carries `file`, and `writeBack` returns only the documents whose own boxes changed. A
 * box read without a filename hint carries none and is never written.
 *
 * @param {Inventory} inv
 * @param {string=} file
 * @returns {Inventory} the same inventory, its boxes stamped
 */
export function stampSource(inv, file) {
  if (!file) return inv;
  const boxes = {};
  for (const [name, box] of Object.entries(inv.boxes || {})) {
    boxes[name] = box.file ? box : { ...box, file };
  }
  return { ...inv, boxes };
}

/**
 * The holds, as a document of their own.
 *
 * **NEVER REWRITE A BOX'S OWN FILE TO RECORD A HOLD.** The first version of this did, and on a
 * copy of a real inventory it: erased the provenance comments explaining where the file was
 * transcribed from, converted a grid-format box to tabular because that is what the writer emits,
 * and turned `Pink Training / pJ01 / well untracked` into `A1` — inventing a location, which is
 * the exact failure this whole mechanism exists to prevent. JCA: *"Just don't say things are in
 * there that aren't there."*
 *
 * A hold is not a sample and does not belong in the samples' document. Its own file is:
 *
 *   **safe** — every existing file stays byte-identical, whatever format it is in
 *   **honest** — holds are visibly separate from occupancy, which is the conceptual point
 *   **auditable** — a stale hold is found by reading one file
 *
 * It is ordinary tabular text with `status: held`, so the normal reader picks it up when the
 * directory is merged, and `parseTabular` already refuses to build a sample out of such a row.
 *
 * @param {Inventory} inv
 * @returns {string} the file's contents, header included, empty-safe
 */
export function holdsDocument(inv) {
  const head = ['# Holds — spots kept free for work that has been issued and not yet returned.',
                '#',
                '# A HOLD IS NOT A TUBE. Nothing is in these wells. They are spoken for by the',
                '# experiment named in `held-by`, and they are released when its labsheet comes',
                '# back — whether or not the tube ended up here. A hold whose experiment was',
                '# abandoned is stale and should be let go; `held-since` is how you find them.',
                '#',
                '# Written by c6-issue and pruned by c6-receive. Boxes are defined in their own',
                '# files; this one only ever says which wells are spoken for.',
                '#',
                '# `held-for` names the tube a spot is being kept for. It is NOT `construct`, which',
                '# is what every reader of an inventory reads to learn what is in a well, and which',
                '# is empty on every row here because nothing is.'].join('\n');
  // `held-for` IS NOT `construct`, AND THE DISTINCTION IS THE WHOLE FILE. `construct` means a tube
  // is in this well; `held-for` means one is expected. Every reader of an inventory reads the
  // first, so a hold row leaves it empty — but leaving the tube unnamed entirely made a hold
  // unmatchable to what it was for, so re-issuing an experiment could not recognise its own holds
  // and minted a second set beside them.
  const cols = ['box', 'row', 'col', 'well', 'construct', 'status', 'held-by', 'held-since',
                'held-for'];
  const rows = [cols.join('\t')];
  for (const h of Object.values(inv.holds || {})) {
    const l = h.location || {};
    const well = (l.row == null || l.col == null)
      ? '' : `${String.fromCharCode(65 + l.row)}${l.col + 1}`;
    rows.push([l.boxname || '', l.row ?? '', l.col ?? '', well,
               '', 'held', h.by || '', h.since || '', h.why || ''].join('\t'));
  }
  return `${head}\n${rows.join('\n')}\n`;
}

/**
 * Append sample rows to a tabular inventory file without touching a byte of what is there.
 *
 * **APPEND, NEVER RE-SERIALIZE.** A file carries comments, a column order somebody chose, and rows
 * this run may not even have understood; round-tripping it through the writer loses all three.
 * Only the new lines are added, and only where the file's own header says where each field goes.
 *
 * Returns null for a file this cannot safely append to — a grid-format box, or one whose header
 * has no `box` column — so the caller reports rather than guessing.
 *
 * @param {string} text      the file as it stands
 * @param {Array<{construct, boxname, row, col, label?}>} samples
 * @returns {string|null} the file with rows appended, or null if it must not be touched
 */
export function appendSamples(text, samples) {
  const lines = String(text || '').split(/\r?\n/);
  // SKIP DIRECTIVES AS WELL AS COMMENTS. `> box <name> <rows>x<cols>` was added the same day as
  // this function and broke it immediately: the first non-comment line was the directive, which
  // has no tab in it, so every file that declared its box was reported as one this could not
  // append to. A newly created box file is exactly the file that declares one.
  const headerAt = lines.findIndex((l) => l.trim() && !l.trim().startsWith('#')
                                       && !l.trim().startsWith('>'));
  if (headerAt < 0) return null;
  const header = lines[headerAt].split('\t').map((h) => h.trim().toLowerCase());
  if (!header.includes('box') && !header.includes('boxname')) return null;   // grid, or not ours
  const at = (name) => header.findIndex((h) => h === name);

  const added = samples.map((sm) => {
    const cells = header.map(() => '');
    const put = (name, v) => { const i = at(name); if (i >= 0) cells[i] = String(v); };
    put('box', sm.boxname); put('boxname', sm.boxname);
    put('row', sm.row); put('col', sm.col);
    put('well', `${String.fromCharCode(65 + sm.row)}${sm.col + 1}`);
    put('construct', sm.construct);
    put('label', sm.label || sm.construct);
    return cells.join('\t');
  });
  const body = lines.slice();
  while (body.length && body[body.length - 1].trim() === '') body.pop();
  return `${[...body, ...added].join('\n')}\n`;
}

export function mergeInventories(invA, invB) {
  // Right-bias: B overwrites conflicts
  let out = invA;
  for (const [k, sample] of Object.entries(invB.samples || {})) {
    out = upsertSample(out, sample);
  }
  for (const [name, box] of Object.entries(invB.boxes || {})) {
    if (!out.boxes[name]) out = addBox(out, box);
  }

  // **HOLDS SURVIVE THE MERGE, AND FOR A DAY THEY DID NOT.**
  //
  // This carried samples and boxes and silently dropped `holds`, which made the whole hold
  // mechanism inert in the only way it is ever used: every tool reads `--inventory <dir>` and
  // merges the files, so the holds parsed out of `holds.tsv` were thrown away one line later.
  // `isAvailable` then never saw one, and two experiments issued the same afternoon took the same
  // wells — the exact collision holds exist to prevent, with the file on disk saying otherwise.
  //
  // A TUBE BEATS A RESERVATION. If a hold and a sample land on one location the sample wins and
  // the hold is dropped: the hold said *keep this free* and somebody has since put something
  // there, so the reservation is answered rather than contradicted.
  const holds = { ...(out.holds || {}) };
  for (const [k, h] of Object.entries(invB.holds || {})) holds[k] = h;
  for (const k of Object.keys(holds)) if (out.samples[k]) delete holds[k];
  return { ...out, holds };
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
