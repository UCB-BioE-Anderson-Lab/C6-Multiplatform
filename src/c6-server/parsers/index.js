// src/c6-server/parsers/index.js
// Dispatcher: picks a parser based on file extension.

import { parseGenbank, looksLikeGenbank } from './genbank.js';
import { parseSequence } from './sequence.js';
import { parseCsv } from './csv.js';
import { parseJson } from './json.js';
import { parseCf } from './cf.js';

const PARSERS = {
  '.gb':    (text, name) => parseGenbank(text, name),
  '.gbk':   (text, name) => parseGenbank(text, name),
  '.genbank': (text, name) => parseGenbank(text, name),
  '.seq':   (text, name) => parseSequence(text, name),
  '.fasta': (text, name) => parseSequence(text, name),
  '.fa':    (text, name) => parseSequence(text, name),
  '.csv':   (text, name) => parseCsv(text, name),
  '.tsv':   (text, name) => parseCsv(text, name),
  '.json':  (text, name) => parseJson(text, name),
  '.cf':    (text, name) => parseCf(text, name),
};

/**
 * @param {string} filePath - relative path, used to extract extension
 * @param {string} text - file content
 * @returns {{ type: string, description: string, keywords: string[], data: object } | null}
 *   null if no parser is registered for this extension
 */
export function parseFile(filePath, text) {
  const ext = filePath.match(/(\.[^/.]+)$/)?.[1]?.toLowerCase();
  const parser = ext && PARSERS[ext];
  if (!parser) return null;
  const fileName = filePath.split('/').pop();
  // THE CONTENT OVERRULES THE EXTENSION, in the one direction it can. A `.seq` holding GenBank
  // is common (ApE writes them); FASTA or a raw read beginning with LOCUS is not a thing. So a
  // plain-sequence extension carrying GenBank is read as GenBank, and nothing else changes.
  if (PLAIN_SEQUENCE.has(ext) && looksLikeGenbank(text)) return parseGenbank(text, fileName);
  return parser(text, fileName);
}

// Extensions dispatched to parseSequence above, which are therefore worth sniffing.
const PLAIN_SEQUENCE = new Set(['.seq', '.fasta', '.fa']);

export { parseGenbank, parseSequence, parseCsv, parseJson, parseCf, looksLikeGenbank };
