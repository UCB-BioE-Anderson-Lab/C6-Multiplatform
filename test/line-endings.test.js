// A CR-ONLY FILE IS A FILE WITH LINES IN IT, and splitting on '\n' alone says it has one.
//
// Nothing throws, which is what makes this expensive: a `_oligos.txt` written by classic Mac OS
// (ApE and several older lab tools still emit CR) yields its FIRST oligo and no other, a
// construction file yields its first step, and the error that eventually reaches a person is
// "the template's sequence is not in the project" — pointing at the wrong file entirely. Found
// 2026-10-04 converting Pimar's legacy construction files. Pimar has normalised its own files
// since, which is exactly why the fix belongs here: UCB_iGEM_Assembly has not.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseCF } from '../src/C6-Sim.js';
import { detectDialect } from '../src/labplanner/validate/constructionFile.js';
import { projectSequences } from '../src/labplanner/planning/projectSequences.js';

const CR = (...lines) => lines.join('\r') + '\r';

let root;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'c6-cr-'));
  fs.writeFileSync(path.join(root, 'old_oligos.txt'), CR(
    'oFwd\tAAAACCCCGGGGTTTTAAAA\t25nm\tSTD',
    'oRev\tTTTTGGGGCCCCAAAATTTT\t25nm\tSTD',
    'oThird\tGGGGAAAATTTTCCCCGGGG\t25nm\tSTD'));
  fs.writeFileSync(path.join(root, 'old_sequences.tsv'), CR(
    '#name\tsequence\tkind\tsource',
    'oInSheet\tACGTACGTACGTACGTACGT\toligo\tbook.xlsx:sequences',
    'oAlsoInSheet\tTGCATGCATGCATGCATGCA\toligo\tbook.xlsx:sequences'));
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('a CR-only oligo file', () => {
  it('yields every oligo, not just the first', () => {
    const { oligos } = projectSequences(root);
    expect(Object.keys(oligos).sort()).toEqual(['oAlsoInSheet', 'oFwd', 'oInSheet', 'oRev', 'oThird']);
    expect(oligos.oThird).toBe('GGGGAAAATTTTCCCCGGGG');
  });
});

describe('a CR-only construction file', () => {
  const cf = CR(
    'PCR\toFwd\toRev\tpTemplate\tampl',
    'GoldenGate\tampl\tBsaI\tasm',
    'Transform\tasm\tMach1\tAmp\t37\tpThing');

  it('parses as three steps', () => {
    const parsed = parseCF(cf);
    expect(parsed.steps.map((s) => s.operation)).toEqual(['PCR', 'GoldenGate', 'Transform']);
  });

  it('is recognised as the current dialect, not "unknown"', () => {
    // A file read as one line has one op line, and the dialect sniffer then answers about a
    // document that does not exist. "unknown" sends c6-check past a file it should have checked.
    expect(detectDialect(cf)).toBe('current');
  });
});

describe('CRLF and LF are unchanged by the fix', () => {
  it('splits all three endings the same way', () => {
    const steps = (sep) => parseCF(['PCR\toFwd\toRev\tpT\tampl',
      'GoldenGate\tampl\tBsaI\tasm'].join(sep)).steps.length;
    expect([steps('\n'), steps('\r\n'), steps('\r')]).toEqual([2, 2, 2]);
  });
});
