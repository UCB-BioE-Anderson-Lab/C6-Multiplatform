// DOES THE SIMULATED PLASMID MATCH THE RECORDED MAP? `sharables/cf.sim.json` has advertised that
// question since the record was written, and until now nothing could answer it: `--json` stripped
// the product sequences before anything could compare them.
//
// The two cases that matter are both real. pP6 simulates to 3555 bp and `Maps/pP6.seq` is 3555 bp
// — and the map is written on the other strand, so a comparison that is not rotation- and
// revcomp-aware calls a correct construction wrong. pJ01 simulates to 3561 bp against a 3564 bp
// map, which is a genuine difference somebody has to go and resolve.
import { describe, it, expect } from 'vitest';
import { compareToMap } from '../src/labplanner/validate/mapMatch.js';
import { revcomp } from '../src/C6-Seq.js';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// A DETERMINISTIC PSEUDO-RANDOM PLASMID, not a repeated motif. Real DNA has unique stretches in
// it, and the alignment below depends on that; a fixture made of one motif repeated has no unique
// anchor anywhere and is its own test case, at the bottom of this file.
const P = (() => {
  let x = 12345, out = '';
  for (let i = 0; i < 1200; i++) { x = (x * 1103515245 + 12345) % 2147483648; out += 'ACGT'[x >> 16 & 3]; }
  return out;
})();
const rotate = (s, n) => s.slice(n) + s.slice(0, n);

describe('a plasmid has no first base and no canonical strand', () => {
  it('matches itself', () => {
    expect(compareToMap(P, P).status).toBe('match');
  });

  it('matches a rotation of itself', () => {
    const r = compareToMap(P, rotate(P, 137));
    expect(r.status).toBe('match');
    expect(r.orientation).toBe('same strand');
  });

  it('matches the reverse complement, rotated — the pP6 case', () => {
    const r = compareToMap(P, rotate(revcomp(P), 29));
    expect(r.status).toBe('match');
    expect(r.orientation).toBe('reverse complement');
  });

  it('is case-insensitive, because GenBank writes its ORIGIN in lower case', () => {
    expect(compareToMap(P.toLowerCase(), P).status).toBe('match');
  });
});

describe('a difference is located, not just counted', () => {
  it('reports a substitution at its base, after aligning the rotation away', () => {
    const changed = rotate(P.slice(0, 200) + 'A' + P.slice(201), 90);
    const r = compareToMap(changed, P);
    expect(r.status).toBe('differs');
    expect(r.delta).toBe(0);
    expect(r.first_difference.at).toBe(201);
    expect(r.first_difference.map).toBe(P[200]);
  });

  it('reports a deletion with its length delta — the pJ01 case, 3 bp short', () => {
    const r = compareToMap(P.slice(0, 100) + P.slice(103), P);
    expect(r.status).toBe('differs');
    expect(r.delta).toBe(-3);
    // A deletion is reported at the first base that actually READS differently, which can be a
    // little past where the bases were removed: if the base after the deletion happens to equal
    // the one it replaced, there is nothing to see there yet. 101 is the earliest it can be and
    // 103 the latest for a 3 bp deletion at 101.
    expect(r.first_difference.at).toBeGreaterThanOrEqual(101);
    expect(r.first_difference.at).toBeLessThanOrEqual(103);
  });

  it('says the position is approximate when the molecule repeats and no anchor is unique', () => {
    // A tandem repeat has no unique 24-mer, so the alignment is one of several. Reporting a base
    // number as if it were certain would be a confident wrong answer; the note is the honest one.
    const R = 'ATGCGGTACCTTAACGGATCCAGGTCTCAGGGACCTTTAAACGGCCGGCCAATTCGATCGAT'.repeat(6);
    const r = compareToMap(R.slice(0, 200) + 'A' + R.slice(201), R);
    expect(r.status).toBe('differs');
    expect(r.note).toMatch(/approximate/);
  });

  it('says so plainly when the two cannot be aligned at all', () => {
    const r = compareToMap('ACGT'.repeat(60), P);
    expect(r.status).toBe('differs');
    expect(r.first_difference).toBe(null);
    expect(r.note).toMatch(/anchor/);
  });

  it('never calls a difference a match on equal lengths alone', () => {
    const other = rotate(P, 10).slice(0, P.length - 4) + 'GGGG';
    expect(other.length).toBe(P.length);
    expect(compareToMap(other, P).status).toBe('differs');
  });
});

// THE RECORD'S WORKED EXAMPLES ARE RUN, HERE AS WELL AS IN CORTEX. An example is the only part of
// a record that shows how to CALL the thing, and one that has stopped reproducing misleads the
// next reader with full confidence. `dna.layout` replays its own for the same reason.
describe("cf.sim's worked examples reproduce", () => {
  const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const rec = JSON.parse(fs.readFileSync(path.join(ROOT, 'sharables/cf.sim.json'), 'utf8'));
  it('there are some', () => expect(rec.examples.length).toBeGreaterThan(1));
  for (const e of rec.examples) {
    it(`c6-sim ${e.input.join(' ')}`, () => {
      let out, code = 0;
      try {
        out = execFileSync(process.execPath, [path.join(ROOT, 'bin/c6-sim'), ...e.input],
          { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
      } catch (err) { code = err.status; out = err.stdout || err.stderr; }
      expect(code).toBe(e.exit ?? 0);
      expect(String(out).trim()).toBe(e.output.trim());
    });
  }
});
