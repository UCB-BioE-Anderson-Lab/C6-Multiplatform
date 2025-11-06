import { describe, it, expect } from 'vitest';

import {
  createInventory,
  cloneInventory,
  addBox,
  removeBox,
  upsertSample,
  removeSample,
  moveSample,
  inBounds,
  isOccupied
} from '../../src/inventory/inventory.js';

import {
  validateBox,
  validatePosition,
  assignNext,
  assignBatch,
  wellName,
  fromWellName
} from '../../src/inventory/manage.js';

import {
  findByConstruct,
  choosePCRInputs
} from '../../src/inventory/query.js';

import {
  toJSON,
  fromJSON,
  serializeGrid,
  parseGridFile,
  ensureInventory,
  inventoryTo,
  parse,
  parseTabular,
  toTabular,
  inventoryFrom
} from '../../src/inventory/io.js';

// ---------- helpers ----------
function seedBasic() {
  let inv = createInventory();
  inv = addBox(inv, { name: 'SRC', rows: 8, cols: 12 });
  inv = addBox(inv, { name: 'DEST', rows: 8, cols: 12 });
  inv = upsertSample(inv, {
    construct: 'Fwd', type: 'oligo', concentration: '10 uM',
    location: { boxname: 'SRC', row: 0, col: 0, label: 'FWD-10uM', sidelabel: '' }
  });
  inv = upsertSample(inv, {
    construct: 'Rev', type: 'oligo', concentration: '10 uM',
    location: { boxname: 'SRC', row: 0, col: 1, label: 'REV-10uM', sidelabel: '' }
  });
  inv = upsertSample(inv, {
    construct: 'Template', type: 'plasmid', culture: 'primary',
    location: { boxname: 'SRC', row: 1, col: 0, label: 'TMP-prim', sidelabel: '' }
  });
  return inv;
}

// ---------- inventory model ----------

describe('inventory model', () => {
  it('createInventory returns empty maps', () => {
    const inv = createInventory();
    expect(Object.keys(inv.boxes)).toHaveLength(0);
    expect(Object.keys(inv.samples)).toHaveLength(0);
    expect(Object.keys(inv.construct_to_locations)).toHaveLength(0);
  });

  it('addBox and inBounds / isOccupied', () => {
    let inv = createInventory();
    inv = addBox(inv, { name: 'BOX', rows: 2, cols: 3 });
    expect(inBounds(inv, { boxname: 'BOX', row: 1, col: 2 })).toBe(true);
    expect(inBounds(inv, { boxname: 'BOX', row: 2, col: 0 })).toBe(false);
    expect(isOccupied(inv, { boxname: 'BOX', row: 0, col: 0 })).toBe(false);
  });

  it('upsertSample updates indices, immutably', () => {
    const inv0 = addBox(createInventory(), { name: 'B', rows: 2, cols: 2 });
    const inv1 = upsertSample(inv0, {
      construct: 'Foo', type: 'oligo', concentration: '10 uM',
      location: { boxname: 'B', row: 0, col: 0, label: 'F', sidelabel: '' }
    });
    expect(inv1).not.toBe(inv0);
    expect(isOccupied(inv0, { boxname: 'B', row: 0, col: 0 })).toBe(false);
    expect(isOccupied(inv1, { boxname: 'B', row: 0, col: 0 })).toBe(true);
    expect(findByConstruct(inv1, 'Foo')).toHaveLength(1);
  });

  it('removeSample and removeBox clean up indices', () => {
    let inv = addBox(createInventory(), { name: 'B', rows: 2, cols: 2 });
    inv = upsertSample(inv, {
      construct: 'Bar', type: 'plasmid', culture: 'primary',
      location: { boxname: 'B', row: 0, col: 0, label: 'P', sidelabel: '' }
    });
    inv = removeSample(inv, { boxname: 'B', row: 0, col: 0 });
    expect(findByConstruct(inv, 'Bar')).toHaveLength(0);

    inv = upsertSample(inv, {
      construct: 'Baz', type: 'oligo', concentration: '10 uM',
      location: { boxname: 'B', row: 1, col: 1, label: 'Z', sidelabel: '' }
    });
    inv = removeBox(inv, 'B');
    expect(Object.keys(inv.boxes)).toHaveLength(0);
    expect(Object.keys(inv.samples)).toHaveLength(0);
  });

  it('moveSample preserves indices', () => {
    let inv = addBox(createInventory(), { name: 'B', rows: 2, cols: 2 });
    inv = upsertSample(inv, {
      construct: 'MoveMe', type: 'oligo', concentration: '10 uM',
      location: { boxname: 'B', row: 0, col: 0, label: 'M', sidelabel: '' }
    });
    inv = moveSample(inv, { boxname: 'B', row: 0, col: 0 }, { boxname: 'B', row: 1, col: 1, label: 'M2', sidelabel: '' });
    expect(findByConstruct(inv, 'MoveMe')).toHaveLength(1);
    const s = findByConstruct(inv, 'MoveMe')[0];
    expect(s.location.row).toBe(1);
    expect(s.location.col).toBe(1);
  });
});

// ---------- manage (placement / validation) ----------

describe('manage placement', () => {
  it('validateBox and validatePosition', () => {
    let inv = addBox(createInventory(), { name: 'B', rows: 1, cols: 2 });
    expect(validateBox(inv, 'B').ok).toBe(true);
    expect(validateBox(inv, 'X').ok).toBe(false);

    const ok = validatePosition(inv, { boxname: 'B', row: 0, col: 1, label: '', sidelabel: '' });
    expect(ok.ok).toBe(true);

    const bad = validatePosition(inv, { boxname: 'B', row: 0, col: 2, label: '', sidelabel: '' });
    expect(bad.ok).toBe(false);
  });

  it('assignNext places sequentially and respects occupancy', () => {
    let inv = addBox(createInventory(), { name: 'B', rows: 1, cols: 3 });
    const a = assignNext(inv, 'B', { construct: 'X' });
    inv = a.inventory;
    const b = assignNext(inv, 'B', { construct: 'Y' });
    inv = b.inventory;
    expect(a.location.col).toBe(0);
    expect(b.location.col).toBe(1);
  });

  it('assignBatch places an array of samples', () => {
    let inv = addBox(createInventory(), { name: 'B', rows: 1, cols: 3 });
    const res = assignBatch(inv, 'B', [
      { construct: 'A' },
      { construct: 'B' },
      { construct: 'C' }
    ]);
    expect(findByConstruct(res.inventory, 'A')).toHaveLength(1);
    expect(findByConstruct(res.inventory, 'C')).toHaveLength(1);
  });

  it('wellName and fromWellName round-trip', () => {
    expect(wellName(0, 0)).toBe('A1');
    expect(fromWellName('B7')).toEqual({ row: 1, col: 6 });
  });
});

// ---------- query (selection / constraints) ----------

describe('query selectors', () => {
  it('choosePCRInputs succeeds with 10 uM oligos', () => {
    const inv = seedBasic();
    const out = choosePCRInputs(inv, { forwardName: 'Fwd', reverseName: 'Rev', templateName: 'Template' }, { min_uM: 10 });
    expect(out.problems).toEqual([]);
    expect(out.forward.best.sample.construct).toBe('Fwd');
    expect(out.reverse.best.sample.construct).toBe('Rev');
    expect(out.template.best.sample.construct).toBe('Template');
  });

  it('choosePCRInputs flags insufficient oligo concentration', () => {
    let inv = createInventory();
    inv = addBox(inv, { name: 'SRC', rows: 8, cols: 12 });
    inv = upsertSample(inv, {
      construct: 'Fwd', type: 'oligo', concentration: '2.66 uM',
      location: { boxname: 'SRC', row: 0, col: 0, label: 'Fwd-2.66', sidelabel: '' }
    });
    inv = upsertSample(inv, {
      construct: 'Rev', type: 'oligo', concentration: '2.66 uM',
      location: { boxname: 'SRC', row: 0, col: 1, label: 'Rev-2.66', sidelabel: '' }
    });
    inv = upsertSample(inv, {
      construct: 'Template', type: 'plasmid', culture: 'primary',
      location: { boxname: 'SRC', row: 1, col: 0, label: 'Tmp', sidelabel: '' }
    });
    const out = choosePCRInputs(inv, { forwardName: 'Fwd', reverseName: 'Rev', templateName: 'Template' }, { min_uM: 10 });
    expect(out.problems.some(p => p.includes('forward'))).toBe(true);
    expect(out.problems.some(p => p.includes('reverse'))).toBe(true);
  });
});

// ---------- io (roundtrip) ----------

describe('io roundtrip', () => {
  it('JSON roundtrip via toJSON/fromJSON', () => {
    const inv = seedBasic();
    const json = toJSON(inv);
    const back = fromJSON(json);
    // spot-check by query rather than deep-eq (because of Set semantics)
    expect(findByConstruct(back, 'Fwd')).toHaveLength(1);
    expect(findByConstruct(back, 'Template')).toHaveLength(1);
  });

  it('TSV roundtrip via serializeGrid/parseGridFile', () => {
    let inv = createInventory();
    inv = addBox(inv, { name: 'B', rows: 2, cols: 3 });
    inv = upsertSample(inv, {
      construct: 'X', type: 'oligo', concentration: '10 uM',
      location: { boxname: 'B', row: 0, col: 0, label: 'X-10', sidelabel: '' }
    });
    const tsv = serializeGrid(inv, 'B');
    const back = parseGridFile('B.tsv', tsv);
    expect(findByConstruct(back, 'X')).toHaveLength(1);
  });

  it('Tabular roundtrip via toTabular/parse (CSV/TSV agnostic)', () => {
    const inv = seedBasic();
    const tab = toTabular(inv);
    const back = parse(tab);
    expect(findByConstruct(back, 'Fwd')).toHaveLength(1);
    expect(findByConstruct(back, 'Rev')).toHaveLength(1);
    expect(findByConstruct(back, 'Template')).toHaveLength(1);
  });

  it('ensureInventory/parse accept object, JSON, grid layout, and tabular', () => {
    const inv0 = seedBasic();
    const json = toJSON(inv0);
    const grid = serializeGrid(inv0, 'SRC');
    const tab = toTabular(inv0);

    const A = ensureInventory(inv0);
    const B = ensureInventory(json);
    const C = ensureInventory(grid, 'SRC.tsv');
    const D = ensureInventory(tab);
    const E = parse(tab); // unified entry point

    expect(findByConstruct(A, 'Fwd')).toHaveLength(1);
    expect(findByConstruct(B, 'Rev')).toHaveLength(1);
    expect(findByConstruct(C, 'Template')).toHaveLength(1);
    expect(findByConstruct(D, 'Template')).toHaveLength(1);
    expect(findByConstruct(E, 'Fwd')).toHaveLength(1);

    // inventoryTo convenience
    expect(() => inventoryTo(A, 'json')).not.toThrow();
    expect(() => inventoryTo(A, 'tsv')).not.toThrow();
  });

  it('inventoryFrom honors explicit format overrides', () => {
    const inv0 = seedBasic();
    const json = toJSON(inv0);
    const grid = serializeGrid(inv0, 'SRC');
    const tab = toTabular(inv0);

    const J = inventoryFrom(json, 'json');
    const G = inventoryFrom(grid, 'grid');
    const T = inventoryFrom(tab, 'tabular');
    expect(findByConstruct(J, 'Fwd')).toHaveLength(1);
    expect(findByConstruct(G, 'Rev')).toHaveLength(1);
    expect(findByConstruct(T, 'Template')).toHaveLength(1);
  });
});
