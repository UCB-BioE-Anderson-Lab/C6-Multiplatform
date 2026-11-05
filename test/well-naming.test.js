/**
 * One well, one name: the box's.
 *
 * **THE DEFECT THIS PINS.** Three places each defined `letter(row) + (col + 1)` for themselves.
 * That is right for a box that letters its rows and silently wrong for one that letters its
 * columns — `src/inventory/io.js` has carried the warning in a comment for weeks: *"the tube
 * written on the cap as D1 is at row index 0, column index 3, and `wellName(row, col)` turns that
 * into 'A4'. A well that exists, holds something else, and looks entirely plausible on a printed
 * labsheet."* What it did not do was carry the LABELS, so nothing outside the parser could act
 * on it.
 *
 * The consequence reached the bench: `c6-issue` reserved the right INDEX under the name of a
 * different, occupied well, while the labsheet printed the right name — so the workbook sent
 * somebody to B3 and `holds.tsv` reserved "C2". On return, two tubes of four were refused with a
 * message naming an unrelated reagent. Found 2026-11-04 by a session using the toolkit cold and
 * reproduced on this repository's own golden fixture, with every test green throughout — which
 * is exactly what the parser's comment predicts, because the wrong name is always a well that
 * exists.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { wellNameIn, wellIndexIn } from '../src/inventory/inventory.js';
import { parse, mergeInventories } from '../src/inventory/io.js';
import { wellAt } from '../src/labplanner/planning/issue.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const CANONICAL = { rowLabels: ['A', 'B', 'C', 'D'], colLabels: ['1', '2', '3', '4'] };
const COLUMN_LETTERED = { rowLabels: ['1', '2', '3', '4'], colLabels: ['A', 'B', 'C', 'D'] };

describe('the box names its own wells', () => {
  it('letters rows in a canonical box', () => {
    expect(wellNameIn(CANONICAL, 0, 3)).toBe('A4');
  });

  it('LETTERS COLUMNS IN A BOX THAT DOES — the case that was wrong', () => {
    // row index 0, column index 3 is the tube written on the cap as D1, not A4.
    expect(wellNameIn(COLUMN_LETTERED, 0, 3)).toBe('D1');
  });

  it('falls back to the canonical layout when a box records no labels', () => {
    expect(wellNameIn({}, 1, 2)).toBe('B3');
    expect(wellNameIn(undefined, 0, 0)).toBe('A1');
  });

  it('refuses a non-index rather than inventing a name', () => {
    expect(wellNameIn(CANONICAL, undefined, 2)).toBe('');
  });
});

describe('and reads them back the same way', () => {
  it('round-trips in both layouts, for every well', () => {
    for (const box of [CANONICAL, COLUMN_LETTERED]) {
      for (let r = 0; r < box.rowLabels.length; r += 1) {
        for (let c = 0; c < box.colLabels.length; c += 1) {
          expect(wellIndexIn(box, wellNameIn(box, r, c)), `${r},${c}`).toEqual({ row: r, col: c });
        }
      }
    }
  });

  it('READS B3 AS COLUMN B OF ROW 3 in a column-lettered box, not row B column 3', () => {
    expect(wellIndexIn(COLUMN_LETTERED, 'B3')).toEqual({ row: 2, col: 1 });
    expect(wellIndexIn(CANONICAL, 'B3')).toEqual({ row: 1, col: 2 });
  });

  it('returns null for a well the box does not have', () => {
    expect(wellIndexIn(COLUMN_LETTERED, 'Z9')).toBeNull();
    expect(wellIndexIn(COLUMN_LETTERED, 'A9')).toBeNull();
    expect(wellIndexIn(CANONICAL, '')).toBeNull();
  });

  it('issue.js resolves through the same implementation', () => {
    expect(wellAt('B3', COLUMN_LETTERED)).toEqual({ row: 2, col: 1 });
    expect(wellAt('B3')).toEqual({ row: 1, col: 2 });
  });
});

describe("the repository's own fixture is a column-lettered box", () => {
  const inv = parse(fs.readFileSync(path.join(root, 'test/fixtures/golden/inventory.txt'), 'utf8'), 'GoldBox');
  const box = inv.boxes.GoldBox;

  it('carries its labels onto the box, which is what makes any of this possible', () => {
    expect(box.colLabels).toEqual(['A', 'B', 'C', 'D']);
    expect(box.rowLabels[0]).toBe('1');
  });

  it('names the ampicillin C1, and nothing else does', () => {
    const amp = Object.values(inv.samples).find((s) => s.construct === 'Amp');
    expect(amp.location.well).toBe('C1');
    expect(wellNameIn(box, amp.location.row, amp.location.col)).toBe('C1');
  });

  it('A FREE WELL GETS ITS OWN NAME, and the old one was not even a well here', () => {
    // Row 1, column 2 is free. The box calls it C2; the canonical naming called it "B3" —
    // and this box has no row 3 at all, so that name denotes nothing.
    expect(wellNameIn(box, 1, 2)).toBe('C2');
    const occupied = new Set(Object.values(inv.samples).map((s) => s.location.well));
    expect(occupied.has('C2')).toBe(false);
    expect(wellIndexIn(box, 'B3')).toBeNull();
  });

  it('refuses an index the box does not have, rather than mixing conventions', () => {
    // This returned "CA" — a canonical row letter glued to a real column label.
    expect(wellNameIn(box, 2, 0)).toBe('');
  });
});

describe('merging must not lose the labels', () => {
  const inv = parse(fs.readFileSync(path.join(root, 'test/fixtures/golden/inventory.txt'), 'utf8'), 'GoldBox');

  // `holds.tsv` NAMES a box without describing it, so it merges in a GoldBox with no labels.
  const holdsOnly = { samples: {}, holds: {}, boxes: { GoldBox: { name: 'GoldBox', rows: 2, cols: 4 } },
                      construct_to_locations: {}, loc_to_conc: {}, loc_to_clone: {},
                      loc_to_culture: {}, loc_to_host: {} };

  it('A DESCRIBED BOX WINS, whichever side it is merged from', () => {
    expect(mergeInventories(inv, holdsOnly).boxes.GoldBox.colLabels).toEqual(['A', 'B', 'C', 'D']);
    expect(mergeInventories(holdsOnly, inv).boxes.GoldBox.colLabels).toEqual(['A', 'B', 'C', 'D']);
  });

  it('so the name does not depend on which file was read first', () => {
    const a = mergeInventories(inv, holdsOnly).boxes.GoldBox;
    const b = mergeInventories(holdsOnly, inv).boxes.GoldBox;
    expect(wellNameIn(a, 1, 2)).toBe(wellNameIn(b, 1, 2));
    expect(wellNameIn(a, 1, 2)).toBe('C2');
  });
});
