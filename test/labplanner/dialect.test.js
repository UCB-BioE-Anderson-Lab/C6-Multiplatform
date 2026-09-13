/**
 * A file this planner cannot read is refused, not guessed at.
 *
 * **THE BUG, AS IT WAS FOUND.** `detectDialect` has always been able to spot the parenthetical
 * dialect — `transform pchia (Mach1, Tet)` — and `validateConstructionFile` refuses to check one,
 * saying so in its own comment: *"a legacy file is not a broken one."* The PLANNER never asked. It
 * read those lines generically, took the last token of each as the product, and compiled Lactis1
 * into nine labsheets whose constructs were `backbone)`, `pchia)`, `frag1)` and `Tet)`.
 *
 * Nothing failed. The packet was well-formed and printable and the exit code was 0. The only
 * reason anybody found out is that two of the garbage names collided and `models/labsheet.js`
 * refused a duplicate label — an error two layers from the cause, about a symptom.
 *
 * A plausible labsheet with nonsense on it is strictly worse than no labsheet, because somebody
 * prints it.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { planExperiment } from '../../src/labplanner/planning/planExperiment.js';
import { detectDialect } from '../../src/labplanner/validate/constructionFile.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

// Lactis1's own file, reduced. The `(…, product)` and ` on ` forms are the dialect's signatures.
const LEGACY = ['pcr bf001, bf002 on pptpi\t\t\t(6979 bp, backbone)',
                'pcr bf003, bf006 on chia\t\t\t(786 bp, frag1)',
                'assemble backbone, frag1\t\t(BsmBI, pchia)',
                'transform pchia\t\t\t\t(Mach1, Tet)'].join('\n');
const CURRENT = ['PCR\tbo1\tbo2\tpSRC\tfrag1',
                 'GoldenGate\tfrag1\tbackbone\tBsaI\tgg',
                 'Transform\tgg\tMach1\tErm\t37\tpTST'].join('\n');

const project = (files) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'dialect-'));
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(d, name), text);
  return d;
};
const packet = (dir, expectFail = false) => {
  try {
    const out = execFileSync('node', [path.join(root, 'bin/c6-packet'), dir],
                             { encoding: 'utf8', maxBuffer: 64e6, stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, packet: JSON.parse(out) };
  } catch (e) {
    if (!expectFail) throw e;
    return { ok: false, code: e.status, stderr: String(e.stderr || '') };
  }
};

describe('the dialects are told apart', () => {
  it('and the detector was never the problem', () => {
    expect(detectDialect(LEGACY)).toBe('legacy');
    expect(detectDialect(CURRENT)).toBe('current');
  });
});

describe('planExperiment', () => {
  it('makes no jobs from a file it cannot read, and says which', () => {
    const out = planExperiment({ cfs: [{ name: 'pchia', text: LEGACY }] });
    expect(out.sheets).toEqual([]);
    expect(out.problems.map((p) => p.code)).toEqual(['LEGACY_FORMAT']);
    expect(out.problems[0].message).toMatch(/parenthetical format/);
  });

  // THE NAMES THAT USED TO COME OUT. Asserted explicitly so a regression is recognisable as this
  // bug rather than as some new mystery about stray punctuation.
  it('never produces a construct with a stray bracket in it', () => {
    const out = planExperiment({ cfs: [{ name: 'pchia', text: LEGACY }] });
    const names = out.sheets.flatMap((s) => (s.samples || []).map((x) => x.output));
    for (const n of names) expect(n, `"${n}" came out of a file nobody could read`)
      .not.toMatch(/[()]/);
  });

  it('reads the good files in a project that also holds a bad one', () => {
    const out = planExperiment({ cfs: [{ name: 'pTST', text: CURRENT },
                                       { name: 'pchia', text: LEGACY }] });
    expect(out.sheets.length).toBeGreaterThan(0);
    expect(out.problems.map((p) => p.code)).toContain('LEGACY_FORMAT');
  });

  // A characterization file has its own grammar and its own reader; running the construction-file
  // detector over one would call every single one unreadable.
  it('does not apply the construction-file detector to a characterization file', () => {
    const out = planExperiment({ cfs: [
      { name: 'pTST', text: CURRENT },
      { name: 'pTST', characterization: true,
        text: 'Retransform\tpTST\thost=L.lactis antibiotic=Erm\tpTST_host\n' },
    ] });
    expect(out.problems.filter((p) => /FORMAT$/.test(p.code))).toEqual([]);
  });
});

describe('c6-packet', () => {
  it('refuses to hand over an empty packet, with the reason', () => {
    const r = packet(project({ 'Construction of pchia.txt': LEGACY }), true);
    expect(r.ok).toBe(false);
    expect(r.code).toBe(2);
    expect(r.stderr).toMatch(/no labsheets were made/);
    expect(r.stderr).toMatch(/parenthetical format/);
  });

  it('says out loud that a file was dropped, not only in the JSON', () => {
    const dir = project({ 'Construction of pTST.txt': CURRENT,
                          'Construction of pchia.txt': LEGACY });
    // The run SUCCEEDS here — one file is readable — so the refusal is on stderr of a process that
    // exits 0, which is exactly the case a caller is most likely to miss.
    const r = spawnSync('node', [path.join(root, 'bin/c6-packet'), dir],
                        { encoding: 'utf8', maxBuffer: 64e6 });
    expect(r.status).toBe(0);
    expect(r.stderr).toMatch(/parenthetical format/);
  });

  // "planned from 3 file(s)" over a packet built from one is a small dishonesty that makes
  // somebody look for the missing sheets somewhere else.
  it('counts the files it actually read', () => {
    const r = packet(project({ 'Construction of pTST.txt': CURRENT,
                               'Construction of pchia.txt': LEGACY }));
    expect(r.packet.metadata.source).toMatch(/from 1 of 2 file\(s\)/);
  });
});
