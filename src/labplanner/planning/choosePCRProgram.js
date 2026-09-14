// choosePCRProgram.js — which thermocycler program, and which polymerase.
//
// **THE RULES THEMSELVES MOVED TO `rules/pcrProgram.rules.js`, AND THIS IS NOW THE ADAPTER.**
// JCA, 2026-09-13: *"you've got a lot of syntax mixed in with the domain logic, that will make it
// hard to follow."* This file was 46 comment lines out of 106 — the reasoning was all present and
// interleaved with `job.program = …`, `continue` and null-guards, so reading out *what the rules
// are* meant filtering every third line.
//
// They are a list of `{when, then, why, applies, decide}` objects now, and `bin/c6-rules` prints
// them as a table. **The table is not a copy — it is that list, rendered**, so it cannot drift.
// What is left here is the part that is genuinely about jobs rather than about PCR: read the
// oligos out of the project, ask the rules, write the answer onto the job.
//
// JCA, 2026-09-10:
//
// > *"simulate the cf, look at the pcr product, get its size. Divide by 1000 and round up. That
// > number is x. Insert that number into 'PGxK55' is typically what you want, where 55 is the
// > annealing temperature. When doing degenerate oligos (not all bases in the oligos are in
// > [ATCG]), I will typically use a 45 degree anneal instead, so PGxK45. For really short
// > sequences, like <250 bp, I would recommend a Taq reaction instead of primestar. PG is
// > primestar. program '45' and '55' are the taq ones. The recipe is different for taq too --
// > different enzyme and buffer, same dntps."*
//
// All of it is exact. None of it is judgement — which is why it is here and not in
// `operations/pcr.md`.
export {
  SHORT_BP, DEFAULT_ANNEAL, DEGENERATE_ANNEAL, EXTENSION_STEPS, LONG_PROGRAM,
  isDegenerate, primestarProgram,
} from '../rules/pcrProgram.rules.js';
import { isDegenerate as _isDegenerate } from '../rules/pcrProgram.rules.js';
import { choose } from '../rules/pcrProgram.rules.js';

/**
 * Choose the thermocycler program and the polymerase for each PCR. → `rules/pcrProgram.rules.js`
 *
 * @param {Array} jobs
 * @param {Object} cfg  { sequences: {oligos} } so degeneracy can be read off the actual oligos
 */
export function annotatePCRPrograms(jobs, cfg = {}) {
  const oligos = (cfg.sequences && cfg.sequences.oligos) || {};
  for (const job of jobs || []) {
    if (job.operation !== 'pcr') continue;
    const seqs = (job.oligos || []).map((n) => oligos[n]).filter(Boolean);
    const got = choose({
      bp: job.productBp,
      sizeNote: job.sizeNote,
      // AN OLIGO WHOSE SEQUENCE WE DO NOT HAVE IS NOT A NON-DEGENERATE ONE — the `degenerate`
      // fact in the rule set carries the reason.
      known: seqs.length === (job.oligos || []).length && seqs.length > 0,
      anyDegenerate: seqs.some(_isDegenerate),
    });
    if (!got) continue;
    job.chemistry = got.chemistry ?? null;
    job.program = got.program ?? null;
    if ('extensionKb' in got) job.extensionKb = got.extensionKb;
    if (got.note) job.programNote = got.note;
  }
  return jobs;
}
