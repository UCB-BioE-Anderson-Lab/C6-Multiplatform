// choosePCRProgram.js — which thermocycler program, and which polymerase.
//
// JCA, 2026-09-10:
//
// > *"simulate the cf, look at the pcr product, get its size. Divide by 1000 and round up. That
// > number is x. Insert that number into 'PGxK55' is typically what you want, where 55 is the
// > annealing temperature. When doing degenerate oligos (not all bases in the oligos are in
// > [ATCG]), I will typically use a 45 degree anneal instead, so PGxK45. For really short
// > sequences, like <250 bp, I would recommend a Taq reaction instead of primestar. PG is
// > primestar. program '45' and '55' are the taq ones. The recipe is different for taq too --
// > different enzyme and buffer, same dntps."*
//
// All of it is exact. None of it is judgement — which is why it is here and not in
// `operations/pcr.md`.
export const SHORT_BP = 250;          // below this, Taq rather than PrimeSTAR
export const DEFAULT_ANNEAL = 55;
export const DEGENERATE_ANNEAL = 45;

// THE PROGRAMS THAT EXIST, from the PrimeStar GXL decision chart in cloning-tutorials
// (docs/planning/inventory_labsheets.md). Extension length comes in steps of 2 kb, and past
// 8 kb there is a single long program rather than a numbered one.
//
//     PG2K   up to 2 kb      PG6K   4-6 kb       PGXL4   over 8 kb
//     PG4K   2-4 kb          PG8K   6-8 kb
//
// "DIVIDE BY 1000 AND ROUND UP" IS RIGHT AND IS NOT THE WHOLE RULE. JCA's instruction gives the
// kb figure; the chart says which programs are actually loaded on the machine. A 3 kb product
// rounds to 3, and there is no PG3K55 — it runs on PG4K55. A 14 kb product does not run on
// PG15K55; it runs on PGXL4. The first version emitted both of those, and a program name that
// does not exist is not a small error: somebody stands at the thermocycler and picks something.
export const EXTENSION_STEPS = [2, 4, 6, 8];
export const LONG_PROGRAM = 'PGXL4';

/** The PrimeSTAR program for a product of this length, at this annealing temperature. */
export function primestarProgram(bp, anneal) {
  const kb = Math.ceil(bp / 1000);
  const step = EXTENSION_STEPS.find((s) => kb <= s);
  return step ? `PG${step}K${anneal}` : LONG_PROGRAM;
}

/** A degenerate oligo is one with any base outside ACGT — N, R, Y, S, W and the rest. */
export function isDegenerate(seq) {
  return /[^ACGTacgt]/.test(String(seq || '').replace(/\s/g, '')) && String(seq || '').length > 0;
}

/**
 * Choose the thermocycler program and the polymerase for each PCR, from the product size and
 * whether the oligos are degenerate. A job whose size is unknown gets no program rather than a
 * plausible default.
 *
 * @param {Array} jobs
 * @param {Object} cfg  { sequences: {oligos} } so degeneracy can be read off the actual oligos
 */
export function annotatePCRPrograms(jobs, cfg = {}) {
  const oligos = (cfg.sequences && cfg.sequences.oligos) || {};
  for (const job of jobs || []) {
    if (job.operation !== 'pcr') continue;

    const seqs = (job.oligos || []).map((n) => oligos[n]).filter(Boolean);
    // AN OLIGO WHOSE SEQUENCE WE DO NOT HAVE IS NOT A NON-DEGENERATE ONE. Deciding "not
    // degenerate" from an empty list anneals a library at 55 °C, which is the failure this
    // whole annotation exists to avoid, arriving silently.
    const known = seqs.length === (job.oligos || []).length && seqs.length > 0;
    const degenerate = known ? seqs.some(isDegenerate) : null;

    const bp = job.productBp;
    if (bp == null) {
      // No length, no program. `operations/pcr.md` says why a plausible default is worse than a
      // blank: the extension time IS the number, and one that is wrong by 3 kb fails quietly.
      job.program = null;
      job.programNote = `no product size (${job.sizeNote || 'not simulated'}) — `
                      + 'the extension time cannot be computed. Decide this by hand.';
      continue;
    }

    const anneal = degenerate === true ? DEGENERATE_ANNEAL : DEFAULT_ANNEAL;
    if (bp < SHORT_BP) {
      // "the recipe is different for taq too" — so this is a chemistry change, not a program
      // change, and a labsheet that swaps the program while keeping the PrimeSTAR reaction is
      // wrong in a way that reads as right.
      job.chemistry = 'taq';
      job.program = String(anneal);
      job.programNote = `${bp} bp is under ${SHORT_BP} — Taq rather than PrimeSTAR. `
                      + 'Different enzyme and buffer, same dNTPs.';
    } else {
      job.chemistry = 'primestar';
      job.extensionKb = Math.ceil(bp / 1000);
      job.program = primestarProgram(bp, anneal);
      if (job.program === LONG_PROGRAM) {
        // PGXL4 carries no annealing temperature in its name, so a degenerate oligo over 8 kb
        // needs saying rather than silently losing its 45.
        job.programNote = `over 8 kb, so ${LONG_PROGRAM}` + (anneal === DEGENERATE_ANNEAL
          ? ' — which has no annealing temperature in its name; set 45 on the machine.' : '.');
      }
    }
    if (degenerate === true) {
      job.programNote = `${job.programNote ? job.programNote + ' ' : ''}`
                      + `Degenerate oligo(s), so a ${DEGENERATE_ANNEAL} °C anneal.`;
    } else if (degenerate === null) {
      job.programNote = `${job.programNote ? job.programNote + ' ' : ''}`
                      + `Assumed a ${DEFAULT_ANNEAL} °C anneal — not every oligo's sequence was `
                      + 'available, so degeneracy could not be checked.';
    }
  }
  return jobs;
}
