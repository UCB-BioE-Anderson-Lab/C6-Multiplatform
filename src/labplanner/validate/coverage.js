// src/labplanner/validate/coverage.js
//
// DOES THE CHARACTERIZATION FILE ACCOUNT FOR EVERYTHING THE CONSTRUCTION FILES BUILD?
//
// Phase 4's gate. `c6-labplan` already refuses to compile an experiment with no characterization
// file at all — "what the plasmid is FOR is a conversation, not a missing input" — but a file
// that exists and covers three of four constructs passes that check and ends with one plasmid
// built, verified, and never used for anything. The compiler cannot catch it, because nothing
// downstream of a construction file knows how many products there were supposed to be.
//
// **A PLASMID NOBODY CHARACTERISES IS EITHER A GAP OR A DECISION, AND THE TWO MUST NOT LOOK
// ALIKE.** `--clone-only` already exists as the way to say an experiment really does end at a
// verified plasmid. So an uncovered product is reported, and declaring it clone-only is how it
// stops being reported — a sentence somebody writes, rather than a silence.

/**
 * Is every plasmid the construction files build actually characterized — retransformed, picked,
 * sequenced or assayed by something — or is one of them built, verified and then never used?
 *
 * Coverage is TRANSITIVE, because characterization is a chain rather than a list: a plasmid is
 * retransformed into a host, the host is picked into clones, the clones are assayed. Only the
 * first of those names the construct, so a check that asked "does some step take this plasmid as
 * an input" would call a plasmid covered by a single `Retransform` and miss that nothing is ever
 * measured. Following the chain is what makes the answer mean "something happens to this".
 *
 * **AN ORPHAN IS REPORTED TOO, AND IS USUALLY THE MORE INTERESTING FINDING.** A characterization
 * step whose subject is neither a construction-file product nor the output of an earlier
 * characterization step is a name that exists nowhere — a typo, or a plasmid somebody meant to
 * build and did not. It reads as perfectly good work until the day the labsheet says to fetch a
 * tube nobody ever made.
 *
 * @param {string[]} products - the DNA names the construction files produce
 * @param {Array<{operation: string, output: string, dnas: (string|string[])}>} steps - the parsed
 *   characterization steps, as `validate.parsecharacterization` returns them
 * @param {{cloneOnly?: string[]}} [options] - products deliberately ending at a verified plasmid
 * @return {{covered: string[], uncovered: string[], cloneOnly: string[], orphans: Array}} what is
 *   characterised, what is not, what was declared as ending there, and every step whose subject
 *   exists nowhere
 */
export function characterizationCoverage(products, steps, options = {}) {
  const declared = new Set(options.cloneOnly || []);
  const made = new Set(products);
  const asList = (x) => (Array.isArray(x) ? x : [x]).filter(Boolean).map(String);

  // Walk the chain: a name is reached if it is a product, or the output of a reached step.
  const reached = new Set();
  const orphans = [];
  let changed = true;
  const pending = steps.map((s) => ({ ...s, _seen: false }));

  while (changed) {
    changed = false;
    for (const step of pending) {
      if (step._seen) continue;
      const subjects = asList(step.dnas);
      if (!subjects.length) { step._seen = true; continue; }
      const anyKnown = subjects.some((n) => made.has(n) || reached.has(n));
      if (!anyKnown) continue;
      step._seen = true;
      changed = true;
      for (const n of subjects) if (made.has(n)) reached.add(n);
      if (step.output) reached.add(step.output);
    }
  }

  for (const step of pending) {
    if (step._seen) continue;
    for (const n of asList(step.dnas)) {
      if (!made.has(n) && !reached.has(n)) {
        orphans.push({ operation: step.operation, name: n, line: step.line });
      }
    }
  }

  const covered = products.filter((p) => reached.has(p));
  const uncovered = products.filter((p) => !reached.has(p) && !declared.has(p));
  return { covered, uncovered, cloneOnly: products.filter((p) => declared.has(p)), orphans };
}
