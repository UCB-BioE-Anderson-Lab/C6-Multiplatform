// AN ENZYME IS NOT A SEQUENCE THAT IS MISSING, and `c6-sim` used to say it was. Its exemption
// list held four enzyme names copied out by hand — BsaI, BsmBI, BbsI, SapI — so
// `GoldenGate pTlib1 pP6 BseRI pExTP_gg` reported "missing: BseRI" although BseRI has been in
// the simulator's table all along. A hand-copied list of what another module knows is a second
// source for one fact, and this one had already drifted.
//
// The two findings are kept apart because they are fixed in different places: a missing sequence
// by adding a file to the project, an unknown enzyme by adding a row to `simRestrictionEnzymes`.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { simRestrictionEnzymes } from '../src/C6-Sim.js';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'c6-sim');
const SEQ = 'ATGCGGTACCTTAACGGATCCAGGTCTCAGGGACCTTTAAACGGCCGGCCAATTCGATCGAT'.repeat(8);

let root;
const run = (cf) => {
  fs.writeFileSync(path.join(root, 'cf.txt'), cf);
  try {
    return execFileSync(process.execPath, [BIN, path.join(root, 'cf.txt'), '--project', root],
      { encoding: 'utf8' });
  } catch (e) {
    // A failed simulation exits 1 and its stdout is exactly what this test reads.
    return String(e.stdout || '');
  }
};

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'c6-enz-'));
  const origin = [];
  for (let i = 0; i < SEQ.length; i += 60) {
    origin.push(`${String(i + 1).padStart(9)} ${SEQ.slice(i, i + 60).match(/.{1,10}/g).join(' ')}`);
  }
  fs.writeFileSync(path.join(root, 'pThing.gb'),
    `LOCUS       pThing                ${SEQ.length} bp    DNA        circular     11-APR-2022\n`
    + `DEFINITION  .\nFEATURES             Location/Qualifiers\nORIGIN\n${origin.join('\n')}\n//\n`);
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('the enzyme table', () => {
  it('knows BseRI, the Type IIS enzyme Pimar builds its promoter libraries with', () => {
    expect(simRestrictionEnzymes.BseRI).toEqual(
      expect.objectContaining({ recognitionSequence: 'GAGGAG', cut5: 10, cut3: 8 }));
  });
});

describe('c6-sim', () => {
  it('does not report a known enzyme as an input with no sequence', () => {
    const out = run('GoldenGate\tpThing\tBseRI\tpAsm\n');
    expect(out).not.toMatch(/no sequence anywhere in the project/);
    expect(out).not.toMatch(/BseRI.*no sequence|no sequence.*BseRI/);
  });

  it('names an enzyme it does not know as an unknown ENZYME, not a missing sequence', () => {
    const out = run('GoldenGate\tpThing\tFspEI\tpAsm\n');
    expect(out).toMatch(/unknown enzyme FspEI/);
    expect(out).not.toMatch(/FspEI.*no sequence|no sequence.*FspEI/);
  });

  it('still reports a genuinely missing input', () => {
    const out = run('GoldenGate\tpNotHere\tBsaI\tpAsm\n');
    expect(out).toMatch(/no sequence anywhere in the project: pNotHere/);
  });
});
