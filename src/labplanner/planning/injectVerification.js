// injectVerification.js — pick, miniprep, sequence, read the traces. The steps between building
// a plasmid and believing you have it.
//
// THEY ARE IN NO FILE, AND THAT IS WHY THEY WERE MISSING. A construction file describes the
// chemical structure of the DNA; picking a colony and reading a trace change nothing about it, so
// a CF naming them would be a CF making a claim outside its subject. A characterization file
// describes what happens to the plasmid ONCE IT IS BUILT; verification is what establishes that
// it is built, so it is not that either. The Lactis3 characterization file says so in its own
// header: *"the real dependency runs through pick, miniprep and sequencing — which verify the
// construction rather than perform it, and are in neither file yet."*
//
// SO THEY ARE INJECTED, exactly as the gel and the cleanup are, and for the same reason: JCA,
// 2026-09-11, *"labplanner is about planning the entire experiment, holistically"* — a planner
// that emits a transformation and then stops has planned four of the nine sessions and called it
// an experiment.
//
// WHAT IS DEFAULTED AND WHAT IS REFUSED, because these steps are not equally mechanical:
//
//   pick        4 colonies. JCA, 2026-09-10: *"I usually say 4, but for libraries this gets more
//               complicated."* So 4 is the clone default and a library is a conversation; the
//               selection criteria are a conversation too and the sheet carries whatever it is
//               given rather than inventing one.
//   miniprep    mechanical except for where the tubes go, which needs the inventory and a
//               judgement about what sits next to what. Named as an open decision, not guessed.
//   sequencing  NOT DEFAULTED AT ALL. *"It is very contextual as to what to do… not trivial."*
//               Which oligo reads into the junction is a lookup against the project's own oligos,
//               and picking one on a guess produces an unreadable trace and a week's delay. The
//               step is emitted with the decision marked open, because a plan that silently omits
//               the sequencing reads as an experiment that does not need it.
//
// A REFUSAL THAT IS VISIBLE IS NOT THE SAME AS A GUESS. Each undecided field arrives as an
// `asks` entry on the bin, so the sheet shows the hole and `c6-labplan` counts them.
import { cloneName, readName } from './naming.js';

// **THE GATE IS A RULE** — `rules/verification.rules.js` decides WHETHER a chain is added; this
// file builds it. Re-exported because those are the names every existing caller imports.
export { VERIFY_AFTER, CLONE_PICKS } from '../rules/verification.rules.js';
import { choose, CHAIN as CHAIN_OPS, CLONE_PICKS, VERIFY_AFTER } from '../rules/verification.rules.js';
import { WELL_VOLUME_ML } from '../rules/culture.rules.js';

// NAMES ARE BUILT FROM THE CONSTRUCT, NOT FROM THE STEP BEFORE. Chaining suffixes gives
// `pBET8_Mach1_clones_minipreps_reads_verified` by the fourth step — a name nobody writes on
// anything, in a column somebody has to read at a bench. The construct is what every one of these
// steps is about, so it is what they are named for.
const nameOf = (construct, suffix, i, n) =>
  `${construct}_${suffix}${n > 1 ? `_${i + 1}` : ''}`;

// A PICKED COLONY IS A CLONE, AND A CLONE IS A LETTER. JCA, 2026-09-12, of four minipreps named
// `pBET8_mp_1` … `pBET8_mp_4`: *"These labels are wonky. I'm fine with referring to plates of L3h
// and such, but the names are pBET8-A like, A, B, C, D."*
//
// `pBET8-A` is the convention the lab already writes on tubes and in the record, and it says the
// true thing: these are four candidates for the same design, told apart by which colony they came
// from. `pBET8_mp_3` says "the third miniprep", which is a fact about the afternoon rather than
// about the DNA. He had said the same thing on 2026-09-11 about a different name: *"in the
// documented version 'pBET8-A' meaning with clone identifier."*
//
// THE LABEL AND THE NAME ARE STILL DIFFERENT THINGS — the tube is `L3h` and what is in it is
// `pBET8-A`. Both are on the sheet, which is what he asked for.
const cloneOf = (construct, i) => cloneName(construct, i);

/**
 * Add the verification chain after each cloning transformation: pick, miniprep, sequence, and a
 * desk session to read the traces. Ordered by depth so it composes with the other injectors.
 *
 * @param {Array} bins  labsheet bins, after binReactions
 * @param {Object} cfg  { picks, sequencingOligo }
 * @returns {Array} bins, with four bins added after each transform bin
 */
export function injectVerificationJobs(bins, cfg = {}) {
  const after = cfg.verifyAfter || VERIFY_AFTER;

  // DECLARED BEATS INJECTED. A characterization file may now name these four steps itself, and
  // where it does, injecting a second set puts two picks and two minipreps on one plan. JCA,
  // 2026-09-12: *"Fold it into the characterization file."*
  //
  // The test is whether a DECLARED step already consumes this transform's product — not whether a
  // `pick` exists anywhere, because a characterization file picks twice: once off the cloning
  // plate and once off the retransformation. The first is verification; the second is not.
  // AND ONLY A DECLARED *VERIFICATION* STEP COUNTS. `Retransform pGOLD` also consumes the
  // transform's product, and it is not verification — reading any consumer as one made the whole
  // chain vanish from an experiment that declares a retransform and nothing else. Caught by the
  // golden fixture, which is the case the real experiment does not exercise.
  const CHAIN = new Set(CHAIN_OPS);
  const declaredConsumers = new Set();
  for (const b of bins || []) {
    for (const j of b.jobs || []) {
      if (!j.args?._characterization || !CHAIN.has(j.operation)) continue;
      for (const n of j.dnaInputs || []) declaredConsumers.add(n);
    }
  }
  const picks = cfg.picks ?? CLONE_PICKS;
  // One name, or a list. Given none, the step is still emitted and the choice is carried as open —
  // a plan that silently omitted the sequencing would read as an experiment that does not need it.
  const oligos = [].concat(cfg.sequencingOligos || cfg.sequencingOligo || []).filter(Boolean);
  // `F` and `R` for a pair, which is what a forward and a reverse read are called everywhere and
  // what this lab's own sheets already used: `pBET8-AF` and `pBET8-AR`. Numbered beyond that,
  // because `pBET8-BT` would be somebody's guess at what `T` meant. A verification file may name
  // the suffixes itself, which is how a lab with another convention gets its own.
  const suffixes = cfg.readSuffixes || null;
  const readSuffix = (i, n) => (suffixes
    ? (suffixes[i] ?? String(i + 1))
    : readName('', i, n));
  const out = [];
  for (const bin of bins || []) {
    out.push(bin);
    const gate = choose({ operation: bin.operation, jobs: bin.jobs, declaredConsumers,
                          picks, verifyAfter: after });
    if (!gate.inject) continue;

    // ONE STEP PER TRANSFORMED PLATE, keeping the product name so every later sheet and the
    // inventory can trace a tube back to the construct it came from.
    const chain = [
      // `colonies` AND NOT `clones`, BECAUSE A CHARACTERIZATION FILE PICKS TOO. Lactis3's own
      // `Pick pBET8_lactis … pBET8_clones` would have collided with this one exactly — two
      // different blocks, in two different organisms, under one name, and every later lookup
      // taking whichever was indexed last.
      { operation: 'pick', suffix: 'colonies', bump: 0.1,
        // THE WELL VOLUME IS DECLARED HERE AND NOT LEFT TO TWO MODULES AGREEING BY ACCIDENT.
        // `picking_colonies_into_block` defaults to 4 mL a well and `qiagen_miniprep` defaults to
        // pelleting 4 mL; they matched, and nothing connected them, so a change to either would
        // have desynchronised the two halves of one action with no test in between.
        params: { n: String(picks), volume: `${cfg.wellVolumeML ?? WELL_VOLUME_ML}mL`,
                  ...(cfg.pickMedium ? { medium: cfg.pickMedium } : {}),
                  ...(cfg.pickMax ? { max: String(cfg.pickMax) } : {}),
                  ...(cfg.pickCriteria ? { criteria: cfg.pickCriteria } : {}) },
        open: cfg.pickCriteria ? []
            : ['selection criteria — what counts as a colony worth picking here'] },
      { operation: 'miniprep', suffix: 'mp', bump: 0.2, fanOut: true, clones: true,
        openIfUndeclared: !cfg.cloneBase,
        params: cfg.minprepBox ? { box: cfg.minprepBox } : {},
        open: [
          ...(cfg.minprepBox ? []
            // THE BOX, NOT THE WELL. The box is a standing decision; the well is a fact recorded
            // at the freezer. A hold on a spot would be legitimate and is not built.
            // → operations/miniprep.md
            : ['which box these minipreps go into — `box=` on the Miniprep line settles it. The '
             + 'well is written at the −20 and comes back on the sheet.']),
          ...(cfg.cloneBase ? []
            : ['what these clones are clones of — nothing declared it, so they are named after '
             + 'the transformation\u2019s product. Say `clone=<name>` on a Miniprep line in the '
             + 'characterization file to settle it.']),
        ] },
      // ONE READ PER CLONE PER OLIGO, EACH NAMED FOR WHAT IT READS. JCA, 2026-09-12: *"sequencing
      // labels should be 'pBET8-B', or maybe 'pBET8-Bf' and 'pBET8-Br' if there are two reads.
      // When sequencing comes back, we need to be able to precisely map it to the data."*
      //
      // Two oligos on one clone are two reactions and two trace files, and the only thing that
      // tells them apart afterwards is what was written on the tube. `f` and `r` where there are
      // two; numbered where there are more.
      { operation: 'sequencing', suffix: 'seq', bump: 0.3, fromParent: true,
        reads: oligos.length || 1,
        params: oligos.length === 1 ? { oligo: oligos[0] } : {},
        open: oligos.length ? []
            : ['which oligo to sequence with, and whether this is a region or the whole plasmid '
             + '— c6-sim <cf> --primes <oligo> says where an oligo sits and whether it has more '
             + 'than one site'] },
      // DESK WORK, AND STILL A SESSION. Reading traces against the intended sequence is where a
      // wrong clone is caught, it takes a sitting, and a plan that omits it hands somebody a
      // retransformation of an unverified plasmid.
      { operation: 'analysis', suffix: 'ok', bump: 0.4, gather: true,
        params: {}, open: [] },
    ];

    // THE CLONES FAN OUT ONCE AND THEN STAY FANNED OUT, AND THE ANALYSIS GATHERS THEM BACK IN.
    //
    // Four picked colonies are four minipreps, four sequencing reactions and four traces — a
    // sheet with one row saying "minipreps" leaves somebody doing that arithmetic with a pipette
    // in their hand. But the fan is ONE event: multiplying at every step gave four minipreps,
    // sixteen sequencing reactions and sixteen identical analysis rows.
    //
    // The pick is one row because it is one block. The analysis is one row because it has ONE
    // answer — which clone is correct — and four rows of it would be four places for that answer
    // to be written differently.
    // WHAT THE CLONES ARE CLONES OF, WHEN NOBODY SAID.
    //
    // The colonies on this plate carry what the transformation PRODUCED, so that is the base: a
    // conventionally-written file gives `pGOLD-A`. Reading the transform's INPUT instead gave
    // `gg-A` — a working name, on a tube, in a freezer.
    //
    // NEITHER END IS RIGHT IN GENERAL and `docs/LABSHEET-SPEC.md` § 6 says why: there is no rule
    // about DNA naming to derive it from. Lactis3's own file names the assembly `pBET8` and the
    // transform `JTK165-AB/pBET8`, so the defensible default there is the wrong one. The
    // characterization file settles it with `clone=`, and where it does not, this says so.
    let from = bin.jobs.map((j) => ({ ...j, _construct: cfg.cloneBase || j.output }));
    for (const step of chain) {
      let jobs;
      const make = (parent, output, inputs) => ({
        id: `${parent.cf}:${parent.line}:${output}`,
        operation: step.operation,
        output,
        dnaInputs: inputs,
        oligos: [],
        args: { ...step.params, _injected: true },
        cf: parent.cf,
        line: parent.line,
        raw: '',
        _construct: parent._construct,
      });
      if (step.gather) {
        // One job per construct, consuming every read of it.
        const byConstruct = new Map();
        for (const j of from) {
          if (!byConstruct.has(j._construct)) byConstruct.set(j._construct, []);
          byConstruct.get(j._construct).push(j);
        }
        jobs = [...byConstruct.entries()].map(([c, members]) => {
          const j = make(members[0], nameOf(c, step.suffix, 0, 1), members.map((m) => m.output));
          // WHICH CONSTRUCT THIS SESSION SETTLES. After it, "fetch pBET8" means the clone that
          // passed and not the assembly reaction — and the labsheet has to be able to say so.
          // THE TUBES, NOT THE READS. What gets electroporated after this session is the
          // miniprep DNA; the sequencing reactions are consumed by the machine. Naming the reads
          // as the thing to fetch would send somebody to the freezer for a spent reaction.
          // `verifies` IS THE CONSTRUCT, which is the clone base — not the transform's product
          // when they differ. It is what a later `Retransform pBET8` names.
          j.args = { ...j.args, verifies: cfg.cloneBase || c,
                     tubes: [...new Set(members.flatMap((m) => m.dnaInputs || []))].join(',') };
          return j;
        });
      } else if (step.fanOut && from.length === bin.jobs.length) {
        jobs = from.flatMap((j) => Array.from({ length: picks }, (_, i) =>
          make(j, step.clones ? cloneOf(j._construct, i)
                              : nameOf(j._construct, step.suffix, i, picks), [j.output])));
      } else if (step.fromParent) {
        const n = step.reads || 1;
        jobs = from.flatMap((j) => Array.from({ length: n }, (_, i) => {
          const job = make(j, `${j.output}${readSuffix(i, n)}_${step.suffix}`, [j.output]);
          if (n > 1) job.args = { ...job.args, oligo: oligos[i] || '' };
          return job;
        }));
      } else {
        jobs = from.map((j) => make(j, nameOf(j._construct, step.suffix,
                                              from.indexOf(j), from.length), [j.output]));
      }
      out.push({
        operation: step.operation,
        round: bin.round,
        rounds: bin.rounds,
        derivedFrom: bin.operation,
        injected: true,
        jobs,
        cfs: bin.cfs,
        depth: bin.depth + step.bump,
        ...(step.open.length ? { open: step.open } : {}),
      });
      from = jobs;
    }
  }
  out.sort((a, b) => a.depth - b.depth);
  out.forEach((b, i) => { b.index = i; });
  return out;
}
