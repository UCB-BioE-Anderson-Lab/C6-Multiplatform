// cfToJobs.js — validated construction files in, jobs with dependency edges out.
//
// THE INPUT IS VALIDATED CFs. JCA, 2026-09-10: *"the input to labplanner is validated
// construction files and an inventory."* Validation is `validate/constructionFile.js` and it is
// not repeated here: a planner that quietly plans around a broken file produces a labsheet for
// an experiment that cannot work, which is worse than refusing. What this does check is the one
// thing validation cannot — that the files, TAKEN TOGETHER, make sense: two construction files
// producing the same name are each individually fine and jointly ambiguous.
import { parseCF } from '../../C6-Sim.js';
import { genericSteps, KNOWN_OPERATIONS } from '../validate/constructionFile.js';
import { parseCharacterization, CHARACTERIZATION_OPERATIONS } from '../validate/characterizationFile.js';
import { createJob, DNA_INPUTS, OLIGO_INPUTS } from './job.js';

// parseCF narrates on stdout; a library must not.
const _log = console.log;
const quietly = (fn) => { console.log = () => {}; try { return fn(); } finally { console.log = _log; } };

function stepsOf(text, characterization = false) {
  // A CHARACTERIZATION FILE IS A DIFFERENT DOCUMENT AND GETS ITS OWN READER. Run through the
  // construction parser it degrades to the generic reader, which cannot tell `ex=483` from
  // `em=525` — they arrive as two strings in a list, positionally, which is the one thing
  // measurement parameters cannot survive. The file knows which kind it is; use it.
  if (characterization) {
    const { steps, problems } = parseCharacterization(text);
    if (problems.length) for (const p of problems) _log(`  ! ${p.message}`);
    return steps;
  }
  return constructionStepsOf(text);
}

function constructionStepsOf(text) {
  try {
    const cf = quietly(() => parseCF(text));
    const steps = cf && (cf.steps || cf.operations || (Array.isArray(cf) ? cf : null));
    if (steps && steps.length) return steps;
  } catch { /* fall through — the generic reader is the point of having one */ }
  return genericSteps(text);
}

// Pull named fields off a step. Takes the FIELD LIST, not the table, because the caller
// sometimes has to override it — a generically-read step holds everything in `dnas` no matter
// what its operation is called, and a version of this that looked the list up again silently
// ignored that override and severed every dependency edge in the file.
function pluck(step, fields) {
  const out = [];
  for (const f of (fields || [])) {
    const v = step[f];
    if (Array.isArray(v)) out.push(...v.filter(Boolean));
    else if (typeof v === 'string' && v) out.push(v);
  }
  return out;
}

function dnaInputsOf(step) {
  const op = String(step.operation || '').toLowerCase();
  // A GENERICALLY-READ STEP KEEPS ALL ITS INPUTS IN `dnas`, whatever its operation is called.
  // `validate/constructionFile.js` carries the same guard and says why: without it, a Transform
  // read generically was asked for its `dna` field, found nothing, and its input vanished. Here
  // the same mistake severed every dependency edge in the file — pGhost16's Transform looked
  // like it depended on nothing and was scheduled before the assembly that makes what it
  // transforms. A planner that loses an edge does not fail; it emits a plausible wrong order.
  // A CHARACTERIZATION STEP KEEPS ITS SUBJECT IN `dnas` TOO, for the same reason: its subject
  // field is named for the operation — a pick has a `plate`, an assay has `samples` — and
  // DNA_INPUTS is keyed on construction operations that have none of those. Reading `dnas`
  // uniformly is what keeps the dependency edge from retransform back to the transform that
  // made the strain.
  const fields = (step._generic || step._characterization) ? ['dnas'] : DNA_INPUTS[op];
  if (!fields) {
    // An operation with no declared shape: everything between the verb and the product is
    // treated as DNA. Over-linking is the safe direction — it can only put two steps in
    // different labsheets that could have shared one, never merge two that must not.
    const v = step.dnas || [];
    return Array.isArray(v) ? v.filter(Boolean) : [v].filter(Boolean);
  }
  return pluck(step, fields);
}

/**
 * @param {Array<{name:string, text:string}>} cfs  validated construction files
 * @returns {{jobs:Array, byOutput:Map, problems:Array}}
 */
/**
 * Lift every step out of a set of construction files into jobs carrying their dependency edges,
 * their oligos and where they came from. Names resolve file-locally first, so two files may
 * each have their own `gg`.
 *
 * @param {Array<{name:string, text:string}>} cfs  validated construction files
 * @returns {{jobs:Array, byOutput:Map, resolve:Function, problems:Array}}
 */
export function extractJobsFromCFs(cfs, cfg = {}) {
  const jobs = [];
  const problems = [];
  const producers = new Map();            // name -> [job, ...]

  for (const { name, text, characterization } of cfs || []) {
    const steps = stepsOf(text, characterization);
    steps.forEach((step, i) => {
      const op = String(step.operation || '').toLowerCase();
      const output = step.output || step.product || '';
      if (!output) {
        problems.push({ code: 'NO_PRODUCT', cf: name, line: i + 1,
                        message: `step ${i + 1} names no product` });
        return;
      }
      const job = createJob({ operation: op, output, dnaInputs: dnaInputsOf(step),
                              oligos: step._generic ? []
                                        : pluck(step, OLIGO_INPUTS[op]),
                              // A characterization step holds its key=value pairs in `args`;
                              // flattened here so a caller reads job.args.ex rather than
                              // job.args.args.ex, which is the sort of shape nobody remembers.
                              args: step._characterization ? { ...step, ...step.args } : step,
                              cf: name, line: i + 1, raw: step.raw || '' });
      // A generic read cannot tell an oligo from a template — they are all just tokens between
      // the verb and the product. Saying so is the difference between "this PCR uses no oligos"
      // and "nobody could tell": the first sends the dilution stage away empty and confident.
      if (step._generic) job.approximate = true;
      if (!producers.has(output)) producers.set(output, []);
      producers.get(output).push(job);
      jobs.push(job);
      // EACH FILE IS CHECKED AGAINST ITS OWN VOCABULARY. A characterization file's operations
      // are retransform/culture/pick/assay and none of them is a construction operation, so
      // checking every step against KNOWN_OPERATIONS reported all four as unknown — a plan that
      // worked, alongside four problems that were not problems. Its own parser has already
      // refused anything it does not know, and said where that step belongs instead.
      const vocabulary = step._characterization ? CHARACTERIZATION_OPERATIONS : KNOWN_OPERATIONS;
      if (!vocabulary.includes(op)) {
        problems.push({ code: 'UNKNOWN_OPERATION', cf: name, line: i + 1,
                        message: `"${step.operation}" is not an operation this planner knows` });
      }
    });
  }

  // A NAME IS LOCAL TO ITS CONSTRUCTION FILE UNLESS IT HAS TO CROSS.
  //
  // SynThera has ten construction files and three of them produce something called `gg`; two
  // produce `gho_back` and `par_frag`. Those are working names for an intermediate — the Golden
  // Gate product of *this* file — and they are not the same molecule. A single global map keeps
  // whichever it saw first, so pGhost3's Transform silently linked to pGhost2's assembly, and
  // the planner emitted an order built on an edge that does not exist.
  //
  // At the same time names genuinely DO cross: pGhost17's PCRs template on `pGhost16`, which
  // another file makes, and that edge is the reason those PCRs cannot share a labsheet with the
  // ones that build it. Both are real, so resolution is: **the producer in my own file if there
  // is one; otherwise the unique producer elsewhere; otherwise ambiguous and said out loud.**
  const resolve = (job, name) => {
    const all = producers.get(name) || [];
    const mine = all.filter((p) => p.cf === job.cf && p !== job);
    if (mine.length) return mine[mine.length - 1];        // the most recent one before it
    const others = all.filter((p) => p !== job);
    return others.length === 1 ? others[0] : null;
  };

  for (const [name, list] of producers) {
    if (list.length < 2) continue;
    const files = [...new Set(list.map((j) => j.cf))];
    if (files.length < 2) {
      problems.push({ code: 'DUPLICATE_PRODUCT', cf: files[0], line: list[1].line,
                      message: `"${name}" is produced twice in one file` });
      continue;
    }
    // Only a problem where somebody outside those files has to consume it: within each file the
    // local rule answers cleanly, and reporting it anyway would flag every reused working name
    // in the project as an error nobody can act on.
    const outsideConsumers = jobs.filter((j) => !files.includes(j.cf) && j.dnaInputs.includes(name));
    if (outsideConsumers.length) {
      problems.push({ code: 'AMBIGUOUS_ACROSS_FILES', cf: outsideConsumers[0].cf,
                      line: outsideConsumers[0].line,
                      message: `"${name}" is produced by ${files.join(' and ')} — cannot tell which one ${outsideConsumers[0].output} uses` });
    }
  }

  // byOutput is kept for callers that only need a name lookup; `resolve` is what the dependency
  // analysis must use, because only it knows which file is asking.
  const byOutput = new Map([...producers].map(([n, l]) => [n, l[0]]));
  return { jobs, byOutput, producers, resolve, problems };
}
