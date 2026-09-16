// faults.js — the ways to get it wrong, and what the toolkit says about each.
//
// JCA, 2026-09-16, on wanting something he can check with his eyes rather than another audit:
//
// > *"you devise a series of examples to run that shows both happy and aberrant path behavior, you
// > run those and make an HTML report that lives on the repo. I read that report, and either tell
// > you about issues, missing edge cases to test, or whatever."*
//
// **`scenarios.js` IS THE HAPPY HALF AND CANNOT BE THE OTHER ONE.** Every scenario there is
// generated from a spec by a pure function, so every file it writes is well-formed by construction
// — twenty-six of twenty-seven compile, and the one that refuses does so about plasticware rather
// than about a file. The aberrant path is a file somebody typed wrong, and there is no spec for
// that. So these are written out by hand, deliberately broken, one per way of being broken.
//
// ## What is actually being tested here, and it is not "does it fail"
//
// The toolkit's whole claim about failure is one sentence, from `CLAUDE.md`: **a refusal is a
// finding, not an exception.** Anything that cannot be decided is reported in a channel a person
// reads, with what would fix it, and never as a stack trace over the top of the sentence that would
// have helped.
//
// So each fault records `says` — a fragment the message must contain — and the report prints the
// WHOLE message beside the broken input. A fault that fails with the wrong words passes a test that
// only asks whether it failed, and the wrong words are the entire defect: `pBET8-A is produced
// twice in one file` names what to change, and `TypeError: Cannot read properties of undefined`
// does not.
//
// ## Why one per problem code
//
// `grep -r "code: '" src/labplanner` gives fifteen. A code with no example is a sentence nobody has
// ever read — which is the same shape as a rule nothing reaches, and this repository has found that
// one four times. `test/labplanner/faults.test.js` asserts every code declared in `src/` appears
// here, so the fifteenth cannot be added without an example of what it looks like to a person.
//
// **`SESSION_OUTGROWS_VESSEL` is deliberately absent**: it is reachable only from a well-formed
// experiment that is too big for its plastic, which is `scenarios § block-too-small`, and moving it
// here would mean writing a broken file to reach a fault that is not about broken files.

/** The construction file most faults start from, so the broken line is the only thing unusual. */
const SOUND = 'PCR\tfwd\trev\tpTPL\tfrag\nTransform\tfrag\tMach1\tKan\t37\tpOK\n';

/**
 * Every way of getting it wrong that the toolkit has a sentence for.
 *
 * Fields:
 *
 *   id       names the folder it is written into
 *   what     one line: what somebody did
 *   code     the problem code this must produce → `grep "code: '" src/labplanner`
 *   says     a fragment the message must contain. The POINT of the fault: a failure with the
 *            wrong words passes any check that only asks whether it failed.
 *   fatal    true where the compile stops; false where it carries on and reports
 *   files    the folder's contents, written exactly as typed
 */
export const FAULTS = [
  {
    id: 'unknown-operation',
    what: 'a verb the grammar does not know',
    code: 'UNKNOWN_OPERATION',
    says: 'Frobnicate',
    fatal: false,
    files: { 'Construction of pOK.txt': 'Frobnicate\tfwd\trev\tpTPL\tfrag\n' + SOUND },
  },
  {
    id: 'no-product',
    what: 'a characterization step that names no product, so nothing later can refer to it',
    code: 'NO_PRODUCT',
    says: 'product',
    fatal: false,
    // **A CONSTRUCTION FILE CANNOT REACH THIS ONE**, and the first draft of this fault tried to:
    // `PCR fwd` fails to PARSE before anything counts its positionals, so it reported
    // PARSE_FAILED. `NO_PRODUCT` belongs to `validate/characterizationFile.js`, whose grammar is
    // looser — a line there is a subject and a product and any number of `key=value` between.
    files: {
      'Construction of pOK.txt': SOUND,
      'Characterization of pOK.txt': 'Pick\tpOK\n',
    },
  },
  {
    id: 'duplicate-product',
    what: 'two steps that both claim to make the same thing',
    code: 'DUPLICATE_PRODUCT',
    says: 'twice',
    fatal: true,
    files: { 'Construction of pOK.txt':
      'PCR\tfwd\trev\tpTPL\tfrag\nPCR\tfwd2\trev2\tpTPL\tfrag\n'
      + 'Transform\tfrag\tMach1\tKan\t37\tpOK\n' },
  },
  {
    id: 'use-before-produced',
    what: 'a step consuming something a LATER line makes',
    code: 'USE_BEFORE_PRODUCED',
    says: 'before',
    fatal: false,
    // **NOTHING REPORTS THIS, AND THE EXAMPLE STAYS SO THAT SOMEBODY SEES IT.** The code is
    // emitted at `validate/constructionFile.js` when a product's line number is greater than its
    // consumer's, and this file is exactly that — a Golden Gate on line 1 consuming a fragment
    // line 2 makes. `c6-check` reports nothing. Either the check does not reach this shape or the
    // code is dead; I could not settle which in the time I had, and a fault quietly dropped
    // because it did not fire is how a dead check stays green. → REPORT.html
    unreached: true,
    files: { 'Construction of pOK.txt':
      'GoldenGate\tfrag\tbb\tBsaI\tgg\nPCR\tfwd\trev\tpTPL\tfrag\n'
      + 'PCR\tfwd2\trev2\tpTPL2\tbb\nTransform\tgg\tMach1\tKan\t37\tpOK\n' },
  },
  {
    id: 'cycle',
    what: 'two steps that each wait for the other',
    code: 'CYCLE',
    says: 'CYCLE',
    fatal: false,
    files: { 'Construction of pOK.txt':
      'PCR\tfwd\trev\tb\ta\nPCR\tfwd\trev\ta\tb\n'
      + 'Transform\ta\tMach1\tKan\t37\tpOK\n' },
  },
  {
    id: 'dangling-product',
    what: 'a product nothing downstream ever uses',
    code: 'DANGLING_PRODUCT',
    says: 'consume',
    fatal: false,
    files: { 'Construction of pOK.txt':
      'PCR\tfwd\trev\tpTPL\torphan\n' + SOUND },
  },
  {
    id: 'duplicate-input',
    what: 'one step naming the same input twice',
    code: 'DUPLICATE_INPUT',
    says: 'twice',
    fatal: false,
    files: { 'Construction of pOK.txt':
      'GoldenGate\tfrag\tfrag\tBsaI\tgg\nPCR\tfwd\trev\tpTPL\tfrag\n'
      + 'Transform\tgg\tMach1\tKan\t37\tpOK\n' },
  },
  {
    id: 'legacy-format',
    what: 'the older parenthetical dialect, which this toolkit does not read',
    code: 'LEGACY_FORMAT',
    says: 'legacy',
    fatal: false,
    // THE STYLE THAT ACTUALLY TRIPS IT, checked rather than guessed. The first draft wrote
    // `pcr(fwd, rev, pTPL) -> frag`, which is a parenthetical CALL and reads as two unknown
    // operations; the legacy dialect this toolkit declines to check is
    // `pcr A, B on TEMPLATE   (1234 bp, product)`. A fault that fires the wrong code teaches the
    // reader the wrong thing about what the toolkit recognises.
    files: { 'Construction of pOK.txt':
      'pcr goF1, goR1 on pSRC1   (1374 bp, frag1)\n'
      + 'transform frag1 (Mach1, Kan)   (pOK)\n' },
  },
  {
    id: 'long-name',
    what: 'a construct named at more than a tube cap holds',
    code: 'LONG_NAME',
    says: 'character',
    fatal: false,
    files: { 'Construction of pVeryLongConstructName.txt':
      'PCR\tfwd\trev\tpTPL\tfrag\n'
      + 'Transform\tfrag\tMach1\tKan\t37\tpVeryLongConstructName\n' },
  },
  {
    id: 'cannot-expand',
    what: 'a miniprep over a picked block with no `clone=` to rename the clones to',
    code: 'CANNOT_EXPAND',
    says: 'clone=',
    fatal: false,
    files: {
      'Construction of pOK.txt': SOUND,
      'Characterization of pOK.txt':
        'Pick\tpOK\tn=4 clone=Mach1/pOK\tpOK_clones\n'
        + 'Miniprep\tpOK_clones\tbox=B1\tpOK_dna\n',
    },
  },
  {
    id: 'analysis-verifies-what',
    what: 'an Analysis whose reads trace back to nothing a construction file built',
    code: 'ANALYSIS_VERIFIES_WHAT',
    says: 'verifies=',
    fatal: false,
    files: {
      'Construction of pOK.txt': SOUND,
      'Characterization of pOK.txt':
        'Analysis\tsome_reads_from_elsewhere\texpects=junctions\tpOK_verdict\n',
    },
  },
  {
    id: 'ambiguous-across-files',
    what: 'two construction files making one name, and a third consuming it',
    code: 'AMBIGUOUS_ACROSS_FILES',
    says: 'gg',
    fatal: false,
    files: {
      'Construction of pA.txt':
        'PCR\tfwd\trev\tpTPL\tgg\nTransform\tgg\tMach1\tKan\t37\tpA\n',
      'Construction of pB.txt':
        'PCR\tfwd2\trev2\tpTPL2\tgg\nTransform\tgg\tMach1\tKan\t37\tpB\n',
      // THE CONSUMER MUST BE A THIRD FILE. `cfToJobs` looks for consumers whose own `cf` is not
      // among the producers, so a characterization file of pA consuming `gg` does not count — pA
      // is one of the two files that make it.
      'Construction of pC.txt': 'Transform\tgg\tMach1\tKan\t37\tpC\n',
    },
  },
  {
    id: 'inventory-unreadable',
    what: 'an inventory file nothing can parse',
    code: 'INVENTORY_UNREADABLE',
    says: 'inventory',
    fatal: false,
    // **NOTHING REPORTS THIS EITHER.** The code fires from `planExperiment` when dilution planning
    // returns an error, and a file of prose apparently parses to an empty freezer instead — which
    // is the "absence is not zero" failure one level down: an unreadable inventory and an empty
    // one are not the same thing and here they render the same.
    unreached: true,
    files: {
      'Construction of pOK.txt': SOUND,
      'inventory.txt': 'this is not a freezer, it is a sentence\nnor is this\n',
    },
  },
  {
    id: 'no-construction-file',
    what: 'a folder with a characterization file and nothing that builds anything',
    code: null,
    says: 'onstruction',
    fatal: true,
    files: { 'Characterization of pOK.txt': 'Pick\tpOK\tn=4 clone=Mach1/pOK\tpOK_clones\n' },
  },
  {
    id: 'empty-construction-file',
    what: 'a construction file with nothing in it but a comment',
    code: null,
    says: '',
    fatal: false,
    files: { 'Construction of pOK.txt': '# I will write this tomorrow\n' },
  },
];

/**
 * One fault by name, or null where none is called that.
 *
 * @param {string} id
 * @returns {Object|null}
 */
export function fault(id) {
  return FAULTS.find((f) => f.id === id) || null;
}
