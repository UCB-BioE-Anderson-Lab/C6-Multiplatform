// Which polymerase, and which thermocycler program.
//
// Read this file top to bottom: it is a list of rules, each one a `when`, a `then`, and a `why`,
// with the code that does it underneath. `c6-rules pcr` prints the same thing as a table.
//
// JCA, 2026-09-10, and every rule below is one sentence of it:
//
//     "simulate the cf, look at the pcr product, get its size. Divide by 1000 and round up. That
//      number is x. Insert that number into 'PGxK55' is typically what you want, where 55 is the
//      annealing temperature. When doing degenerate oligos (not all bases in the oligos are in
//      [ATCG]), I will typically use a 45 degree anneal instead, so PGxK45. For really short
//      sequences, like <250 bp, I would recommend a Taq reaction instead of primestar. PG is
//      primestar. program '45' and '55' are the taq ones. The recipe is different for taq too --
//      different enzyme and buffer, same dntps."
//
// All of it is exact. None of it is judgement, which is why it is rules and not a decision.
import { text, apply } from './lib.js';

export const TITLE = 'Which polymerase, and which thermocycler program';


// ── the numbers ─────────────────────────────────────────────────────────────────────────────────
// They live here, beside the rules that use them, so a threshold cannot be changed without walking
// past the sentence saying why it is that number.

export const SHORT_BP = 250;              // under this, Taq rather than PrimeSTAR
export const DEFAULT_ANNEAL = 55;
export const DEGENERATE_ANNEAL = 45;

// The programs that are actually loaded on the machine, from the PrimeSTAR GXL decision chart:
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
// Read off the reaction. They decide nothing; every rule below sees all of them.

export const FACTS = [
  {
    name: 'degenerate',
    is: 'whether any oligo has a base outside ACGT — N, R, Y, S, W and the rest',
    unknown: `null when we do not hold every oligo's sequence, which is NOT the same as false`,

    why: text`
      Deciding "not degenerate" from an empty list anneals a library at 55 °C, which is the failure
      this whole annotation exists to avoid, arriving silently.

      This was a rule in the first draft of this file, which stopped the chain and gave a 3.7 kb
      product no program at all. It is a fact: it changes the annealing temperature and nothing
      else.
    `,

    of: ({ known, anyDegenerate }) => (known ? anyDegenerate === true : null),
  },
  {
    name: 'anneal',
    is: 'the annealing temperature',

    why: text`
      JCA: "When doing degenerate oligos (not all bases in the oligos are in [ATCG]), I will
      typically use a 45 degree anneal instead, so PGxK45."

      Unknown degeneracy takes the default. The toolkit refuses a program only for a missing size,
      never for this — but it says which it did.
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
// Tried in order. The first that applies wins, so the order is part of the domain.

export const RULES = [
  {
    name: 'no product size',
    when: `the construction file would not simulate, so there is no length`,
    then: `no program and no chemistry; the sheet carries the question`,

    why: text`
      The extension time IS the number. A plausible default that is wrong by 3 kb fails quietly,
      and a blank does not.
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
      JCA: "For really short sequences, like <250 bp, I would recommend a Taq reaction instead of
      primestar. The recipe is different for taq too — different enzyme and buffer, same dntps."

      So it is a CHEMISTRY change and not a program change. A labsheet that swaps the program while
      keeping the PrimeSTAR reaction is wrong in a way that reads as right.
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
      A 14 kb product does not run on PG15K55. There is no such program, and a name that does not
      exist is not a small error: somebody stands at the thermocycler and picks something.

      ${LONG_PROGRAM} also carries no annealing temperature in its name, so a degenerate oligo over
      8 kb needs saying rather than silently losing its 45.
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
      JCA: "Divide by 1000 and round up. That number is x. Insert that number into PGxK55."

      That gives the kb figure; the machine only carries ${EXTENSION_STEPS.join(', ')} kb programs,
      so a 3 kb product runs on PG4K, not on a PG3K that does not exist.
    `,

    applies: ({ bp }) => bp != null && bp >= SHORT_BP,
    decide: ({ bp, anneal }) => ({ chemistry: 'primestar', program: primestarProgram(bp, anneal),
                                   extensionKb: Math.ceil(bp / 1000) }),

    eg: [{ bp: 250 }, { bp: 3000 }, { bp: 3000, anyDegenerate: true }],
  },
];


/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES }, { known: true, ...facts });
