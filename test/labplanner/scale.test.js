/**
 * What happens when the numbers get big — and, more to the point, what happens when the toolkit
 * refuses.
 *
 * **A DELIBERATE REFUSAL MUST NOT ARRIVE AS A STACK TRACE.** `cloneDesignation` and `layoutFor`
 * both throw on purpose, and both say something a bench scientist could act on:
 *
 *     cloneDesignation(26): letters run out at Z, and AA is not in the grammar
 *     layoutFor: 30 clones will not fit a 4x6 vessel. Two blocks is a decision
 *                about the session, not about the layout.
 *
 * Nothing caught either, so `Pick pX n=30` printed eleven lines of Node internals from
 * `extractJobsFromCFs` and `c6-packet` reported *"c6-plan failed"*. Same class as the `c6-labplan`
 * crash fixed the same day: the sentence worth reading was written, and then thrown over.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { expandClones } from '../../src/labplanner/planning/expandClones.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

const pick = (n, args = {}) => ({
  cf: 'x', line: 6, operation: 'pick', output: 'pX_clones', dnaInputs: ['pX_host'],
  args: { n, clone: 'pX', _characterization: true, ...args } });

const problem = (n, args) => expandClones([pick(n, args)]).problems[0];

describe('too many clones to name', () => {
  it('reaches the user as a problem, not as a throw', () => {
    const p = problem(30, { vessel: '96-well' });
    expect(p.code).toBe('CANNOT_EXPAND');
    expect(p.message).toMatch(/letters run out at Z/);
  });

  // THE GRAMMAR SOMEBODY WRITES IN. `naming.js` says *"pass { library: true }"*, which is true of
  // the function and is not what goes on the line of a characterization file.
  it('names the remedy in the file grammar, not the function signature', () => {
    const p = problem(30, { vessel: '96-well' });
    expect(p.message).toMatch(/library=true/);
    expect(p.message).not.toMatch(/\{ library: true \}/);
  });

  it('says nothing about letters once the line declares a library', () => {
    const { jobs, problems } = expandClones([pick(30, { vessel: '96-well', library: 'true' })]);
    expect(problems).toHaveLength(0);
    expect(jobs).toHaveLength(30);
  });
});

describe('too many clones to fit', () => {
  it('is a different refusal with a different answer', () => {
    const p = problem(30);
    expect(p.code).toBe('CANNOT_EXPAND');
    expect(p.message).toMatch(/will not fit a 4x6 vessel/);
  });

  // ONE CATCH AROUND BOTH OFFERED `library=true` FOR THE PLASTIC PROBLEM, which is advice that
  // cannot work: renaming the clones does not make the block bigger.
  it('does not offer the naming remedy for a plasticware problem', () => {
    expect(problem(30).message).not.toMatch(/library=true/);
  });

  it('names the smallest vessel that would hold them', () => {
    expect(problem(30).message).toMatch(/48-well/);   // not the 96 that BLOCKS happens to list first
    expect(problem(60).message).toMatch(/96-well/);
  });

  it('says it is two sessions when nothing we know of holds them', () => {
    const p = problem(400, { vessel: '96-well', library: 'true' });
    expect(p.message).toMatch(/two sessions/);
    expect(p.message).not.toMatch(/say `vessel=/);
  });
});

// THE ADDRESS AND THE WELL ARE MEANT TO BE THE SAME FACT — `naming.js`: *"filled down the columns,
// the same order `vessels.layoutFor` uses."* `plateAddress` defaulted to 4x6 whatever vessel it was
// handed, so in a 96-well block the fifth clone was called `1A2` while sitting in `E1`.
describe('a library clone is named for where it actually sits', () => {
  it('follows the declared vessel, not a 4x6 default', () => {
    const { jobs } = expandClones([pick(8, { vessel: '96-well', library: 'true' })]);
    for (const j of jobs) expect(j.args.clone).toBe(`1${j.args.well}`);
    expect(jobs[4].args.well).toBe('E1');
  });
});

describe('end to end, which is where the stack trace came out', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scale-'));
  const golden = path.join(root, 'test/fixtures/golden');
  for (const f of fs.readdirSync(golden)) {
    fs.copyFileSync(path.join(golden, f), path.join(dir, f));
  }
  const char = path.join(dir, 'Characterization of pGOLD.txt');
  fs.writeFileSync(char, fs.readFileSync(char, 'utf8').replace('n=4', 'n=30'));

  const run = execFileSync('node',
    [path.join(root, 'bin/c6-packet'), dir, '--inventory', path.join(dir, 'inventory.txt')],
    { encoding: 'utf8', maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'pipe'] });

  it('still produces a packet', () => {
    expect(JSON.parse(run).sheets.length).toBeGreaterThan(0);
  });

  it('carries the refusal as a finding', () => {
    const found = JSON.parse(run).problems || [];
    const hit = found.find((p) => p.code === 'CANNOT_EXPAND');
    expect(hit, JSON.stringify(found)).toBeTruthy();
    expect(hit.message).toMatch(/will not fit/);
  });
});
