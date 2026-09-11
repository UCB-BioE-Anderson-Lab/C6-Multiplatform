// injectCleanup.js — a Zymo column cleanup after PCR.
//
// JCA, 2026-09-10: *"Nothing to think about there. It's simple, just make up tube names."*
//
// So this module is short on purpose. The only decision is the name, and the only thing worth
// getting right about a name is that the NEXT sheet can refer to it without a lookup table. The
// convention already in the SynThera labsheets is a `z` prefix — `pcr15` becomes `zpcr15` — and
// its whole value is being derivable.
//
// NOT AUTOMATED, AND OBSERVED RATHER THAN GUESSED: SLIP4-libraries runs a SECOND cleanup after
// its Golden Gate, because that assembly is going into an electroporation and salt kills the
// pulse. That is a real rule and it is not in the brief, so it is named here and left for the
// person writing the sheet rather than injected on a guess about which transforms electroporate.
export const CLEANUP_AFTER = ['pcr'];
export const PREFIX = 'z';

/**
 * The name of the cleaned-up tube for a product, so the next sheet can refer to it without a
 * lookup table.
 */
export const cleanupName = (product) => `${PREFIX}${product}`;

/**
 * Add a Zymo cleanup after each PCR bin. Ordered by depth rather than position, so it composes
 * with the gel injector in any order.
 */
export function injectCleanupJobs(bins, cfg = {}) {
  const after = cfg.cleanupAfter || CLEANUP_AFTER;
  const out = [];
  for (const bin of bins || []) {
    out.push(bin);
    if (!after.includes(bin.operation)) continue;
    out.push({
      operation: 'zymo',
      round: bin.round,
      rounds: bin.rounds,
      derivedFrom: bin.operation,
      jobs: bin.jobs,
      cfs: bin.cfs,
      depth: bin.depth + 0.2,                     // after the gel, before the assembly
      tubes: bin.jobs.map((j) => ({ from: j.output, to: cleanupName(j.output), cf: j.cf })),
    });
  }
  // ORDER BY DEPTH, NOT BY POSITION. Inserting "right after the PCR bin" does not compose: run
  // the gel injector and then the cleanup injector, and the cleanup lands between the PCR and
  // its own gel. Each injected bin carries a fractional depth (gel +0.1, cleanup +0.2) and the
  // list is sorted, so injectors can run in any order and the result is the same. The sort is
  // stable, so bins at equal depth keep the order `binReactions` gave them.
  out.sort((a, b) => a.depth - b.depth);
  out.forEach((b, i) => { b.index = i; });
  return out;
}
