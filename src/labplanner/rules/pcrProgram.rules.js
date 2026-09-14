// pcrProgram.rules.js — WHICH POLYMERASE AND WHICH PROGRAM, as a list of rules.
//
// **WHY THIS FILE EXISTS.** JCA, 2026-09-13:
//
// > *"we are in the details of the domain logic, and the only way to really know for sure we got
// > it is for me to look at many examples. Alternatively, I try and understand your code and read
// > it. But you've got a lot of syntax mixed in with the domain logic, that will make it hard to
// > follow."*
//
// He is right, and reformatting would not have fixed it. `choosePCRProgram.js` was already 46
// comment lines out of 106 — the reasoning was all there, interleaved with `job.program = …`,
// `continue`, and null-guards, so reading out "what are the rules" meant filtering every third
// line. The rules were never hard; finding them was.
//
// So each rule is one object: **when it applies, what it decides, and why.** The function that
// applies them does nothing else, and `bin/c6-rules` prints the table. Checking the toolkit
// against what you know becomes reading six rows instead of fifty-three lines.
//
// **THE `why` IS NOT A COMMENT.** It is a field, it reaches the printed table, and where a rule
// exists because of something JCA said, it quotes him. A rule whose reason cannot be stated in a
// sentence is one nobody has finished thinking about.
export const TITLE = 'Which polymerase, and which thermocycler program';

// **THE NUMBERS LIVE WITH THE RULES THAT USE THEM**, so a threshold cannot be changed without
// walking past the sentence saying why it is that number. `planning/choosePCRProgram.js`
// re-exports them, because that is the name every existing caller and test already imports.
export const SHORT_BP = 250;          // below this, Taq rather than PrimeSTAR
export const DEFAULT_ANNEAL = 55;
export const DEGENERATE_ANNEAL = 45;

// THE PROGRAMS THAT EXIST, from the PrimeStar GXL decision chart in cloning-tutorials
// (docs/planning/inventory_labsheets.md). Extension length comes in steps of 2 kb, and past 8 kb
// there is a single long program rather than a numbered one.
//
//     PG2K   up to 2 kb      PG6K   4-6 kb       PGXL4   over 8 kb
//     PG4K   2-4 kb          PG8K   6-8 kb
export const EXTENSION_STEPS = [2, 4, 6, 8];
export const LONG_PROGRAM = 'PGXL4';

/** A degenerate oligo is one with any base outside ACGT — N, R, Y, S, W and the rest. */
export function isDegenerate(seq) {
  return /[^ACGTacgt]/.test(String(seq || '').replace(/\s/g, '')) && String(seq || '').length > 0;
}

/** The PrimeSTAR program for a product of this length, at this annealing temperature. */
export function primestarProgram(bp, anneal) {
  const kb = Math.ceil(bp / 1000);
  const step = EXTENSION_STEPS.find((s) => kb <= s);
  return step ? `PG${step}K${anneal}` : LONG_PROGRAM;
}

// ---- FACTS: read off the job, decide nothing ---------------------------------------------------
//
// **A DERIVED FACT IS NOT A RULE, AND WRITING THIS TABLE IS WHAT MADE THE DIFFERENCE VISIBLE.**
// The first draft of this file made "we do not hold every oligo's sequence" a RULE that stopped
// the chain — so a 3.7 kb product with unknown oligos got no program at all, where the live code
// gives it PG4K55. Both readings are defensible and only one is what the toolkit does; in an
// `if/else` chain the distinction was invisible, because `known` was just a local that fed the
// next line down.
//
// Facts are computed first, every rule sees all of them, and no fact stops anything.
export const FACTS = [
  {
    name: 'degenerate',
    is: 'whether any oligo has a base outside ACGT — N, R, Y, S, W and the rest',
    unknown: 'null when we do not hold every oligo\'s sequence, which is NOT the same as false',
    why: 'Deciding "not degenerate" from an empty list anneals a library at 55 °C, which is the '
       + 'failure this whole annotation exists to avoid, arriving silently.',
    of: ({ known, anyDegenerate }) => (known ? anyDegenerate === true : null),
  },
  {
    name: 'anneal',
    is: 'the annealing temperature',
    unknown: null,
    why: 'JCA: *"When doing degenerate oligos (not all bases in the oligos are in [ATCG]), I will '
       + 'typically use a 45 degree anneal instead, so PGxK45."* Unknown degeneracy takes the '
       + 'default — the toolkit does NOT refuse a program for it, it refuses only for a missing size.',
    of: ({ degenerate }) => (degenerate === true ? DEGENERATE_ANNEAL : DEFAULT_ANNEAL),
    // **A FACT MAY HAVE TO SAY SOMETHING, AND IT IS NOT THE RULE'S SENTENCE.** Whether the anneal
    // was CHOSEN or ASSUMED is a fact about the oligos, and it is appended to whatever the
    // matching rule said rather than replacing it. The first draft of this file lost this
    // entirely — it lived below the if/else chain in the old code, where it read as an
    // afterthought rather than as the other half of the degeneracy fact.
    says: ({ degenerate }) => (
      degenerate === true ? `Degenerate oligo(s), so a ${DEGENERATE_ANNEAL} °C anneal.`
      : degenerate === null ? `Assumed a ${DEFAULT_ANNEAL} °C anneal — not every oligo's sequence `
                            + 'was available, so degeneracy could not be checked.'
      : null),
  },
];

export const RULES = [
  {
    name: 'no product size',
    when: 'the construction file would not simulate, so there is no length',
    then: 'no program and no chemistry; the sheet carries the question',
    why: 'The extension time IS the number. A plausible default that is wrong by 3 kb fails '
       + 'quietly, and a blank does not.',
    // **THE EXAMPLES ARE RUN, NOT WRITTEN.** `when` is prose beside the predicate, and prose can
    // drift from it — change `<` to `<=` and the sentence still reads "under 250 bp". These are
    // put through `choose()` by `c6-rules` and by the suite, so the printed table shows what the
    // code ACTUALLY does at each boundary rather than what the sentence claims.
    eg: [{ bp: null, known: true }],
    applies: ({ bp }) => bp == null,
    decide: ({ sizeNote }) => ({
      program: null, chemistry: null,
      note: `no product size (${sizeNote || 'not simulated'}) — the extension time cannot be `
          + 'computed. Decide this by hand.',
    }),
  },
  {
    name: 'short product',
    when: `the product is under ${SHORT_BP} bp`,
    then: 'Taq, and the program is the annealing temperature alone',
    why: 'JCA: *"For really short sequences, like <250 bp, I would recommend a Taq reaction '
       + 'instead of primestar… The recipe is different for taq too — different enzyme and '
       + 'buffer, same dntps."* So it is a CHEMISTRY change, not a program change: a labsheet '
       + 'that swaps the program while keeping the PrimeSTAR reaction is wrong in a way that '
       + 'reads as right.',
    eg: [{ bp: 249, known: true }, { bp: 250, known: true }],
    applies: ({ bp }) => bp != null && bp < SHORT_BP,
    decide: ({ bp, anneal }) => ({
      chemistry: 'taq', program: String(anneal),
      note: `${bp} bp is under ${SHORT_BP} — Taq rather than PrimeSTAR. Different enzyme and `
          + 'buffer, same dNTPs.',
    }),
  },
  {
    name: 'long product',
    when: `the product is over ${EXTENSION_STEPS[EXTENSION_STEPS.length - 1]} kb`,
    then: `PrimeSTAR on ${LONG_PROGRAM}`,
    why: `${LONG_PROGRAM} carries no annealing temperature in its name, so a degenerate oligo `
       + 'over 8 kb needs saying rather than silently losing its 45. And a 14 kb product does NOT '
       + 'run on PG15K55 — there is no such program, and a name that does not exist is not a '
       + 'small error: somebody stands at the thermocycler and picks something.',
    eg: [{ bp: 8000, known: true }, { bp: 8001, known: true }, { bp: 14000, known: true }],
    applies: ({ bp }) => bp != null && bp >= SHORT_BP
                      && Math.ceil(bp / 1000) > EXTENSION_STEPS[EXTENSION_STEPS.length - 1],
    decide: ({ bp, anneal }) => ({
      chemistry: 'primestar', program: LONG_PROGRAM, extensionKb: Math.ceil(bp / 1000),
      note: `over 8 kb, so ${LONG_PROGRAM}` + (anneal === DEGENERATE_ANNEAL
        ? ' — which has no annealing temperature in its name; set 45 on the machine.' : '.'),
    }),
  },
  {
    name: 'ordinary product',
    when: `${SHORT_BP} bp to 8 kb`,
    then: 'PrimeSTAR on PG<step>K<anneal>, where <step> is the next loaded extension length',
    why: 'JCA: *"Divide by 1000 and round up. That number is x. Insert that number into PGxK55."* '
       + `That gives the kb figure; the machine only carries ${EXTENSION_STEPS.join(', ')} kb `
       + 'programs, so a 3 kb product runs on PG4K, not on a PG3K that does not exist.',
    eg: [{ bp: 250, known: true }, { bp: 3000, known: true },
         { bp: 3000, known: true, anyDegenerate: true }],
    applies: ({ bp }) => bp != null && bp >= SHORT_BP,
    decide: ({ bp, anneal }) => {
      const kb = Math.ceil(bp / 1000);
      const step = EXTENSION_STEPS.find((s) => kb <= s);
      return { chemistry: 'primestar', program: `PG${step}K${anneal}`, extensionKb: kb };
    },
  },
];

/**
 * The first rule that applies, and what it decided. Nothing else happens here.
 *
 * FIRST MATCH WINS, and the order in `RULES` is therefore part of the domain: `long product` sits
 * above `ordinary product` because both apply over 8 kb. That ordering is visible in the printed
 * table, which is the point — it was previously an `if/else` chain a reader had to unwind.
 */
export function choose(input) {
  const facts = { ...input };
  for (const f of FACTS) facts[f.name] = f.of(facts);
  const rule = RULES.find((r) => r.applies(facts));
  if (!rule) return null;
  const got = { rule: rule.name, ...rule.decide(facts) };
  // A rule that refuses outright — no size — says everything there is to say; appending a remark
  // about the annealing temperature of a reaction that has no program would be noise.
  if (got.program != null) {
    for (const f of FACTS) {
      const said = f.says ? f.says(facts) : null;
      if (said) got.note = got.note ? `${got.note} ${said}` : said;
    }
  }
  return got;
}
