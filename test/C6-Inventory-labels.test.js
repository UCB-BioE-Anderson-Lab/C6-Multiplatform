/**
 * An inventory with 62 samples and no index is not an empty inventory, and it is not a full one.
 *
 * The grid format carries a `>>construct` grid. The Cheese team's inventory leaves it entirely
 * blank: every sample's name is in its LABEL — "10uM bf001", "pPTPi-G14" — which is what is
 * actually written on the tube. Read strictly, that file indexes nothing, so `findByConstruct`
 * is empty for every name in it.
 *
 * WHICH IS THE FAILURE `planDilutions` ALREADY NAMES, arriving through a door its guard does not
 * cover. That guard refuses an EMPTY inventory, after a run that reported *"ORDER THESE (6)"*
 * about six oligos sitting in a freezer drawer. This inventory is not empty — it has 62 samples
 * and no way to look one up — so it sails past the guard and produces the same confident wrong
 * answer about 33 constructs.
 */
import { describe, it, expect } from 'vitest';
import { constructFromLabel, ensureInventory } from '../src/inventory/io.js';
import { findByConstruct } from '../src/inventory/query.js';

const GRID = [
  '>name\t\tTestBox',
  '>plate_type\tplastic_box',
  '',
  '>>label \tA\tB\tC',
  '1\t10uM bo1\t100uM bo1\tpPLASMID-G14',
  '2\t2.66uM bo1\tB. cereus gDNA\t',
  '',
  '>>construct\tA\tB\tC',
  '1\t\t\t',
  '2\t\t\t',
  '',
  '>>concentration\tA\tB\tC',
  '1\t10uM\t100uM\tminiprep',
  '2\t2.66uM\t\t',
].join('\n');

describe('constructFromLabel', () => {
  it('strips a leading concentration token and keeps the name', () => {
    expect(constructFromLabel('10uM bf001')).toBe('bf001');
    expect(constructFromLabel('100uM bet003')).toBe('bet003');
    expect(constructFromLabel('2.66uM oGho17')).toBe('oGho17');
  });

  it('leaves a label that is only a name alone', () => {
    // Names that merely start with a digit, or contain a space, must survive intact: these are
    // real labels from the same box and a greedy parse would eat half of each.
    expect(constructFromLabel('pPTPi-G14')).toBe('pPTPi-G14');
    expect(constructFromLabel('B. cereus gDNA')).toBe('B. cereus gDNA');
    expect(constructFromLabel('Sm-dil')).toBe('Sm-dil');
    expect(constructFromLabel('')).toBe('');
  });
});

describe('a grid inventory with no construct annotations', () => {
  const inv = ensureInventory(GRID, 'TestBox.txt');

  it('is still searchable by the name on the tube', () => {
    expect(findByConstruct(inv, 'bo1').length).toBe(3);
    expect(findByConstruct(inv, 'pPLASMID-G14').length).toBe(1);
  });

  it('keeps the concentrations apart, so a working stock is distinguishable from its stock', () => {
    const conc = findByConstruct(inv, 'bo1').map((s) => s.concentration);
    expect([...conc].sort()).toEqual(['10uM', '100uM', '2.66uM'].sort());
  });

  it('records that the construct was read off the label rather than declared', () => {
    // Derived, not asserted. A tool that cannot tell the difference cannot report it.
    const s = findByConstruct(inv, 'bo1')[0];
    expect(s.metadata.construct_from_label).toBe(true);
  });

  it('does not overwrite a construct the file does declare', () => {
    const declared = GRID.replace('>>construct\tA\tB\tC\n1\t\t\t', '>>construct\tA\tB\tC\n1\tREAL\t\t');
    const inv2 = ensureInventory(declared, 'TestBox.txt');
    expect(findByConstruct(inv2, 'REAL').length).toBe(1);
    expect(findByConstruct(inv2, 'REAL')[0].metadata.construct_from_label).toBeUndefined();
  });
});

/**
 * A well name is a letter and a number, and which axis supplies which is the box's business.
 *
 * This module's canonical format letters its ROWS and numbers its COLUMNS. The Cheese team's
 * inventory does the reverse — columns A..I, rows 1..9 — and the parser was discarding the file's
 * column headers and renumbering them 1..N. So the tube written on the cap as D1 sat at row index
 * 0, column index 3, and `wellName(row, col)` turned that into "A4": a well that exists, holds
 * something else, and looks entirely plausible on a printed labsheet.
 */
describe('well names', () => {
  it('reads a box that letters its columns the way the box does', () => {
    const inv = ensureInventory(GRID, 'TestBox.txt');
    const at = (name) => findByConstruct(inv, name)[0].location.well;
    expect(at('pPLASMID-G14')).toBe('C1');
    expect(at('B. cereus gDNA')).toBe('B2');
  });

  it('reads a box that letters its rows the same way', () => {
    const canonical = [
      '>name\t\tCanon',
      '',
      '>>label\t1\t2\t3',
      'A\tfirst\t\t',
      'B\t\tsecond\t',
    ].join('\n');
    const inv = ensureInventory(canonical, 'Canon.txt');
    expect(findByConstruct(inv, 'first')[0].location.well).toBe('A1');
    expect(findByConstruct(inv, 'second')[0].location.well).toBe('B2');
  });
});

/**
 * A box's own name, and the header line that never parsed.
 *
 * `parseBoxWideFields` split on `:` alone, and the format is tab-separated — so `>name\t\tCheese1`,
 * the first line of every inventory written this way, parsed to nothing. With it went the box's
 * declared name, its location, its plate type and its temperature. Nothing failed: the box fell
 * back to being named after the file. And `ensureInventory` took a filename hint and dropped it on
 * the floor, so the fallback fell back again, to the literal string "BOX".
 *
 * A labsheet that sends somebody to box "BOX" has told them nothing.
 */
describe('box identity', () => {
  it('uses the name the box gives itself', () => {
    const inv = ensureInventory(['>name\t\tCheese1', '', '>>label\tA\tB', '1\tthing\t'].join('\n'),
                                'some-file.txt');
    expect(Object.keys(inv.boxes)).toEqual(['Cheese1']);
    expect(findByConstruct(inv, 'thing')[0].location.boxname).toBe('Cheese1');
  });

  it('falls back to the filename, and only then to a placeholder', () => {
    const noName = ['>plate_type\tplastic_box', '', '>>label\tA\tB', '1\tthing\t'].join('\n');
    expect(Object.keys(ensureInventory(noName, 'Pink Training.txt').boxes)).toEqual(['Pink Training']);
    expect(Object.keys(ensureInventory(noName).boxes)).toEqual(['BOX']);
  });

  it('still reads a colon-separated header', () => {
    const inv = ensureInventory(['>name: Legacy', '', '>>label\tA\tB', '1\tthing\t'].join('\n'));
    expect(Object.keys(inv.boxes)).toEqual(['Legacy']);
  });
});
