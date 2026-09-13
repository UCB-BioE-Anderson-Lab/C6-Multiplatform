// expandClones.js — a declared step that makes one tube per clone becomes one job per clone.
//
// **A DECLARED STEP IS ONE LINE AND N TUBES.** `Miniprep pBET8_colonies clone=pBET8 …` is one line
// in a characterization file and four tubes on a bench, and until this ran it was one row on a
// labsheet reading `pBET8_clones` — a name for a set, written on nothing.
//
// `injectVerification.js` already fanned out the chain it invents. When JCA ruled on 2026-09-12
// that verification folds into the characterization file, those steps became DECLARABLE, and a
// declared one arrived unexpanded. Same physical fact, two code paths, one of them missing.
//
// ## Where the count comes from
//
// **The pick.** A pick makes one block holding `n` colonies, so it stays one job; everything
// downstream of it is per clone. The count is the pick's `n=`, not the miniprep's, because the
// miniprep does not decide how many colonies there were.
//
// ## What the clones are called
//
// `clone=` on the step, because it cannot be derived. → `docs/LABSHEET-SPEC.md` § 6: there is no
// rule about DNA naming, so a compiler taking the transform's input gets `pBET8` for Lactis3 and
// `gg` for a conventionally-written file. The file says which, and the clone designation is
// appended per § 3 — `[A-Z]`, so `pBET8-A`.
import { cloneDesignation } from './naming.js';

/** Steps that make one tube per clone. A pick makes a block and stays one. */
export const PER_CLONE = ['miniprep', 'sequencing'];

/** How many clones a block holds, from the pick that filled it. */
function clonesInBlock(job, byOutput) {
  for (const name of job.dnaInputs || []) {
    const p = byOutput.get(name);
    if (p && p.operation === 'pick') {
      const n = Number(p.args?.n);
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

/**
 * Expand every declared per-clone step into one job per clone.
 *
 * **CALLED FROM INSIDE `extractJobsFromCFs`, BEFORE THE DEPENDENCY MAP IS BUILT.** Run afterwards,
 * it left `resolve` closed over the producers of the unexpanded jobs, so every edge into a fanned
 * step pointed at a name nothing produced any more — the plan came out with the sequencing third
 * and both picks in one bin. Expansion is part of lifting steps into jobs, not a pass over them.
 *
 * @param {Array} jobs   raw jobs, straight out of the step loop
 * @returns {{jobs:Array, problems:Array}}
 */
export function expandClones(jobs) {
  const byOutput = new Map(jobs.map((j) => [j.output, j]));
  const out = [];
  // What each expanded step's outputs became, so the next step fans out over them rather than
  // over the name of the set.
  const fannedTo = new Map();

  for (const job of jobs) {
    const declared = !!job.args?._characterization;
    if (!declared || !PER_CLONE.includes(job.operation)) { out.push(job); continue; }

    // Sequencing fans over the minipreps AND over the reads; a miniprep fans over the clones.
    const upstream = (job.dnaInputs || []).flatMap((n) => fannedTo.get(n) || []);
    const reads = String(job.args?.reads || '').split(',').map((s) => s.trim()).filter(Boolean);

    if (upstream.length) {
      // One per (upstream tube × read). With no reads declared it is one per upstream tube.
      const made = [];
      for (const u of upstream) {
        for (const [i, r] of (reads.length ? reads : ['']).entries()) {
          made.push({ ...job,
            id: `${job.cf}:${job.line}:${u.output}${r}`,
            output: `${u.output}${r}`,
            dnaInputs: [u.output],
            args: { ...job.args, ...(r ? { oligo: oligoFor(job, i) } : {}) } });
        }
      }
      fannedTo.set(job.output, made);
      out.push(...made);
      continue;
    }

    const n = clonesInBlock(job, byOutput);
    const base = job.args?.clone;
    if (!n || !base) {
      // NOT SILENTLY ONE. A step that should fan out and cannot say how wide is a step somebody
      // has to notice: no `clone=` on the line, or no `n=` on the pick above it.
      job.expandProblem = !base
        ? `${job.operation} ${job.output}: no clone= on the line, so the tubes cannot be named. `
          + 'There is no rule about DNA naming to derive it from.'
        : `${job.operation} ${job.output}: the pick above it says no n=, so how many tubes this `
          + 'makes is unknown.';
      out.push(job);
      continue;
    }
    const made = Array.from({ length: n }, (_, i) => ({ ...job,
      id: `${job.cf}:${job.line}:${base}-${cloneDesignation(i)}`,
      output: `${base}-${cloneDesignation(i)}`,
      args: { ...job.args, clone: cloneDesignation(i) } }));
    fannedTo.set(job.output, made);
    out.push(...made);
  }

  // AND EVERY LATER STEP HAS TO BE TOLD. `Analysis pBET8_reads` names the sequencing step's
  // product, which after fanning out is four tubes and no longer a name anything produces — so the
  // analysis lost its edge, came out at depth zero, and the plan put it third. A step that
  // multiplies has to rewrite the references to what it used to be.
  for (const j of out) {
    if (!(j.dnaInputs || []).some((n) => fannedTo.has(n))) continue;
    j.dnaInputs = j.dnaInputs.flatMap((n) => (fannedTo.has(n)
      ? fannedTo.get(n).map((m) => m.output) : [n]));
  }

  return { jobs: out,
           problems: out.filter((j) => j.expandProblem)
                        .map((j) => ({ code: 'CANNOT_EXPAND', cf: j.cf, line: j.line,
                                       message: j.expandProblem })) };
}

/** Which oligo reads this one. `oligos=bf037,bf038` pairs with `reads=F,R` by position. */
function oligoFor(job, i) {
  const oligos = String(job.args?.oligos || '').split(',').map((s) => s.trim()).filter(Boolean);
  return oligos[i] || '';
}
