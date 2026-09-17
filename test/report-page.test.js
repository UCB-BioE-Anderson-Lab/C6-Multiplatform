/**
 * The committed report page is a page a browser can actually run.
 *
 * **THE BUTTON DID NOTHING FOR TWO ROUNDS AND NOTHING SAID SO.** `bin/c6-report` builds the page's
 * inline `<script>` inside a template literal, so `'\n'` written in the generator is consumed AT
 * GENERATION TIME and lands in the page as a real newline — inside a single-quoted JavaScript
 * string, which is a syntax error. The whole script then fails to parse, so `showAnswers` was never
 * defined, the live tally never updated, and the page looked completely normal: every claim, every
 * table, every radio button rendered, because none of that needs JavaScript. JCA answered
 * thirty-one claims on a page whose script had never run once.
 *
 * A generated artifact that is never executed by the suite is a document, not a program. This runs
 * it. Two separate failures, because they fail differently:
 *
 *   parses    `new Function` over the script body. Catches the escaping bug above and every other
 *             way a template literal can emit text that is not JavaScript.
 *   wired     the handlers `onclick=` and the rest of the page refer to are actually defined.
 *             A script can parse perfectly and still not define what the HTML calls.
 *
 * **A THIRD CHECK WAS WRITTEN AND THROWN AWAY**: a regex hunting raw newlines inside quoted
 * strings, to pin this one bug exactly. It reported the fixed page as broken, because
 * `'a'` newline `'b'` lets it pair the CLOSING quote of one string with the OPENING quote of the
 * next — it cannot tell a string containing a newline from two strings on different lines without
 * parsing the JavaScript, which is what `new Function` already does, correctly.
 *
 * **CHECKED AGAINST THE COMMITTED FILE, not against a fresh generation.** `docs/REPORT.html` is
 * what JCA opens; a test that regenerates first would pass on a page nobody has.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(root, 'docs/REPORT.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

describe('docs/REPORT.html', () => {
  it('carries a script at all', () => expect(scripts.length).toBeGreaterThan(0));

  it('has a script the browser can parse', () => {
    for (const body of scripts) {
      // `new Function` compiles without running — the page touches `document`, which is absent here.
      expect(() => new Function(body), 'the page script is not valid JavaScript').not.toThrow();
    }
  });

  it('defines every handler the page calls', () => {
    const called = new Set([...html.matchAll(/on\w+="(\w+)\(/g)].map((m) => m[1]));
    expect(called.size, 'no inline handlers found — has the page changed shape?').toBeGreaterThan(0);
    const src = scripts.join('\n');
    for (const fn of called) {
      expect(new RegExp(`function\\s+${fn}\\b|(const|let|var)\\s+${fn}\\s*=`).test(src),
        `the page calls ${fn}() and the script never defines it`).toBe(true);
    }
  });

});
