// Which polymerase, and which thermocycler program.
//
// Each rule below is a comment block saying what it does, and the functions that do it. The words
// are comments; the logic is code. Rules are tried in the order they appear and the first that
// applies wins, so that order is part of the logic.
//
//     when      what has to be true for this rule to fire
//     then      what it decides
//     why       the reason it is this way and not another. The field to check: if the reason is
//               wrong, the rule is wrong however well the code matches it
//     eg        product lengths to work through. They are RUN, not written — `c6-rules` puts each
//               through the rules and prints the real outcome
//
//     applies   the condition, in code. This is what runs
//     decide    what it produces: a chemistry, a program. Data, no prose
//     says      the sentence the labsheet prints when this rule fires
//
// `c6-rules pcr` prints this file as a table. Who settled what, and when, is in
// `docs/DECISIONS.md § PCR program and polymerase`.
import { apply, named } from './lib.js';

export const TITLE = 'Which polymerase, and which thermocycler program';

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
const BIGGEST_STEP = EXTENSION_STEPS[EXTENSION_STEPS.length - 1];

export const isDegenerate = (seq) =>
  String(seq || '').length > 0 && /[^ACGTacgt]/.test(String(seq).replace(/\s/g, ''));

export const primestarProgram = (bp, anneal) => {
  const kb = Math.ceil(bp / 1000);
  const step = EXTENSION_STEPS.find((s) => kb <= s);
  return step ? `PG${step}K${anneal}` : LONG_PROGRAM;
};


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════
// Read off the reaction. They decide nothing, and every rule sees all of them.

// name:  degenerate
// when:  any oligo has a base outside ACGT — N, R, Y, S, W and the rest
// then:  true, false, or null where we do not hold every oligo's sequence
// why:   A degenerate oligo is a mixture: at each ambiguous position the pool contains every base
//        the code allows. Most members therefore mismatch the template somewhere, and the duplex
//        is weaker than the sequence alone suggests.
//
//        Whether the oligos are degenerate is knowable only if we hold all of their sequences.
//        Reading an empty list as "not degenerate" would anneal a library at 55 °C, which is the
//        failure this exists to prevent, arriving silently. Absence of evidence is its own state.
export const degenerate = {
  of: ({ known, anyDegenerate }) => (known ? anyDegenerate === true : null),
};

// name:  anneal
// when:  always — it is the annealing temperature every program is named for
// then:  45 °C for a degenerate pool, otherwise 55 °C
// why:   A degenerate pool anneals at 45 °C rather than the standard 55 °C, because its weaker
//        duplexes will not hold at the higher temperature and the reaction simply fails.
//
//        Where degeneracy could not be checked the standard 55 °C is used. A missing oligo
//        sequence is not a reason to refuse a program — only a missing product size is — but the
//        sheet says which temperature was assumed rather than chosen.
export const anneal = {
  of: ({ degenerate: d }) => (d === true ? DEGENERATE_ANNEAL : DEFAULT_ANNEAL),
  says: ({ degenerate: d }) =>
    d === true ? `Degenerate oligo(s), so a ${DEGENERATE_ANNEAL} °C anneal.`
    : d === null ? `Assumed a ${DEFAULT_ANNEAL} °C anneal — not every oligo's sequence was `
                 + `available, so degeneracy could not be checked.`
    : null,
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════
// Tried in order. The first that applies wins.

// name:  no product size
// when:  the construction file would not simulate, so there is no length
// then:  no program and no chemistry; the sheet carries the question
// why:   The extension time is computed from the product length, so without a length there is no
//        program to name. A plausible default that is wrong by 3 kb truncates the product and
//        fails quietly; a blank on the sheet does not.
// eg:    null
export const noProductSize = {
  applies: ({ bp }) => bp == null,
  decide: () => ({ program: null, chemistry: null }),
  says: ({ sizeNote }) =>
    `no product size (${sizeNote || 'not simulated'}) — the extension time cannot be computed. `
    + `Decide this by hand.`,
};

// name:  short product
// when:  the product is under 250 bp
// then:  Taq rather than PrimeSTAR, and the program is the annealing temperature alone
// why:   Under about 250 bp a proofreading polymerase gives no advantage worth its cost, and Taq
//        is the better reaction.
//
//        This is a change of chemistry, not only of program: Taq takes a different enzyme and a
//        different buffer, though the same dNTPs. A labsheet that switched the program while
//        leaving the PrimeSTAR reaction written underneath would be wrong in a way that reads as
//        right, which is why the two move together.
// eg:    249, 250
export const shortProduct = {
  applies: ({ bp }) => bp != null && bp < SHORT_BP,
  decide: ({ anneal: a }) => ({ chemistry: 'taq', program: String(a) }),
  says: ({ bp }) =>
    `${bp} bp is under ${SHORT_BP} — Taq rather than PrimeSTAR. Different enzyme and buffer, `
    + `same dNTPs.`,
};

// name:  long product
// when:  the product is over 8 kb
// then:  PrimeSTAR on PGXL4
// why:   Past 8 kb the machine carries one long program rather than a numbered one, so a 14 kb
//        product does not run on PG15K55. There is no such program, and a name that does not exist
//        is not a small error: somebody stands at the thermocycler and picks something.
//
//        PGXL4 also carries no annealing temperature in its name, so where a degenerate pool needs
//        45 °C that has to be set by hand and the sheet has to say so.
// eg:    8000, 8001, 14000
export const longProduct = {
  applies: ({ bp }) => bp != null && bp >= SHORT_BP && Math.ceil(bp / 1000) > BIGGEST_STEP,
  decide: ({ bp }) => ({ chemistry: 'primestar', program: LONG_PROGRAM,
                         extensionKb: Math.ceil(bp / 1000) }),
  says: ({ anneal: a }) =>
    `over 8 kb, so ${LONG_PROGRAM}` + (a === DEGENERATE_ANNEAL
      ? ` — which has no annealing temperature in its name; set 45 on the machine.` : `.`),
};

// name:  ordinary product
// when:  250 bp to 8 kb
// then:  PrimeSTAR on PG<step>K<anneal>, where <step> is the next extension length up
// why:   The program name states the extension length in kb and the annealing temperature: divide
//        the product by 1000 and round up to get the kb figure.
//
//        The machine only carries 2, 4, 6, 8 kb programs, so the figure rounds up again to the
//        next one that exists — a 3 kb product runs on PG4K, not on a PG3K that was never loaded.
// eg:    250, 3000, 8000
export const ordinaryProduct = {
  applies: ({ bp }) => bp != null && bp >= SHORT_BP,
  decide: ({ bp, anneal: a }) => ({ chemistry: 'primestar', program: primestarProgram(bp, a),
                                    extensionKb: Math.ceil(bp / 1000) }),
};


// ── the order, which is part of the logic ───────────────────────────────────────────────────────
// `longProduct` sits above `ordinaryProduct` because both are true over 8 kb. Each is named by the
// key it is listed under, so the name is written once.

export const FACTS = named({ degenerate, anneal });

export const RULES = named({ noProductSize, shortProduct, longProduct, ordinaryProduct });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES }, { known: true, ...facts });
