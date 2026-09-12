// sequences/ — named session sequences, so a workflow that has been run before can be run again.
//
// JCA, 2026-09-12: *"Remembering pre-done orderings of labsheets, and being able to reference
// past experiments for sequences of events is definitely something we will want as part of
// labplanner. Like, the user can say 'do it like the Tlib3 experiment' and you can understand
// that as a step sequence."*
//
// A SEQUENCE IS NOT A PLAN. `binReactions` decides which steps there are and which MAY share a
// sheet — reachability in the dependency graph, and that is exact. A sequence answers the other
// half: which of them SHOULD share a sitting, which is about how long a person can stand at a
// bench and what has to incubate overnight. That is lab knowledge, it is stable across
// experiments of the same shape, and it is the part worth remembering by name.
//
// SO A SEQUENCE NEVER ADDS OR REMOVES A STEP. It groups what the planner produced, in the order
// the planner produced it. An experiment whose steps do not match the sequence gets the steps —
// the sequence is a preference about grouping, and a preference that silently dropped a step
// would be a plan that omits work.
import cloneAndCharacterize from './clone-and-characterize.js';
import cloneOnly from './clone-only.js';

export const SEQUENCES = Object.fromEntries(
  [cloneAndCharacterize, cloneOnly].map((s) => [s.id, s]));

/** A named sequence, or null. Never guesses — an unknown name is a question, not a default. */
export function sequenceNamed(id) {
  return SEQUENCES[String(id || '').toLowerCase()] || null;
}

/**
 * The sequence that fits a plan best: the one whose sessions cover the most of its operations
 * without naming operations the plan does not have.
 *
 * WHY A FIT AND NOT A DEFAULT. An experiment with no characterization phase stops after the
 * sequencing analysis, and handing it the nine-session table would leave three empty sessions
 * that read as work somebody forgot to do.
 */
export function bestSequenceFor(operations) {
  const have = new Set(operations.map((o) => String(o).toLowerCase()));
  let best = null, bestScore = -1;
  for (const seq of Object.values(SEQUENCES)) {
    const named = seq.sessions.flatMap((s) => s.steps);
    const covered = named.filter((o) => have.has(o)).length;
    const spurious = named.filter((o) => !have.has(o)).length;
    const score = covered - spurious;
    if (score > bestScore) { best = seq; bestScore = score; }
  }
  return best;
}
