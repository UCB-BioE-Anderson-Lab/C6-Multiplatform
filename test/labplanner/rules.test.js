/**
 * A rule set is the code, not a description of it.
 *
 * JCA, 2026-09-13: *"you've got a lot of syntax mixed in with the domain logic, that will make it
 * hard to follow."* The answer was not to reformat — `choosePCRProgram.js` was already 46 comment
 * lines out of 106 — but to make the rules a list of `{when, then, why, applies, decide}` objects
 * that `bin/c6-rules` renders and `annotatePCRPrograms` applies.
 *
 * **The whole value is that those are the same list.** A printed table that merely agreed with the
 * code would be a second description to keep in step, which is the defect this repository keeps
 * finding. These tests hold the shape that makes drift impossible.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as rules from '../../src/labplanner/rules/pcrProgram.rules.js';
import { annotatePCRPrograms } from '../../src/labplanner/planning/choosePCRProgram.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

describe('every rule states itself', () => {
  it('has a when, a then and a why', () => {
    for (const r of rules.RULES) {
      expect(r.name, JSON.stringify(r)).toBeTruthy();
      for (const k of ['when', 'then', 'why']) {
        expect(String(r[k] || ''), `${r.name}.${k}`).not.toBe('');
      }
      expect(typeof r.applies, r.name).toBe('function');
      expect(typeof r.decide, r.name).toBe('function');
    }
  });

  // A rule whose reason cannot be stated in a sentence is one nobody has finished thinking about.
  it('gives a reason long enough to be one', () => {
    for (const r of rules.RULES) expect(r.why.length, r.name).toBeGreaterThan(40);
  });

  it('and every fact says what it is and what its unknown means', () => {
    for (const f of rules.FACTS) {
      expect(String(f.is || ''), f.name).not.toBe('');
      expect(typeof f.of, f.name).toBe('function');
    }
  });
});

describe('the printed table is the rule list', () => {
  // Compared with whitespace collapsed: the printer wraps to a column, so a rule's sentence is
  // split across lines on the page and contiguous only as text.
  const flat = (t) => String(t).replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  const out = flat(execFileSync('node', [path.join(root, 'bin/c6-rules')], { encoding: 'utf8' }));

  it('prints every rule', () => {
    for (const r of rules.RULES) expect(out, r.name).toContain(flat(r.when));
  });

  it('prints them in the order they are tried', () => {
    // ORDER IS PART OF THE DOMAIN: `long product` sits above `ordinary product` because both apply
    // over 8 kb. A table that sorted them would be a different rule set.
    const at = rules.RULES.map((r) => out.indexOf(flat(r.when)));
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('prints the why, which is the part a person checks', () => {
    for (const r of rules.RULES) expect(out, r.name).toContain(flat(r.why).split('.')[0]);
  });
});

describe('the planner applies the rules and does nothing else', () => {
  // The adapter must not re-implement a threshold. If `choosePCRProgram.js` grows a number of its
  // own, the table stops being the whole story and this is how we find out.
  it('the adapter holds no thresholds', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/labplanner/planning/choosePCRProgram.js'), 'utf8');
    const code = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
    expect(code.join('\n')).not.toMatch(/\b(250|45|55|8000|1000)\b/);
  });

  // Every branch of the rule set, through the real entry point.
  const run = (bp, oligos, seqs) => {
    const job = { operation: 'pcr', productBp: bp, oligos, sizeNote: 'not simulated' };
    annotatePCRPrograms([job], { sequences: { oligos: seqs } });
    return job;
  };
  const CLEAN = { a: 'ACGTACGT', b: 'ACGTACGT' };
  const DEGEN = { a: 'ACGTNNNN', b: 'ACGTACGT' };

  it.each([
    ['no size',      null,  CLEAN, { program: null, chemistry: null }],
    ['short',        231,   CLEAN, { program: '55', chemistry: 'taq' }],
    ['short degen',  231,   DEGEN, { program: '45', chemistry: 'taq' }],
    ['ordinary',     3762,  CLEAN, { program: 'PG4K55', chemistry: 'primestar' }],
    ['ordinary deg', 3762,  DEGEN, { program: 'PG4K45', chemistry: 'primestar' }],
    ['exactly 8 kb', 8000,  CLEAN, { program: 'PG8K55', chemistry: 'primestar' }],
    ['over 8 kb',    14000, CLEAN, { program: 'PGXL4', chemistry: 'primestar' }],
  ])('%s', (_name, bp, seqs, want) => {
    const j = run(bp, ['a', 'b'], seqs);
    expect({ program: j.program ?? null, chemistry: j.chemistry ?? null }).toEqual(want);
  });

  // **THE THIRD STATE.** Concluding "not degenerate" from an empty list anneals a library at 55 °C.
  it('unknown degeneracy still gets a program, and says it was assumed', () => {
    const j = run(3000, ['a', 'missing'], CLEAN);
    expect(j.program).toBe('PG4K55');
    expect(j.programNote).toMatch(/could not be checked/);
  });

  // A reaction with no program has nothing to say about its annealing temperature.
  it('a refusal is not decorated with an anneal remark', () => {
    expect(run(null, ['a', 'b'], CLEAN).programNote).not.toMatch(/anneal/);
  });
});
