/**
 * The phase-4 gate, as `c6-labplan` actually runs it.
 *
 * **THIS IS THE TEST THAT WOULD HAVE CAUGHT THE REAL DEFECT.** `validate.characterizationcoverage`
 * was written, tested, and called by nothing; `docs/planning/README.md` claimed it gated the
 * compile. A session using the toolkit cold found that out by running the check BY HAND after
 * `c6-labplan` had already written ten sheets. A unit test on the function could not have seen
 * it — only a test on the command can.
 *
 * The two fixtures differ in one file: the covered one's characterization starts at `pFIX1_t`,
 * the transformant, which is how a real file is written; the uncovered one starts at a construct
 * that exists nowhere.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const inventory = fs.mkdtempSync(path.join(os.tmpdir(), 'c6-labplan-inv-'));
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'c6-labplan-out-')), 'sheets.xlsx');

const run = (fixture, extra = []) => {
  try {
    const stdout = execFileSync('node', [path.join(root, 'bin/c6-labplan'),
      path.join(root, 'test/fixtures/labplan', fixture),
      '--inventory', inventory, '--out', out, ...extra], { encoding: 'utf8', stdio: 'pipe' });
    return { code: 0, out: stdout };
  } catch (e) {
    return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
};

describe('a characterization file that reaches the chain compiles', () => {
  const { code, out: text } = run('covered');

  it('does not stop on coverage', () => {
    expect(text).not.toMatch(/does not reach/);
    expect(code).not.toBe(3);
  });

  it('CHARACTERISING THE TRANSFORMANT COUNTS AS CHARACTERISING THE PLASMID', () => {
    // Every step begins at pFIX1_t. Asking only about the filename product refused this file.
    expect(text).not.toMatch(/STOP/);
  });

  it('reports no orphans for a well formed file', () => {
    expect(text).not.toMatch(/exists nowhere/);
  });
});

describe('a characterization file that reaches nothing is REFUSED', () => {
  const { code, out: text } = run('uncovered');

  it('exits 3, the same refusal as a missing file', () => expect(code).toBe(3));

  it('names the construct nothing arrives at', () => {
    expect(text).toMatch(/STOP — the characterization file does not reach: pFIX1/);
  });

  it('says what to add rather than only what is wrong', () => {
    expect(text).toMatch(/Add a step to Characterization of pFIX1\.txt/);
  });

  it('warns about the steps naming something that exists nowhere, without stopping on them', () => {
    expect(text).toMatch(/exists nowhere/);
    expect(text).toMatch(/pELSEWHERE/);
  });

  it('--clone-only is the way past it, as for the file-presence gate', () => {
    expect(run('uncovered', ['--clone-only']).code).not.toBe(3);
  });
});
