/**
 * GATE 6 — the first experiment outside Lactis3.
 *
 * JCA, 2026-09-13: *"If you want something to test, try running the Tlib3 experiment in Pimar
 * TPcon6."* Fourteen operation designs had been tested against one experiment's worth of shapes.
 * This is the second, and it found five defects in twenty minutes — every one of them a case the
 * first experiment happened not to contain.
 *
 * The construction files themselves are Pimar's, untouched, and are in the legacy parenthetical
 * dialect. The converted subpool-A pair lives in `test/fixtures/tlib3/`, which is a transcription
 * and not a new experiment: one of seven, converted so the toolkit has something to compile.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { concentrationUM } from '../../src/labplanner/planning/planDilutions.js';
import { ensureInventory } from '../../src/inventory/io.js';
import { expandClones } from '../../src/labplanner/planning/expandClones.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const fixture = path.join(root, 'test/fixtures/tlib3');
// BOTH STREAMS, ALWAYS. `c6-plan` writes its report to stderr and its packet to stdout, so a
// helper that kept only stdout on success looked at an empty report and called the assertion
// wrong — a test failing for the shape of its own harness.
const run = (bin, args) => {
  const opts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] };
  try {
    const r = execFileSync('node', [path.join(root, 'bin', bin), ...args],
                           { ...opts, env: { ...process.env } });
    return { out: r, err: '', code: 0 };
  } catch (e) {
    return { out: (e.stdout || '') + (e.stderr || ''), err: e.stderr || '', code: e.status };
  }
};
// For the commands whose report is on stderr and whose payload is on stdout.
const runBoth = (bin, args) => {
  const r = spawnSync('node', [path.join(root, 'bin', bin), ...args], { encoding: 'utf8' });
  return { out: (r.stdout || '') + (r.stderr || ''), code: r.status };
};

// 1 ------------------------------------------------------------------------------------------
// `c6-check` printed `ok Construction of pTlib3.txt (0 steps)` for seven files it had not read,
// under a summary line reading `7 checked · 0 with findings`. Every one has four steps. The
// validator returns `ok: true, parsed: false` WITH a LEGACY_FORMAT finding — correct on all three
// counts — and the printer tested `r.ok` and discarded `r.findings`.
//
// Its own header says why that matters: *"a repo with a latent defect and a repo with none look
// identical from outside."*
describe('c6-check on a file it cannot read', () => {
  const legacy = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-'));
  fs.writeFileSync(path.join(legacy, 'Construction of pX.txt'),
    'PCR a/b on TEMPLATE     (frag)\nAssemble frag,back      (BsmBI, pX)\n'
    + 'Transform pX            (Mach1, Amp)\n');

  it('does not call it ok', () => {
    const { out } = runBoth('c6-check', [legacy]);
    expect(out).not.toMatch(/^\s*ok\s/m);
    expect(out).toMatch(/NOT CHECKED/);
  });

  it('prints the finding it was already carrying', () => {
    expect(runBoth('c6-check', [legacy]).out).toMatch(/LEGACY_FORMAT/);
  });

  // "7 checked · 0 with findings" over seven unopened files is a stronger claim than the per-file
  // lines made, and it is the line somebody skims.
  it('does not count an unread file as checked', () => {
    const { out } = runBoth('c6-check', [legacy]);
    expect(out).toMatch(/1 file\(s\) · 0 checked/);
    expect(out).toMatch(/1 NOT CHECKED/);
  });
});

// 2 ------------------------------------------------------------------------------------------
// `c6-labplan` on the seven legacy files printed "STOP — no characterization file for pTlib3,
// pTlib3A, …" and seven paragraphs telling somebody to write seven new files, and never mentioned
// that not one construction file had been read.
describe('the gate asks for the possible thing first', () => {
  const legacy = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy2-'));
  fs.writeFileSync(path.join(legacy, 'Construction of pX.txt'),
    'PCR a/b on T     (frag)\nTransform pX     (Mach1, Amp)\n');

  it('names the unreadable construction files, not the missing characterization ones', () => {
    const { out, code } = runBoth('c6-labplan', [legacy]);
    expect(code).toBe(3);
    expect(out).toMatch(/legacy parenthetical style and were not read/);
    expect(out).not.toMatch(/no characterization file for/);
  });
});

// 3 ------------------------------------------------------------------------------------------
// A renaming step with no `clone=` keeps the names of the step above it, so a Miniprep over a
// 30-clone pick produced thirty DUPLICATE_PRODUCT problems — *"T3A-1A1 is produced twice in one
// file"* — every word true and none of it saying what to change. Lactis3 writes
// `Miniprep … clone=pBET8`, so the toolkit had never met the omission.
describe('a renaming step with nothing to rename to', () => {
  const picked = () => [
    { cf: 'x', line: 1, operation: 'pick', output: 'clones', dnaInputs: ['host'],
      args: { n: 4, clone: 'T3A', _characterization: true } },
    { cf: 'x', line: 2, operation: 'miniprep', output: 'dna', dnaInputs: ['clones'],
      args: { _characterization: true } },
  ];

  it('is one problem naming the cure, not four naming the symptom', () => {
    const { problems } = expandClones(picked());
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toMatch(/no clone= to rename them to/);
    expect(problems[0].message).toMatch(/Add clone=/);
  });

  it('is silent once the line carries one', () => {
    const jobs = picked();
    jobs[1].args.clone = 'pTlib3A';
    const got = expandClones(jobs);
    expect(got.problems).toHaveLength(0);
    expect(got.jobs.filter((j) => j.operation === 'miniprep').map((j) => j.output))
      .toEqual(['pTlib3A-A', 'pTlib3A-B', 'pTlib3A-C', 'pTlib3A-D']);
  });

  // A sequencing step legitimately renames via the read suffix and needs no new base — Lactis3's
  // `Sequence pBET8_clones oligos=bf037,bf038 reads=F,R` has none.
  it('does not fire on a step that fans over reads instead', () => {
    const jobs = picked();
    jobs[1] = { ...jobs[1], operation: 'sequencing', args: { reads: 'F,R', _characterization: true } };
    expect(expandClones(jobs).problems).toHaveLength(0);
  });
});

// 4 ------------------------------------------------------------------------------------------
// Thirteen of the thirty-nine files in Pimar's `inventory/Minus20` end their lines with a bare
// `\r` — saved out of Excel on a Mac years ago. Everything splits on `\n`, so such a file arrives
// as one enormous line and dies as "Malformed grid", which is true of what the splitter produced
// and says nothing about what is wrong.
describe('a box file with classic-Mac line endings', () => {
  const text = ['>name\tboxL', '>>label\tA\tB', '1\tfoo\tbar', '2\t\t'].join('\r');

  it('reads', () => {
    const inv = ensureInventory(text, 'boxL.txt');
    expect(Object.keys(inv.boxes)).toContain('boxL');
  });

  it('reads the same as the \\n form', () => {
    const a = ensureInventory(text, 'boxL.txt');
    const b = ensureInventory(text.replace(/\r/g, '\n'), 'boxL.txt');
    expect(Object.keys(a.samples).sort()).toEqual(Object.keys(b.samples).sort());
  });

  // ONE UNREADABLE BOX MUST NOT TAKE DOWN THE FREEZER, and the one fact worth having is which.
  it('and if one truly cannot be read, the run names it and keeps the others', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inv-'));
    fs.writeFileSync(path.join(dir, 'good.tsv'), 'box\trow\tcol\tconstruct\n> box good 9x9\n');
    fs.writeFileSync(path.join(dir, 'broken.txt'), '>name\tb\n>>label\n');
    const { out } = runBoth('c6-plan', [fixture, '--inventory', dir]);
    expect(out).toMatch(/broken\.txt could not be read/);
    expect(out).toMatch(/The other files were read/);
  });
});

// 5 ------------------------------------------------------------------------------------------
// Sixty-one of Pimar's 1,472 samples record their strength as `100_m`, `10_m` or `100�M` — a
// `µ` that went through a spreadsheet or an encoding change. They are 100 µM and 10 µM oligo
// stocks in the freezer, and reading them as "no concentration known" makes the planner say a tube
// must be ordered when it is right there.
describe('a micro sign that did not survive', () => {
  it('reads every spelling of it', () => {
    for (const t of ['100uM', '100 uM', '100_m', '100�M', '100µM', '100μM']) {
      expect(concentrationUM(t), t).toBe(100);
    }
  });

  it('still reads nM and the sequencing strength', () => {
    expect(concentrationUM('250 nM')).toBe(0.25);
    expect(concentrationUM('2.66 uM')).toBe(2.66);
  });

  // AN AMOUNT IS NOT A CONCENTRATION. IDT ships oligos labelled `25 nmol`; `25nmol` matched the
  // `nm` pattern and came back as 0.025 µM — a synthesis scale read as a strength.
  it('refuses an amount', () => {
    for (const t of ['100 nmol', '25 nmole', '1 umol', '0.2 umol']) {
      expect(concentrationUM(t), t).toBe(null);
    }
  });

  it('still refuses what is not a concentration at all', () => {
    for (const t of ['miniprep', 'zymo', 'dil20x', 'gblock', '', '100 ng/uL']) {
      expect(concentrationUM(t), t).toBe(null);
    }
  });
});

// 6 ------------------------------------------------------------------------------------------
// It compiles. Eight sheets from a real experiment, resolved against a real freezer.
describe('the experiment itself', () => {
  it('plans, and the library is named by plate address', () => {
    const { out, code } = runBoth('c6-plan', [fixture]);
    expect(code, out.slice(-400)).toBe(0);
    expect(out).toMatch(/T3A-1A1/);        // plate 1, row A, column 1
    expect(out).toMatch(/30 sample\(s\)/);
  });

  // `simCF` simulates a construction file as one unit, so one missing template means no product
  // gets a size — including a PCR whose own template is present. The backbone PCR reported
  // "Missing sequence for key: Tlib3", and a reader goes looking for a pTP2 sequence that is not
  // lost.
  // ASSERTED ON THE PACKET, NOT THE REPORT. The console summary truncates each note to fit a
  // column, so the sentence that does the work is only ever whole in the packet — which is also
  // where the renderer reads it from, and therefore what reaches the page.
  it('says whose missing sequence it is', () => {
    const raw = spawnSync('node', [path.join(root, 'bin/c6-plan'), fixture, '--json'],
                          { encoding: 'utf8' }).stdout;
    const plan = JSON.parse(raw.slice(raw.indexOf('{')));
    const notes = JSON.stringify(plan.sheets.find((s) => s.operation === 'pcr').samples);
    expect(notes).toMatch(/that is a different step in the same file/);
    expect(notes).toMatch(/own template pTP2 is present/);
  });
});

// 7 ------------------------------------------------------------------------------------------
// **A BLANK MEANT "ASK THE STUDENT", AND AN UNKNOWN SIZE IS NOT A QUESTION FOR A STUDENT.** The
// renderer detects entry cells as the trailing run of empty columns, so a size the compiler could
// not work out came out as a yellow box next to `program`, also yellow — two questions put to
// somebody at a bench with no way to answer either. An amplicon length is arithmetic on a template
// sequence and the thermocycler program follows from it; neither is an observation.
//
// JCA, 2026-09-13, looking at the Tlib3 PCR sheet: *"I don't think the right answer is to ask the
// student to put in a number. It is meaningless to cite a single number."*
describe('a size the compiler could not work out', () => {
  // Asserted on the packet, which is what the renderer is handed: the shading rule is "a trailing
  // run of blank columns", so a row with no blanks has nothing to shade.
  it('is not a yellow cell', () => {
    const raw = spawnSync('node', [path.join(root, 'bin/c6-packet'), fixture],
                          { encoding: 'utf8', maxBuffer: 64e6 }).stdout;
    const packet = JSON.parse(raw);
    const pcr = packet.sheets.find((s) => (s.metadata?.operations || []).includes('pcr'));
    const rows = pcr.samples;
    // Every cell in the row carries a value, so no trailing run of blanks exists to be shaded.
    for (const row of rows) {
      expect(String(row['expected size'] ?? ''), JSON.stringify(row)).not.toBe('');
      expect(String(row.program ?? ''), JSON.stringify(row)).not.toBe('');
    }
  });

  it('says what it is instead', () => {
    const raw = spawnSync('node', [path.join(root, 'bin/c6-packet'), fixture],
                          { encoding: 'utf8', maxBuffer: 64e6 }).stdout;
    const pcr = JSON.parse(raw).sheets.find((s) => (s.metadata?.operations || []).includes('pcr'));
    expect(pcr.samples[0]['expected size']).toBe('not computed');
    expect(pcr.samples[0].program).toBe('follows from the size');
  });

  // The gap becomes a STILL TO DECIDE line — the mechanism that already exists for a decision the
  // compiler refuses to make — so `c6-labplan` prints it with the rest and somebody can close it
  // before the sheet is issued rather than at the bench.
  it('becomes an open decision on the sheet', () => {
    const raw = spawnSync('node', [path.join(root, 'bin/c6-packet'), fixture],
                          { encoding: 'utf8', maxBuffer: 64e6 }).stdout;
    const pcr = JSON.parse(raw).sheets.find((s) => (s.metadata?.operations || []).includes('pcr'));
    const open = (pcr.open || []).join(' | ');
    expect(open).toMatch(/the PCR on Tlib3 has no product size/);
    expect(open).toMatch(/Supply the template's sequence, or state the expected length/);
  });

  // An earlier version appended a paragraph about libraries to every case, including a backbone
  // PCR off a single plasmid — advice about a situation the reaction is not in. Nothing here knows
  // whether a template is a pool.
  it('does not lecture about libraries it cannot detect', () => {
    const raw = spawnSync('node', [path.join(root, 'bin/c6-packet'), fixture],
                          { encoding: 'utf8', maxBuffer: 64e6 }).stdout;
    const pcr = JSON.parse(raw).sheets.find((s) => (s.metadata?.operations || []).includes('pcr'));
    expect((pcr.open || []).join(' ')).not.toMatch(/LIBRARY/);
  });

  it('a known size is still just the number', () => {
    const raw = spawnSync('node', [path.join(root, 'bin/c6-packet'),
                                   path.join(root, 'test/fixtures/golden'),
                                   '--inventory', path.join(root, 'test/fixtures/golden/inventory.txt')],
                          { encoding: 'utf8', maxBuffer: 64e6 }).stdout;
    const pcr = JSON.parse(raw).sheets.find((s) => (s.metadata?.operations || []).includes('pcr'));
    expect(pcr.samples[0]['expected size']).toMatch(/^\d+ bp$/);
    expect((pcr.open || []).join(' ')).not.toMatch(/no product size/);
  });
});
