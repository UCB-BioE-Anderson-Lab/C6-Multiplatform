import { describe, it, expect } from 'vitest';
import { sliceLocation, mineFeatures, dedupeFeatures, toApeLibrary, fromApeLibrary }
  from 'src/features/mine.js';

const gb = (seq, feats, circular = true) =>
  `LOCUS       test                    ${seq.length} bp    DNA     ${circular ? 'circular' : 'linear'}\n` +
  `FEATURES             Location/Qualifiers\n` + feats +
  `ORIGIN\n        1 ${seq.toLowerCase()}\n//\n`;

describe('sliceLocation', () => {
  const s = 'AAAACCCCGGGGTTTT';
  it('reads a plain range, 1-based and inclusive', () => {
    expect(sliceLocation(s, '5..8')).toBe('CCCC');
  });
  it('reverse-complements a complement()', () => {
    expect(sliceLocation(s, 'complement(1..4)')).toBe('TTTT');
  });
  it('concatenates a join()', () => {
    expect(sliceLocation(s, 'join(1..4,13..16)')).toBe('AAAATTTT');
  });
  it('tolerates the < and > partial markers', () => {
    expect(sliceLocation(s, '<5..>8')).toBe('CCCC');
  });

  // Six of Cheese's features were lost to this, including `slp` — the S-layer protein that
  // pTRKH3-slpGFP is named after. complement(9854..298) starts near the end, runs off it, and
  // continues from base 1. It is not backwards and it is not corrupt.
  it('WRAPS an origin-spanning range on a circular sequence', () => {
    expect(sliceLocation(s, '13..4', true)).toBe('TTTTAAAA');
  });
  it('…and refuses the same range on a LINEAR sequence, where it means nothing', () => {
    expect(sliceLocation(s, '13..4', false)).toBeNull();
  });

  it('returns null rather than a guess when it cannot read the location', () => {
    expect(sliceLocation(s, 'J00194.1:1..10')).toBeNull();
    expect(sliceLocation(s, '5..999')).toBeNull();
    expect(sliceLocation(s, '')).toBeNull();
  });
});

describe('mineFeatures', () => {
  const seq = 'ATGGGGCCCCAAAATTTTGGGGCCCCAAAATTTT';
  it('mines name, sequence, type and ApE colour', () => {
    const { features } = mineFeatures('p.ape', gb(seq,
      `     CDS             1..20\n` +
      `                     /label="thing"\n` +
      `                     /ApEinfo_fwdcolor="#ff0000"\n`));
    expect(features).toHaveLength(1);
    expect(features[0]).toMatchObject({ name: 'thing', type: 'CDS', color: '#ff0000' });
    expect(features[0].sequence).toBe(seq.slice(0, 20));
  });

  it('SKIPS features under 10 bp, and says why', () => {
    const { features, skipped } = mineFeatures('p.ape', gb(seq,
      `     misc_feature    1..6\n                     /label="BseRI"\n`));
    expect(features).toHaveLength(0);
    expect(skipped[0].why).toMatch(/shorter than 10/);
    expect(skipped[0].name).toBe('BseRI');
  });

  it('returns what it could not read rather than dropping it', () => {
    const { features, skipped } = mineFeatures('p.ape', gb(seq,
      `     CDS             complement(1..9999)\n                     /label="x"\n`));
    expect(features).toHaveLength(0);
    expect(skipped[0].why).toBe('location could not be read');
  });
});

describe('identity', () => {
  const f = (name, sequence, path) => ({ name, sequence, type: 'CDS', color: '', source: { path } });

  it('same name AND same sequence is ONE feature', () => {
    const { features, conflicts } = dedupeFeatures([
      f('amilGFP', 'ATGGGGCCCCAAAA', 'a.seq'),
      f('amilGFP', 'ATGGGGCCCCAAAA', 'b.seq'),
    ]);
    expect(features).toHaveLength(1);
    expect(features[0].sources).toHaveLength(2);
    expect(conflicts).toHaveLength(0);
  });

  it('DIFFERENT name, same sequence is TWO features — P_T7 and T7 Universal are both real', () => {
    const { features, conflicts } = dedupeFeatures([
      f('P_T7', 'ATGGGGCCCCAAAA', 'a.seq'),
      f('T7 Universal', 'ATGGGGCCCCAAAA', 'b.seq'),
    ]);
    expect(features).toHaveLength(2);
    expect(conflicts).toHaveLength(0);
  });

  // Cheese carried ChiA/chiA at 1,483 and 1,479bp — unrelated sequences — and a case-sensitive
  // check called them two distinct features and said nothing. Nothing downstream distinguishes
  // names by case: not ApE, not search, not a person reading a map.
  it('finds a conflict across a CASE difference in the name', () => {
    const { conflicts } = dedupeFeatures([
      f('ChiA', 'ATGGGGCCCCAAAA', 'a.seq'),
      f('chiA', 'ATGGGGCCCCTTTT', 'b.seq'),
    ]);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].spellings.sort()).toEqual(['ChiA', 'chiA']);
  });

  it('but two SPELLINGS of one sequence are not a conflict', () => {
    const { conflicts } = dedupeFeatures([
      f('slp', 'ATGGGGCCCCAAAA', 'a.seq'),
      f('SLP', 'ATGGGGCCCCAAAA', 'b.seq'),
    ]);
    expect(conflicts).toHaveLength(0);
  });

  it('same name, DIFFERENT sequence is a conflict — reported, never resolved', () => {
    const { features, conflicts } = dedupeFeatures([
      f('tetK', 'ATGGGGCCCCAAAA', 'a.seq'),
      f('tetK', 'ATGGGGCCCCTTTT', 'b.seq'),
    ]);
    expect(features).toHaveLength(2);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].name).toBe('tetK');
    for (const v of conflicts[0].variants) {
      expect(v).not.toHaveProperty('preferred');
      expect(v).not.toHaveProperty('winner');
    }
  });
});

describe('the ApE library is an output', () => {
  it('writes the eight tab-separated fields ApE expects', () => {
    // NOT .trim() — the eighth field is empty, so the row genuinely ends in a tab, exactly as
    // every row of a real Default_Features.txt does. Trimming it made this assert 7 fields.
    const row = toApeLibrary([{ name: 'amilGFP', sequence: 'ATGGGG', type: 'CDS', color: '#ff4bd0' }])
      .split('\n')[0];
    const c = row.split('\t');
    expect(c).toHaveLength(8);
    expect(c.slice(0, 5)).toEqual(['amilGFP', 'ATGGGG', 'CDS', '#ff4bd0', '#ff4bd0']);
    expect(c[6]).toBe('0');
  });

  it('round-trips through fromApeLibrary', () => {
    const one = [{ name: 'x', sequence: 'ATGGGG', type: 'CDS', color: 'cyan' }];
    const { features, skipped } = fromApeLibrary(toApeLibrary(one));
    expect(skipped).toHaveLength(0);
    expect(features[0]).toMatchObject(one[0]);
  });

  it('reports a malformed row instead of silently dropping it', () => {
    const { features, skipped } = fromApeLibrary('name\tACGTACGTAC\tCDS\tcyan\t\t\t0\t\nbroken\tACGT\n');
    expect(features).toHaveLength(1);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].line).toBe(2);
  });
});
