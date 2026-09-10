// src/c6-server/parsers/index.js
// Dispatcher: picks a parser based on file extension.

import { parseGenbank } from './genbank.js';
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
  return parser(text, fileName);
}

export { parseGenbank, parseSequence, parseCsv, parseJson, parseCf };
