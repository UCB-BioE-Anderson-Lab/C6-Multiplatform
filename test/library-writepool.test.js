import { describe, it, expect } from 'vitest';
import { writePool } from 'src/library/writePool.js';
import { readPool } from 'src/library/readPool.js';
import { dsDNA } from 'src/C6-Seq.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * §4.2 — a pool written out and read back must be the same pool.
 *
 * ROUND-TRIPPING IS THE WHOLE TEST. A writer checked only by eye produces a file that looks like
 * GenBank and loses a slot boundary by one base, and nothing notices until a labsheet quotes a
 * size that is right for no member. Reading it back with the reader that real code uses is the
 * only check that covers the format and both halves at once.
 */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'c6-writepool-'));
const MEMBERS = path.join(TMP, 'members.tsv');
fs.writeFileSync(MEMBERS, 'set\tcas\tix\narnold\tAAAACCCC\tGGGG\narnold\tTTTTGGGG\tGGGG\n'
                        + 'utract\tCCCCAAAA\tTTTT\nutract\tGGGGTTTT\tTTTT\n');

function pool({ refined = null } = {}) {
  const p = dsDNA('ATGCATGCAT' + 'N'.repeat(8) + 'CCCCGGGG' + 'N'.repeat(4) + 'TTTTAAAA');
  p.isCircular = true;
  p.slots = [{ name: 'cassette', start: 10, end: 18, lengths: [8, 8], cols: ['cas'],
               bin: ['AAAACCCC', 'TTTTGGGG', 'CCCCAAAA', 'GGGGTTTT'] },
             { name: 'index', start: 26, end: 30, lengths: [4, 4], cols: ['ix'],
               bin: ['GGGG', 'TTTT'] }];
  const rows = [{ set: 'arnold', cas: 'AAAACCCC', ix: 'GGGG' }, { set: 'arnold', cas: 'TTTTGGGG', ix: 'GGGG' },
                { set: 'utract', cas: 'CCCCAAAA', ix: 'TTTT' }, { set: 'utract', cas: 'GGGGTTTT', ix: 'TTTT' }];
  p.occupancy = { source: 'members.tsv', rows, ...(refined ? { refined } : {}) };
  return p;
}

const roundTrip = (p, name) => {
  const f = path.join(TMP, `${name}.gb`);
  fs.writeFileSync(f, writePool(p, { name, members: 'members.tsv' }));
  return { back: readPool(f), text: fs.readFileSync(f, 'utf8') };
};

describe('a pool survives being written and read back', () => {
  const { back } = roundTrip(pool(), 'Demo');

  it('keeps the sequence, case aside', () => {
    expect(back.sequence).toBe(pool().sequence.toUpperCase());
  });

  it('keeps every slot at exactly the same coordinates', () => {
    expect(back.slots.map((s) => [s.name, s.start, s.end]))
      .toEqual([['cassette', 10, 18], ['index', 26, 30]]);
  });

  it('keeps the declared length ranges, which the n-run length does not carry', () => {
    expect(back.slots.map((s) => s.lengths)).toEqual([[8, 8], [4, 4]]);
  });

  it('rebuilds each bin from the members table rather than copying it', () => {
    expect(back.slots[0].bin.sort()).toEqual(['AAAACCCC', 'CCCCAAAA', 'GGGGTTTT', 'TTTTGGGG']);
    expect(back.slots[1].bin.sort()).toEqual(['GGGG', 'TTTT']);
  });

  it('keeps all four members', () => expect(back.occupancy.rows).toHaveLength(4));
  it('keeps the topology', () => expect(back.isCircular).toBe(true));
});

describe('a narrowed pool records the narrowing, it does not fork the table', () => {
  const { back, text } = roundTrip(pool({ refined: [{ slot: 'index', value: 'GGGG' }] }), 'DemoA');

  it('writes a filter rather than a second members table', () => {
    expect(text).toContain('/pool_filter="index=GGGG"');
    expect(text).toContain('/pool_members="members.tsv"');   // still the original
    expect(fs.readdirSync(TMP).filter((f) => f.endsWith('.tsv'))).toHaveLength(1);
  });

  it('reads back only the members the filter selects', () => {
    expect(back.occupancy.rows).toHaveLength(2);
    expect(back.occupancy.rows.every((r) => r.ix === 'GGGG')).toBe(true);
  });

  it('narrows the OTHER slot"s bin with it — those two members, not all four', () => {
    expect(back.slots[0].bin.sort()).toEqual(['AAAACCCC', 'TTTTGGGG']);
  });
});

describe('it refuses to write a library that is not one', () => {
  it('will not dress an ordinary molecule as a pool', () => {
    expect(() => writePool(dsDNA('ATGCATGC'), { name: 'plain' }))
      .toThrow(/would claim a library that does not exist/);
  });
});

describe('the file is ordinary GenBank', () => {
  const { text } = roundTrip(pool(), 'Demo2');
  it('is written by C6\'s own serialiser, so ApE opens it coloured', () => {
    // The first version of writePool emitted its own GenBank with /label and /note and nothing
    // else. A second serialiser in one toolkit is how two conventions appear, and only one of them
    // is the one people's existing maps follow.
    expect(text).toMatch(/LOCUS .* circular/);
    expect(text).toMatch(/\/ApEinfo_fwdcolor="/);
    expect(text).toMatch(/\/ApEinfo_revcolor="/);
  });

  it('gives the variable regions their own colour, so they are visible without reading labels', () => {
    const slotBlock = text.slice(text.indexOf('/pool_slot="cassette"'));
    expect(slotBlock).toMatch(/ApEinfo_fwdcolor="#ffd24d"/);
  });

  it('says what the length it shows actually is, and what it is for', () => {
    expect(text).toMatch(/each/);
    expect(text).toMatch(/right for almost no single/);
    // The rounding caveat is not decoration: three of Tlib3's seven product maps differ from the
    // true mean by a base for exactly this reason.
    expect(text).toMatch(/rounding each slot/);
  });
});
