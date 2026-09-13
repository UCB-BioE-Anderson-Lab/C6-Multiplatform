// planSources.js — for every material a step consumes, where it comes from.
//
// JCA, 2026-09-12, of a rendered PCR sheet: *"It has no source info."*
//
// THE QUESTION IS NOT "WHERE IS THIS IN THE FREEZER". It is prior to that: **was this made by an
// earlier step of this plan, or does it come out of the freezer?** Those are different answers on
// a labsheet and only one of them is a box and a well. Sending somebody to look for `backbone`
// in a box — a PCR product that will not exist until the previous session runs — is worse than
// saying nothing, because they will go and look.
//
// The plan already knows: `resolve` is exactly the function that finds the producing step, and an
// input with no producer is one the lab must already have. So this is a partition first and a
// lookup second, and it is the same partition the dependency graph is built on.
//
// WHAT IS NOT HERE, DELIBERATELY: nothing ranks a tube by how much is left, because the inventory
// records no volume, and nothing invents a location for a sample recorded without a well.
import { choosePrimerSource } from './choosePrimerSource.js';
import { chooseTemplateSample } from './chooseTemplateSample.js';

/**
 * One row per material a job consumes: what it is, what kind of thing, and where it comes from.
 *
 * @param {{jobs:Array, resolve:Function}} lifted
 * @param {Inventory|null} inv
 * @returns {Map<string, Array>} job id -> sources
 */
export function planSources({ jobs, resolve, byOutput }, inv) {
  const lookup = resolve || ((job, name) => (byOutput ? byOutput.get(name) : null));
  const out = new Map();
  for (const job of jobs || []) {
    const rows = [];
    for (const name of job.oligos || []) {
      rows.push({ name, kind: 'oligo', ...choosePrimerSource(inv, name, job.operation) });
    }
    for (const name of job.dnaInputs || []) {
      const producer = lookup(job, name);
      if (producer && producer !== job) {
        rows.push({ name, kind: 'dna', status: 'made-here',
                    note: `made by the ${producer.operation} step that produces ${producer.output}` });
        continue;
      }
      rows.push({ name, kind: 'dna', ...chooseTemplateSample(inv, name) });
    }
    // A CONTROL IS FETCHED LIKE ANYTHING ELSE. The electroporation's positive control is a real
    // tube of pTRKH3-slpGFP that comes out of a box, and the sheet said "3 plates: the sample, plus
    // untransformed and pTRKH3-slpGFP" without ever saying where the second plasmid is. `role`
    // travels with it so the sheet can say what the tube is for rather than listing it bare.
    for (const name of job.alsoNeeds || []) {
      if (rows.some((r) => r.name === name)) continue;
      const producer = lookup(job, name);
      rows.push(producer && producer !== job
        ? { name, kind: 'dna', role: 'positive control', status: 'made-here',
            note: `the positive control — made by the ${producer.operation} step that produces ${producer.output}` }
        : (() => { const w = chooseTemplateSample(inv, name);
                   return { name, kind: 'dna', role: 'positive control', ...w,
                            note: `the positive control${w.note ? ` — ${w.note}` : ''}` }; })());
    }
    if (rows.length) out.set(job.id, rows);
  }
  return out;
}

/** A short human line per job, for the text report. */
export function describeSources(sources) {
  const counts = {};
  for (const rows of sources.values()) {
    for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  }
  return counts;
}
