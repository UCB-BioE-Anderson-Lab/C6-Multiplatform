// injectGel.js — an analytical gel after every round of PCR.
//
// JCA, 2026-09-10: *"You need the expected sizes from the C6 simulation, and that's it."* and
// *"There will always be a gel pic checkpoint with these steps."*
//
// THE EXPECTED SIZE IS THE WHOLE POINT OF THE STEP. A gel with no expected size tells you a band
// exists; it does not tell you whether it is the right band, which is the only question the gel
// was run to answer. So a lane whose size could not be computed says so **on the sheet**, rather
// than leaving the column blank — a blank reads as "no band expected", and the two are opposite.
//
// BEFORE THE CLEANUP, NOT AFTER. Every SynThera labsheet runs pcr -> gel -> zymo, because the
// gel asks whether the reaction worked and the cleanup prepares what worked for the next step.
// The planner skeleton's comment said "Gel after PCR cleanup"; five real packets say otherwise
// and they are what students carried into the lab.
export const GEL_AFTER = ['pcr'];

/**
 * Add an analytical gel after each PCR bin, one lane per product with the size the simulation
 * expects. A lane whose size could not be computed says so, because a blank column reads as 'no
 * band expected'.
 *
 * @param {Array} bins   labsheet bins from binReactions
 * @returns {Array} bins, with a gel bin inserted after each PCR bin
 */
export function injectGelJobs(bins, cfg = {}) {
  const out = [];
  for (const bin of bins || []) {
    out.push(bin);
    if (!GEL_AFTER.includes(bin.operation)) continue;
    const lanes = bin.jobs.map((j) => ({
      sample: j.output, cf: j.cf,
      expectedBp: j.productBp ?? null,
      note: j.productBp == null
        ? `size not computed — ${j.sizeNote || 'not simulated'}. Say so on the sheet; a blank `
          + 'column reads as "no band expected".'
        : null,
    }));
    out.push({
      operation: 'gel',
      round: bin.round,
      rounds: bin.rounds,
      derivedFrom: bin.operation,
      jobs: bin.jobs,
      cfs: bin.cfs,
      depth: bin.depth + 0.1,          // immediately after its PCR, before anything else
      lanes,
      // Not conditional on anything — see the quote above.
      checkpoint: { type: 'checkpoint.gel' },
      unknownSizes: lanes.filter((l) => l.expectedBp == null).length,
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
