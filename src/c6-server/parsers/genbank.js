// src/c6-server/parsers/genbank.js
// Parses GenBank flat file format (.gb, .gbk) into a Polynucleotide.

import { plasmid, dsDNA } from '../../C6-Seq.js';

/**
 * @param {string} text - raw GenBank file content
 * @returns {{ type: string, description: string, keywords: string[], data: object }}
 */
export function parseGenbank(text) {
  const lines = text.split(/\r?\n/);

  let definition = '';
  let accession = '';
  let organism = '';
  const keywords = [];
  const features = [];
  let isCircular = false;
  let sequence = '';

  let section = null;
  let featKey = null;
  let featQuals = {};

  for (const line of lines) {
    // LOCUS line: tells us topology
    if (line.startsWith('LOCUS')) {
      isCircular = /circular/i.test(line);
      continue;
    }

    if (line.startsWith('DEFINITION')) {
      definition = line.replace(/^DEFINITION\s+/, '').trim();
      section = 'DEFINITION';
      continue;
    }
    if (line.startsWith('ACCESSION')) {
      accession = line.replace(/^ACCESSION\s+/, '').trim().split(/\s+/)[0];
      section = null;
      continue;
    }
    if (line.startsWith('KEYWORDS')) {
      const kw = line.replace(/^KEYWORDS\s+/, '').replace(/\.$/, '').trim();
      if (kw && kw !== '.') keywords.push(...kw.split(/[;,]\s*/));
      section = 'KEYWORDS';
      continue;
    }
    if (line.startsWith('  ORGANISM')) {
      organism = line.replace(/^\s+ORGANISM\s+/, '').trim();
      section = null;
      continue;
    }

    // Multi-line continuation for DEFINITION / KEYWORDS
    if (section === 'DEFINITION' && line.startsWith('            ')) {
      definition += ' ' + line.trim();
      continue;
    }
    if (section === 'KEYWORDS' && line.startsWith('            ')) {
      const kw = line.trim().replace(/\.$/, '');
      if (kw) keywords.push(...kw.split(/[;,]\s*/));
      continue;
    }
    if (line.match(/^[A-Z]/) && section === 'DEFINITION') section = null;
    if (line.match(/^[A-Z]/) && section === 'KEYWORDS') section = null;

    // FEATURES
    if (line.startsWith('FEATURES')) { section = 'FEATURES'; continue; }
    if (section === 'FEATURES') {
      if (line.startsWith('ORIGIN')) { section = 'ORIGIN'; continue; }
      const featMatch = line.match(/^     (\S+)\s+(.+)$/);
      if (featMatch) {
        if (featKey) features.push({ key: featKey, qualifiers: featQuals });
        featKey = featMatch[1];
        featQuals = { location: featMatch[2].trim() };
        continue;
      }
      const qualMatch = line.match(/^\s+\/(\w+)=?"?([^"]*)"?$/);
      if (qualMatch && featKey) {
        featQuals[qualMatch[1]] = qualMatch[2];
      }
      continue;
    }

    // ORIGIN — sequence lines
    if (section === 'ORIGIN') {
      if (line.startsWith('//')) break;
      sequence += line.replace(/[\d\s]/g, '').toUpperCase();
    }
  }
  if (featKey) features.push({ key: featKey, qualifiers: featQuals });

  // Build description from available metadata
  const descParts = [definition, organism && `(${organism})`].filter(Boolean);
  const description = descParts.join(' ').replace(/\s+/g, ' ').trim() ||
    (accession ? `GenBank accession ${accession}` : 'GenBank sequence');

  // Extract gene/product names as additional keywords
  for (const feat of features) {
    const gene = feat.qualifiers.gene || feat.qualifiers.product || feat.qualifiers.note;
    if (gene) keywords.push(gene);
  }

  const poly = isCircular ? plasmid(sequence) : dsDNA(sequence);

  return {
    type: 'polynucleotide',
    description,
    keywords: [...new Set(keywords.filter(k => k && k.length < 80))],
    data: { ...poly, features },
  };
}
