// src/c6-server/parsers/sequence.js
// Parses plain sequence files (.seq, .fasta, .fa) into a Polynucleotide.

import { cleanup, plasmid, dsDNA, oligo } from '../../C6-Seq.js';

/**
 * @param {string} text
 * @param {string} fileName - used to infer type hints from name
 * @returns {{ type: string, description: string, keywords: string[], data: object }}
 */
export function parseSequence(text, fileName = '') {
  let description = '';
  let rawSeq = '';
  const keywords = [];

  if (text.startsWith('>')) {
    // FASTA format
    const lines = text.split(/\r?\n/);
    const header = lines[0].slice(1).trim();
    description = header;
    // Pull anything after | as keywords
    keywords.push(...header.split(/[|[\]]/g).map(s => s.trim()).filter(Boolean));
    rawSeq = lines.slice(1).join('');
  } else {
    rawSeq = text;
    description = fileName.replace(/\.[^/.]+$/, '') || 'sequence';
  }

  const seq = cleanup(rawSeq);

  // Infer topology from file name heuristics
  const nameLower = fileName.toLowerCase();
  let poly;
  if (nameLower.includes('plasmid') || nameLower.includes('vector')) {
    poly = plasmid(seq);
    keywords.push('plasmid');
  } else if (nameLower.includes('oligo') || nameLower.includes('primer')) {
    poly = oligo(seq);
    keywords.push('oligo');
  } else {
    poly = dsDNA(seq);
  }

  return {
    type: 'polynucleotide',
    description: description || `${seq.length} bp sequence`,
    keywords: [...new Set(keywords.filter(Boolean))],
    data: poly,
  };
}
