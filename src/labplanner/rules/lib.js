// lib.js — the two helpers a rule file needs, so a rule file contains nothing but rules.
//
// The correctness of the rules is what the toolkit is for, and a rule nobody can check is not
// worth having. So a rule file is written to be read and edited by whoever knows the chemistry,
// and everything mechanical lives here instead. → `docs/DECISIONS.md § How a rule set is written`

/**
 * Prose written as an indented block, read back without the indentation.
 *
 * It lets a `why` be typed as paragraphs — blank lines stay paragraph breaks, and where a sentence
 * wraps to fit the margin the wrap is discarded, since the printer chooses its own width. Without
 * it a paragraph has to be written as string literals joined by `+`, and rewording one means
 * re-balancing quotes across several lines.
 */
export function text(strings, ...values) {
  const raw = strings.reduce((out, s, i) => out + s + (i < values.length ? values[i] : ''), '');
  const lines = raw.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  // Paragraphs survive; wrapped lines rejoin. The printer wraps to its own width, so a hard line
  // break inside a paragraph is an accident of editing rather than a decision.
  return lines.map((l) => l.slice(indent)).join('\n')
    .split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).join('\n\n');
}

/**
 * Apply a rule set: derive the facts, take the first rule that applies, collect what it says.
 *
 * **FIRST MATCH WINS, so the order of `RULES` is part of the domain** — `long product` sits above
 * `ordinary product` because both are true over 8 kb. The printed table shows them in order for
 * exactly that reason.
 */
export function apply({ FACTS = [], RULES = [] }, input) {
  const facts = { ...input };
  for (const f of FACTS) facts[f.name] = f.of(facts);

  const rule = RULES.find((r) => r.applies(facts));
  if (!rule) return null;

  const got = { rule: rule.name, ...rule.decide(facts) };
  // WHAT A RULE SAYS IS SEPARATE FROM WHAT IT DECIDES. The decision is data — a chemistry, a
  // program — and the sentence is prose for a person. Keeping them in one function made every
  // `decide` half string-building, which is most of what made the file hard to read.
  const said = [rule.says ? rule.says(facts) : null];
  // A fact may have something to add — whether the annealing temperature was chosen or assumed is
  // a fact about the oligos, not about the rule that matched. Only where there is a decision to
  // annotate: a reaction with no program has nothing to say about its anneal.
  if (got.program != null) for (const f of FACTS) said.push(f.says ? f.says(facts) : null);

  const note = said.filter(Boolean).join(' ');
  return note ? { ...got, note } : got;
}
