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
// ## What the clones are called, and why it changes along the way
//
// JCA, 2026-09-12: *"if you are picking the colonies coming out of the construction file's
// transformation, the full name of that strain is going to be jtk165/pBET8, and different colonies
// of that pick up -A, -B, etc. When you then miniprep that DNA, you end up with samples who lose
// the jtk165 designation, and are now just pBET8-A etc."*
//
// **A colony is a strain; a miniprep is DNA.** So the same clone is `JTK165-AB/pBET8-A` in a block
// and `pBET8-A` in a tube, and the designation is what stays the same. `clone=` on each step says
// what that step's products are named for, and a step downstream of an already-fanned one RENAMES
// rather than fanning again — four minipreps of two colonies would be four tubes of two clones.
//
// The base is declared and never derived: `docs/LABSHEET-SPEC.md` § 6, there is no rule about DNA
// naming, and the strain prefix is not in a construction file at all — a construction file's
// transform product is the DNA in the cells, not the strain carrying it.
import { cloneDesignation } from './naming.js';
import { BLOCKS, vesselFor, layoutFor, shapeOf } from './vessels.js';

// Steps that make one thing per clone.
//
// **THE PICK IS ONE OF THEM.** A pick fills one block, but the wells in it are clones and the
// clone designations are assigned there — the workbook says so: *"Identify between 2 and 4
// colonies to pick and write their clone identifier (A,B,C, or D) next to the colony."* A sheet
// with one row saying "pick 2" leaves the person to invent which is which.
/**
 * The steps that happen once per picked colony rather than once per construct.
 *
 * A pick of four colonies becomes four minipreps and, at two reads each, eight sequencing
 * reactions. Fanning them out here is what lets every later sheet name a specific tube — `pBET8-C`
 * — instead of saying "each clone" and leaving the arithmetic to the bench.
 */
export const PER_CLONE = ['pick', 'miniprep', 'sequencing'];

/**
 * The vessel NAME declared by something that consumes these clones — a culture, usually.
 *
 * It returned `jobs.some(...)`, a BOOLEAN, so it could say whether a vessel had been declared
 * downstream and never which one. Paired with the precedence bug at the call site, that is how
 * `vessel=96-well` reached the pick as the literal string "block".
 */
function downstreamVessel(job, jobs) {
  const consumer = jobs.find((j) => (j.dnaInputs || []).includes(job.output) && j.args?.vessel);
  return consumer ? String(consumer.args.vessel) : null;
}

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

    // Sequencing fans over the minipreps AND over the reads; a miniprep renames the pick's
    // clones; a pick fans over the colonies it is told to take.
    const upstream = (job.dnaInputs || []).flatMap((n) => fannedTo.get(n) || []);
    const reads = String(job.args?.reads || '').split(',').map((s) => s.trim()).filter(Boolean);
    const base = job.args?.clone;

    if (upstream.length) {
      // ALREADY FANNED UPSTREAM: rename, keeping each clone's designation, and fan again only
      // over the reads. `clone=` gives the new base; without one the names carry through.
      const made = [];
      for (const u of upstream) {
        const designation = String(u.args?.clone || '');
        const renamed = base && designation ? `${base}-${designation}` : u.output;
        for (const [i, r] of (reads.length ? reads : ['']).entries()) {
          made.push({ ...job,
            id: `${job.cf}:${job.line}:${renamed}${r}`,
            output: `${renamed}${r}`,
            dnaInputs: [u.output],
            args: { ...job.args, clone: designation,
                    ...(r ? { oligo: oligoFor(job, i), read: r } : {}) } });
        }
      }
      fannedTo.set(job.output, made);
      out.push(...made);
      continue;
    }

    const n = job.operation === 'pick' ? Number(job.args?.n) : clonesInBlock(job, byOutput);
    if (!n || !base) {
      // NOT SILENTLY ONE. A step that should fan out and cannot say how wide is a step somebody
      // has to notice: no `clone=` on the line, or no `n=` on the pick above it.
      job.expandProblem = !base
        ? `${job.operation} ${job.output}: no clone= on the line, so its products cannot be named. `
          + 'There is no rule about DNA naming to derive it from, and a strain prefix is in no '
          + 'construction file at all.'
        : `${job.operation} ${job.output}: nothing says how many — no n= here, and none on the `
          + 'pick above it.';
      out.push(job);
      continue;
    }
    // LIBRARY OR NOT decides the notation; the count decides the plasticware. Two decisions, and
    // holding them as one is how a block came to imply plate addresses. → `naming.js`, `vessels.js`
    const library = String(job.args?.library || '') === 'true';
    // A DOWNSTREAM CULTURE'S DECLARED VESSEL WINS. Lactis3 picks four clones — under the block
    // threshold — into a block, because the culture says `vessel=24-well` and the assay reads the
    // block in a plate reader. Deciding from the count alone put "one tube each" on the picking
    // sheet and "24-well" on the culture two lines later.
    //
    // **AND THE NAME SURVIVES.** This read `a || b ? 'block' : c`, which parses as
    // `(a || b) ? 'block' : c` — so a declared `vessel=96-well` was replaced by the literal string
    // "block", and every reader downstream got a word that names no piece of plastic. The picking
    // sheet then said "24-well block" four lines under a culture table saying 96-well, and the
    // wells were laid out 4×6 for a plate that is 8×12.
    const namedVessel = job.args?.vessel || downstreamVessel(job, jobs);
    const vessel = namedVessel || vesselFor(n);

    // **A REFUSAL IS A FINDING, NOT AN EXCEPTION.** `cloneDesignation` and `layoutFor` both throw
    // on purpose and both say something worth reading — *"letters run out at Z, and AA is not in
    // the grammar"*, *"30 clones will not fit a 4x6 vessel; two blocks is a decision about the
    // session, not about the layout"*. Nothing caught them, so picking 30 colonies printed a Node
    // stack trace over the top of the sentence that would have told somebody what to do. Same
    // class as the `c6-labplan` crash: a deliberate refusal escaping as an exception.
    //
    // `expandProblem` already existed for the cases this function detects itself; these are the
    // ones its collaborators detect, and they belong in the same channel.
    //
    // **THE TWO REFUSALS HAVE DIFFERENT ANSWERS**, so they are caught apart. Running out of letters
    // is about notation and `library=true` fixes it; running out of wells is about plasticware and
    // `library=true` does nothing at all for it. One catch around both offered the naming remedy
    // for the plastic problem, which is advice that cannot work.
    let wells, made;
    try {
      wells = vessel === 'tubes' ? [] : layoutFor(n, shapeOf(vessel));
    } catch (e) {
      // THE SMALLEST ONE THAT HOLDS THEM, not the first one declared. `BLOCKS` is written
      // 24/96/48, so taking the head sent a 30-clone pick to a 96-well and left 66 wells empty
      // when a 48-well would have done.
      const fits = Object.entries(BLOCKS).filter(([, s]) => s.rows * s.cols >= n)
                         .sort((a, b) => a[1].rows * a[1].cols - b[1].rows * b[1].cols);
      job.expandProblem = `${job.operation} ${job.output}: ${e.message}`
        + (fits.length ? ` A ${fits[0][1].name} holds ${n} — say \`vessel=${fits[0][0]}\` on the `
                       + 'line if that is the plastic, or split the pick across two sessions.'
                      : ` Nothing we know about holds ${n} in one piece, so this is two sessions.`);
      out.push(job);
      continue;
    }
    try {
      made = Array.from({ length: n }, (_, i) => {
        // THE SHAPE, NOT THE DEFAULT. A library clone is named by its plate address and
        // `plateAddress` defaulted to 4x6 whatever vessel it was in — so in a 96-well block the
        // name said `1B1` while `layoutFor` put the clone in `B1` of an eight-row plate, and the
        // fifth clone was called `1A2` while sitting in `E1`. The address a clone is called by
        // and the well it sits in are meant to be the same fact.
        const clone = cloneDesignation(i, { library, ...shapeOf(vessel) });
        return { ...job,
          id: `${job.cf}:${job.line}:${base}-${clone}`,
          output: `${base}-${clone}`,
          args: { ...job.args, clone, vessel,
                  ...(wells[i] ? { well: wells[i] } : {}) } };
      });
    } catch (e) {
      // IN THE GRAMMAR SOMEBODY WRITES IN. `cloneDesignation` says *"pass { library: true }"*,
      // which is true of the function and is not what goes on the line.
      job.expandProblem = `${job.operation} ${job.output}: `
        + e.message.replace('pass { library: true }', 'say `library=true` on the line');
      out.push(job);
      continue;
    }
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
