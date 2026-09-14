/**
 * Every rule set is actually reached when a real experiment compiles.
 *
 * JCA, 2026-09-13: *"can we do a test to confirm that all these rules are actually plumbed into
 * the system?"*
 *
 * **THE ANSWER WAS NO, AND THIS FOUND IT.** `culture.rules.js` — how much a colony grows in and a
 * miniprep pellets — was written, documented, printed by `c6-rules` and exercised by its own unit
 * tests, and nothing in the compiler called it. The CONSTANT had been wired and the rules had not,
 * so the file read as live from every angle except the only one that counts.
 *
 * That is this repository's most persistent shape: a correct mechanism wired to nothing. The Zymo
 * small-fragment mode, `taq_pcr`'s `per_sample`, and `binPCRRuns.js` were all the same thing, and
 * none of them was visible by reading either half.
 *
 * So the applier records which rules fire, and this compiles the real experiments and asks.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { trace } from '../../src/labplanner/rules/lib.js';
import { planExperiment } from '../../src/labplanner/planning/planExperiment.js';
import { jobsToLabSheets } from '../../src/labplanner/planning/jobsToLabSheets.js';
import { projectSequences } from '../../src/labplanner/planning/projectSequences.js';
import { ensureInventory, mergeInventories } from '../../src/inventory/io.js';
import { spotsNeeded, issue, resolve } from '../../src/labplanner/planning/issue.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const RULES_DIR = path.join(root, 'src/labplanner/rules');

const invOf = (p) => {
  if (!p || !fs.existsSync(p)) return null;
  const files = fs.statSync(p).isDirectory()
    ? fs.readdirSync(p).filter((f) => /\.(txt|tsv|csv|json)$/i.test(f)).map((f) => path.join(p, f))
    : [p];
  let inv = null;
  for (const f of files) {
    try {
      const one = ensureInventory(fs.readFileSync(f, 'utf8'), path.basename(f));
      inv = inv ? mergeInventories(inv, one) : one;
    } catch { /* absence-ok: an unreadable box is the planner's problem to name, not this test's */ }
  }
  return inv;
};

/** Compile an experiment the way the pipeline does, and run the lifecycle over what it makes. */
function compile(dir, invPath) {
  const cfs = fs.readdirSync(dir)
    .filter((f) => /^(construction|characterization) of .*\.txt$/i.test(f))
    .map((n) => ({ name: n.replace(/^(construction|characterization) of |\.txt$/gi, ''),
                   text: fs.readFileSync(path.join(dir, n), 'utf8'),
                   characterization: /^characterization/i.test(n) }));
  const inv = invOf(invPath);
  const log = console.log;
  console.log = () => {};
  try {
    const plan = planExperiment({ cfs, sequences: projectSequences(dir), inventory: inv });
    const packet = jobsToLabSheets(plan, { experiment: path.basename(dir) });
    // ISSUE AND RECEIVE TOO, because the receipt rules are the highest-consequence set and they
    // live past the end of a compile. One tube comes back blank and the rest where they were put,
    // which is the ordinary case plus the abandoned one.
    const needed = spotsNeeded({ sheets: packet.sheets });
    if (needed.length && inv) {
      const iss = issue(inv, needed, { by: 'plumbing-test', since: '2026-09-13' });
      const back = {};
      for (const [i, a] of iss.assignments.entries()) back[a.construct] = i === 0 ? '' : a.well;
      resolve(iss.inventory, iss.assignments, back, { proposed: iss.proposed });
    }
  } finally { console.log = log; }
}

const PROJECTS = [
  [path.join(root, 'test/fixtures/golden'), path.join(root, 'test/fixtures/golden/inventory.txt')],
  // TLIB3 CARRIES ITS OWN SMALL FREEZER, so this test reaches outside nothing — and so that the
  // issue-and-receive half runs at all: golden's characterization has no miniprep, so it asks for
  // no boxes and the receipt rules are never touched by it.
  [path.join(root, 'test/fixtures/tlib3'), path.join(root, 'test/fixtures/tlib3/inventory.txt')],
];

describe('every rule set is plumbed in', () => {
  const declared = new Map();      // "TITLE·ruleId" -> file
  const fired = (() => {
    const stop = trace();
    for (const [dir, inv] of PROJECTS) if (fs.existsSync(dir)) compile(dir, inv);
    return stop();
  })();

  it('finds the rule files', async () => {
    for (const f of fs.readdirSync(RULES_DIR).filter((x) => x.endsWith('.rules.js'))) {
      const m = await import(path.join(RULES_DIR, f));
      for (const r of m.RULES || []) declared.set(`${m.TITLE}·${r.id}`, f.replace('.rules.js', ''));
    }
    expect(declared.size).toBeGreaterThan(40);
  });

  // **THE CHECK THAT MATTERS.** A rule set no compile reaches is a file nothing calls, however
  // well it reads and however green its own unit tests are.
  it('reaches every rule set', async () => {
    const sets = new Map();
    for (const f of fs.readdirSync(RULES_DIR).filter((x) => x.endsWith('.rules.js'))) {
      const m = await import(path.join(RULES_DIR, f));
      const name = f.replace('.rules.js', '');
      sets.set(name, (m.RULES || []).some((r) => (fired.get(`${m.TITLE}·${r.id}`) || 0) > 0));
    }
    const cold = [...sets].filter(([, hot]) => !hot).map(([n]) => n);
    expect(cold, `rule set(s) no compile reaches: ${cold.join(', ')}`).toEqual([]);
  });

  // Individual rules may legitimately never fire on two experiments — an unreadable antibiotic, a
  // well outside its box. Those are the cases nobody has had yet, and their absence is not a
  // defect. But the number is worth watching: if it climbs, rules are being written for situations
  // that do not occur.
  it('reaches most rules, and says which it does not', async () => {
    const cold = [];
    for (const f of fs.readdirSync(RULES_DIR).filter((x) => x.endsWith('.rules.js'))) {
      const m = await import(path.join(RULES_DIR, f));
      for (const r of m.RULES || []) {
        if (!(fired.get(`${m.TITLE}·${r.id}`) || 0)) cold.push(`${f.replace('.rules.js', '')}.${r.id}`);
      }
    }
    // Two real experiments exercise a little over half. The rest are refusals and edge cases.
    expect(cold.length, `never fired: ${cold.join(', ')}`).toBeLessThan(30);
  });
});
