/**
 * How much of the decision surface anybody has actually ruled on, and how much merely ran.
 *
 * JCA, 2026-09-16: *"How complete are we though? How do we know we've covered all scenarios? Or is
 * it impossible to anticipate all scenarios?"*
 *
 * **SCENARIOS ARE UNBOUNDED. DECISIONS ARE NOT.** Nobody can enumerate the experiments a lab will
 * write — the inputs are free text and the combinations multiply without limit. But every one of
 * those experiments is compiled by a finite, countable set of decisions: the rules in the rule
 * tables, the design modules, the problem codes. That set can be listed, and a compile can be
 * watched to see which members of it were reached. "Have we covered every scenario?" is
 * unanswerable. "Which decisions has nobody looked at?" is answerable, and it is the useful one.
 *
 * ## Two questions, and only one of them is about running
 *
 *   REACHED    a compile took this path. Mechanical, exact, and already ratcheted — a rule going
 *              cold fails `scenarios.test.js § COLD`. It says the path does not crash.
 *   RULED ON   a claim on `docs/REPORT.html` asserts something about it and JCA answered true or
 *              false. It says somebody who can tell looked at what it produced.
 *
 * A green suite gives the first and cannot give the second. That gap is the point of this file.
 *
 * ## What "ruled on" can honestly be measured for, and what it cannot
 *
 * **DESIGNS AND CODES: YES. RULES: NO, AND THE DIFFERENCE MATTERS.**
 *
 *   designs   the evidence extractor NAMES the operation whose sheet it goes and finds, and carries
 *             it as `.op`. Structural attribution. → `claims.js § tag`
 *   codes     a fault fixture declares the one code it demonstrates, and a fault claim points at
 *             one fixture. Structural attribution. → `faults.js`
 *   rules     NOT ATTRIBUTABLE, and an earlier draft of this file said it was. One scenario fires
 *             about forty rules; a claim pinning one sentence of that run has asserted nothing
 *             about the other thirty-nine. Counting them all as "claimed" produced 52 of 54, which
 *             looked excellent and meant only that the runs behind the claims are ordinary
 *             experiments. Rules are reported as REACHED only, which is what a trace can see.
 *
 * ## What none of it can see
 *
 *   - **Correct decisions composing badly.** Four constructs each picked into A1 — every rule
 *     right, the combination wrong, both rules at full coverage throughout.
 *   - **A decision that should exist and does not.** JCA on claim 14: *"not all these controls are
 *     needed when transforming miniprep DNA"* — a missing distinction. No count of what exists
 *     finds what is absent. Only a reader does.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { trace } from '../rules/lib.js';
import { everyScenario } from './scenarios.js';
import { writeScenario } from './generate.js';
import { FAULTS, FAULT_SEQUENCES } from './faults.js';
import { CLAIMS } from './claims.js';
import { compileScenario, returnedSheets, filesOf } from './compile.js';
import { validateConstructionFile } from '../validate/constructionFile.js';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Every rule in every table, as `file.id` plus the key `trace()` tallies under. */
export async function everyRule() {
  const dir = path.join(SRC, 'rules');
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.rules.js')).sort()) {
    const m = await import(path.join(dir, f));
    for (const r of m.RULES || []) out.push({ id: `${f.replace('.rules.js', '')}.${r.id}`, key: `${m.TITLE}·${r.id}` });
  }
  return out;
}

/** The design modules — one per operation the compiler knows how to lay out. */
export const everyDesign = () => fs.readdirSync(path.join(SRC, 'design'))
  .filter((f) => /^[a-z]+\.js$/.test(f) && !['index.js', 'util.js', '_default.js'].includes(f))
  .map((f) => f.replace('.js', '')).sort();

/** Every problem code the planner and the validators can emit. */
export const everyCode = () => [...new Set(
  ['planning', 'validate'].flatMap((d) => fs.readdirSync(path.join(SRC, d))
    .filter((f) => f.endsWith('.js'))
    .flatMap((f) => fs.readFileSync(path.join(SRC, d, f), 'utf8').match(/code: *'[A-Z_]{4,}'/g) || [])
    .map((s) => s.replace(/.*'(.*)'/, '$1'))),
)].sort();

function writeFault(f, into) {
  const dir = path.join(into, `fault-${f.id}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const [n, t] of Object.entries({ ...FAULT_SEQUENCES, ...f.files })) {
    fs.writeFileSync(path.join(dir, n), t);
  }
  return dir;
}

/**
 * Compile a folder and collect everything reached — operations laid out, codes reported, rules
 * fired past the end of the compile.
 *
 * **THE VALIDATORS RUN HERE TOO, and an earlier draft forgot them.** `validateConstructionFile`
 * is called by `bin/c6-check` and by nothing in the planner, so four codes with working fault
 * fixtures — `USE_BEFORE_PRODUCED`, `DANGLING_PRODUCT`, `DUPLICATE_INPUT`, `LONG_NAME` — measured
 * as unreachable when they are demonstrated every time the suite runs. A ratchet that measures
 * less than the toolkit does reports gaps that are not there, which is worse than no ratchet: it
 * sends somebody off to build the thing nobody needed.
 */
function reach(dir, into) {
  // QUIET, AND NOT BECAUSE OF ANYTHING IN THIS FILE. `parseCF` in `src/C6-Sim.js` writes a debug
  // line on every call; `bin/c6-check` suppresses the same one for the same reason and says why.
  const log = console.log;
  console.log = () => {};
  try {
    for (const cf of filesOf(dir)) {
      if (cf.characterization) continue;
      // `.findings`, NOT `.problems` — the validators and the planner name the same thing
      // differently, and reading the wrong one here silently measured four working codes as
      // unreachable. An absent field reads as an empty list, which is a gap that looks like data.
      for (const f of validateConstructionFile(cf.text, cf.name).findings || []) into.codes.add(f.code);
    }
  } finally { console.log = log; }
  const r = compileScenario(dir);
  if (r.outcome !== 'compiles') return r;
  returnedSheets(r);
  for (const s of r.packet.sheets) for (const o of s.metadata.operations || []) into.ops.add(o);
  for (const p of r.plan.problems || []) into.codes.add(p.code);
  return r;
}

/**
 * Measure it.
 *
 * @returns {{rules:Array, designs:Array, codes:Array, counts:Object, runs:number}}
 */
export async function coverage() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'c6-coverage-'));
  const found = { ops: new Set(), codes: new Set() };

  const stop = trace();
  for (const s of everyScenario()) reach(writeScenario(s, tmp), found);
  for (const f of FAULTS) reach(writeFault(f, tmp), found);
  const fired = stop();
  fs.rmSync(tmp, { recursive: true, force: true });

  // WHAT A CLAIM ASSERTS ABOUT, read off its structure rather than its prose.
  const claimedOps = new Set(CLAIMS.map((c) => c.show && c.show.op).filter(Boolean));
  const claimedCodes = new Set(FAULTS.filter((f) => f.code
    && CLAIMS.some((c) => c.from.fault === f.id)).map((f) => f.code));

  const rules = (await everyRule()).map((r) => ({ id: r.id, reached: (fired.get(r.key) || 0) > 0 }));
  const designs = everyDesign().map((d) => ({ id: d, reached: found.ops.has(d), ruled: claimedOps.has(d) }));
  const codes = everyCode().map((c) => ({ id: c, reached: found.codes.has(c), ruled: claimedCodes.has(c) }));

  const tally = (xs) => ({ total: xs.length,
                           reached: xs.filter((x) => x.reached).length,
                           ruled: xs.filter((x) => x.ruled).length });
  return { rules, designs, codes, runs: new Set(CLAIMS.map((c) => c.from.fault || c.from.scenario)).size,
           counts: { rules: tally(rules), designs: tally(designs), codes: tally(codes) } };
}
