/**
 * What prints under "For this experiment", and what is not a source.
 *
 * Both rules exist because the same defect appeared twice: the sheet showed a fact that was
 * true of the PLAN and meaningless at the bench. `clone | B` over a table of A and B, and
 * "pBET8-A — made by the miniprep step that produces pBET8-A" printed on the miniprep sheet.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DESIGNS } from '../../src/labplanner/design/index.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(here, '../..');
const fixture = path.join(root, 'test/fixtures/golden');

const packet = JSON.parse(execFileSync('node',
  [path.join(root, 'bin/c6-packet'), fixture, '--inventory', path.join(fixture, 'inventory.txt')],
  { encoding: 'utf8', maxBuffer: 64e6 }));

describe('conditions are declared, not subtracted', () => {
  it('every design says what belongs under its table', () => {
    for (const [name, d] of Object.entries(DESIGNS))
      expect(Array.isArray(d.conditions), `${name} has no conditions list`).toBe(true);
  });

  // THE ACTUAL BUG, AS A TEST. `expandClones` writes `clone`, `read` and `picked` onto the steps
  // it fans out, and `injectVerification` writes `afterVerified`. Under the old subtract-an-
  // exclusion-list rule each of those printed as an experimental condition the day it was added.
  it('no planner bookkeeping is declared as a condition', () => {
    const bookkeeping = ['clone', 'read', 'picked', 'afterVerified', 'well', 'protocol', 'oligos'];
    for (const [name, d] of Object.entries(DESIGNS))
      for (const k of d.conditions)
        expect(bookkeeping, `${name} shows bookkeeping "${k}" as a condition`).not.toContain(k);
  });

  it('a conditions table has no header row to print blank', () => {
    for (const s of packet.sheets) {
      const b = s.blocks || [];
      const i = b.findIndex((x) => x.kind === 'heading' && x.text === 'For this experiment');
      if (i < 0) continue;
      const t = b.slice(i + 1).find((x) => x.kind === 'table');
      expect(t.header).toBe(false);
      for (const row of t.rows) expect(String(row[0]).trim()).not.toBe('');
    }
  });
});

describe('a sheet does not fetch what it makes', () => {
  it('nothing a session produces appears in its own Source block', () => {
    for (const s of packet.sheets) {
      // The packet does not carry per-session outputs, so read them off the sample tables: a
      // source naming something that also stands in a `clone` or `construct` column of the same
      // sheet is the sheet pointing at itself.
      const inCols = new Set();
      for (const row of s.columns || []) for (const v of Object.values(row)) inCols.add(String(v));
      for (const src of s.sources || [])
        if (/^made by the (pick|miniprep) step/.test(src.note || ''))
          expect(inCols.has(src.what), `${s.id} lists its own ${src.what} as a source`).toBe(false);
    }
  });

  // A GEL MAKES NOTHING. It shares the PCR's job object, so its samples carry the PCR's outputs —
  // and the PCR ran a session earlier. Treating those as made-here dropped `frag1` and `backbone`
  // from the assembly sheet, the one page that genuinely has to say which tubes to fetch.
  it('the assembly sheet still fetches the fragments the PCR session made', () => {
    const asm = packet.sheets.find((s) => (s.metadata?.operations || []).includes('goldengate'));
    const named = (asm.sources || []).map((x) => x.what);
    expect(named).toContain('frag1');
    expect(named).toContain('backbone');
  });
});

describe('nothing that should be text reaches the page as a function', () => {
  // A DESIGN MAY COMPUTE ITS TITLE, MODULE OR `submits` FROM THE STEP — a retransformation is
  // titled Electroporation or Conjugation by what the file said. `module` and `submits` had always
  // been called; `title` had not, so a function there was stringified and the sheet's heading came
  // out as the SOURCE CODE of the arrow function that should have produced it:
  //
  //   sheet 9  s9-retransform  (ctx) => wordsFor(cond(ctx.samples?.[0]?.params, 'method')).title
  //
  // This is the guard rather than the fix: any future field that forgets to call gets caught here
  // instead of on somebody's printed page.
  it('no sheet carries a stringified function anywhere', () => {
    const seen = JSON.stringify(packet);
    expect(seen).not.toMatch(/=>/);
    expect(seen).not.toMatch(/\bfunction\s*\(/);
  });

  it('every sheet has a real title', () => {
    for (const s of packet.sheets) {
      expect(typeof s.title).toBe('string');
      expect(s.title.length).toBeGreaterThan(3);
      expect(s.title).not.toMatch(/undefined|\[object/);
    }
  });
});
