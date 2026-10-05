// `.seq` IS TWO FILE FORMATS WEARING ONE EXTENSION, and every reader in this repository has to
// know that. ApE writes GenBank into `.seq`; a sequencing facility writes a raw read into `.seq`.
// Pimar holds 397 of the first and 433 of the second, in the same tree. Deciding by extension is
// wrong for one of the two groups, and the two readers here had each picked a different group to
// be wrong about: `projectSequences` read every `.seq` as GenBank and silently dropped the reads,
// `bin/c6-dna` read every `.seq` as plain and refused the maps with "it did not parse".
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { looksLikeGenbank, parseFile } from '../src/c6-server/parsers/index.js';
import { projectSequences } from '../src/labplanner/planning/projectSequences.js';
import { readFile } from '../bin/c6-dna';

const PLASMID = 'ATGCGGTACC'.repeat(24);           // 240 bp
const READ = 'ACGTTGCANNNNACGTTGCAGG'.repeat(4);   // a sequencing read, N calls and all

function genbank(name, seq) {
  const origin = [];
  for (let i = 0; i < seq.length; i += 60) {
    origin.push(`${String(i + 1).padStart(9)} ${seq.slice(i, i + 60).match(/.{1,10}/g).join(' ')}`);
  }
  return `LOCUS       ${name}                ${seq.length} bp    DNA        circular     11-APR-2022\n`
    + `DEFINITION  .\nFEATURES             Location/Qualifiers\nORIGIN\n${origin.join('\n')}\n//\n`;
}

let root;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'c6-seq-'));
  fs.writeFileSync(path.join(root, 'pMap.seq'), genbank('pMap', PLASMID));
  fs.writeFileSync(path.join(root, '71-read_G09_067.seq'), READ + '\n');
  fs.writeFileSync(path.join(root, 'broken.seq'), 'LOCUS       broken   nonsense and no ORIGIN\n');
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('looksLikeGenbank', () => {
  it('is the first non-blank line beginning with LOCUS, and nothing else', () => {
    expect(looksLikeGenbank(genbank('p', PLASMID))).toBe(true);
    expect(looksLikeGenbank('\n\n  \nLOCUS   p  240 bp\n')).toBe(true);
    expect(looksLikeGenbank(READ)).toBe(false);
    expect(looksLikeGenbank('>a read\n' + READ)).toBe(false);
    // LOCUS further down is not a GenBank file; it is a sequence that happens to spell it.
    expect(looksLikeGenbank(`${READ}\nLOCUS\n`)).toBe(false);
    expect(looksLikeGenbank('')).toBe(false);
  });
});

describe('the parser dispatcher', () => {
  it('reads a .seq holding GenBank as GenBank, features and topology and all', () => {
    const parsed = parseFile('Maps/pMap.seq', genbank('pMap', PLASMID));
    expect(parsed.data.sequence.toUpperCase()).toBe(PLASMID);
    expect(parsed.data.isCircular).toBe(true);
  });

  it('still reads a .seq holding a plain read as a plain read', () => {
    const parsed = parseFile('Sequencing/71-read.seq', READ);
    expect(parsed.data.sequence.toUpperCase()).toBe(READ);
    expect(parsed.data.isCircular).toBeFalsy();
  });
});

describe('bin/c6-dna', () => {
  it('draws a GenBank map that is called .seq — the repro from Pimar', () => {
    const mol = readFile(path.join(root, 'pMap.seq'));
    expect(mol.status).not.toBe('unreadable');
    expect(mol.sequence.toUpperCase()).toBe(PLASMID);
    expect(mol.isCircular).toBe(true);
    expect(mol.featureStatus).toBe('carried');
  });

  it('still reads a plain .seq, and still says topology was guessed', () => {
    const mol = readFile(path.join(root, '71-read_G09_067.seq'));
    expect(mol.status).not.toBe('unreadable');
    expect(mol.sequence.toUpperCase()).toBe(READ);
    expect(mol.notes.join(' ')).toMatch(/Topology is not recorded/);
  });
});

describe('projectSequences', () => {
  it('resolves BOTH kinds of .seq, which is the whole point', () => {
    const { plasmids } = projectSequences(root);
    expect(plasmids.pMap.toUpperCase()).toBe(PLASMID);
    expect(plasmids['71-read_G09_067'].toUpperCase()).toBe(READ);
  });

  it('NAMES a map it cannot parse instead of dropping it', () => {
    const { plasmids, sources } = projectSequences(root);
    expect(plasmids.broken).toBeUndefined();
    // "malformed" and "absent" must not produce the same answer: the empty catch that used to be
    // here sent people looking for a file that was sitting right there.
    expect((sources.broken || []).join(' ')).toMatch(/UNPARSEABLE/);
  });
});
