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
import { read } from '../../src/labplanner/rules/lib.js';
import { annotatePCRPrograms } from '../../src/labplanner/planning/choosePCRProgram.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

const FILE = path.join(root, 'src/labplanner/rules/pcrProgram.rules.js');
const said = read(FILE);

// **THE WORDS ARE COMMENTS AND THE LOGIC IS CODE.** That is what makes a rule file readable and
// editable by whoever knows the chemistry — nothing in it is there to feed a machine. The cost is
// that a misspelt key is silent: `// whn:` would simply vanish, and no runtime error would say so.
// These tests are what turn that back into a loud failure.
describe('every rule states itself', () => {
  it('carries a name, a when, a then and a why', () => {
    for (const r of rules.RULES) {
      const w = said[r.id];
      expect(w, `${r.id} has no comment block — is it spelt right, and directly above the export?`)
        .toBeTruthy();
      for (const k of ['name', 'when', 'then', 'why', 'source']) {
        expect(String(w[k] || ''), `${r.id} is missing // ${k}:`).not.toBe('');
      }
      expect(typeof r.applies, r.id).toBe('function');
      expect(typeof r.decide, r.id).toBe('function');
    }
  });

  // A rule whose reason cannot be stated in a sentence is one nobody has finished thinking about.
  it('gives a reason long enough to be one', () => {
    for (const r of rules.RULES) expect(said[r.id].why.length, r.id).toBeGreaterThan(40);
  });

  it('and every fact says what it reads and what it produces', () => {
    for (const f of rules.FACTS) {
      const w = said[f.name];
      expect(w, `${f.name} has no comment block`).toBeTruthy();
      for (const k of ['name', 'when', 'then', 'why', 'source']) {
        expect(String(w[k] || ''), `${f.name} is missing // ${k}:`).not.toBe('');
      }
      expect(typeof f.of, f.name).toBe('function');
    }
  });

  // A field name the parser does not know is dropped without complaint, so the set it accepts is
  // pinned here: adding one to a rule file means adding it here too.
  it('uses only field names the reader knows', () => {
    const known = new Set(['name', 'when', 'then', 'why', 'source', 'eg']);
    const src = fs.readFileSync(FILE, 'utf8');
    for (const m of src.matchAll(/^\s*\/\/ (\w+):/gm)) {
      expect(known.has(m[1]), `// ${m[1]}: is not a field the reader parses`).toBe(true);
    }
  });
});

describe('the printed table is the rule list', () => {
  // Compared with whitespace collapsed: the printer wraps to a column, so a rule's sentence is
  // split across lines on the page and contiguous only as text.
  const flat = (t) => String(t).replace(/\*/g, '').replace(/\s+/g, ' ').trim();
  const out = flat(execFileSync('node', [path.join(root, 'bin/c6-rules')], { encoding: 'utf8' }));

  it('prints every rule', () => {
    for (const r of rules.RULES) expect(out, r.id).toContain(flat(said[r.id].when));
  });

  it('prints them in the order they are tried', () => {
    // ORDER IS PART OF THE DOMAIN: `long product` sits above `ordinary product` because both apply
    // over 8 kb. A table that sorted them would be a different rule set.
    const at = rules.RULES.map((r) => out.indexOf(flat(said[r.id].when)));
    expect(at).toEqual([...at].sort((a, b) => a - b));
  });

  it('prints the why, which is the part a person checks', () => {
    for (const r of rules.RULES) expect(out, r.id).toContain(flat(said[r.id].why).split('.')[0]);
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

// **`when` IS PROSE BESIDE THE PREDICATE, AND PROSE CAN DRIFT FROM IT.** JCA, 2026-09-13, asking
// the right question of the printed table: *"Are you paraphrasing what's actually in code, or is
// this actually the format you are using to do the execution?"*
//
// `applies` IS the execution — it is what runs when the toolkit plans a PCR — and `when` sits in
// the same object, so the two cannot live in separate files and drift apart. But nothing forces
// the SHAPE of the sentence to match: change `<` to `<=` and "the product is under 250 bp" still
// reads true while the code now says otherwise.
//
// Worked examples close that. They are run through `choose()` and printed, so the table shows what
// the code does at each boundary rather than what the sentence claims.
describe('the examples are run, not written', () => {
  const egOf = (id) => (said[id].eg || []).map(rules.egFacts);

  it('every rule carries at least one', () => {
    for (const r of rules.RULES) {
      expect((said[r.id].eg || []).length, `${r.id} has no // eg:`).toBeGreaterThan(0);
    }
  });

  it('each example produces a real outcome', () => {
    for (const r of rules.RULES) {
      for (const facts of egOf(r.id)) {
        expect(rules.choose(facts), `${r.id}: ${JSON.stringify(facts)} decided nothing`).toBeTruthy();
      }
    }
  });

  // A rule whose OWN examples never fire it is one whose examples are about something else.
  it('every rule is fired by at least one of its own examples', () => {
    for (const r of rules.RULES) {
      const fires = egOf(r.id).some((f) => rules.choose(f)?.rule === r.id);
      expect(fires, `${r.id} is not fired by any of its examples`).toBe(true);
    }
  });

  it('and the printed table shows the outcomes, not the claims', () => {
    const out = execFileSync('node', [path.join(root, 'bin/c6-rules'), 'pcr'], { encoding: 'utf8' });
    // The boundary that the prose cannot express on its own: 250 is NOT "under 250".
    expect(out).toMatch(/250\s+falls through to "ordinary product"/);
    expect(out).toMatch(/249\s+chemistry taq/);
    expect(out).toMatch(/8000\s+falls through/);
    expect(out).toMatch(/8001\s+chemistry primestar, program PGXL4/);
  });
});

// **EVERY RULE SET, NOT JUST THE FIRST.** The printer and the applier were both written against
// `pcrProgram` and both grew its domain knowledge: `apply` decided when a fact may speak by asking
// `got.program != null`, and the printer read every `// eg:` as a product length and rendered every
// outcome as a chemistry and a program. Neither was wrong until there was a second rule set.
//
// So the shared checks run over all of them, and a new rule set is covered the day it is added.
describe('every rule set', () => {
  const DIR = path.join(root, 'src/labplanner/rules');
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.rules.js'));

  it('there is more than one, so the shared parts are actually shared', () => {
    expect(files.length).toBeGreaterThan(1);
  });

  for (const f of files) {
    describe(f, () => {
      const words = read(path.join(DIR, f));

      it('names every rule and fact it exports, in a comment block', async () => {
        const m = await import(path.join(DIR, f));
        for (const r of [...(m.RULES || []), ...(m.FACTS || [])]) {
          const w = words[r.id || r.name];
          expect(w, `${f}: ${r.id || r.name} has no comment block`).toBeTruthy();
          for (const k of ['name', 'when', 'then', 'why', 'source']) {
            expect(String(w[k] || ''), `${f}: ${r.id || r.name} is missing // ${k}:`).not.toBe('');
          }
          // **EVERY REASON SAYS WHERE IT CAME FROM.** A rule's why is either something the lab
          // stated or something the toolkit's author supplied, and an external reviewer needs to
          // know which — the second is where a plausible-sounding mechanism can sit for months
          // looking like knowledge. One did, and was wrong for three days.
          expect(w.source, `${f}: ${r.id || r.name} — // source: must say stated or inferred`)
            .toMatch(/stated|inferred/i);
        }
      });

      it('says what its own examples mean', async () => {
        const m = await import(path.join(DIR, f));
        expect(typeof m.egFacts, `${f} exports no egFacts, so its examples cannot be run`)
          .toBe('function');
        for (const r of m.RULES || []) {
          for (const eg of words[r.id].eg || []) {
            expect(m.egFacts(eg), `${f}: // eg: ${eg} is not a situation egFacts knows`).toBeTruthy();
          }
        }
      });

      it('every rule is fired by one of its own examples', async () => {
        const m = await import(path.join(DIR, f));
        for (const r of m.RULES || []) {
          const fires = (words[r.id].eg || []).some((eg) => m.choose(m.egFacts(eg))?.rule === r.id);
          expect(fires, `${f}: ${r.id} is not fired by any of its examples`).toBe(true);
        }
      });

      it('prints', () => {
        const name = f.replace(/\.rules\.js$/, '');
        const out = execFileSync('node', [path.join(root, 'bin/c6-rules'), name],
                                 { encoding: 'utf8' });
        expect(out).toContain(words[Object.keys(words)[0]].name);
        expect(out).not.toMatch(/undefined|\[object/);
      });
    });
  }
});
