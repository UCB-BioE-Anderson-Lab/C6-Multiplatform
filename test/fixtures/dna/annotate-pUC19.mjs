#!/usr/bin/env node
// Writes pUC19.annotated.gb from pUC19.gb, the public NCBI record L09137.2.
//
// WHY A SCRIPT RATHER THAN A HAND-EDITED FILE. NCBI's record carries one feature, `source`, and
// nothing else, so the annotated copy has to come from somewhere. Every coordinate below is FOUND
// by searching the sequence for something public and exact (a primer, a start codon, a site),
// never typed in. Each one agrees with the standard pUC19 map, and anyone can rerun this and
// get the same file:
//
//   node test/fixtures/dna/annotate-pUC19.mjs
//
// The unannotated original is kept beside it: it is the "no features annotated" case, which has
// to look different from "the format carries no annotation" and from "could not read the file".
import fs from 'node:fs';
import path from 'node:path';
import { revcomp } from '../../../src/C6-Seq.js';
import { parseGenbank } from '../../../src/c6-server/parsers/genbank.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const STOPS = new Set(['TAA', 'TAG', 'TGA']);

/** 1-based [start, end] of the only occurrence of `probe` on the top strand, or throw. */
function onTop(seq, probe) {
  const i = seq.indexOf(probe);
  if (i < 0 || seq.indexOf(probe, i + 1) >= 0) throw new Error(`${probe}: not exactly once on top`);
  return [i + 1, i + probe.length];
}

/** 1-based top-strand span of the only occurrence of `probe` on the BOTTOM strand, or throw. */
function onBottom(seq, probe) {
  const [a, b] = onTop(revcomp(seq), probe);
  return [seq.length - b + 1, seq.length - a + 1];
}

/** The ORF that starts with `startProbe` on the bottom strand, through its stop codon. */
function orfOnBottom(seq, startProbe) {
  const rc = revcomp(seq);
  const i = rc.indexOf(startProbe);
  let j = i;
  while (j + 3 <= rc.length && !STOPS.has(rc.slice(j, j + 3))) j += 3;
  if (j + 3 > rc.length) throw new Error(`${startProbe}: no stop codon`);
  return [seq.length - (j + 3) + 1, seq.length - i];
}

export function annotate(text) {
  const seq = parseGenbank(text).data.sequence;
  const features = [
    // lacZ-alpha: starts ATGACCATGATTACG, the lacZ N-terminus, on the bottom strand.
    ['CDS', 'lacZ-alpha', orfOnBottom(seq, 'ATGACCATGATTACG'), true],
    // M13 forward (-20) and M13 reverse: the universal sequencing primers.
    ['primer_bind', 'M13 fwd', onTop(seq, 'GTAAAACGACGGCCAGT'), false],
    ['primer_bind', 'M13 rev', onBottom(seq, 'CAGGAAACAGCTATGAC'), true],
    // The MCS, from the EcoRI site (GAATTC) through the HindIII site (AAGCTT).
    ['misc_feature', 'MCS', [onTop(seq, 'GAATTC')[0], onTop(seq, 'AAGCTT')[1]], false],
    // bla: TEM-1 beta-lactamase, starting ATGAGTATTCAACATTTCCG, on the bottom strand.
    ['CDS', 'bla', orfOnBottom(seq, 'ATGAGTATTCAACATTTCCG'), true],
  ];
  const lines = features.flatMap(([key, label, [a, b], comp]) => [
    `     ${key.padEnd(16)}${comp ? `complement(${a}..${b})` : `${a}..${b}`}`,
    `                     /label="${label}"`,
  ]);
  return text.replace(/^ORIGIN/m, lines.join('\n') + '\nORIGIN');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const text = fs.readFileSync(path.join(HERE, 'pUC19.gb'), 'utf8');
  fs.writeFileSync(path.join(HERE, 'pUC19.annotated.gb'), annotate(text));
  console.log('wrote pUC19.annotated.gb');
}
