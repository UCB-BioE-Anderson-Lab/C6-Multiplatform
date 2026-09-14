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

// A project whose template has no sequence at all. The Tlib3 fixture WAS this until it gained a
// stencil, and the two behaviours are different: "no size, and nobody can supply one at the bench"
// versus "a pool, whose size is a range". Both have to stay covered, so they get a fixture each.
const noSequence = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nosize-'));
  fs.writeFileSync(path.join(d, 'Construction of pX.txt'),
    ['PCR\tfwd\trev\tMysteryTemplate\tfrag',
     'Transform\tfrag\tMach1\tAmp\t37\tpX'].join('\n') + '\n');
  fs.writeFileSync(path.join(d, 'Characterization of pX.txt'),
    'Pick\tpX\tn=2 clone=X\tpX_clones\n');
  fs.writeFileSync(path.join(d, 'x_oligos.txt'),
    'fwd\tattaccgcctttgagtgagc\t25nm\tSTD\nrev\tgtatcacgaggcagaatttcag\t25nm\tSTD\n');
  return d;
};

const pcrSheetOf = (dir) => {
  const raw = spawnSync('node', [path.join(root, 'bin/c6-packet'), dir],
                        { encoding: 'utf8', maxBuffer: 64e6 }).stdout;
  return JSON.parse(raw).sheets.find((s) => (s.metadata?.operations || []).includes('pcr'));
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
  // Two PCRs in one file, one of whose templates is present: `simCF` simulates the file as a unit,
  // so the present one gets no size either — and used to report the ABSENT one's name as if it were
  // its own problem. The Tlib3 fixture no longer exhibits this, because its stencil resolves both.
  it('says whose missing sequence it is', () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'twopcr-'));
    const known = 'ATTACCGCCTTTGAGTGAGC' + 'ATGC'.repeat(200) + 'CTGAAATTCTGCCTCGTGATAC';
    fs.writeFileSync(path.join(d, 'Construction of pY.txt'),
      ['PCR\tfwd\trev\tAbsentTemplate\tfragA',
       'PCR\tfwd\trev\tKnownTemplate\tfragB',
       'Transform\tfragA\tMach1\tAmp\t37\tpY'].join('\n') + '\n');
    fs.writeFileSync(path.join(d, 'Characterization of pY.txt'), 'Pick\tpY\tn=2 clone=Y\tpY_c\n');
    fs.writeFileSync(path.join(d, 'y_oligos.txt'),
      'fwd\tattaccgcctttgagtgagc\t25nm\tSTD\nrev\tgtatcacgaggcagaatttcag\t25nm\tSTD\n');
    fs.writeFileSync(path.join(d, 'y_sequences.tsv'), `KnownTemplate\t${known}\tplasmid\n`);
    // The note reaches the sheet as the open decision, which is where a person reads it.
    const open = (pcrSheetOf(d).open || []).join(' | ');
    expect(open).toMatch(/that is a different step in the same file/);
    expect(open).toMatch(/own template KnownTemplate is present/);
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
    const rows = pcrSheetOf(noSequence()).samples;
    // Every cell in the row carries a value, so no trailing run of blanks exists to be shaded.
    for (const row of rows) {
      expect(String(row['expected size'] ?? ''), JSON.stringify(row)).not.toBe('');
      expect(String(row.program ?? ''), JSON.stringify(row)).not.toBe('');
    }
  });

  it('says what it is instead', () => {
    const pcr = pcrSheetOf(noSequence());
    expect(pcr.samples[0]['expected size']).toBe('not computed');
    expect(pcr.samples[0].program).toBe('follows from the size');
  });

  // The gap becomes a STILL TO DECIDE line — the mechanism that already exists for a decision the
  // compiler refuses to make — so `c6-labplan` prints it with the rest and somebody can close it
  // before the sheet is issued rather than at the bench.
  it('becomes an open decision on the sheet', () => {
    const open = (pcrSheetOf(noSequence()).open || []).join(' | ');
    expect(open).toMatch(/the PCR on MysteryTemplate has no product size/);
    expect(open).toMatch(/Supply the template's sequence, or state the expected length/);
  });

  // An earlier version appended a paragraph about libraries to every case, including a backbone
  // PCR off a single plasmid — advice about a situation the reaction is not in. Nothing here knows
  // whether a template is a pool.
  it('does not lecture about libraries it cannot detect', () => {
    expect((pcrSheetOf(noSequence()).open || []).join(' ')).not.toMatch(/LIBRARY/);
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

// 8 ------------------------------------------------------------------------------------------
// **THE STENCIL.** JCA, 2026-09-13, on how a library should reach the simulator:
//
// > *"you also define a placeholder sequence... a special string that has all the conserved
// > characteristics of the library that can then be used for simulations."*
//
// and on how far to take it:
//
// > *"the CF simulation code will need simple N's to work, and it would be a lot of work to change
// > that. So, I wouldn't get fancy with this."*
//
// So the string is plain IUPAC N and `simCF` learns nothing. Tlib3's arnold subpool is 43 bp of
// conserved 5' frame, a 138–152 bp variable span, and 66 bp of conserved 3' frame; both primers
// land in the frames, so one simulation anneals exactly where it does on every real member.
describe('a library simulated from its stencil', () => {
  const pcr = () => {
    const raw = spawnSync('node', [path.join(root, 'bin/c6-packet'), fixture],
                          { encoding: 'utf8', maxBuffer: 64e6 }).stdout;
    return JSON.parse(raw).sheets.find((s) => (s.metadata?.operations || []).includes('pcr'));
  };

  it('resolves, so there is nothing left to decide about the size', () => {
    expect((pcr().open || []).join(' ')).not.toMatch(/no product size/);
  });

  // **ONE SIMULATION GIVES THE WHOLE RANGE, BECAUSE THE FLANKS ARE CONSTANT.** Product length is
  // linear in span length, so the stencil's N-run at the pool's MEAN plus the span bounds yields
  // the endpoints by arithmetic. Measured against all thirty real members: 225-239, mean 231.
  // N×138 → 225, N×144 → 231, N×152 → 239. Exact at all three, and not luck.
  it('reports the mean and the true range, from one simulation', () => {
    const row = pcr().samples.find((x) => x.construct === 'TL3A');
    expect(row['expected size']).toBe('231 bp mean (225-239, n=30)');
  });

  // A LIBRARY HAS NO ONE SIZE. *"It is meaningless to cite a single number."*
  it('does not print a library as a single number', () => {
    expect(pcr().samples.find((x) => x.construct === 'TL3A')['expected size'])
      .not.toMatch(/^\d+ bp$/);
  });

  // And an ordinary PCR is untouched — the backbone off a single plasmid stays one number.
  // It lives in the SECOND table now: the sheet needs Taq for the 231 bp amplicon and PrimeSTAR
  // for the 3.7 kb backbone, so the session is one bin per enzyme and only the head bin's rows
  // are `samples`. → §11.
  it('leaves an ordinary PCR alone', () => {
    const sh = pcr();
    const rows = [...sh.samples.map((r) => Object.values(r)),
                  ...(sh.blocks || []).filter((b) => b.kind === 'table').flatMap((b) => b.rows)];
    const bT = rows.find((r) => r.includes('bT'));
    expect(bT, JSON.stringify(rows).slice(0, 300)).toBeTruthy();
    expect(bT.some((c) => /^\d+ bp$/.test(String(c)))).toBe(true);
  });

  // The program follows from the mean, which is the point of having one: 231 bp is under 250, so
  // Taq rather than PrimeSTAR.
  it('chooses the program from the representative size', () => {
    expect(pcr().samples.find((x) => x.construct === 'TL3A').program).toBeTruthy();
  });

  // The N's are real ambiguity and they propagate. The assembled library plasmid genuinely has a
  // variable region, and `simCF` carries it through Golden Gate without being taught anything.
  it('carries the variable region through the assembly', async () => {
    const { parseCF, simCF } = await import('../../src/C6-Sim.js');
    const seqs = fs.readFileSync(path.join(fixture, 'Tlib3_sequences.tsv'), 'utf8')
      .split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.split('\t'));
    const st = seqs.find((c) => c[2]?.trim() === 'stencil');
    expect(st, 'no stencil row in the fixture').toBeTruthy();
    expect(st[1]).toMatch(/N{100,}/);
    expect(st[3]).toMatch(/span=138-152/);
    const log = console.log; console.log = () => {};
    try {
      const cf = [`oligo\tG00101\tattaccgcctttgagtgagc`,
                  `oligo\tT3A_R\tctctacctcggataccactagt`,
                  `plasmid\tTlib3\t${st[1]}`,
                  `PCR\tG00101\tT3A_R\tTlib3\tTL3A`].join('\n');
      const out = simCF(parseCF(cf));
      const prod = [...out].find(([k]) => k === 'TL3A')[1];
      const s = String(prod?.sequence ?? prod);
      expect(s.length).toBe(231);
      expect((s.match(/N/g) || []).length).toBe(144);
    } finally { console.log = log; }
  });
});

// 9 ------------------------------------------------------------------------------------------
// **A CORRECT MECHANISM WIRED TO NOTHING.** JCA, looking at the Tlib3 cleanup sheet: *"This should
// trigger the choice of doing a small frag cleanup for the library zymo. Is that logic not part of
// the zymo decision code?"* It was not. `protocols/modules/zymo_cleanup.js` has declared a
// `small_fragment` input since it was written, and its template carries the remedy — bind with
// 1 part ADB + 3 parts isopropanol — behind that flag. Nothing ever set it, so a 231 bp library
// amplicon came up for cleanup with the plain protocol and no warning, and ADB alone washes it
// straight through.
describe('a fragment too small to bind', () => {
  const sheetOf = (dir, op) => {
    const raw = spawnSync('node', [path.join(root, 'bin/c6-packet'), dir],
                          { encoding: 'utf8', maxBuffer: 64e6 }).stdout;
    return JSON.parse(raw).sheets.find((s) => (s.metadata?.operations || []).includes(op));
  };

  it('sets the flag the protocol has always had', () => {
    const sh = sheetOf(fixture, 'zymo');
    expect(sh.protocol_values?.zymo_cleanup?.small_fragment).toBe(true);
  });

  it('names which tube, because the protocol renders once for the sheet', () => {
    const notes = (sheetOf(fixture, 'zymo').notes || []).join(' | ');
    expect(notes).toMatch(/TL3A is under 250 bp/);
    expect(notes).toMatch(/1 part ADB \+ 3 parts isopropanol/);
    expect(notes).toMatch(/washes straight through/);
  });

  // The same sheet cleans a 3.7 kb backbone. Saying "use isopropanol" without saying which tube
  // needs it is true and unreadable at the bench.
  it('says what happens to the larger tubes on the same sheet', () => {
    expect((sheetOf(fixture, 'zymo').notes || []).join(' ')).toMatch(/The other tube is larger/);
  });

  // A LIBRARY'S FLOOR, NOT ITS MEAN: Tlib3 is 231 bp mean over 225-239, and it is the 225 bp
  // members that wash through.
  it('judges a library on its smallest member', () => {
    const sh = sheetOf(fixture, 'zymo');
    // The sheet bins gel + cleanup + assembly, so `samples` is the first table; the size it
    // carries is the same one the cleanup judges on.
    const row = sh.samples.find((x) => x.construct === 'TL3A');
    expect(row['expected size']).toMatch(/225-239/);   // mean 231, floor 225 — both under 250
    expect(sh.protocol_values.zymo_cleanup.small_fragment).toBe(true);
  });

  it('leaves an ordinary cleanup alone', () => {
    const sh = sheetOf(path.join(root, 'test/fixtures/golden'), 'zymo');
    expect(sh?.protocol_values?.zymo_cleanup?.small_fragment).toBeUndefined();
    expect((sh?.notes || []).join(' ')).not.toMatch(/isopropanol/);
  });
});

// 10 -----------------------------------------------------------------------------------------
// One sheet bins several operations over the same samples, so a note attached to a SAMPLE is
// contributed once per design. The PCR chemistry note printed twice, three lines apart, on
// `Gel, cleanup and assembly`.
describe('the same sentence twice', () => {
  it('is said once', () => {
    const raw = spawnSync('node', [path.join(root, 'bin/c6-packet'), fixture],
                          { encoding: 'utf8', maxBuffer: 64e6 }).stdout;
    for (const sh of JSON.parse(raw).sheets) {
      const ns = sh.notes || [];
      expect(new Set(ns).size, `${sh.id}: ${ns.length} notes`).toBe(ns.length);
    }
  });

  // Two notes about two different tubes are two notes, and must both survive.
  it('and two different notes both survive', async () => {
    const { createLabSheet, addNote } = await import('../../src/labplanner/models/labsheet.js');
    const s = createLabSheet({ id: 'x', operation: 'PCR', tube: 'pcr', columns: ['label'] });
    addNote(s, 'a'); addNote(s, 'b'); addNote(s, 'a');
    expect(s.notes).toEqual(['a', 'b']);
  });
});

// 11 -----------------------------------------------------------------------------------------
// **A NOTE BELONGS TO THE OPERATION THAT SET IT.** JCA, 2026-09-13: *"'TL3A: 231 bp is under 250 —
// Taq rather than PrimeSTAR.' That comment does not make sense on a page about gel/zymo/assembly.
// That belonged on the pcr page."*
//
// The same job objects are re-binned into every later operation that touches the tube, and the
// sheet builder copied every sample's note onto every bin unconditionally. So a sentence about
// polymerase choice printed on a page about running a gel and spinning a column.
describe('a note on the wrong page', () => {
  const packet = () => JSON.parse(spawnSync('node', [path.join(root, 'bin/c6-packet'), fixture],
                                            { encoding: 'utf8', maxBuffer: 64e6 }).stdout);

  it('the PCR chemistry note is on the PCR sheet', () => {
    const sh = packet().sheets.find((s) => s.id.includes('pcr'));
    expect((sh.notes || []).join(' ')).toMatch(/Taq rather than PrimeSTAR/);
  });

  it('and on no other', () => {
    for (const sh of packet().sheets) {
      if (sh.id.includes('pcr')) continue;
      expect((sh.notes || []).join(' '), sh.id).not.toMatch(/Taq rather than PrimeSTAR/);
    }
  });

  // A note with no owner travels as before — that is how every other note still reaches its sheet.
  it('an unowned note still travels', async () => {
    const sh = packet().sheets.find((s) => (s.metadata?.operations || []).includes('zymo'));
    expect((sh.notes || []).join(' ')).toMatch(/isopropanol/);
  });
});

// 12 -----------------------------------------------------------------------------------------
// **A PCR SHEET NEEDING TWO ENZYMES TRANSCLUDED NEITHER.** `protocolModule` was set only when
// there was exactly one chemistry group, so a session mixing Taq and PrimeSTAR carried a table of
// reactions with no method under it. `c6-labplan` said so — *"no protocol module for: pcr"* — which
// is a hole reported rather than a hole filled.
//
// Tlib3 is the first experiment to reach it: a 231 bp library amplicon wants Taq, the 3.7 kb
// backbone wants PrimeSTAR. Lactis3 and the golden fixture are single-chemistry throughout.
describe('one session, two enzymes', () => {
  const pcrSheet = () => JSON.parse(
    spawnSync('node', [path.join(root, 'bin/c6-packet'), fixture],
              { encoding: 'utf8', maxBuffer: 64e6 }).stdout)
    .sheets.find((s) => (s.metadata?.operations || []).includes('pcr'));

  it('transcludes both protocols', () => {
    expect(Object.keys(pcrSheet().protocol_values || {}).sort())
      .toEqual(['primestar_pcr', 'taq_pcr']);
  });

  it('draws each as its own table with its own recipe', () => {
    const blocks = pcrSheet().blocks || [];
    const text = blocks.filter((b) => b.kind === 'text').map((b) => b.text).join(' ');
    expect(text).toMatch(/\{taq_pcr\}/);
    expect(text).toMatch(/\{primestar_pcr\}/);
    expect(blocks.filter((b) => b.kind === 'table').length).toBeGreaterThan(1);
  });

  it('keeps every reaction — neither is lost in the split', () => {
    const sh = pcrSheet();
    const all = JSON.stringify([sh.samples, sh.blocks]);
    expect(all).toMatch(/TL3A/);
    expect(all).toMatch(/bT/);
  });

  // The id is what every checkpoint slug and record-tab key is built from, so it describes the
  // session and not how many tables it happens to have. Splitting made it `s3-pcr-pcr`.
  it('does not say pcr twice in the id', () => {
    expect(pcrSheet().id).toBe('s3-pcr');
  });

  it('leaves a single-chemistry session exactly as it was', () => {
    const sh = JSON.parse(spawnSync('node', [path.join(root, 'bin/c6-packet'),
                                             path.join(root, 'test/fixtures/golden'),
                                             '--inventory', path.join(root, 'test/fixtures/golden/inventory.txt')],
                                    { encoding: 'utf8', maxBuffer: 64e6 }).stdout)
      .sheets.find((s) => (s.metadata?.operations || []).includes('pcr'));
    expect(Object.keys(sh.protocol_values || {})).toEqual(['primestar_pcr']);
    expect(sh.id).toBe('s3-pcr');
  });
});

// 13 -----------------------------------------------------------------------------------------
// **THE TWO PCR MODULES WERE NOT PARALLEL.** `primestar_pcr` declares `per_sample` — *"primers and
// template differ between reactions"* — and points at the Samples table when it is set.
// `taq_pcr` never declared it, so the design passed it and it was dropped:
// *"taq_pcr: given per_sample, which this module does not declare — ignored."*
//
// A Taq bin holding two different primer pairs would then print ONE pair as if it applied to both.
// That is the error `cycle_sequencing` was fixed for — a plausible, specific, wrong instruction —
// and it became reachable the moment a mixed-chemistry session became one bin per enzyme.
describe('the Taq module and the PrimeSTAR module say the same things', () => {
  const load = (n) => import(`../../src/labplanner/protocols/modules/${n}.js`);

  it('declare the same inputs', async () => {
    const [taq, ps] = await Promise.all([load('taq_pcr'), load('primestar_pcr')]);
    expect(taq.inputs.map((i) => i.name).sort()).toEqual(ps.inputs.map((i) => i.name).sort());
  });

  it('both point at the table when the reactions differ', async () => {
    for (const n of ['taq_pcr', 'primestar_pcr']) {
      const m = await load(n);
      const out = m.factory({ reactions: 2, per_sample: true });
      expect(out.description, n).toMatch(/Samples table/);
      expect(out.template, n).toMatch(/see the Samples table/);
    }
  });

  // **A PLACEHOLDER THAT LOOKS LIKE AN ANSWER IS WORSE THAN A BLANK.** With differing reactions
  // the caller sends no primer names, so the recipe fell back to its defaults and printed
  // `forward_oligo`, `reverse_oligo` and `template_dna` — which on a printed page read exactly
  // like real oligo names. `primestar_pcr` said "see the Samples table" in its description and
  // then did this three lines below it.
  it('and neither leaks a placeholder name into the recipe', async () => {
    for (const n of ['taq_pcr', 'primestar_pcr']) {
      const m = await load(n);
      expect(m.factory({ reactions: 2, per_sample: true }).template, n)
        .not.toMatch(/forward_oligo|reverse_oligo|template_dna/);
    }
  });

  it('and both name the pair when they do not', async () => {
    for (const n of ['taq_pcr', 'primestar_pcr']) {
      const m = await load(n);
      const out = m.factory({ reactions: 2, primer1_name: 'oA', primer2_name: 'oB',
                              template_name: 'pT' });
      expect(out.description, n).toMatch(/oA\/oB on pT/);
      expect(out.template, n).not.toMatch(/see the Samples table/);
    }
  });

  // A module given a value it does not declare says so and drops it. Nothing should now be doing
  // that on a compile we can run.
  it('no compile passes a value a module will drop', () => {
    for (const dir of [fixture, path.join(root, 'test/fixtures/golden')]) {
      const args = [path.join(root, 'bin/c6-labplan'), dir, '--out',
                    path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'par-')), 'b.xlsx')];
      const r = spawnSync('node', args, { encoding: 'utf8' });
      expect((r.stdout || '') + (r.stderr || ''), dir).not.toMatch(/which this module does not declare/);
    }
  });
});
