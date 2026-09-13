/**
 * The five operations of the characterization half: retransform, culture, assay, dilution, stock.
 * GATE 3c of `docs/TOOLKIT-PLAN.md`.
 */
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DESIGNS } from '../../src/labplanner/design/index.js';
import { createJob } from '../../src/labplanner/planning/job.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const fixture = path.join(root, 'test/fixtures/golden');
const packet = JSON.parse(execFileSync('node',
  [path.join(root, 'bin/c6-packet'), fixture, '--inventory', path.join(fixture, 'inventory.txt')],
  { encoding: 'utf8', maxBuffer: 64e6 }));

const sheetWith = (op) => packet.sheets.find((s) => (s.metadata?.operations || []).includes(op));
const headings = (s) => (s.blocks || []).filter((b) => b.kind === 'heading').map((b) => b.text);
const tableUnder = (s, re) => {
  const b = s.blocks || [];
  const i = b.findIndex((x) => x.kind === 'heading' && re.test(x.text));
  return i < 0 ? null : b.slice(i + 1).find((x) => x.kind === 'table');
};

describe('retransform', () => {
  const s = sheetWith('retransform');

  // IT WAS `negative | untransformed` AND `positive | pCTRL` UNDER "For this experiment" — true,
  // and it does not tell anybody what to put on a plate or what the plate would prove. The
  // cloning transform had had a proper control table since GATE 3a and a student meets both in
  // one experiment.
  it('presents its controls as plates, the same way the transform does', () => {
    expect(headings(s).some((h) => /^Controls —/.test(h))).toBe(true);
    const t = tableUnder(s, /^Controls —/);
    expect(t.rows[0]).toEqual(['plate', 'what goes on it', 'it answers']);
    expect(t.rows.length).toBe(3);          // header + positive + negative
    expect(headings(s)).not.toContain('For this experiment');
  });

  // TWO, NOT THREE. The restreak belongs to the cloning transformation — JCA, 2026-09-12, asked
  // for the three-plate set on "the transformation, not the retransformation". This DNA is
  // already known good, so "is this batch of plates any good" was answered upstream.
  it('has no restreak control', () => {
    const t = tableUnder(s, /^Controls —/);
    expect(t.rows.map((r) => r[0]).join(' ')).not.toMatch(/streak/i);
  });

  // A POSITIVE CONTROL IS A REAL TUBE. The sheet said "3 plates: the sample, plus untransformed
  // and pCTRL" and never said where the second plasmid was.
  it('lists the positive control plasmid as something to fetch', () => {
    const src = (s.sources || []).find((x) => x.what === 'pCTRL');
    expect(src, 'pCTRL is not in the Source block').toBeTruthy();
    expect(src.note).toMatch(/positive control/);
  });
});

describe('alsoNeeds', () => {
  // Kept out of `dnaInputs` on purpose: everything that orders the plan reads that field, and a
  // control is consumed without being an ingredient of anything.
  it('is material consumed without an ordering edge', () => {
    const job = createJob({ operation: 'retransform', output: 'host/pX', dnaInputs: ['pX'],
                            args: { positive: 'pCTRL', negative: 'untransformed' },
                            cf: 'c', line: 1 });
    expect(job.alsoNeeds).toEqual(['pCTRL']);
    expect(job.dnaInputs).toEqual(['pX']);
  });

  it('does not collect the negative, which names cells and not a tube', () => {
    const job = createJob({ operation: 'retransform', output: 'host/pX', dnaInputs: ['pX'],
                            args: { negative: 'untransformed' }, cf: 'c', line: 1 });
    expect(job.alsoNeeds).toEqual([]);
  });

  it('is empty for every operation that does not declare it', () => {
    for (const op of ['pcr', 'transform', 'culture', 'assay', 'pick'])
      expect(createJob({ operation: op, output: 'x', args: { positive: 'pCTRL' },
                         cf: 'c', line: 1 }).alsoNeeds).toEqual([]);
  });
});

describe('assay', () => {
  const s = sheetWith('assay');

  // A plate reader returns a grid of numbers. A grid with no key is not data, and rebuilding it
  // afterwards from the picking sheet is where a control column gets read as a sample.
  it('says what is in every well, controls included', () => {
    const t = tableUnder(s, /each well/);
    expect(t).toBeTruthy();
    expect(t.rows[0]).toEqual(['well', 'what is in it', 'role']);
    const roles = t.rows.slice(1).map((r) => r[2]);
    expect(roles.filter((x) => x === 'sample').length).toBe(4);
    expect(roles.some((x) => /^control/.test(x))).toBe(true);
  });

  // `expandClones` overwrites `clone` with the per-colony letter as it fans a pick out, so
  // reading it back gave `A-A`, `A-B` — bookkeeping rendered as a construct name.
  it('names the clones, not the bookkeeping letter', () => {
    const names = tableUnder(s, /each well/).rows.slice(1).map((r) => r[1]);
    expect(names[0]).toBe('B.subtilis/pGOLD-A');
    for (const n of names) expect(n).not.toMatch(/^[A-Z]-[A-Z]$/);
  });

  it('agrees with the wells the pick handed out', () => {
    const wells = tableUnder(s, /each well/).rows.slice(1).map((r) => r[0]);
    const pick = sheetWith('pick');
    const picked = (pick.columns || []).map((c) => c.well).filter(Boolean);
    expect(wells.slice(0, picked.length)).toEqual(picked);
  });
});

describe('every sheet', () => {
  // The protocol is a reference the bench has on a cheatsheet; the design's own blocks are what
  // nobody can look up. Ordered the other way, the assay's well map sat on page 2 behind the
  // plate-reader procedure.
  // PER SECTION, because one sheet is one work session and may hold three operations — the pick's
  // protocol legitimately precedes the culture section's conditions. The invariant is within a
  // section, which starts at a heading named for a design.
  const TITLES = new Set(Object.values(DESIGNS).map((d) => d.title));
  it('puts what is specific to it before the generic protocol', () => {
    for (const s of packet.sheets) {
      const b = s.blocks || [];
      let proto = -1;
      b.forEach((x, i) => {
        if (x.kind === 'heading' && TITLES.has(x.text)) proto = -1;
        else if (x.kind === 'text' && /^\{.+\}$/.test(String(x.text || ''))) proto = i;
        else if (proto >= 0 && x.kind === 'heading' && x.text === 'For this experiment')
          expect.fail(`${s.id}: conditions printed after the protocol in the same section`);
      });
    }
  });
});
