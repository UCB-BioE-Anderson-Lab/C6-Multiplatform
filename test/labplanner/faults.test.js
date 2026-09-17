/**
 * Every broken input still produces the message it was written to produce.
 *
 * **THE FAULT FIXTURES HAD NO TEST.** Fifteen deliberately-broken files, each declaring the problem
 * code it demonstrates and a fragment its message must contain, and the only thing that ever ran
 * them was `bin/c6-report` — which renders them into a 260 kB HTML page that nobody diffs. A fault
 * that quietly stopped reporting would have changed one paragraph of that page and failed nothing.
 *
 * `says` is the point of the file and not decoration. A failure with the wrong words passes any
 * check that only asks whether it failed, and the words are the entire value of a refusal: the
 * person reading them is at a bench with a file they cannot compile.
 *
 * Both readers run, because the codes come from two places and neither knows about the other:
 * `validateConstructionFile` is called by `bin/c6-check` and by nothing in the planner, so a check
 * that ran only the planner would miss four of these. → `scenarios/coverage.js § reach`
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FAULTS, FAULT_SEQUENCES } from '../../src/labplanner/scenarios/faults.js';
import { compileScenario, filesOf } from '../../src/labplanner/scenarios/compile.js';
import { validateConstructionFile } from '../../src/labplanner/validate/constructionFile.js';

const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'c6-faults-'));

/** Everything both readers said about one fault's folder, as `{code, message}` rows. */
function reportOn(f) {
  const dir = path.join(OUT, f.id);
  fs.mkdirSync(dir, { recursive: true });
  // SEQUENCES FIRST, THE BROKEN FILES OVER THEM, so a fault naming its own wins and every other
  // fault's PCRs still simulate — otherwise each one also reports PCR_NOT_SIMULATED and the
  // message being demonstrated arrives third in a list. → `faults.js § FAULT_SEQUENCES`
  for (const [n, t] of Object.entries({ ...FAULT_SEQUENCES, ...f.files })) {
    fs.writeFileSync(path.join(dir, n), t);
  }
  const out = [];
  const log = console.log;
  console.log = () => {};
  try {
    for (const cf of filesOf(dir)) {
      if (cf.characterization) continue;
      for (const v of validateConstructionFile(cf.text, cf.name).findings || []) out.push(v);
    }
    const r = compileScenario(dir);
    if (r.outcome === 'compiles') out.push(...(r.plan.problems || []));
    else out.push({ code: '(threw)', message: r.message });
  } finally { console.log = log; }
  return out;
}

describe.each(FAULTS.filter((f) => f.code))('the fault $id', (f) => {
  const got = reportOn(f);

  it(`reports ${f.code}`, () => {
    expect(got.map((p) => p.code),
      `nothing reported ${f.code}. What was reported: ${got.map((p) => p.code).join(', ') || 'nothing at all'}`)
      .toContain(f.code);
  });

  it(`says "${f.says}"`, () => {
    const mine = got.filter((p) => p.code === f.code).map((p) => p.message).join('\n');
    expect(mine, `the ${f.code} message never mentions "${f.says}", so it names the fault `
      + 'without naming the thing that caused it').toContain(f.says);
  });
});
