/**
 * The golden snapshot: what the compiler currently says, frozen so a change has to be looked at.
 *
 * `docs/TOOLKIT-PLAN.md` promises that every gate presents **the diff of the generated sheets**,
 * not only the diff of the code. This is the mechanism. A phase meant to change nothing that
 * changes something has found a bug; a phase meant to change something shows exactly what.
 *
 * **WHEN THIS FAILS, LOOK AT THE DIFF BEFORE RE-RECORDING IT.** A snapshot updated without being
 * read is a snapshot that has stopped being a check — which is the failure this repository keeps
 * finding in other clothes. To re-record deliberately:
 *
 *     node bin/c6-golden test/fixtures/golden --inventory test/fixtures/golden/inventory.txt \
 *       --write test/fixtures/golden/SNAPSHOT.txt
 *
 * THE FIXTURE IS SYNTHETIC ON PURPOSE. `pGOLD` is not anybody's experiment: content does not go in
 * machinery, and a toolkit carrying one lab's real construct as its test data is the second north
 * star failing quietly. It is built to exercise every operation — an oligo ready at 10 µM, one only
 * at 100 µM so a dilution is needed, two absent so the sheet has to ask, and no kanamycin so the
 * stock session fires.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, 'fixtures', 'golden');
const SNAPSHOT = path.join(FIXTURE, 'SNAPSHOT.txt');

describe('golden snapshot', () => {
  it('matches what the compiler says today', () => {
    const got = execFileSync('node', [path.join(HERE, '..', 'bin', 'c6-golden'), FIXTURE,
                                      '--inventory', path.join(FIXTURE, 'inventory.txt')],
                             { encoding: 'utf8', maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'pipe'] });
    const want = fs.readFileSync(SNAPSHOT, 'utf8');
    if (got !== want) {
      // Show the first divergence rather than 188 lines of context: a snapshot failure is read by
      // a person deciding whether the change was wanted.
      const g = got.split('\n'); const w = want.split('\n');
      const i = g.findIndex((l, n) => l !== w[n]);
      throw new Error(`golden snapshot differs at line ${i + 1}\n`
                    + `  was:  ${JSON.stringify(w[i])}\n  now:  ${JSON.stringify(g[i])}\n`
                    + `  (${w.length} -> ${g.length} lines)`);
    }
    expect(got).toBe(want);
  });

  it('covers every operation the designs know', () => {
    // A snapshot that exercises half the toolkit protects half the toolkit. Anything not listed
    // here is a design whose regressions this harness would not catch.
    const snap = fs.readFileSync(SNAPSHOT, 'utf8');
    const seen = new Set(snap.split('\n').filter((l) => l.startsWith('  ops\t'))
                             .flatMap((l) => l.split('\t')[1].split(',')));
    for (const op of ['stock', 'dilution', 'pcr', 'gel', 'zymo', 'goldengate', 'transform',
                      'pick', 'miniprep', 'sequencing', 'analysis', 'retransform', 'culture',
                      'assay']) {
      expect(seen, `${op} is not covered by the golden fixture`).toContain(op);
    }
  });
});
