// scenarios.js — the shapes an experiment can have, one named scenario each.
//
// JCA, 2026-09-15, on where the confidence in a labsheet is supposed to come from:
//
// > *"We have buttressed such scenarios in the past by having validation scripts backed up by
// > synthetic tests with different permutations of scenarios. IDK if we have already done that for
// > all these decision-making algorithms or not."*
//
// **FOR THE RULE TABLES, YES. FOR THE COMPOSITION OF THEM, NO.** `test/labplanner/rules.test.js`
// requires every rule to carry a worked example and requires every rule to be FIRED by one of its
// own examples, over all fourteen rule files — that is branch coverage by construction, and it is
// done. What had never been permuted is which operations sit next to which, at what counts, with
// what in the freezer. Two experiments had ever been compiled end to end, and between them they
// left 23 of 51 rules never once reached by a real compile — including `vessel.enoughForABlock`,
// which is the plain case of five colonies going into a block.
//
// ## Why a named list and not a cross product
//
// The axes below multiply out to thousands of combinations, nearly all of which are the same
// experiment with a different number in it. A list somebody can read is worth more than a sweep
// nobody can, and it is the same argument the rule tables already make: `c6-rules` prints fourteen
// tables in the order they are tried because *"a rule you cannot call is a rule you find out about
// on paper"*. So each scenario says, in a field of its own, what shape it is and what it is there
// to reach.
//
// ## The words are fields here, and comments in a rule file. That is deliberate.
//
// `rules/lib.js` keeps a rule's prose in COMMENTS, because *"nothing in the file is there to feed
// a machine"* — the sentence is for a person and the predicate beside it is the logic. A scenario
// is the other way round: `what` and `reaches` are read by `bin/c6-scenarios` and printed, and the
// spec IS data with nothing to execute. Putting them in comments would mean a second parser for
// no gain.
//
// ## `expect` is the part that has to be maintained
//
// Every scenario records whether it compiles or is refused today. **A scenario that starts
// compiling fails the test**, the same way the golden snapshot does, and for the same reason: a
// change in what the toolkit produces is a thing to look at rather than a thing to absorb.
//
// **ONE of these is `refuses`, and that count has been down as well as up.** Three were, on the
// day the matrix was written; two of those turned out to be defects and were fixed, and each keeps
// its account in place because the refusal is the only reason anybody looked. A scenario whose
// refusal is CORRECT stays refused — `block-too-small` is one, because which sitting a second
// block belongs to is a decision about somebody's afternoon and not about a layout.

/**
 * What every scenario is unless it says otherwise: one plasmid of two fragments, picked four ways,
 * verified, and nothing after that.
 *
 * A DEFAULT IS A SHAPE AND NOT A BLANK. Every field here is a real decision — four colonies rather
 * than two, a kanamycin marker rather than an ampicillin one — and a scenario that overrides one
 * is saying which single thing it varies.
 */
export const BASE = {
  name: 'pS',
  constructs: 1,
  sizes: [1400, 1700],
  marker: 'Kan',
  clones: 4,
  vessel: null,
  library: false,
  verify: 'declared',
  reads: 1,
  phase2: false,
  inventory: 'partial',
  mismatch: false,
  expect: 'compiles',
};

/**
 * The synthetic experiments the suite compiles, each named for its shape and for what it reaches.
 *
 * **ORDERED FROM THE ORDINARY TO THE AWKWARD**, so reading the list top to bottom is reading what
 * the toolkit is expected to cope with, in roughly the order somebody would meet it.
 *
 * Fields beyond the spec itself:
 *
 *   id        the folder name the experiment is generated into; also the label prefix's source
 *   what      one sentence, for `bin/c6-scenarios`
 *   reaches   what this is here to exercise that nothing else does. Prose, not an assertion —
 *             the ratchet in `test/labplanner/scenarios.test.js` is what actually measures it.
 *   expect    `compiles` or `refuses`, as of today. Changing one is a deliberate act.
 */
export const SCENARIOS = [
  {
    id: 'minimal',
    what: 'one plasmid, two fragments, no characterization file at all',
    reaches: 'a labsheet that ENDS AT THE TRANSFORMATION. JCA, 2026-09-18: "the construction file '
           + 'basically ends at transformation. So, if the characterization file was empty, you '
           + 'would end the labsheet at construction." It used to reach an injected pick, '
           + 'miniprep and sequencing chain — which manufactured a pick nobody authored, and a '
           + 'pick nobody authored cannot say which colonies to take.',
  },
  {
    id: 'declared-verification',
    what: 'the same experiment with pick, miniprep, sequencing and analysis written out',
    reaches: 'the ONLY path to a pick, now that nothing is injected: written in the '
           + 'characterization file, with a phenotype, through expandClones.',
  },
  {
    id: 'one-clone',
    what: 'a single colony picked',
    reaches: 'clone designation at its lower bound — one letter, and no set to be a member of',
    clones: 1,
  },
  {
    id: 'five-clones',
    what: 'five colonies, which is one more than fits comfortably in tubes',
    reaches: 'vessel.enoughForABlock — five or more go in a block. The ordinary case, and until '
           + 'this scenario existed no compile had ever reached it.',
    clones: 5,
  },
  {
    id: 'thirty-library',
    what: 'thirty clones of a library, named by plate address, in a 48-well block',
    reaches: 'plate-address clone designations and a layout that is neither of the default shapes',
    clones: 30,
    library: true,
    vessel: '48-well',
  },
  {
    id: 'ninety-six',
    what: 'a full 96-well block',
    reaches: 'layoutFor at the top of its range — the well after H12 is the one that does not exist',
    clones: 96,
    library: true,
    vessel: '96-well',
  },
  {
    id: 'two-reads',
    what: 'each clone sequenced from both ends',
    reaches: 'the oligos=/reads= pairing by position, and the F/R suffixes on the tubes that '
           + 'leave the building. No fixture had ever set `oligos=`.',
    reads: 2,
  },
  {
    id: 'four-constructs',
    what: 'four plasmids built and characterized together',
    reaches: 'sixteen picks into one session. Every construct lays its wells out from A1, so four '
           + 'of them claim it — a well is a property of the SESSION and is assigned per job.',
    constructs: 4,
    // WAS `verify: 'injected'`. Nothing is injected any more — a pick is only ever written in the
    // characterization file — so a scenario about sixteen picks has to declare them.
    verify: 'declared',
    phase2: true,
    // **FIXED 2026-09-16, AND THE ACCOUNT IS KEPT** because the refusal it describes is the only
    // reason anybody looked. It used to refuse with *"label \"A1\" is used twice"*.
    //
    // Sixteen tubes went into one 24-well block and four of them were told to sit in A1, because
    // `expandClones` lays wells out with `layoutFor(n, shape)` — a pure function of the count — so
    // every construct started again at the top-left corner. What the sheet model could see was two
    // strings colliding on one page; what was true is that one piece of plastic had been given
    // sixteen occupants and four addresses.
    //
    // The fix was not a running cursor through `expandClones`: the same operation appears in two
    // sessions and a cursor cannot see the boundary between two genuinely different blocks. Wells
    // belong to the sitting, so `planning/allocateWells.js` runs after `groupIntoSessions`.
    //
    // **AND IT UNCOVERED TWO MORE PAGES DOING THE ARITHMETIC THEMSELVES.** The culture's control
    // well and the assay's well map were each `layoutFor(picked + controls)` — one construct's
    // count — so both went on saying the control sat in A2 of a block whose A2 now holds somebody
    // else's culture, and the assay's map keyed four of sixteen wells. Both read the allocation
    // now. A plate reader returns a grid of numbers and a grid with no key is not data.
  },
  {
    id: 'block-too-small',
    what: 'two constructs picking sixteen colonies each into one 24-well block',
    reaches: 'the sitting outgrowing its vessel — thirty-two clones and twenty-four wells. The '
           + 'allocator refuses rather than seating twenty-four and leaving eight holding the '
           + 'addresses expandClones guessed.',
    constructs: 2,
    clones: 16,
    vessel: '24-well',
    expect: 'refuses',
    refusal: 'puts more than 24 clones in one 24-well block',
    // **THIS REFUSAL IS CORRECT AND SHOULD STAY ONE.** JCA's own words are already in `layoutFor`:
    // *"Two blocks is a decision about the session, not about the layout."* Which sitting the
    // second block belongs to, and whether the experiment would rather use a 48-well, are choices
    // about how somebody spends an afternoon — so the toolkit names the problem and the number
    // that would fix it, and stops.
    //
    // It exists because `SESSION_OUTGROWS_VESSEL` fired in none of the other twenty-seven, and a
    // refusal nothing reaches is a refusal nobody has ever read.
  },
  {
    id: 'mastermix',
    what: 'four fragments, so four reactions share one PCR sheet',
    reaches: 'mastermix.worthAMix — the threshold at which a mastermix is worth setting up. No '
           + 'experiment in this repository was large enough to reach it.',
    sizes: [1200, 1400, 1600, 1800],
  },
  {
    id: 'short-product',
    what: 'a 231 bp amplicon',
    reaches: 'Taq rather than PrimeSTAR, the annealing temperature alone as a program, and the '
           + 'small-fragment bind on the cleanup',
    sizes: [231, 1400],
  },
  {
    id: 'long-product',
    what: 'a nine-kilobase amplicon',
    reaches: 'pcrProgram.longProduct — over 8 kb the extension is a different program',
    sizes: [9000, 1400],
  },
  {
    id: 'mixed-chemistry',
    what: 'one short fragment and one long one in the same experiment',
    reaches: 'two chemistries on what would otherwise be one PCR sheet, which splits the bin',
    sizes: [231, 9000],
  },
  {
    id: 'amp-no-rescue',
    what: 'an ampicillin marker',
    reaches: 'transformRecovery.noOutgrowth — a beta-lactam acts on the cell wall, so the plate is '
           + 'the outgrowth and no controls are injected',
    marker: 'Amp',
  },
  {
    id: 'no-selection',
    what: 'an experiment that ends at the assembly and transforms nothing',
    reaches: 'antibioticStock.nothingSelects — not every experiment plates, and one that does not '
           + 'must not have a stock session injected before it',
    marker: 'none',
  },
  {
    // THE ID IS KEPT AND THE PREMISE IS NOT. It was "the antibiotic is already made up", tested by
    // looking in the freezer — and the freezer never knew, because a box inventory holds DNA and
    // an antibiotic is a reagent. What survives the change is what this scenario is actually FOR:
    // a compile where nothing needs making first, so the earliest sheet is the PCR. Two ruled
    // claims read their evidence off that sheet by position, and the default marker Kan now gets
    // a session of its own, which moved the sheet out from under them.
    //
    // Renaming it would rewrite thirteen references including a published report; what matters is
    // that the sentence above the scenario is true of it, and it now is.
    id: 'stock-in-freezer',
    what: 'everything placed, and a routine antibiotic that needs no session of its own',
    reaches: 'antibioticStock.allRoutine and the four "ready" branches of the two source rule '
           + 'sets — the ordinary case, where the first sheet of the compile is the PCR',
    inventory: 'full',
    marker: 'Amp',
  },
  {
    id: 'everything-answered',
    what: 'a full freezer and the one open question answered, so nothing is left to decide',
    reaches: 'a compile that carries NO open decisions at all — the state every other scenario '
           + 'falls short of by exactly one, and the only way to see that STILL TO DECIDE is a '
           + 'real channel rather than a permanent fixture of every sheet.',
    inventory: 'full',
    // → `planning/decisions/labelPrefix.js`. The two characters standing for the experiment on
    // every tube, which cannot be a rule because whether `Zz` collides with somebody else's
    // experiment is a fact about the LAB and no file in one project directory can establish it.
    answers: { labelPrefix: 'Zz' },
  },
  {
    id: 'untracked-box',
    what: 'materials in a box that deliberately records no wells',
    reaches: 'primerSource.readyUntracked and templateSample.boxUntracked — the box is the whole '
           + 'answer and the sheet must ask nothing',
    inventory: 'untracked',
  },
  {
    id: 'well-not-recorded',
    what: 'a tracked box where nobody wrote the wells down',
    reaches: 'primerSource.readyWellUnknown and templateSample.wellNotRecorded — print the box, '
           + 'ask for the well. Collapsing this into "unlocated" throws away the half that is known.',
    inventory: 'wellblank',
  },
  {
    id: 'odd-strength',
    what: 'oligo tubes at 50 uM — neither the working strength nor the stock',
    reaches: 'dilution.neitherStrength and primerSource.someOtherConcentration — a person decides, '
           + 'and the sheet says what was actually found',
    inventory: 'odd',
  },
  {
    id: 'unsimulatable-pcr',
    what: 'a primer that does not match its template, so the product has no length',
    reaches: 'pcrProgram.noProductSize and cleanup.noSizeKnown — the two rules that hold the line '
           + 'against inventing a number. A mutagenic primer genuinely does not match, so this is '
           + 'an ordinary experiment rather than a broken file.',
    mismatch: true,
  },
  {
    id: 'two-culture-stages',
    what: 'two minipreps of one template, from different stages of a serial culture',
    reaches: 'cultureStage — which tube of a construct to reach for when there is more than one. '
           + 'It is re-isolation rather than purification, so the earliest stage wins.',
    inventory: 'cultures',
  },
  {
    id: 'no-inventory',
    what: 'no inventory file at all',
    reaches: 'the unsearched state — "could not look", which must never render the same as '
           + '"nothing found"',
    inventory: 'none',
  },
  {
    id: 'long-name',
    what: 'a plasmid whose name is longer than a cap comfortably holds',
    reaches: 'label.tooLong — which warns rather than refusing, because the name came from the '
           + 'file and that is the author’s to choose',
    name: 'pTEST_Mach1',
  },
  {
    id: 'phase-two',
    what: 'built, verified by the injected chain, then moved into a host, grown and read',
    reaches: 'retransform, culture and assay on top of a construction — the longest chain the '
           + 'toolkit knows, and the shape the golden fixture has',
    phase2: true,
  },
  {
    id: 'verify-and-phase-two',
    what: 'the same, but with the verification written out in the file rather than injected',
    reaches: 'a declared verification pick AND a declared host pick in one experiment — a shape '
           + 'neither fixture has, because golden injects its verification and tlib3 has no '
           + 'phase two.',
    phase2: true,
    // **FIXED 2026-09-15, AND THE ACCOUNT BELOW IS KEPT** because the refusal it describes is the
    // only reason anybody looked. `cfToJobs` now derives `verifies=` for a declared analysis by
    // walking up to the construct the construction file built, so the verdict orders what comes
    // after it and the two picks are two sessions again.
    //
    // **THE REFUSAL WAS A SYMPTOM AND THE CAUSE WAS AN EDGE THAT POINTED AT THE WRONG THING.**
    //
    // `Retransform pS` names the plasmid, and the most recent step producing `pS` is the
    // CONSTRUCTION file's transformation — so the retransform depends on the transform, and the
    // whole verification chain that sits between them (pick, miniprep, sequencing, analysis) is a
    // branch nothing downstream reads. Neither pick can reach the other, so `binReactions` is
    // correct by its own rule to put them on one sheet: the Mach1 verification pick, in tubes,
    // beside the B. subtilis host pick, in a 24-well block, weeks apart and in two organisms.
    //
    // What then fails is a column contract: `design/pick.js` returns `{label, clone, from plate}`
    // for a tube and `{well, clone, from plate}` for a block, the sheet declares its columns from
    // the first row, and the fifth row does not match them. So the message a person gets is about
    // a column, and the thing that is wrong is a dependency.
    //
    // Physically the edge was wrong too: you electroporate a verified miniprep, not a colony off
    // the cloning plate, and which miniprep is exactly what the analysis session decides.
    //
    // Three more things rode on the same missing derivation, none of them visible on the page that
    // was wrong: no `afterVerified`, so the electroporation sheet never asked which clone; a label
    // hold landing on `pS_verdict` instead of on the construct; and — the one that reached paper —
    // `tubes` never derived either, so tlib3's sequence-analysis sheet carried ONE verdict box for
    // thirty clones. `design/analysis.js` has said *"one row per clone"* since it was written; it
    // was only ever true of the injected chain.
  },
  {
    id: 'culture-in-tubes',
    what: 'cultures grown in tubes and then read in a plate reader',
    reaches: 'a declared vessel that is not a block, carried into an assay whose protocol assumes '
           + 'one. The sheet it produces has a heading reading "each well of the tubes block".',
    clones: 2,
    vessel: 'tubes',
    phase2: true,
  },
];

/**
 * One scenario by name, with the defaults filled in, or null where no scenario is called that.
 *
 * @param {string} id
 * @returns {Object|null} the full spec
 */
export function scenario(id) {
  const hit = SCENARIOS.find((s) => s.id === id);
  return hit ? { ...BASE, ...hit } : null;
}

/**
 * Every scenario, with the defaults filled in, in the order they are written.
 *
 * @returns {Array<Object>} the full specs
 */
export function everyScenario() {
  return SCENARIOS.map((s) => ({ ...BASE, ...s }));
}
