// src/c6-server/parsers/csv.js
// Parses CSV/TSV into an array of objects.

/**
 * @param {string} text
 * @param {string} fileName
 * @returns {{ type: string, description: string, keywords: string[], data: object[] }}
 */
export function parseCsv(text, fileName = '') {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { type: 'table', description: 'empty table', keywords: [], data: [] };

  const sep = text.includes('\t') ? '\t' : ',';
  const headers = splitRow(lines[0], sep);
  const rows = lines.slice(1).map(line => {
    const vals = splitRow(line, sep);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] ?? ''; });
    return obj;
  });

  const name = fileName.replace(/\.[^/.]+$/, '') || 'table';
  const description = `${rows.length} row${rows.length !== 1 ? 's' : ''}, columns: ${headers.join(', ')}`;

  return {
    type: 'table',
    description,
    keywords: [name, ...headers].filter(Boolean),
    data: rows,
  };
}

function splitRow(line, sep) {
  if (sep === '\t') return line.split('\t');
  // Minimal CSV split respecting quoted fields
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuote = !inQuote; continue; }
    if (ch === ',' && !inQuote) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}
