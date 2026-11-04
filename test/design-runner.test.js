/**
 * The design gate, end to end: does `c6-design` reject a design that was improvised, accept one
 * that was derived, and account for every oligo in between.
 *
 * **THIS IS THE CHECK BEING WATCHED FAILING.** `test/fixtures/design/improvised.design.js` is a
 * deliberately bad design — an arbitrary 30-mer off the template chosen by position, a primer
 * typed in that is not in the template at all, and one with no template to check against. A gate
 * nobody has seen reject anything is a claim, so the rejection is asserted here rather than
 * described in a document.
 */
import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const run = (fixture) => {
  try {
    return { code: 0, out: execFileSync('node', [path.join(root, 'bin/c6-design'), path.join(root, 'test/fixtures/design', fixture)], { encoding: 'utf8' }) };
  } catch (e) {
    return { code: e.status, out: `${e.stdout || ''}${e.stderr || ''}` };
  }
};

describe('a derived design passes', () => {
  const { code, out } = run('derived.design.js');

  it('exits 0', () => expect(code).toBe(0));
  it('checked every oligo', () => expect(out).toMatch(/2 oligo\(s\): 2 checked, 0 not in their template, 0 unchecked/));
  it('says so plainly rather than printing nothing', () => {
    expect(out).toMatch(/every oligo derived, nothing typed, nothing imported from outside/);
  });
  it('reports no hand-typed sequence, because the template is read from a file', () => {
    expect(out).not.toMatch(/TYPED BY HAND/);
  });
});

describe('an improvised design is rejected', () => {
  const { code, out } = run('improvised.design.js');

  it('EXITS 1 — the gate holds', () => expect(code).toBe(1));

  it('names the primer that is not in its template as a hard finding', () => {
    expect(out).toMatch(/ANNEAL NOT FOUND IN ITS TEMPLATE/);
    expect(out).toMatch(/oBad-R/);
  });

  it('counts every oligo, so none goes missing from the summary', () => {
    expect(out).toMatch(/3 oligo\(s\): 1 checked, 1 not in their template, 1 unchecked/);
  });

  it('UNDECLARED IS NOT VERIFIED: an oligo with no template is named, not passed', () => {
    expect(out).toMatch(/UNCHECKED — nothing was verified about these/);
    // AND IT NAMES WHICH FIELD IS MISSING. It used to say "no template declared" whatever was
    // absent, which pointed at the wrong field on the first real design it met.
    expect(out).toMatch(/oBad-X\s+\(no anneal, no template\)/);
  });

  it('shows the better anneal beside the improvised one, so the reason can be judged', () => {
    expect(out).toMatch(/THE TOOL WOULD HAVE CHOSEN DIFFERENTLY/);
    expect(out).toMatch(/oBad-F\s+chose/);
    expect(out).toMatch(/tool\s+[ACGT]+/);
  });

  it('reports the hand-typed sequence with its line', () => {
    expect(out).toMatch(/SEQUENCES TYPED BY HAND/);
    expect(out).toMatch(/line 15/);
  });
});

describe('it refuses rather than reporting half an answer', () => {
  it('a script with no design() export fails', () => {
    const { code, out } = run('template.txt');
    expect(code).toBe(1);
    expect(out).toMatch(/design\(\)|threw while running/);
  });
});
