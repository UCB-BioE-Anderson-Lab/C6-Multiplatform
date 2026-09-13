/**
 * Planning has no consequences; issuing does.
 *
 * JCA, 2026-09-13: *"The checkpoint system we have said is activated once it is issued to the
 * students by cortex. I think at that point you'd want to put in the holds, and then resolve the
 * holds when the labsheet is returned. That will distinguish a planning phase, where the
 * experiment may be revised many times and should not have consequences, to one where an official
 * plan has been said and the process initiated."*
 */
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { spotsNeeded, issue, resolve, wellAt } from '../../src/labplanner/planning/issue.js';
import {
  createInventory, addBox, upsertSample, isHeld, isOccupied, isAvailable, holds, locKey,
} from '../../src/inventory/inventory.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const fixture = path.join(root, 'test/fixtures/golden');
const packet = JSON.parse(execFileSync('node',
  [path.join(root, 'bin/c6-packet'), fixture, '--inventory', path.join(fixture, 'inventory.txt')],
  { encoding: 'utf8', maxBuffer: 64e6 }));

const BOX = 'gold_box';
const base = (rows = 4, cols = 6) => addBox(createInventory(), { name: BOX, rows, cols });
const needs = (n) => Array.from({ length: n }, (_, i) =>
  ({ sheet: 's7', construct: `pX-${'ABCDEFGH'[i]}`, box: BOX }));
const BY = { by: 'gold/2026-09-13', since: '2026-09-13' };

describe('planning leaves no trace', () => {
  it('the compile writes no inventory at all', () => {
    // Not a property of `issue.js` — a property of the pipeline, asserted here because this is the
    // file that introduces the thing which DOES write, and the contrast is the ruling.
    expect(packet.sheets.some((s) => (s.samples || []).some((r) => 'Box' in r))).toBe(true);
    for (const s of packet.sheets)
      for (const row of s.samples || [])
        if ('Well' in row) expect(String(row.Well), `${s.id} predicted a well`).toBe('');
  });

  it('spotsNeeded reads what will need a home', () => {
    const need = spotsNeeded({ sheets: [{ id: 's7', samples: [
      { label: 'pX-A', Box: 'gold_box', Well: '' },
      { label: 'pX-B', Box: 'gold_box', Well: '' },
    ] }] });
    expect(need).toEqual([
      { sheet: 's7', construct: 'pX-A', box: 'gold_box' },
      { sheet: 's7', construct: 'pX-B', box: 'gold_box' },
    ]);
  });

  // A SHEET THAT NAMES NO BOX ASKS FOR NOTHING, and the golden fixture is exactly that case: its
  // verification chain is injected, so nothing has said `box=` and the sheet carries that as an
  // open decision instead. Issuing it holds nothing, which is the right answer — you cannot
  // reserve a spot in a box nobody has named.
  it('asks for nothing where no box has been named', () => {
    expect(spotsNeeded(packet)).toEqual([]);
    const mp = packet.sheets.find((s) => (s.metadata?.operations || []).includes('miniprep'));
    expect((mp.open || []).join(' ')).toMatch(/which box/);
    expect(spotsNeeded({ sheets: [{ id: 's1', samples: [{ label: 'L3a' }] }] })).toEqual([]);
  });
});

describe('issuing places the holds', () => {
  it('holds a well per tube, and none of them reads as occupied', () => {
    const { inventory, problems } = issue(base(), needs(4), BY);
    expect(problems).toEqual([]);
    expect(holds(inventory)).toHaveLength(4);
    for (const h of holds(inventory)) {
      expect(isHeld(inventory, h.location)).toBe(true);
      expect(isOccupied(inventory, h.location)).toBe(false);
    }
    expect(Object.keys(inventory.samples)).toHaveLength(0);
  });

  it('puts a set in consecutive wells', () => {
    const { assignments } = issue(base(), needs(4), BY);
    expect(assignments.map((a) => a.well)).toEqual(['A1', 'A2', 'A3', 'A4']);
  });

  // A HELD SPOT IS NOT AVAILABLE, which is the whole reason `isAvailable` exists. Two issues the
  // same afternoon must not pick the same well.
  it('a second issue steps over the first one’s holds', () => {
    const first = issue(base(), needs(2), BY).inventory;
    const { assignments } = issue(first, needs(2), { by: 'somebody else' });
    expect(assignments.map((a) => a.well)).toEqual(['A3', 'A4']);
  });

  it('steps over occupied wells too', () => {
    let inv = upsertSample(base(), { construct: 'old', location: { boxname: BOX, row: 0, col: 0 } });
    expect(issue(inv, needs(1), BY).assignments[0].well).toBe('A2');
  });

  it('refuses a box that cannot fit the set, rather than half-placing it', () => {
    const { inventory, problems, assignments } = issue(base(1, 2), needs(4), BY);
    expect(problems[0]).toMatch(/2 free well\(s\) and this needs 4/);
    expect(assignments).toEqual([]);
    expect(holds(inventory)).toHaveLength(0);
  });

  it('reports a box that is not in the inventory', () => {
    const { problems } = issue(base(), [{ sheet: 's', construct: 'pX', box: 'nowhere' }], BY);
    expect(problems[0]).toMatch(/no box named "nowhere"/);
  });

  it('will not issue anonymously', () => {
    expect(() => issue(base(), needs(1), {})).toThrow(/needs an owner/);
  });
});

describe('returning resolves them', () => {
  const issued = () => issue(base(), needs(3), BY);

  it('turns a hold into a sample where the tube went where we expected', () => {
    const { inventory, assignments } = issued();
    const r = resolve(inventory, assignments, { 'pX-A': 'A1', 'pX-B': 'A2', 'pX-C': 'A3' });
    expect(r.problems).toEqual([]);
    expect(holds(r.inventory)).toHaveLength(0);
    expect(Object.keys(r.inventory.samples)).toHaveLength(3);
    expect(r.placed.every((p) => p.asExpected)).toBe(true);
  });

  // THE COMMON CASE. The student was standing at the freezer and we were not.
  it('follows the sheet when the tube went somewhere else, and lets the held well go', () => {
    const { inventory, assignments } = issued();
    const r = resolve(inventory, assignments, { 'pX-A': 'C5', 'pX-B': 'A2', 'pX-C': 'A3' });
    expect(r.problems).toEqual([]);
    expect(isOccupied(r.inventory, { boxname: BOX, row: 2, col: 4 })).toBe(true);
    expect(isAvailable(r.inventory, { boxname: BOX, row: 0, col: 0 })).toBe(true);
    expect(r.placed.find((p) => p.construct === 'pX-A').asExpected).toBe(false);
  });

  // AN ABORTED EXPERIMENT LEAVES NO TRACE IN THE FREEZER.
  it('releases a hold for a tube nobody made, and records nothing', () => {
    const { inventory, assignments } = issued();
    const r = resolve(inventory, assignments, { 'pX-A': 'A1' });
    expect(Object.keys(r.inventory.samples)).toHaveLength(1);
    expect(holds(r.inventory)).toHaveLength(0);
    expect(r.released.map((x) => x.construct)).toEqual(['pX-B', 'pX-C']);
  });

  it('leaves nothing held even when the sheet is unreadable', () => {
    const { inventory, assignments } = issued();
    const r = resolve(inventory, assignments, { 'pX-A': 'not a well' });
    expect(r.problems[0]).toMatch(/is not a well name/);
    expect(holds(r.inventory)).toHaveLength(0);
    expect(Object.keys(r.inventory.samples)).toHaveLength(0);
  });

  // TWO TUBES CANNOT BE IN ONE WELL, and the inventory disagreeing with the freezer is what this
  // whole mechanism exists to prevent — so it is reported rather than settled by the last write.
  it('refuses to overwrite a different construct, and says so', () => {
    let { inventory, assignments } = issued();
    inventory = upsertSample(inventory, { construct: 'somebody else’s',
                                          location: { boxname: BOX, row: 3, col: 5 } });
    const r = resolve(inventory, assignments, { 'pX-A': 'D6' });
    expect(r.problems[0]).toMatch(/already has somebody else/);
    expect(r.inventory.samples[locKey({ boxname: BOX, row: 3, col: 5 })].construct)
      .toBe('somebody else’s');
  });
});

describe('wellAt', () => {
  it('reads what a person writes on a box', () => {
    expect(wellAt('A1')).toEqual({ row: 0, col: 0 });
    expect(wellAt('D6')).toEqual({ row: 3, col: 5 });
    expect(wellAt('c12')).toEqual({ row: 2, col: 11 });
    for (const bad of ['', 'AA1', '1A', 'A', 'hello']) expect(wellAt(bad)).toBe(null);
  });
});
