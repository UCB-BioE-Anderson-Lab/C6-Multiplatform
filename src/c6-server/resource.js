// src/c6-server/resource.js
// Resource model and in-memory index management.
// The index is a plain JS array; persistence is handled by the fs-adapter.

// Pure JS UUID v4 — works in Node, Apps Script, and browsers.
function randomUUID() {
  var bytes = (typeof crypto !== 'undefined' && crypto.getRandomValues)
    ? crypto.getRandomValues(new Uint8Array(16))
    : Array.from({ length: 16 }, function() { return Math.random() * 256 | 0; });
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  var hex = Array.from(bytes, function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
}

/**
 * @typedef {Object} ResourceEntry
 * @property {string} id
 * @property {string} name          - bare name, e.g. "pBR322"
 * @property {string} file_path     - relative to data folder root, e.g. "sequences/pBR322.gb"
 * @property {string} type          - "polynucleotide" | "cf" | "table" | "json" | "model"
 * @property {string} description
 * @property {string[]} keywords
 * @property {number} indexed_at    - unix ms
 */

/** @returns {ResourceEntry[]} */
export function createIndex() {
  return [];
}

/**
 * @param {ResourceEntry[]} index
 * @param {Omit<ResourceEntry, 'id' | 'indexed_at'>} fields
 * @returns {ResourceEntry[]} new index with entry added or replaced by file_path
 */
export function addEntry(index, fields) {
  const existing = index.findIndex(e => e.file_path === fields.file_path);
  const entry = {
    id: existing >= 0 ? index[existing].id : randomUUID(),
    indexed_at: Date.now(),
    ...fields,
  };
  if (existing >= 0) {
    return index.map((e, i) => (i === existing ? entry : e));
  }
  return [...index, entry];
}

/**
 * @param {ResourceEntry[]} index
 * @param {string} filePath
 * @returns {ResourceEntry[]}
 */
export function removeEntry(index, filePath) {
  return index.filter(e => e.file_path !== filePath);
}

/**
 * Resolve a name string to an index entry.
 * Accepts bare name ("pBR322") or dotted path ("sequences.pBR322" → "sequences/pBR322").
 * @param {ResourceEntry[]} index
 * @param {string} name
 * @returns {ResourceEntry | undefined}
 */
export function findByName(index, name) {
  const normalized = name.replace(/\./g, '/');
  // Exact file_path match (with or without extension)
  const byPath = index.find(e =>
    e.file_path === normalized ||
    e.file_path.replace(/\.[^/.]+$/, '') === normalized
  );
  if (byPath) return byPath;
  // Bare name match (last path segment without extension)
  return index.find(e => {
    const base = e.file_path.split('/').pop().replace(/\.[^/.]+$/, '');
    return base.toLowerCase() === name.toLowerCase();
  });
}

/**
 * Simple keyword + name search. Returns entries ranked by hit count.
 * @param {ResourceEntry[]} index
 * @param {string} text
 * @returns {ResourceEntry[]}
 */
export function searchIndex(index, text) {
  const terms = text.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = index.map(entry => {
    const haystack = [
      entry.name,
      entry.description,
      ...(entry.keywords || []),
      entry.type,
      entry.file_path,
    ].join(' ').toLowerCase();
    const hits = terms.filter(t => haystack.includes(t)).length;
    return { entry, hits };
  });
  return scored
    .filter(s => s.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map(s => s.entry);
}
