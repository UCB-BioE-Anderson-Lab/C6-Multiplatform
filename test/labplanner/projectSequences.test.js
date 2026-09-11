// The resolver's whole job is to MISS NOTHING, and every way it can fail is silent: a sequence
// it does not find is reported as a missing input on a construction file that is correct.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { projectSequences, addWorkbookSequences, preambleFor } from
  '../../src/labplanner/planning/projectSequences.js';

let root;
const OLIGO = 'ACGTACGTACGTACGTACGT';
const PLASMID = 'ATGC'.repeat(80);

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'c6-proj-'));
  // inputs live wherever they were made — two experiments, two folders
  fs.mkdirSync(path.join(root, 'EXP1'));
  fs.mkdirSync(path.join(root, 'EXP2', 'deeper'), { recursive: true });
  fs.writeFileSync(path.join(root, 'EXP1', 'EXP1_oligos.txt'),
    `oFwd\t${OLIGO}\t25nm\tSTD\noRev\tTTTTGGGGCCCCAAAATTTT\t25nm\tSTD\n`);
  // A real GenBank body: 60 bases per line in six blocks of ten, with the 1-based offset in
  // front. Written out properly because a fixture the parser silently rejects would make this
  // whole file pass by testing nothing.
  const origin = [];
  for (let i = 0; i < PLASMID.length; i += 60) {
    const chunk = PLASMID.slice(i, i + 60).match(/.{1,10}/g).join(' ');
    origin.push(`${String(i + 1).padStart(9)} ${chunk}`);
  }
  fs.writeFileSync(path.join(root, 'EXP2', 'deeper', 'pThing.seq'),
    `LOCUS       pThing                ${PLASMID.length} bp    DNA        circular     10-FEB-2026\n`
    + `DEFINITION  .\nFEATURES             Location/Qualifiers\nORIGIN\n${origin.join('\n')}\n//\n`);
  fs.writeFileSync(path.join(root, 'EXP2', 'derived_sequences.tsv'),
    `# derived\n#name\tsequence\tkind\tsource\noOnlyInWorkbook\tGGGGCCCCAAAATTTTGGGG\toligo\tbook.xlsx:sequences\n`);
  fs.writeFileSync(path.join(root, 'EXP1', 'notes.md'), 'ACGTACGTACGTACGTACGT looks like DNA\n');
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('projectSequences', () => {
  it('crosses experiment folders, because a construction file\'s inputs do', () => {
    const { oligos, plasmids } = projectSequences(root);
    expect(oligos.oFwd).toBe(OLIGO);            // EXP1
    expect(plasmids.pThing.toUpperCase()).toBe(PLASMID);  // EXP2/deeper
  });

  it('reads sequences that exist ONLY inside a workbook', () => {
    // The failure this closes: SynThera's G00101 and s101R are in no _oligos.txt anywhere, so
    // a resolver reading only ordering sheets calls a correct construction file broken.
    const { oligos } = projectSequences(root);
    expect(oligos.oOnlyInWorkbook).toBe('GGGGCCCCAAAATTTTGGGG');
  });

  it('does not harvest DNA-looking text out of prose', () => {
    const { oligos, plasmids } = projectSequences(root);
    for (const bag of [oligos, plasmids])
      expect(Object.keys(bag).some((k) => k.includes('notes'))).toBe(false);
  });

  it('records where each sequence came from, so a wrong one can be traced', () => {
    const { sources } = projectSequences(root);
    expect(sources.oFwd.join()).toContain('EXP1_oligos.txt');
    expect(sources.pThing.join()).toContain('pThing.seq');
  });

  it('a name defined twice with different sequences is flagged, not silently picked', () => {
    const dup = path.join(root, 'EXP2', 'clash_oligos.txt');
    fs.writeFileSync(dup, `oFwd\tTTTTTTTTTTTTTTTTTTTT\t25nm\tSTD\n`);
    try {
      const { sources } = projectSequences(root);
      expect(sources.oFwd.some((s) => s.includes('CONFLICTS'))).toBe(true);
    } finally { fs.rmSync(dup); }
  });
});

describe('preambleFor', () => {
  it('emits only what the construction file actually names', () => {
    const seqs = projectSequences(root);
    const cf = 'PCR\toFwd\toRev\tpThing\tprod';
    const pre = preambleFor(cf, seqs);
    expect(pre).toContain('oligo\toFwd');
    expect(pre).toContain('plasmid\tpThing');
    expect(pre).not.toContain('oOnlyInWorkbook');
  });
});

describe('addWorkbookSequences', () => {
  it('classifies by length when the workbook does not say', () => {
    const bag = { oligos: {}, plasmids: {}, sources: {} };
    addWorkbookSequences(bag, [['short', OLIGO], ['long', PLASMID]], 'book');
    expect(bag.oligos.short).toBe(OLIGO);
    expect(bag.plasmids.long).toBe(PLASMID);
  });
});
