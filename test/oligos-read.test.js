import { describe, it, expect } from 'vitest';
import { readOligoLine, readOligoFile, isOligoFile, findNameCollisions, decodeText }
  from 'src/oligos/read.js';

/**
 * Each block below is a fact measured against the real corpus, not an invented case. The last two
 * are the ones a weaker test would skip, and both are defects this reader actually had.
 */
describe('oligo reader — the three dialects', () => {
  it('reads the IDT order form', () => {
    const r = readOligoLine('oGho17\tctgtaGGTCTCcgcgtgccatttacc\t25nm\tSTD');
    expect(r).toMatchObject({ name: 'oGho17', scale: '25nm', purification: 'STD' });
    expect(r.assumed).toBeUndefined();
  });

  it('reads the catalogue form, and column three is a DESCRIPTION not a scale', () => {
    const r = readOligoLine('M13-rev\tCAGGAAACAGCTATGACCATG\tClassis sequencing oligos');
    expect(r.description).toBe('Classis sequencing oligos');
    expect(r.scale).toBe('25nm');
    expect(r.assumed).toEqual(['scale', 'purification']);
  });

  it('reads the bare form', () => {
    const r = readOligoLine('oap2\tggctgcggcgagcggtatcag');
    expect(r.assumed).toEqual(['scale', 'purification']);
  });

  it('DECIDES DIALECT PER ROW, never per file — Oligos-pBET2.txt carries both', () => {
    const { records } = readOligoFile('Oligos-pBET2.txt', [
      'bet007\tcatcaGGTCTCaTAGATGATTAACTTTATAATAATT\t25nm\tSTD',
      'ce007\tacataGGTCTCaTCTAGATGATTAACTTTATAACAGG',
    ].join('\n'));
    expect(records[0].assumed).toBeUndefined();          // stated
    expect(records[1].assumed).toEqual(['scale', 'purification']);   // guessed, four lines apart
  });
});

describe('what is guessed is declared', () => {
  it('never lets an inferred value pass as a recorded one', () => {
    const stated = readOligoLine('a\tACGTACGTACGTACGT\t100nm\tPAGE');
    const guessed = readOligoLine('a\tACGTACGTACGTACGT');
    expect(stated.scale).toBe('100nm');
    expect(guessed.scale).toBe('25nm');
    expect(guessed.assumed).toContain('scale');
  });
});

describe('encoding', () => {
  // `nisK and nisR seq oligos.txt` in Cheese is UTF-16LE. Read as UTF-8, all six of its oligos
  // silently vanish — the null bytes break the sequence pattern, so every row is rejected as "not
  // an oligo row" and the file yields nothing at all. No error, no empty file.
  it('reads UTF-16LE, which UTF-8 would silently drop', () => {
    const line = 'nisK_for\tgattactaaattactttttt\t25nm\tSTD';
    const utf16 = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(line, 'utf16le')]);
    expect(decodeText(utf16)).toBe(line);
    const { records } = readOligoFile('x.txt', utf16);
    expect(records).toHaveLength(1);
    expect(records[0].name).toBe('nisK_for');
  });
});

describe('what it refuses', () => {
  it('skips oligo pools — they are one mixed tube, not oligos', () => {
    expect(isOligoFile('Tlib3_order_IDT.xlsx')).toBe(false);
    expect(isOligoFile('Idt_coa.txt')).toBe(false);
    expect(isOligoFile('SLIP4_oligos.txt')).toBe(true);
  });

  it('RETURNS the lines it did not understand rather than dropping them', () => {
    // SeqOligos-pBET2.txt is misnamed: it holds construction steps. The reader yields no records
    // and must SAY so, or a misnamed file is indistinguishable from an empty one.
    const { records, skipped } = readOligoFile('SeqOligos-pBET2.txt',
      'PCR ChiA_FWD, ChiA_REV on ChiA_GS  (ChiA_PCR 2079)\nAssemble pTRKH3_PCR  (Gibson, pBET4)');
    expect(records).toHaveLength(0);
    expect(skipped).toHaveLength(2);
    expect(skipped[0].line).toBe(1);
  });
});

describe('name collisions', () => {
  const rows = (...xs) => xs.map(([n, s, p, l]) =>
    ({ ...readOligoLine(`${n}\t${s}`), source: { path: p, line: l } }));

  it('same name and same sequence is NOT a collision', () => {
    expect(findNameCollisions(rows(
      ['nisK_for', 'GATTACTAAATTACTTTT', 'a.txt', 3],
      ['nisK_for', 'gattactaaattactttt', 'b.txt', 3],
    ))).toHaveLength(0);
  });

  it('pairs each distinct sequence with ITS OWN sources', () => {
    // A flat sequence list beside a flat source list cannot be read: with three files and two
    // sequences there is no way to say which file held which.
    const c = findNameCollisions(rows(
      ['nisK_for', 'GATTACTAAATTACTTTT', 'lactis1.txt', 3],
      ['nisK_for', 'GATTACTAAATTACTTTT', 'pbet2.txt', 3],
      ['nisK_for', 'ATTTTCAGAATCTATTCA', 'golden-gate.txt', 3],
    ));
    expect(c).toHaveLength(1);
    expect(c[0].variants).toHaveLength(2);
    expect(c[0].variants[0].sources.map(s => s.path)).toEqual(['lactis1.txt', 'pbet2.txt']);
    expect(c[0].variants[1].sources.map(s => s.path)).toEqual(['golden-gate.txt']);
  });

  it('reports without choosing — no variant is marked a winner', () => {
    const c = findNameCollisions(rows(
      ['x', 'AAAAAAAAAAAAAAAAAAAAAAAAAAAA', 'long.txt', 1],
      ['x', 'CCCCCCCCCCCC', 'short.txt', 1],
    ))[0];
    for (const v of c.variants) {
      expect(v).not.toHaveProperty('preferred');
      expect(v).not.toHaveProperty('winner');
    }
  });
});
