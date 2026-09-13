/**
 * Decisions the compiler will not make by rule. GATE 4 of `docs/TOOLKIT-PLAN.md`.
 *
 * JCA, 2026-09-12: *"It has code-defined things like pcr program selection whenever things can be
 * done strictly logically. It has other pieces like making up an acronym for the PCR labels that an
 * LLM call needs to make. That LLM could be a full cortex context, such that the full situation can
 * be considered in choosing those label names."*
 *
 * The property these tests are really defending is that **the compile never calls a model.** A
 * compile that asks one mid-run produces different sheets on different days for reasons nobody
 * recorded, which is the condition the whole toolkit was built to end.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DECISIONS, decide, pending } from '../../src/labplanner/planning/decisions/index.js';
import { jobsToLabSheets } from '../../src/labplanner/planning/jobsToLabSheets.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const fixture = path.join(root, 'test/fixtures/golden');
const packet = (extra = []) => JSON.parse(execFileSync('node',
  [path.join(root, 'bin/c6-packet'), fixture, '--inventory', path.join(fixture, 'inventory.txt'),
   ...extra], { encoding: 'utf8', maxBuffer: 64e6 }));

const ctx = (over = {}) => ({ experiment: 'Lactis3', constructs: ['pBET8'], tubes: 8,
                              hasStripTubes: true, ...over });

describe('the contract', () => {
  it('every decision declares a question, a prompt, a schema and a check', () => {
    for (const [id, d] of Object.entries(DECISIONS)) {
      expect(d.id, id).toBe(id);
      expect(typeof d.question, id).toBe('string');
      expect(typeof d.prompt, id).toBe('function');
      expect(d.schema, id).toBeTruthy();
      expect(typeof d.check, id).toBe('function');
      expect(typeof d.fallback, id).toBe('function');
    }
  });

  // A SPECIFICATION THAT CONTRADICTS ITS OWN VALIDATOR gets the model blamed for a mistake that is
  // ours. The prefix schema advertised two-or-three characters while `check` rejected three for any
  // experiment with PCRs in it.
  it('what the schema advertises is what the check accepts', () => {
    for (const [id, d] of Object.entries(DECISIONS)) {
      for (const c of [ctx(), ctx({ hasStripTubes: false })]) {
        const schema = typeof d.schema === 'function' ? d.schema(c) : d.schema;
        if (!schema.maxLength) continue;
        const tooLong = 'A'.repeat(schema.maxLength + 1);
        expect(d.check(tooLong, c).length, `${id} accepts ${tooLong}`).toBeGreaterThan(0);
      }
    }
  });

  it('the prompt never contains the fallback', () => {
    // A suggestion in a prompt is an answer with extra steps.
    for (const [id, d] of Object.entries(DECISIONS)) {
      const c = ctx();
      const back = d.fallback(c);
      if (!back) continue;
      const asked = d.prompt(c);
      // `L3` appears in the prompt as a worked example of the FORM. What must not appear is the
      // fallback computed for THIS experiment, presented as the answer.
      expect(asked).not.toMatch(new RegExp(`(suggest|recommend|default)[^.]*${back.value}`, 'i'));
    }
  });
});

describe('labelPrefix', () => {
  it('falls back to the rule and says so, rather than refusing', () => {
    const got = decide('labelPrefix', ctx(), {});
    expect(got.value).toBe('L3');
    expect(got.source).toBe('fallback');
    expect(got.why).toMatch(/folder name/);
    // The question still reaches the sheet: what was NOT checked is the part somebody needs.
    expect(got.open).toMatch(/not checked against other experiments/);
  });

  it('uses an answer when one is on file, and goes quiet', () => {
    const got = decide('labelPrefix', ctx(), { labelPrefix: 'Lc' });
    expect(got).toMatchObject({ value: 'Lc', source: 'answered', open: null });
  });

  // AN ANSWER IS CHECKED, NOT TRUSTED. It came from a model or from somebody typing into JSON, and
  // the mechanical half of the question is exactly the half neither is good at.
  it('rejects an answer that will not fit the cap, and says which', () => {
    const got = decide('labelPrefix', ctx(), { labelPrefix: 'Lac' });
    expect(got.source).toBe('fallback');
    expect(got.value).toBe('L3');
    expect(got.why).toMatch(/rejected/);
    expect(got.open).toMatch(/rejected/);
  });

  it('allows three characters where nothing is on a strip tube', () => {
    expect(decide('labelPrefix', ctx({ hasStripTubes: false }), { labelPrefix: 'Lac' }).source)
      .toBe('answered');
  });

  it('refuses a prefix that starts with a digit', () => {
    expect(decide('labelPrefix', ctx(), { labelPrefix: '3L' }).source).toBe('fallback');
  });

  it('is listed as pending until it is answered', () => {
    expect(pending([{ id: 'labelPrefix', ctx: ctx() }], {})).toHaveLength(1);
    expect(pending([{ id: 'labelPrefix', ctx: ctx() }], { labelPrefix: 'Lc' })).toHaveLength(0);
  });

  it('tells the model what to do when it cannot establish what is taken', () => {
    expect(DECISIONS.labelPrefix.prompt(ctx())).toMatch(/say so rather than guessing/);
    expect(DECISIONS.labelPrefix.prompt(ctx({ taken: ['L3', 'T2'] })))
      .toMatch(/already in use.*L3, T2/);
  });
});

describe('the compile', () => {
  it('never calls out to anything', () => {
    // THE PROPERTY, AS A GREP. A decision module may not import a network client, a child process
    // or the filesystem: it declares a question, it does not go and ask it.
    const dir = path.join(root, 'src/labplanner/planning/decisions');
    for (const f of fs.readdirSync(dir)) {
      const src = fs.readFileSync(path.join(dir, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      expect(src, f).not.toMatch(/\b(fetch|child_process|execFileSync|node:fs|node:https?)\b/);
    }
  });

  it('produces labels from the answer it was given', () => {
    expect(packet(['--label-prefix', 'Gx']).sheets
      .flatMap((s) => (s.samples || []).map((x) => x.label)).filter(Boolean)[0]).toMatch(/^Gx/);
  });

  it('is deterministic: the same answers give the same labels', () => {
    const a = packet(['--label-prefix', 'Gx']);
    const b = packet(['--label-prefix', 'Gx']);
    expect(JSON.stringify(a.sheets)).toBe(JSON.stringify(b.sheets));
  });

  it('carries the open question onto the first sheet when it fell back', () => {
    const p = packet();
    expect((p.sheets[0].open || []).join(' ')).toMatch(/not checked against other experiments/);
    // And NOT onto every sheet: eleven copies of a paragraph about lab-wide uniqueness is how a
    // page stops being read.
    const everywhere = p.sheets.filter((s) => (s.open || [])
      .some((o) => /not checked against other experiments/.test(o)));
    expect(everywhere).toHaveLength(1);
  });

  it('says nothing about the prefix once it is answered', () => {
    const p = packet(['--label-prefix', 'Gx']);
    expect(p.sheets.flatMap((s) => s.open || []).join(' '))
      .not.toMatch(/not checked against other experiments/);
  });
});

describe('c6-decide', () => {
  const run = (extra = []) => execFileSync('node',
    [path.join(root, 'bin/c6-decide'), fixture, '--inventory', path.join(fixture, 'inventory.txt'),
     ...extra], { encoding: 'utf8', maxBuffer: 64e6 });

  it('prints the question, the prompt and what happens without an answer', () => {
    const out = run();
    expect(out).toMatch(/labelPrefix/);
    expect(out).toMatch(/answer shape/);
    expect(out).toMatch(/without an answer/);
  });

  it('gives an agent JSON with the prompt and the schema in it', () => {
    const got = JSON.parse(run(['--json']));
    expect(got.pending[0].id).toBe('labelPrefix');
    expect(got.pending[0].prompt.length).toBeGreaterThan(80);
    expect(got.pending[0].schema.pattern).toBeTruthy();
  });

  it('reports nothing pending once the answers file covers it', () => {
    const f = path.join(root, 'test/fixtures/golden/.answers.test.json');
    fs.writeFileSync(f, JSON.stringify({ labelPrefix: 'Gx' }));
    try {
      expect(run(['--answers', f])).toMatch(/every declared decision is answered/);
    } finally { fs.unlinkSync(f); }
  });
});
