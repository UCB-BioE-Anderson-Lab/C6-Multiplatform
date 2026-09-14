// lib.js — read a rule file, and apply one.
//
// A rule file is plain JavaScript. Each rule is a comment block stating what it does in words,
// followed by the functions that do it:
//
//     // name:  short product
//     // when:  the product is under 250 bp
//     // then:  Taq rather than PrimeSTAR
//     // why:   Under about 250 bp a proofreading polymerase gives no advantage worth its cost.
//     // eg:    249, 250
//     export const shortProduct = {
//       applies: ({ bp }) => bp != null && bp < SHORT_BP,
//       decide:  ({ anneal }) => ({ chemistry: 'taq', program: String(anneal) }),
//     };
//
// **THE WORDS ARE COMMENTS AND THE LOGIC IS CODE**, which is the whole point: nothing in the file
// is there to feed a machine. `read()` below parses the comment blocks so `c6-rules` can print
// them, and that is the only reason this file exists.
//
// The cost of comments over data fields is that a misspelt key is silent — `// whn:` would simply
// vanish. `test/labplanner/rules.test.js` requires every rule to carry every field, which is what
// turns that back into a loud failure.
import fs from 'node:fs';

const FIELDS = ['name', 'when', 'then', 'why', 'eg'];

/**
 * The comment blocks in a rule file, keyed by the export they sit above.
 *
 * A block is a run of `//` lines ending at an `export const <id> =`. A field starts at
 * `// <field>:` and continues through any `//` lines that follow it, so a `why` can be several
 * paragraphs — a blank `//` line is a paragraph break.
 */
export function read(path) {
  const out = {};
  let block = [];
  for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
    const comment = line.match(/^\s*\/\/ ?(.*)$/);
    if (comment) { block.push(comment[1]); continue; }
    const decl = line.match(/^export const (\w+)\s*=\s*\{/);
    if (decl && block.length) out[decl[1]] = fields(block);
    // Anything that is not a comment ends the block, so a stray blank line between the words and
    // the code does not silently detach them.
    block = [];
  }
  return out;
}

function fields(lines) {
  const got = {};
  let key = null;
  for (const raw of lines) {
    const started = raw.match(new RegExp(`^\\s*(${FIELDS.join('|')}):\\s*(.*)$`));
    if (started) { key = started[1]; got[key] = [started[2]]; continue; }
    if (!key) continue;                       // a decorative rule before any field
    got[key].push(raw.trim());
  }
  const joined = {};
  for (const [k, parts] of Object.entries(got)) {
    // Paragraphs survive, wrapped lines rejoin: the printer picks its own width, so a line break
    // inside a paragraph is an accident of editing rather than a decision.
    joined[k] = parts.join('\n').split(/\n\s*\n/)
      .map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean).join('\n\n');
  }
  if (joined.eg) joined.eg = joined.eg.split(',').map((s) => s.trim()).filter(Boolean);
  return joined;
}

/**
 * Apply a rule set: derive the facts, take the first rule that applies, collect what it says.
 *
 * First match wins, so the order of `RULES` is part of the logic.
 */
export function apply({ FACTS = [], RULES = [] }, input) {
  const facts = { ...input };
  for (const f of FACTS) facts[f.name] = f.of(facts);

  const rule = RULES.find((r) => r.applies(facts));
  if (!rule) return null;

  const got = { rule: rule.id, ...rule.decide(facts) };
  // A rule decides data and says prose, separately. A fact may add a remark of its own — whether
  // the annealing temperature was chosen or assumed is a fact about the oligos, not about the rule
  // that matched — but only where there is a decision to annotate.
  const said = [rule.says ? rule.says(facts) : null];
  if (got.program != null) for (const f of FACTS) said.push(f.says ? f.says(facts) : null);

  const note = said.filter(Boolean).join(' ');
  return note ? { ...got, note } : got;
}
