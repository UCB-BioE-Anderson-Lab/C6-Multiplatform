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
import { expandClones } from './expandClones.js';
import { KNOWN_ANTIBIOTICS } from './injectTransformRecovery.js';

// parseCF narrates on stdout; a library must not.
const _log = console.log;
const quietly = (fn) => { console.log = () => {}; try { return fn(); } finally { console.log = _log; } };

/**
 * The steps of one file, and anything wrong with it — RETURNED, never printed.
 *
 * **THIS PRINTED THE PROBLEMS TO STDOUT, TWO LINES UNDER A COMMENT SAYING A LIBRARY MUST NOT.**
 * `c6-plan --json` writes the plan to stdout, so a characterization file with a typo put
 * `  ! line 1 names 1 unnamed value(s)…` in front of the JSON — and `c6-packet`, which parses that
 * stdout, then reported:
 *
 *     c6-packet: c6-plan failed
 *     Unexpected token '!', "  ! line 1 n"... is not valid JSON
 *
 * So the one sentence naming the line to fix was replaced by a parse error about a bracket. That is
 * the failure this whole toolkit is built against — *a refusal is a finding, not an exception* —
 * committed by the finding channel itself, and it survived because every characterization fixture
 * the suite has is a file that parses.
 *
 * Found on 2026-09-16 by `docs/REPORT.html`, whose `no-product` fault is a characterization file
 * with a line that names no product. It is the first defect that page caught which the 790 tests
 * beside it did not.
 *
 * A CHARACTERIZATION FILE IS A DIFFERENT DOCUMENT AND GETS ITS OWN READER. Run through the
 * construction parser it degrades to the generic reader, which cannot tell `ex=483` from `em=525` —
 * they arrive as two strings in a list, positionally, which is the one thing measurement parameters
 * cannot survive. The file knows which kind it is; use it.
 */
function stepsOf(text, characterization = false) {
  if (characterization) return parseCharacterization(text);
  return { steps: constructionStepsOf(text), problems: [] };
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

/** Can `from` reach `to` by consuming, directly or indirectly, what it produces? */
function reaches(from, to, producers, resolve) {
  const seen = new Set();
  const walk = (j) => {
    if (j === to) return true;
    if (seen.has(j.id)) return false;
    seen.add(j.id);
    for (const n of j.dnaInputs || []) {
      const p = resolve(j, n);
      if (p && walk(p)) return true;
    }
    return false;
  };
  return walk(from);
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
  const lifted = [];
  const problems = [];

  for (const { name, text, characterization } of cfs || []) {
    const read = stepsOf(text, characterization);
    const steps = read.steps;
    // INTO THE CHANNEL A PERSON READS, carrying the file's name. `parseCharacterization` knows the
    // line and not which document it was in, and "line 1" on its own sends somebody to the wrong
    // file the moment an experiment has two.
    for (const pr of read.problems || []) problems.push({ ...pr, cf: pr.cf || name });
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
      lifted.push(job);
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
      // **A WORD IN THE ANTIBIOTIC POSITION THAT IS NOT AN ANTIBIOTIC IS A BROKEN FILE, NOT A
      // MISSING FIELD.** JCA, 2026-09-17, ruling claim 17 FALSE: *"If the antibiotic field is like
      // 'Bubba' instead of 'Carb', it is not even parsible as a CF."*
      //
      // It used to compile. The parser dropped the word, `transformRecovery.unreadable` found no
      // antibiotic and — correctly, by its own lights — declined to guess, so the workbook came
      // out with a blank antibiotic column, no note, no STILL TO DECIDE, and three control plates
      // silently missing. Every individual decision was defensible and the page was unusable.
      //
      // The name is listed in the message rather than just the fact of it, because the whole fix
      // is usually a spelling.
      if (step.unrecognized && step.unrecognized.length) {
        problems.push({ code: 'UNKNOWN_ANTIBIOTIC', cf: name, line: i + 1,
                        message: `step ${i + 1} says "${step.unrecognized.join('", "')}" where an `
                          + 'antibiotic belongs, and that is not a name this planner knows. It '
                          + `knows ${KNOWN_ANTIBIOTICS.join(', ')}. The file is refused: what to `
                          + 'plate on decides whether the cells need an outgrowth before plating, '
                          + 'and getting that wrong loses the whole plate silently.' });
      }
    });
  }

  // ONE DECLARED STEP MAY BE N TUBES, and that has to happen before the dependency map is built —
  // `resolve` closes over `producers`, so a job created afterwards is a name nothing produces.
  const expanded = expandClones(lifted);
  const jobs = expanded.jobs;
  problems.push(...expanded.problems);

  const producers = new Map();            // name -> [job, ...]
  for (const job of jobs) {
    if (!producers.has(job.output)) producers.set(job.output, []);
    producers.get(job.output).push(job);
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

  // A CHARACTERIZATION FILE COMES AFTER THE WHOLE CONSTRUCTION FILE, NOT AFTER ONE STEP OF IT.
  //
  // JCA, 2026-09-12, looking at a packet: *"you've got electroporation before mach1
  // transformation. Electroporation comes much later, after sequence confirmation."*
  //
  // The name-level edge is correct and insufficient. `Retransform pBET8 …` names the construct,
  // and the construct exists the moment the Golden Gate reaction is assembled — so the only edge
  // the graph had ran from the assembly, and nothing stopped the electroporation being scheduled
  // beside the transformation that verifies it. The characterization file's own header says why
  // that is wrong: *"What happens to pBET8 once it is built."* Once it is BUILT — which means
  // transformed, picked, minipreped and sequenced, and the last two are in neither file yet.
  //
  // So the dependency is on the FILE, not on the step: every characterization step comes after
  // every step of the construction file that makes its subject. That is true by what the two
  // documents are, which is why it holds without knowing which verification steps exist — and it
  // is why the gap noted in the Lactis3 file ("a correct name with a known scheduling gap")
  // could be closed without inventing a miniprep nobody wrote down.
  for (const j of jobs) {
    if (!(j.args && j.args._characterization)) continue;
    const seen = new Set();
    for (const name of j.dnaInputs) {
      const producer = resolve(j, name);
      if (!producer || producer.args?._characterization || seen.has(producer.cf)) continue;
      seen.add(producer.cf);
      // CONSTRUCTION STEPS ONLY. Both files are read under the construct's name, so `cf` alone
      // does not separate them and the characterization steps would come to depend on each
      // other — every one of them reported as a cycle, and all four dropped from the plan.
      for (const other of jobs) {
        if (other === j || other.cf !== producer.cf || other.args?._characterization) continue;
        (j.deps ||= []).push(other.id);
      }
    }
  }

  // HOW MANY WELLS THE PICKED CLONES ALREADY TOOK, for whatever shares their block. A culture
  // inoculating two controls beside four clones needs to know the four are in A1-D1, or it invents
  // the last two positions at the bench.
  for (const j of jobs) {
    if (!j.args?._characterization || j.args.picked) continue;
    const upstream = (j.dnaInputs || []).map((n) => resolve(j, n)).filter(Boolean);
    const picks = upstream.filter((p) => p.operation === 'pick');
    if (picks.length) j.args = { ...j.args, picked: String(picks.length) };
  }

  // A STEP ON A CONSTRUCT COMES AFTER THE ANALYSIS THAT VERIFIES THAT CONSTRUCT.
  //
  // JCA, 2026-09-12, on why the characterization file keeps naming `pBET8` and not the clone that
  // passed: *"a characterization file is referring to platonic ideals, not really to specific
  // tubes... think of the doc as meaning 'the method of characterizing a plasmid with pBET8's
  // sequence'."* Right — and it means `Retransform pBET8` names something that exists from the
  // moment the Golden Gate reaction is assembled, so nothing in the name says it comes after the
  // sequencing. Ordered by name alone, the electroporation lands beside the miniprep.
  //
  // He also ruled where the fix belongs: *"that is the toolkit's problem to carry."* So the
  // toolkit reads the `verifies=` the file already carries — `Analysis pBET8_reads verifies=pBET8`
  // — and every later step on `pBET8` waits for it. The file stays about a platonic plasmid and
  // the plan knows which afternoon is which.
  // **WHICH CONSTRUCT A VERDICT IS ABOUT, WHERE THE FILE DID NOT SAY.**
  //
  // `injectVerification` sets `verifies` on the chain it invents, so every experiment whose
  // verification is INJECTED got its ordering edge — and both fixtures are that, so the mechanism
  // below looked covered. A file that writes the four steps out, which is what `DECLARED BEATS
  // INJECTED` invites, produced an analysis with no `verifies=` at all. `verifiers` stayed empty
  // and everything hanging off it did nothing.
  //
  // Three things went with it, none visible on the page that was wrong: no ordering edge, so an
  // electroporation was free to be scheduled beside the verification pick that was supposed to
  // justify it; no `afterVerified`, so its sheet never asked which clone; and the label hold
  // landed on `pS_verdict` — a name for a verdict — instead of on the construct.
  //
  // Found by `scenarios § verify-and-phase-two`, where the two picks bin together and what
  // reaches a person is a column-contract error about a labsheet.
  //
  // **WALKED, NOT PARSED.** The verdict is about the plasmid the CONSTRUCTION file built, so the
  // walk goes up the characterization chain — reads, tubes, colonies — and stops at the first name
  // whose producer is a construction step. Cutting `-A` off `pS-A` would be the guess `naming.js`
  // refuses to make, and it is wrong the first time a clone base differs from the construct.
  for (const j of jobs) {
    if (j.operation !== 'analysis' || j.args?.verifies) continue;
    const found = new Set();
    const seen = new Set();
    const walk = (job, hops) => {
      if (hops > 8 || seen.has(job.id)) return;
      seen.add(job.id);
      for (const n of job.dnaInputs || []) {
        const p = resolve(job, n);
        // A NAME NOTHING IN THIS PLAN PRODUCES IS NOT A CONSTRUCT THIS ANALYSIS VERIFIES. It is a
        // material out of a freezer, and a verdict about it would be the invention this toolkit
        // exists to prevent.
        if (!p) continue;
        if (!p.args?._characterization) { found.add(n); continue; }
        walk(p, hops + 1);
      }
    };
    walk(j, 0);
    if (found.size === 1) { j.args = { ...j.args, verifies: [...found][0] }; continue; }
    // **TWO ANSWERS IS NOT AN ANSWER, AND NO ANSWER IS NOT ZERO.** An analysis reading clones of
    // two constructs verifies neither on its own; one whose reads trace back to nothing verifies
    // nothing we can name. Either way the steps after it are NOT ordered against it, and a plan
    // that leaves them unordered quietly is one that can put an electroporation on the same
    // afternoon as the sequencing meant to justify it.
    problems.push({ code: 'ANALYSIS_VERIFIES_WHAT', cf: j.cf, line: j.line,
      message: `line ${j.line} of ${j.cf}: this Analysis produces "${j.output}" and nothing says `
        + 'which construct its verdict is about'
        + (found.size ? `, because its reads trace back to ${found.size} of them `
                      + `(${[...found].join(', ')})` : '')
        + '. Steps later in the file that use that construct will not be ordered after this '
        + 'verdict. Say `verifies=<construct>` on the Analysis line.' });
  }

  const verifiers = new Map();
  for (const j of jobs) {
    const v = j.args?.verifies;
    // **THE `!v` GUARD USED TO SKIP THE WHOLE BODY**, which took `tubes` with it: a declared
    // analysis got neither the edge nor the per-clone rows, and the comment below claiming to fix
    // exactly that case only ever ran for the injected one. Derivation above now fills `verifies`
    // wherever it can be walked to, so what is left here is an analysis nobody can name a subject
    // for — and that one is reported, not skipped silently.
    if (j.operation !== 'analysis') continue;
    if (v) verifiers.set(String(v), j);
    // WHICH TUBES THE VERDICT IS ABOUT. An analysis consumes READS and decides about the DNA those
    // reads came from, which is one step further up: `pBET8-AF` is a spent reaction and `pBET8-A`
    // is the tube somebody fetches afterwards. The injector computed this and a declared analysis
    // had no way to, so the sheet showed one row for the construct instead of one per clone, and
    // the electroporation offered a choice "one of pBET8".
    if (!j.args.tubes) {
      const tubes = [...new Set((j.dnaInputs || []).flatMap((n) => {
        const read = resolve(j, n);
        return read ? (read.dnaInputs || []) : [];
      }))];
      if (tubes.length) j.args = { ...j.args, tubes: tubes.join(',') };
    }
  }

  if (verifiers.size) {
    for (const j of jobs) {
      // CHARACTERIZATION STEPS ONLY. The transform's own input is `pBET8` too — it is what MAKES
      // the thing being verified — so an edge from the analysis to it is a cycle, and every step
      // of the file came back as one.
      if (!j.args?._characterization || j.operation === 'analysis') continue;
      for (const name of j.dnaInputs) {
        const a = verifiers.get(String(name));
        // NOT THE STEPS THAT FEED THE ANALYSIS — they are how it gets its reads, and asking one
        // of them to wait for it is a cycle. The test is whether the ANALYSIS reaches `j`, walking
        // up its own inputs; the first version asked whether `j` reaches the analysis, which is
        // the other direction and always false for something upstream of it.
        if (!a || a === j || reaches(a, j, producers, resolve)) continue;
        (j.deps ||= []).push(a.id);
        // AND THIS STEP IS AFTER THE VERDICT, which is what makes "which clone?" a question worth
        // asking on its sheet. The pick that FEEDS the analysis consumes the same construct and is
        // where the clones come FROM — asking it which clone is being used is backwards.
        j.args = { ...j.args, afterVerified: String(name) };
      }
    }
  }

  // byOutput is kept for callers that only need a name lookup; `resolve` is what the dependency
  // analysis must use, because only it knows which file is asking.
  const byOutput = new Map([...producers].map(([n, l]) => [n, l[0]]));
  return { jobs, byOutput, producers, resolve, problems };
}
