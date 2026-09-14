/**
 * A hold says *keep this spot free*. It never says a tube is there.
 *
 * JCA, 2026-09-13, in two steps. First on when the inventory is written:
 *
 * > *"That happens after the students send back the labsheet. That is when you learn about the
 * > real locations of things. What we have now is a tentative plan. The inventory we store should
 * > reflect reality, not a prediction of future reality. Cause sometimes labsheets get aborted, or
 * > just take years to finish."*
 *
 * then, correcting an over-reading of it:
 *
 * > *"It might be good to put a hold on spots in the inventory — I think that is fine. Just don't
 * > say things are in there that aren't there."*
 *
 * The whole feature is that distinction, and every test here is a way of getting it wrong.
 */
import { describe, it, expect } from 'vitest';
import {
  createInventory, addBox, upsertSample, getSample, mapSamples, filterSamples,
  isOccupied, isHeld, isAvailable, hold, release, holdAt, holds,
} from '../../src/inventory/inventory.js';
import { toTabular, holdsDocument, parseTabular, mergeInventories } from '../../src/inventory/io.js';

const BOX = { name: 'cheese_temp', rows: 9, cols: 9 };
const at = (row, col) => ({ boxname: BOX.name, row, col });
const base = () => addBox(createInventory(), BOX);
const claim = { by: 'Lactis3/s7-miniprep', why: 'pBET8-A', since: '2026-09-13' };

describe('a hold is not a sample', () => {
  it('does not appear as one', () => {
    const inv = hold(base(), at(0, 0), claim);
    expect(isHeld(inv, at(0, 0))).toBe(true);
    expect(isOccupied(inv, at(0, 0))).toBe(false);
    expect(Object.keys(inv.samples)).toHaveLength(0);
  });

  // EVERY READER OF `samples`, not just the obvious one. Holds live in their own map precisely so
  // that a reader which has never heard of them cannot report a tube that does not exist — this
  // is the assertion that the separation actually achieved that.
  it('is invisible to every way of reading samples', () => {
    const inv = hold(base(), at(0, 0), claim);
    expect(getSample ? getSample(inv, at(0, 0)) : undefined).toBeFalsy();
    if (mapSamples) expect(Object.keys(mapSamples(inv, (s) => s).samples)).toHaveLength(0);
    if (filterSamples) expect(Object.keys(filterSamples(inv, () => true).samples)).toHaveLength(0);
    expect(Object.values(inv.construct_to_locations || {}).flatMap((v) => [...v])).toHaveLength(0);
  });

  it('makes a spot unavailable without making it occupied', () => {
    const inv = hold(base(), at(1, 1), claim);
    expect(isAvailable(inv, at(1, 1))).toBe(false);
    expect(isOccupied(inv, at(1, 1))).toBe(false);
    expect(isAvailable(inv, at(1, 2))).toBe(true);
  });
});

describe('what a hold refuses', () => {
  it('an owner it cannot name', () => {
    expect(() => hold(base(), at(0, 0), {})).toThrow(/needs an owner/);
    expect(() => hold(base(), at(0, 0), { why: 'something' })).toThrow(/needs an owner/);
  });

  // A hold on an occupied well is not a weaker claim, it is a contradiction — and the one thing a
  // hold must never do is imply anything about what is there.
  it('a spot that already has a tube in it', () => {
    let inv = upsertSample(base(), { construct: 'pBET8-A', location: at(0, 0) });
    expect(() => hold(inv, at(0, 0), claim)).toThrow(/already a tube here/);
  });

  it('a second owner for one spot', () => {
    const inv = hold(base(), at(0, 0), claim);
    expect(() => hold(inv, at(0, 0), { by: 'somebody else' })).toThrow(/already held by/);
    // The same owner re-holding is fine: the point is the end state, not the number of calls.
    expect(() => hold(inv, at(0, 0), claim)).not.toThrow();
  });
});

describe('letting go', () => {
  it('releases, and releasing nothing is not an error', () => {
    let inv = hold(base(), at(0, 0), claim);
    inv = release(inv, at(0, 0));
    expect(isHeld(inv, at(0, 0))).toBe(false);
    expect(() => release(inv, at(5, 5))).not.toThrow();
  });

  // THE FAILURE MODE OF THIS FEATURE IS A STALE HOLD. Experiments are abandoned and experiments
  // take years; a hold that outlives its reason is a well nobody can use and nobody can account
  // for. `by` and `since` are required so they can be found and let go.
  it('lists holds oldest first, with who and when', () => {
    let inv = hold(base(), at(0, 0), { by: 'old', since: '2024-01-01' });
    inv = hold(inv, at(0, 1), { by: 'new', since: '2026-09-13' });
    const all = holds(inv);
    expect(all.map((h) => h.by)).toEqual(['old', 'new']);
    expect(holdAt(inv, at(0, 0)).since).toBe('2024-01-01');
  });
});

describe('it survives being written down', () => {
  it('round-trips through its own document', () => {
    // `toTabular` writes SAMPLES. Holds have their own document — see `holdsDocument`, and the
    // comment in `toTabular` saying why it no longer writes them.
    let inv = upsertSample(base(), { construct: 'pBET8-A', location: at(0, 0) });
    inv = hold(inv, at(0, 1), claim);
    // Two documents, parsed separately and merged — which is how the tools read an inventory
    // directory. Concatenating them would give two header lines and read the second as data.
    const back = mergeInventories(parseTabular(toTabular(inv)), parseTabular(holdsDocument(inv)));
    expect(Object.keys(back.samples)).toHaveLength(1);
    expect(isHeld(back, at(0, 1))).toBe(true);
    expect(holdAt(back, at(0, 1)).by).toBe(claim.by);
  });

  // THE ROW A CARELESS READER SEES. It carries no construct and says `held` in a column of its
  // own, so a person scanning the file in a spreadsheet and a parser that has never heard of
  // holds both come to the same conclusion: there is nothing in that well.
  it('writes a held row with no construct on it', () => {
    const text = holdsDocument(hold(base(), at(0, 1), claim));
    // The document opens with comments explaining what a hold is NOT, so the header is not line 0.
    const [header, ...body] = text.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
    const head = header.split('\t');
    const line = body.find((l) => l.split('\t')[head.indexOf('status')] === 'held');
    expect(line, 'no held row was written').toBeTruthy();
    const cols = line.split('\t');
    expect(cols[head.indexOf('construct')]).toBe('');
    expect(cols[head.indexOf('status')]).toBe('held');
    expect(cols[head.indexOf('held-by')]).toBe(claim.by);
  });
});

describe('holds survive being read back through a merge', () => {
  // **THE WHOLE MECHANISM WAS INERT FOR A DAY.** `mergeInventories` carried samples and boxes and
  // silently dropped `holds` — and every tool reads `--inventory <dir>`, merging the files, so the
  // holds parsed out of `holds.tsv` were thrown away one line later. `isAvailable` never saw one,
  // and two experiments issued the same afternoon took the same wells, with the file on disk
  // saying otherwise.
  const A = () => hold(base(), at(0, 0), { by: 'first', why: 'pX-A', since: '2026-09-13' });
  const B = () => hold(base(), at(0, 1), { by: 'second', why: 'pX-B', since: '2026-09-13' });

  it('a merge keeps both sides’ holds', () => {
    const merged = mergeInventories(A(), B());
    expect(Object.keys(merged.holds)).toHaveLength(2);
    expect(isHeld(merged, at(0, 0))).toBe(true);
    expect(isHeld(merged, at(0, 1))).toBe(true);
  });

  // A TUBE BEATS A RESERVATION: the hold said *keep this free* and somebody has since put
  // something there, so it is answered rather than contradicted.
  it('a sample on the same well wins, and the hold goes', () => {
    const withTube = upsertSample(base(), { construct: 'pOLD', location: at(0, 0) });
    const merged = mergeInventories(A(), withTube);
    expect(isOccupied(merged, at(0, 0))).toBe(true);
    expect(isHeld(merged, at(0, 0))).toBe(false);
  });

  // Without this the hold could not be matched to what it was for, so re-issuing an experiment
  // could not recognise its own holds. `held-for` is NOT `construct`: nothing is in the well.
  it('the file says what each hold is for, in its own column', () => {
    const text = holdsDocument(A());
    const [header, ...body] = text.split('\n').filter((l) => l.trim() && !l.startsWith('#'));
    const head = header.split('\t');
    const row = body.find((l) => l.split('\t')[head.indexOf('status')] === 'held').split('\t');
    expect(row[head.indexOf('held-for')]).toBe('pX-A');
    expect(row[head.indexOf('construct')]).toBe('');
    expect(holdAt(parseTabular(text), at(0, 0)).why).toBe('pX-A');
  });
});
