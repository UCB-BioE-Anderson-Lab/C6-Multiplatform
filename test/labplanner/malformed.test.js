/**
 * What happens when the input is not what the toolkit expected.
 *
 * **EVERY TEST BEFORE THIS ONE USED A WELL-FORMED EXPERIMENT.** Compiling six deliberately broken
 * projects on 2026-09-13 found one thing that mattered: a construction file with two PCRs both
 * producing `frag` compiled into ELEVEN PRINTABLE LABSHEETS, exit 0, with `DUPLICATE_PRODUCT`
 * carried in the packet's JSON and mentioned nowhere. A sheet saying "fetch frag" names two
 * different tubes and somebody picks one.
 *
 * The others behaved: an empty folder, a cycle and a blank file all refused with a reason, and a
 * PCR with no oligos produced a sheet with visibly empty oligo columns that says why — honest,
 * which is the whole bar.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { planExperiment, FATAL } from '../../src/labplanner/planning/planExperiment.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const CHAR = 'Retransform\tpX\thost=L.lactis antibiotic=Erm\tpX_h\n'
           + 'Pick\tpX_h\tn=4 phenotype=growing on the selective plate\tpX_c\nAssay\tpX_c\tprotocol=plate_reader_fluorescence\tr\n';

const project = (files) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'malformed-'));
  for (const [n, t] of Object.entries(files)) fs.writeFileSync(path.join(d, n), t);
  return d;
};
const packet = (dir, extra = []) =>
  spawnSync('node', [path.join(root, 'bin/c6-packet'), dir, ...extra],
            { encoding: 'utf8', maxBuffer: 64e6 });

describe('a problem that makes a sheet ambiguous stops the packet', () => {
  const dupe = () => project({
    'Construction of pX.txt': 'PCR\tbo1\tbo2\tpS\tfrag\nPCR\tbo3\tbo4\tpS\tfrag\n'
                            + 'Transform\tfrag\tMach1\tErm\t37\tpX\n',
    'Characterization of pX.txt': CHAR,
  });

  it('two DNAs under one name is fatal, and named', () => {
    const r = packet(dupe());
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/DUPLICATE_PRODUCT/);
    expect(r.stderr).toMatch(/untrustworthy/);
    expect(r.stdout.trim()).toBe('');            // nothing was handed over
  });

  it('the gate reports it rather than stack-tracing', () => {
    // `execFileSync` throws on a non-zero exit, which printed a Node stack over the explanation.
    // The same mistake was made once before, one layer down, with c6-plan.
    const dir = dupe();
    const r = spawnSync('node', [path.join(root, 'bin/c6-labplan'), dir,
                                 '--out', path.join(dir, 'w.xlsx')],
                        { encoding: 'utf8', maxBuffer: 64e6 });
    expect(r.status).toBe(2);
    expect(r.stderr).not.toMatch(/at (Object|Module|node:)/);
    expect(r.stderr).toMatch(/no workbook was written/);
    expect(fs.existsSync(path.join(dir, 'w.xlsx'))).toBe(false);
  });

  it('every fatal code is one the planner can actually emit', () => {
    // WALK THE TWO DIRECTORIES; DO NOT LIST THE FILES.
    //
    // This named four files by hand, and `validate/characterizationFile.js` was not one of them —
    // so when PICK_WITHOUT_PHENOTYPE became fatal on 2026-09-18 this reported that nothing emits
    // it, about a code emitted forty lines into a file the list did not mention. The third
    // hand-maintained list to go stale that day, after `bin/selftest.py`'s suite list and
    // `projectSequences`' oligo pattern.
    const emitted = new Set();
    const scan = (dir) => {
      for (const f of fs.readdirSync(path.join(root, 'src/labplanner', dir))) {
        if (!f.endsWith('.js')) continue;
        const src = fs.readFileSync(path.join(root, 'src/labplanner', dir, f), 'utf8');
        for (const m of src.matchAll(/code: '([A-Z_]+)'/g)) emitted.add(m[1]);
      }
    };
    scan('planning');
    scan('validate');
    for (const code of FATAL) expect(emitted, `FATAL names ${code}, which nothing emits`)
      .toContain(code);
  });
});

describe('what it refuses, with a reason', () => {
  it('a folder with no construction file', () => {
    const r = packet(project({ 'notes.md': 'hello' }));
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/no construction files/);
  });

  it('an empty construction file', () => {
    const r = packet(project({ 'Construction of pX.txt': '' }));
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/no format this reader recognises/);
  });

  it('a cycle', () => {
    const r = packet(project({ 'Construction of pA.txt':
      'PCR\tbo1\tbo2\tB\tA\nPCR\tbo3\tbo4\tA\tB\n' }));
    expect(r.status).toBe(2);
  });
});

describe('what it compiles honestly rather than refusing', () => {
  // A PCR WITH NO PRIMERS IS A SHEET WITH NO PRIMERS ON IT, which is the right answer: the columns
  // are visibly empty and the notes say the product size could not be computed and why. Refusing
  // would be wrong — somebody may genuinely not have chosen them yet.
  it('a PCR with no oligos', () => {
    const out = planExperiment({ cfs: [{ name: 'pX',
      text: 'PCR\t\t\tpS\tfrag\nTransform\tfrag\tMach1\tErm\t37\tpX\n' }] });
    expect(out.problems.filter((p) => FATAL.has(p.code))).toEqual([]);
    const pcr = out.sheets.find((s) => s.operation === 'pcr');
    expect(pcr.samples[0].oligos.filter(Boolean)).toEqual([]);
  });

  // A characterization file with no construction file is a real case: the plasmid already exists
  // and somebody wants to characterise it.
  it('a characterization file on its own', () => {
    const out = planExperiment({ cfs: [{ name: 'pX', characterization: true, text: CHAR }] });
    expect(out.problems.filter((p) => FATAL.has(p.code))).toEqual([]);
    expect(out.sheets.length).toBeGreaterThan(0);
  });
});
