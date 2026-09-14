// Which polymerase, and which thermocycler program.
//
// ── how to read a rule ──────────────────────────────────────────────────────────────────────────
//
//   name      what to call it. Appears in the printed table and in test failures.
//
//   when      the condition, in words. What has to be true for this rule to be the one that fires.
//   then      the outcome, in words. What it decides.
//   why       the reason it is this way and not another way. This is the field a reviewer checks:
//             if the reason is wrong, the rule is wrong however well the code matches it.
//
//   applies   the same condition, in code. This is what actually runs.
//   decide    the same outcome, in code. Returns data — a chemistry, a program — and no prose.
//   says      the sentence the labsheet prints when this rule fires. Optional.
//
//   eg        worked examples. They are RUN, not written: `c6-rules` puts each through the rules
//             and prints the real outcome, so the table shows where a boundary actually falls
//             rather than where the words claim it does.
//
// Rules are tried in order and the first that applies wins, so the order below is part of the
// logic. Facts come first: they are read off the reaction, they decide nothing, and every rule
// sees all of them.
//
// `c6-rules pcr` prints this file as a table. Provenance — who settled what, and when — is in
// `docs/DECISIONS.md § PCR program and polymerase`.
import { text, apply } from './lib.js';

export const TITLE = 'Which polymerase, and which thermocycler program';


// ── the numbers ─────────────────────────────────────────────────────────────────────────────────

export const SHORT_BP = 250;              // under this, Taq rather than PrimeSTAR
export const DEFAULT_ANNEAL = 55;
export const DEGENERATE_ANNEAL = 45;

// The programs loaded on the machine. Extension length comes in steps of 2 kb; past 8 kb there is
// one long program rather than a numbered one.
//
//     PG2K   up to 2 kb        PG6K   4-6 kb          PGXL4   over 8 kb
//     PG4K   2-4 kb            PG8K   6-8 kb
//
export const EXTENSION_STEPS = [2, 4, 6, 8];
export const LONG_PROGRAM = 'PGXL4';

export const isDegenerate = (seq) =>
  String(seq || '').length > 0 && /[^ACGTacgt]/.test(String(seq).replace(/\s/g, ''));

export const primestarProgram = (bp, anneal) => {
  const kb = Math.ceil(bp / 1000);
  const step = EXTENSION_STEPS.find((s) => kb <= s);
  return step ? `PG${step}K${anneal}` : LONG_PROGRAM;
};


// ── the facts ───────────────────────────────────────────────────────────────────────────────────

export const FACTS = [
  {
    name: 'degenerate',
    is: 'whether any oligo has a base outside ACGT — N, R, Y, S, W and the rest',
    unknown: `null when we do not hold every oligo's sequence, which is not the same as false`,

    why: text`
      A degenerate oligo is a mixture: at each ambiguous position the pool contains every base the
      code allows. Most members therefore mismatch the template somewhere, and the duplex is weaker
      than the sequence alone suggests.

      Whether the oligos are degenerate is knowable only if we hold all of their sequences. Reading
      an empty list as "not degenerate" would anneal a library at 55 °C, which is the failure this
      annotation exists to prevent, arriving silently. So absence of evidence is its own state.
    `,

    of: ({ known, anyDegenerate }) => (known ? anyDegenerate === true : null),
  },

  {
    name: 'anneal',
    is: 'the annealing temperature',

    why: text`
      A degenerate pool anneals at 45 °C rather than the standard 55 °C, because its weaker duplexes
      will not hold at the higher temperature and the reaction simply fails.

      Where degeneracy could not be checked the standard 55 °C is used. A missing oligo sequence is
      not a reason to refuse a program — only a missing product size is — but the sheet says which
      temperature was assumed rather than chosen.
    `,

    of: ({ degenerate }) => (degenerate === true ? DEGENERATE_ANNEAL : DEFAULT_ANNEAL),

    says: ({ degenerate }) =>
      degenerate === true ? `Degenerate oligo(s), so a ${DEGENERATE_ANNEAL} °C anneal.`
      : degenerate === null ? `Assumed a ${DEFAULT_ANNEAL} °C anneal — not every oligo's sequence `
                            + `was available, so degeneracy could not be checked.`
      : null,
  },
];


// ── the rules ───────────────────────────────────────────────────────────────────────────────────

export const RULES = [
  {
    name: 'no product size',
    when: `the construction file would not simulate, so there is no length`,
    then: `no program and no chemistry; the sheet carries the question`,

    why: text`
      The extension time is computed from the product length, so without a length there is no
      program to name. A plausible default that is wrong by 3 kb truncates the product and fails
      quietly; a blank on the sheet does not.
    `,

    applies: ({ bp }) => bp == null,
    decide: () => ({ program: null, chemistry: null }),
    says: ({ sizeNote }) =>
      `no product size (${sizeNote || 'not simulated'}) — the extension time cannot be computed. `
      + `Decide this by hand.`,

    eg: [{ bp: null }],
  },

  {
    name: 'short product',
    when: `the product is under ${SHORT_BP} bp`,
    then: `Taq, and the program is the annealing temperature alone`,

    why: text`
      Under about 250 bp a proofreading polymerase gives no advantage worth its cost, and Taq is
      the better reaction.

      This is a change of CHEMISTRY, not only of program: Taq takes a different enzyme and a
      different buffer, though the same dNTPs. A labsheet that switched the program while leaving
      the PrimeSTAR reaction written underneath would be wrong in a way that reads as right, which
      is why the two move together.
    `,

    applies: ({ bp }) => bp != null && bp < SHORT_BP,
    decide: ({ anneal }) => ({ chemistry: 'taq', program: String(anneal) }),
    says: ({ bp }) =>
      `${bp} bp is under ${SHORT_BP} — Taq rather than PrimeSTAR. Different enzyme and buffer, `
      + `same dNTPs.`,

    eg: [{ bp: 249 }, { bp: 250 }],
  },

  {
    name: 'long product',
    when: `the product is over ${EXTENSION_STEPS[EXTENSION_STEPS.length - 1]} kb`,
    then: `PrimeSTAR on ${LONG_PROGRAM}`,

    why: text`
      Past 8 kb the machine carries one long program rather than a numbered one, so a 14 kb product
      does not run on PG15K55. There is no such program, and a name that does not exist is not a
      small error: somebody stands at the thermocycler and picks something.

      ${LONG_PROGRAM} also carries no annealing temperature in its name, so where a degenerate pool
      needs 45 °C that has to be set by hand and the sheet has to say so.
    `,

    applies: ({ bp }) => bp != null && bp >= SHORT_BP
                      && Math.ceil(bp / 1000) > EXTENSION_STEPS[EXTENSION_STEPS.length - 1],
    decide: ({ bp }) => ({ chemistry: 'primestar', program: LONG_PROGRAM,
                           extensionKb: Math.ceil(bp / 1000) }),
    says: ({ anneal }) =>
      `over 8 kb, so ${LONG_PROGRAM}` + (anneal === DEGENERATE_ANNEAL
        ? ` — which has no annealing temperature in its name; set 45 on the machine.` : `.`),

    eg: [{ bp: 8000 }, { bp: 8001 }, { bp: 14000 }],
  },

  {
    name: 'ordinary product',
    when: `${SHORT_BP} bp to ${EXTENSION_STEPS[EXTENSION_STEPS.length - 1]} kb`,
    then: `PrimeSTAR on PG<step>K<anneal>, where <step> is the next extension length up`,

    why: text`
      The program name states the extension length in kb and the annealing temperature: divide the
      product by 1000 and round up to get the kb figure.

      The machine only carries ${EXTENSION_STEPS.join(', ')} kb programs, so the figure rounds up
      again to the next one that exists — a 3 kb product runs on PG4K, not on a PG3K that was never
      loaded.
    `,

    applies: ({ bp }) => bp != null && bp >= SHORT_BP,
    decide: ({ bp, anneal }) => ({ chemistry: 'primestar', program: primestarProgram(bp, anneal),
                                   extensionKb: Math.ceil(bp / 1000) }),

    eg: [{ bp: 250 }, { bp: 3000 }, { bp: 3000, anyDegenerate: true }],
  },
];


/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES }, { known: true, ...facts });
