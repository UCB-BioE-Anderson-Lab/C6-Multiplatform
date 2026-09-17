/**
 * The evidence behind every answered claim is still the evidence that was answered.
 *
 * JCA's plan, 2026-09-16: *"...and then we convert the report into golden fixtures."* This is that.
 * Forty-eight sentences have been read and ruled on; until this existed, nothing failed when the
 * thing behind one of them changed.
 *
 * **A PACKET SNAPSHOT AND THIS ONE ARE NOT THE SAME CHECK.** `test/fixtures/golden/SNAPSHOT.txt`
 * freezes one experiment completely, which catches anything that moves in it and nothing that
 * happens in the other twenty-eight runs. This freezes the specific thing a person agreed to,
 * across all of them, and a failure names the agreement rather than the line.
 *
 * **WHEN THIS FAILS, READ THE DIFF BEFORE RE-RECORDING:**
 *
 *     node bin/c6-claims --write
 *
 * A snapshot updated without being read has stopped being a check. The whole point of the date in
 * each block is that the question is not "did something move" but "does JCA still agree".
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { snapshot } from '../../src/labplanner/scenarios/evidence.js';
import { CLAIMS, RULED } from '../../src/labplanner/scenarios/claims.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const FIXTURE = path.join(root, 'test/fixtures/claims/SNAPSHOT.txt');

describe('the claims snapshot', () => {
  it('matches what the claims say today', () => {
    const got = snapshot();
    const want = fs.readFileSync(FIXTURE, 'utf8');
    // BLOCK BY BLOCK, so a failure names the claim instead of printing four hundred lines. The
    // whole-file comparison below still runs, to catch a block appearing or disappearing.
    const blocks = (t) => new Map(t.split(/\n(?=## )/).filter(Boolean)
      .map((b) => [b.split('\n')[0].replace(/^## \d+\s+/, ''), b]));
    const a = blocks(want);
    const b = blocks(got);
    for (const [id, block] of a) {
      expect(b.get(id), `claim "${id}" is gone from the page but its evidence was recorded`)
        .toBeDefined();
      expect(b.get(id), `the evidence for claim "${id}" has changed. It was ruled on — see the `
        + 'date in the block — so the question is whether that ruling still holds, not whether a '
        + 'line moved. `node bin/c6-claims --write` once you have read it.').toBe(block);
    }
    expect([...b.keys()], 'a claim was added or removed').toEqual([...a.keys()]);
    expect(got).toBe(want);
  }, 120_000);

  // A CLAIM NOBODY HAS ANSWERED IS NOT A GOLDEN FIXTURE, it is a question waiting. It may sit in
  // the file — the snapshot records every claim — but it is recorded as unanswered, and this says
  // how many there are so the count cannot drift unnoticed.
  it('records which claims carry a ruling', () => {
    const text = fs.readFileSync(FIXTURE, 'utf8');
    expect((text.match(/^ruled: true,/gm) || []).length).toBe(RULED.size);
    expect((text.match(/^## /gm) || []).length).toBe(CLAIMS.length);
  });

  // EVERY RULING NAMES A CLAIM THAT EXISTS. A ruling left behind by a renamed claim is a yes
  // recorded against nothing, and the page would quietly show the claim as needing an answer.
  it('has no ruling for a claim that is gone', () => {
    const ids = new Set(CLAIMS.map((c) => c.id));
    expect([...RULED.keys()].filter((k) => !ids.has(k))).toEqual([]);
  });
});
