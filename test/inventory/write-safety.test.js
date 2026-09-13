/**
 * Writing to a lab's inventory must not damage what is already in it.
 *
 * **THIS FILE EXISTS BECAUSE THE FIRST VERSION DID.** `c6-issue` originally recorded a hold by
 * re-serializing every box back to its file. Run once against a copy of a real inventory it:
 *
 *   - erased the provenance comments explaining where the file was transcribed from,
 *   - converted a grid-format box to tabular, because that is what the writer emits,
 *   - and turned `Pink Training / pJ01 / well untracked` into `A1` — inventing a location.
 *
 * The last one is the exact failure the whole hold mechanism exists to prevent. JCA: *"Just don't
 * say things are in there that aren't there."* Every test here is one of those three.
 */
import { describe, it, expect } from 'vitest';
import { holdsDocument, appendSamples, parseTabular, toTabular, ensureInventory } from '../../src/inventory/io.js';
import { createInventory, addBox, hold, isHeld } from '../../src/inventory/inventory.js';

const GRID = ['>name\t\tCheese1', '>description\tthe team box', 'A1\tbf001', 'B1\tbf002'].join('\n');
const TABULAR = [
  '# Transcribed from JCA 2026-09-12. The well moves; the box does not.',
  '#',
  'box\trow\tcol\twell\tconstruct\tlabel\tconcentration',
  'Pink Training\t\t\tuntracked\tpJ01\tpJ01\tminiprep',
  'cheese_temp\t0\t0\tA1\tpOLD\tpOLD\tminiprep',
].join('\n');

describe('a hold is written to its own document', () => {
  const held = () => hold(addBox(createInventory(), { name: 'b', rows: 4, cols: 6 }),
                          { boxname: 'b', row: 0, col: 1 },
                          { by: 'X issued', since: '2026-09-13' });

  it('says in the file itself that nothing is in these wells', () => {
    const doc = holdsDocument(held());
    expect(doc).toMatch(/A HOLD IS NOT A TUBE/);
    expect(doc).toMatch(/held-since` is how you find them/);
  });

  it('carries no construct on a held row', () => {
    const doc = holdsDocument(held());
    const [header, ...body] = doc.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
    const cols = header.split('\t');
    const row = body[0].split('\t');
    expect(row[cols.indexOf('construct')]).toBe('');
    expect(row[cols.indexOf('status')]).toBe('held');
  });

  it('reads back as a hold and never as a sample', () => {
    const back = parseTabular(holdsDocument(held()));
    expect(Object.keys(back.samples)).toHaveLength(0);
    expect(isHeld(back, { boxname: 'b', row: 0, col: 1 })).toBe(true);
  });

  it('is empty-safe', () => {
    expect(() => holdsDocument(createInventory())).not.toThrow();
    expect(parseTabular(holdsDocument(createInventory())).holds).toEqual({});
  });
});

describe('appending a sample leaves the rest of the file alone', () => {
  const rows = [{ construct: 'pBET8-A', boxname: 'cheese_temp', row: 0, col: 1 }];

  it('keeps every existing line byte for byte', () => {
    const out = appendSamples(TABULAR, rows);
    expect(out.startsWith(TABULAR)).toBe(true);
  });

  it('keeps the comments', () => {
    expect(appendSamples(TABULAR, rows)).toMatch(/# Transcribed from JCA 2026-09-12/);
  });

  // THE WORST ONE. A sample in a box whose well is deliberately untracked must survive untouched;
  // re-serializing gave it `A1`, which is a location nobody recorded and somebody would act on.
  it('does not invent a well for a sample that never had one', () => {
    const before = parseTabular(TABULAR);
    const after = parseTabular(appendSamples(TABULAR, rows));
    const pj = Object.values(after.samples).find((s) => s.construct === 'pJ01');
    expect(pj.location.row).toBe(null);
    expect(pj.location.col).toBe(null);
    expect(Object.keys(before.samples).length + 1).toBe(Object.keys(after.samples).length);
  });

  it('writes the new row into the columns that file actually has, in its order', () => {
    const out = appendSamples(TABULAR, rows);
    // NOT `.trim()`: it eats the trailing tab of a row whose last column is empty, and the test
    // then counts one column short of what was written.
    const added = out.split('\n').filter((l) => l !== '').pop().split('\t');
    const cols = TABULAR.split('\n')[2].split('\t');
    expect(added).toHaveLength(cols.length);
    expect(added[cols.indexOf('construct')]).toBe('pBET8-A');
    expect(added[cols.indexOf('well')]).toBe('A2');
  });

  // A GRID FILE CANNOT TAKE A ROW, and guessing is how a box lands in the wrong document.
  it('refuses a file it cannot append to safely, rather than guessing', () => {
    expect(appendSamples(GRID, rows)).toBe(null);
    expect(appendSamples('', rows)).toBe(null);
  });
});

// AN EMPTY CELL IS NOT ROW ZERO, AND AN UNPLACED SAMPLE IS NOT IN A1. Both halves were wrong:
// `Number('')` is 0 so a blank row parsed as 0, and `String.fromCharCode(65 + null)` is "A" so the
// writer emitted A1. A file written and read back moved every well-less tube to the first well of
// its box — a location nobody recorded and somebody would go and look for.
describe('a tube with no well keeps no well', () => {
  it('parses as unplaced when the row and column cells are blank', () => {
    const inv = parseTabular(['box\trow\tcol\twell\tconstruct',
                              'Pink Training\t\t\t\tpJ01'].join('\n'));
    const pj = Object.values(inv.samples)[0];
    expect([pj.location.row, pj.location.col]).toEqual([null, null]);
  });

  it('survives a write and a read unchanged', () => {
    const before = parseTabular(TABULAR);
    const after = parseTabular(toTabular(before));
    const where = (i) => Object.values(i.samples)
      .map((s) => `${s.construct}@${s.location.row == null ? 'untracked' : s.location.row}`).sort();
    expect(where(after)).toEqual(where(before));
  });
});

describe('provenance', () => {
  it('a box remembers which document it came from', () => {
    const inv = ensureInventory(TABULAR, 'shared-stocks.tsv');
    for (const box of Object.values(inv.boxes)) expect(box.file).toBe('shared-stocks.tsv');
  });

  it('and carries none when it was read from nowhere', () => {
    const inv = ensureInventory(TABULAR);
    for (const box of Object.values(inv.boxes)) expect(box.file).toBeUndefined();
  });
});
