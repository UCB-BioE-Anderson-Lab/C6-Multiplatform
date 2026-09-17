/**
 * The evidence behind every claim, as data, so a ruling can be frozen.
 *
 * JCA's plan, 2026-09-16: *"you devise a series of examples to run that shows both happy and
 * aberrant path behavior, you run those and make an HTML report that lives on the repo. I read that
 * report, and either tell you about issues, missing edge cases to test, or whatever, and we modify
 * until we are both happy with the report, and then we convert the report into golden fixtures."*
 *
 * This is the conversion. Forty-eight sentences have been read and answered; what was missing is
 * anything that fails when the thing behind one of them changes. `docs/REPORT.html` is regenerated
 * from scratch every time, so a table that starts saying something different just says something
 * different, in a 260 kB page nobody diffs.
 *
 * **THE FAILURE THIS CLOSES HAS ALREADY HAPPENED TWICE.** A picking note said "4 clones in a
 * 24-well block" over a table of sixteen, on six sheets, green throughout. A CYCLE refusal printed
 * `undefined` where its message belonged. Both were invisible because no test read what a sheet
 * SAYS — only that it compiled. → `test/labplanner/claims-golden.test.js`
 *
 * ## What this covers and what it does not
 *
 * It freezes what a claim's own extractor pulls out of a real compile: the table, the note, the
 * problems. It does not freeze the whole packet — that is `test/fixtures/golden/SNAPSHOT.txt`, one
 * experiment, and the two are complementary. A packet snapshot catches any change to one
 * experiment; this catches a change to the specific thing somebody agreed to, across twenty-nine
 * runs, and says which ruling it broke.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CLAIMS, RULED, groups } from './claims.js';
import { scenario } from './scenarios.js';
import { writeScenario } from './generate.js';
import { fault, FAULT_SEQUENCES } from './faults.js';
import { compileScenario, filesOf } from './compile.js';
import { validateConstructionFile } from '../validate/constructionFile.js';

/** Lay a fault's files over the shared sequences. → `faults.js § FAULT_SEQUENCES` */
function writeFault(f, into) {
  const dir = path.join(into, `fault-${f.id}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const [n, t] of Object.entries({ ...FAULT_SEQUENCES, ...f.files })) {
    fs.writeFileSync(path.join(dir, n), t);
  }
  return dir;
}

/**
 * Compile every folder a claim points at, once each.
 *
 * **BOTH READERS RUN**, because a refusal can come from either and neither knows about the other:
 * `validateConstructionFile` is called by `bin/c6-check` and by nothing in the planner. A snapshot
 * that ran only the planner would freeze four codes as absent that fire every time.
 */
function runAll() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c6-claims-'));
  const out = new Map();
  for (const c of CLAIMS) {
    const key = c.from.fault ? `fault:${c.from.fault}` : `scenario:${c.from.scenario}`;
    if (out.has(key)) continue;
    const dir = c.from.fault ? writeFault(fault(c.from.fault), tmp)
                             : writeScenario(scenario(c.from.scenario), tmp);
    const said = [];
    const log = console.log;
    console.log = () => {};
    try {
      for (const cf of filesOf(dir)) {
        if (cf.characterization) continue;
        for (const v of validateConstructionFile(cf.text, cf.name).findings || []) {
          said.push(`${v.code}  ${v.message}`);
        }
      }
      const r = compileScenario(dir);
      if (r.outcome === 'compiles') {
        for (const p of r.plan.problems || []) said.push(`${p.code}  ${p.message}`);
        out.set(key, { packet: r.packet, said });
      } else {
        out.set(key, { packet: null, said: [...said, `refused  ${r.message}`] });
      }
    } finally { console.log = log; }
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
}

/** One claim's evidence, flattened to lines a person can read in a diff. */
function linesOf(c, got) {
  if (!got) return ['(nothing ran)'];
  if (c.show === 'message') {
    // SORTED, because two validators reporting the same file may finish in either order and a
    // snapshot that churns on ordering is a snapshot people re-record without reading.
    return got.said.length ? [...got.said].sort() : ['(said nothing)'];
  }
  if (!got.packet) return ['(no packet)'];
  const e = c.show(got.packet);
  if (!e) return ['(NO EVIDENCE — this claim shows nothing)'];
  const out = [`caption: ${e.caption}`];
  if (e.lines) out.push(...e.lines.map((l) => `  ${l}`));
  if (e.cols) {
    out.push(`  | ${e.cols.join(' | ')}`);
    for (const r of e.rows) out.push(`  | ${r.join(' | ')}`);
    if (e.more) out.push(`  … and ${e.more} more`);
  }
  return out;
}

/**
 * The whole snapshot, as text.
 *
 * Each block carries the RULING DATE, so a failure can say which agreement it breaks rather than
 * only which line moved.
 */
export function snapshot() {
  const ran = runAll();
  const out = [];
  let n = 0;
  for (const g of groups()) {
    for (const c of CLAIMS.filter((x) => x.group === g)) {
      n += 1;
      const key = c.from.fault ? `fault:${c.from.fault}` : `scenario:${c.from.scenario}`;
      const ruled = RULED.get(c.id);
      out.push(`## ${n}  ${c.id}`);
      out.push(`ruled: ${ruled ? `true, ${ruled}` : 'NOT YET ANSWERED'}`);
      out.push(`from: ${key}`);
      out.push(`says: ${c.claim.replace(/\s+/g, ' ')}`);
      for (const l of linesOf(c, ran.get(key))) out.push(l);
      out.push('');
    }
  }
  return out.join('\n');
}
