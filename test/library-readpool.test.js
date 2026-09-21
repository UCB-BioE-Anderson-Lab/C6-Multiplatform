import { describe, it, expect } from 'vitest';
import { readPool, isPoolFile } from 'src/library/readPool.js';
import { projectSequences } from 'src/labplanner/planning/projectSequences.js';
import fs from 'fs';

const FIX = 'test/fixtures/pool/Demo.gb';

describe('a pool file is a pool because it says so', () => {
  it('recognises one by its qualifiers, not by containing N', () => {
    expect(isPoolFile(fs.readFileSync(FIX, 'utf8'))).toBe(true);
  });

  it('does not mistake an ordinary map with a stray N for a library', () => {
    // A bad read leaves N in plenty of real maps. Inventing slots from that would fabricate both
    // variable regions and a membership nobody declared.
    expect(isPoolFile('LOCUS x\nORIGIN\n  1 ATGCNATGC\n//')).toBe(false);
  });
});

describe('reading Demo.gb', () => {
  const p = () => readPool(FIX);

  it('takes its name from the file and its slots in order', () => {
    expect(p().name).toBe('Demo');
    expect(p().slots.map((s) => s.name)).toEqual(['alpha', 'beta']);
  });

  it('converts 1-based GenBank locations to slots that land on their own n-runs', () => {
    for (const s of p().slots) {
      expect(p().sequence.slice(s.start, s.end)).toBe('N'.repeat(s.end - s.start));
    }
  });

  it('builds each bin from its column(s), joining several with +', () => {
    const [alpha, beta] = p().slots;
    expect(alpha.bin).toEqual(['AAAACCCC', 'GGGGTTTT']);   // deduplicated
    expect(beta.bin).toEqual(['ACGT', 'TTAA']);            // b1 + b2
  });

  it('carries the declared length range, not the n-run length', () => {
    expect(p().slots[0].lengths).toEqual([6, 10]);
    expect(p().slots[0].end - p().slots[0].start).toBe(8);
  });

  it('keeps the member rows as occupancy', () => {
    expect(p().occupancy.rows).toHaveLength(3);
    expect(p().occupancy.source).toBe('Demo_members.tsv');
  });
});

describe('a broken pool is not a missing one', () => {
  it('names the columns it actually has when a bin points at nothing', () => {
    const bad = 'test/fixtures/pool/Bad.gb';
    fs.writeFileSync(bad, fs.readFileSync(FIX, 'utf8').replace('/pool_bin="a"', '/pool_bin="nope"'));
    expect(() => readPool(bad)).toThrow(/does not have. Its columns are: a, b1, b2/);
    fs.unlinkSync(bad);
  });

  it('refuses when the members table is absent rather than reporting an empty pool', () => {
    const bad = 'test/fixtures/pool/Orphan.gb';
    fs.writeFileSync(bad, fs.readFileSync(FIX, 'utf8').replace(/Demo_members\.tsv/g, 'gone.tsv'));
    expect(() => readPool(bad)).toThrow(/is not there/);
    fs.unlinkSync(bad);
  });
});

describe('the project scan finds pools beside plasmids and oligos', () => {
  it('resolves the pool by name, so a construction file needs no new syntax', () => {
    const seqs = projectSequences('test/fixtures/pool');
    expect(seqs.pools.Demo).toBeDefined();
    expect(seqs.plasmids.Demo).toBe(seqs.pools.Demo.sequence);
  });
});
