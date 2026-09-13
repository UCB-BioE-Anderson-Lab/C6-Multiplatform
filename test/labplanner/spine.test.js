/**
 * The spine: one pipeline, reachable from the library and from the command line.
 *
 * **THIS IS THE AUDIT FINDING, AS A TEST.** `generateLabPacket` returned an empty packet on its
 * first line and said nothing, because it required `jobsToLabSheets` and that module was the two
 * characters `export {}`. Eleven stages sat behind `typeof X === 'function'`; four of them did not
 * exist. Meanwhile `bin/c6-plan` spelled the stages out in its own middle and `bin/c6-packet` did
 * `jobsToLabSheets`'s work inline — so the pipeline that worked and the pipeline that was the
 * published API were different code, and only one of them ran.
 *
 * JCA, 2026-09-12: *"I'm not sure if we've gone off the rails because we have bypassed the
 * labsheet generation code we wrote, or we never really wrote it."*
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { generateLabPacket } from '../../src/labplanner/C6-LabPlanner.js';
import { jobsToLabSheets, TUBE_FOR, tubeFor } from '../../src/labplanner/planning/jobsToLabSheets.js';
import { DESIGNS } from '../../src/labplanner/design/index.js';
import { TUBE } from '../../src/labplanner/models/labsheet.js';
import { ensureInventory } from '../../src/inventory/io.js';
import { projectSequences } from '../../src/labplanner/planning/projectSequences.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const dir = path.join(root, 'test/fixtures/golden');

const cfs = fs.readdirSync(dir)
  .filter((f) => /^(Construction|Characterization) of /.test(f))
  .sort()
  .map((f) => ({
    name: f.replace(/^(Construction|Characterization) of /, '').replace(/\.txt$/, ''),
    characterization: /^Characterization/.test(f),
    text: fs.readFileSync(path.join(dir, f), 'utf8'),
  }));
const inventory = ensureInventory(fs.readFileSync(path.join(dir, 'inventory.txt'), 'utf8'),
                                  'inventory.txt');

// THE SAME INPUTS THE CLI GIVES ITSELF. The library takes sequences as an argument and the CLI
// resolves them off the project tree; handing the library the same ones is what makes the
// comparison below an equality rather than an approximation. Without it the PCR sheets differ on
// `program`, which is decided from the product size — a real difference, and not one about the
// two spines.
const sequences = projectSequences(dir);
const viaLibrary = generateLabPacket(cfs, inventory, { experiment: 'golden', sequences });
const viaCli = JSON.parse(execFileSync('node',
  [path.join(root, 'bin/c6-packet'), dir, '--inventory', path.join(dir, 'inventory.txt')],
  { encoding: 'utf8', maxBuffer: 64e6 }));

describe('generateLabPacket', () => {
  it('produces sheets at all', () => {
    expect(viaLibrary.sheets.length).toBeGreaterThan(0);
  });

  // EVERYTHING THE PLANNER DECIDES, not a sample of it. Given the same files, the same inventory
  // and the same sequences, the library and the command line must produce the same page.
  it('agrees with the command line, sheet for sheet', () => {
    expect(viaLibrary.sheets.map((s) => s.id)).toEqual(viaCli.sheets.map((s) => s.id));
    for (const [i, s] of viaLibrary.sheets.entries()) {
      const c = viaCli.sheets[i];
      expect(s.title, s.id).toBe(c.title);
      expect(s.tube, s.id).toBe(c.tube);
      expect(s.columns, s.id).toEqual(c.columns);
      expect(s.samples, s.id).toEqual(c.samples);
      expect(s.sources.map((x) => x.what), s.id).toEqual(c.sources.map((x) => x.what));
      expect(s.notes, s.id).toEqual(c.notes);
      expect(s.open, s.id).toEqual(c.open);
    }
  });

  it('keeps the planner order rather than sorting by operation', () => {
    // sortSheets orders by a static list — Dilution, PCR, Cleanup, Gel… — which would sort an
    // experiment's second pick up beside its first, ahead of the analysis that stands between them.
    const sessions = viaLibrary.sheets.map((s) => s.metadata.session);
    expect(sessions).toEqual([...sessions].sort((a, b) => a - b));
    const ops = viaLibrary.sheets.flatMap((s) => s.metadata.operations);
    expect(ops.indexOf('analysis')).toBeLessThan(ops.lastIndexOf('pick'));
  });

  it('carries what it could not read rather than dropping it', () => {
    const bad = generateLabPacket([{ name: 'broken', text: 'PCR\tonly\ttwo\n' }], null,
                                  { experiment: 'broken' });
    expect(bad.metadata.problems || bad.metadata.warnings).toBeTruthy();
  });
});

describe('every sheet is built through the model', () => {
  it('declares a tube kind that exists', () => {
    for (const s of viaLibrary.sheets) expect(TUBE[s.tube], `${s.id} -> ${s.tube}`).toBeTruthy();
  });

  it('derives labelMax from the tube rather than carrying its own number', () => {
    for (const s of viaLibrary.sheets) expect(s.labelMax).toBe(TUBE[s.tube].cap);
  });

  // The designs used to carry `labelMax: 24`, which is not a tube — it is the check turned off.
  it('no design carries a labelMax any more', () => {
    for (const [name, d] of Object.entries(DESIGNS))
      expect(d.labelMax, `${name} still declares labelMax`).toBeUndefined();
  });

  it('every operation with a design says what it writes on', () => {
    for (const name of Object.keys(DESIGNS))
      expect(TUBE_FOR[name], `${name} has no tube kind`).toBeTruthy();
  });

  // A Zymo cleanup ELUTES INTO A 1.5 mL TUBE. Two of JCA's rules met here and contradicted:
  // "Adding a z to a label is a convention for zymo" and "A pcr tube is max 3 char" — and `zL3a`
  // is four. The model caught it on its first real run; the resolution is that it was never a
  // strip tube.
  it('a zymo product is not on a strip tube', () => {
    expect(tubeFor('zymo')).toBe('micro');
    expect(TUBE.micro.cap).toBeGreaterThanOrEqual(4);
  });

  it('a sequencing tube takes one more character than a miniprep', () => {
    expect(TUBE.sequencing.cap).toBe(TUBE.micro.cap + 1);
  });
});

describe('the model refuses what used to reach paper', () => {
  const plan = { sheets: [{
    index: 0, operation: 'pcr', round: 1, rounds: 1, cfs: ['x'],
    samples: [{ output: 'aaaa', inputs: [], oligos: [], sources: [] },
              { output: 'bbbb', inputs: [], oligos: [], sources: [] }],
  }] };

  // LENGTH REACHES THE SEAM AS A WARNING, not as a refusal — see `models/labsheet.js § checkRow`
  // for why. It must still be said out loud: a label nobody can write on a cap is a real problem,
  // and the one thing worse than refusing over it is going quiet about it.
  it('warns at the seam about a label too long for what it is written on', () => {
    let n = 0;
    const label = Object.assign(() => `TOOLONG${n++}`, { of: () => null, hold: () => {} });
    const out = jobsToLabSheets(plan, { experiment: 'x', label });
    expect(out.warnings.join('\n')).toMatch(/characters and goes on a 200 µL PCR strip tube/);
  });

  it('throws on two tubes under one label', () => {
    const label = Object.assign(() => 'Xa', { of: () => null, hold: () => {} });
    expect(() => jobsToLabSheets(plan, { experiment: 'x', label }))
      .toThrow(/used twice/);
  });
});
