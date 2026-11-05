/**
 * The design audit: can it tell a derived oligo from an improvised one, and does it say so in a
 * way a person can act on.
 *
 * **THE TEST THAT MATTERS IS THE IMPROVISED PRIMER.** Everything else here is bookkeeping. If an
 * arbitrary window of the template scores the same as the tool's choice, this audit is theatre,
 * and better to find that out in a test than in a review.
 */
import { describe, it, expect } from 'vitest';
import { auditAnneal, auditScript, ANNEAL_WINDOW } from '../src/design/audit.js';
import { findanneal, scoreanneal } from '../src/C6-Oligos.js';
import { revcomp } from '../src/C6-Seq.js';

// A template with enough variety that the tool's choice and an arbitrary one differ.
const TEMPLATE =
  'ATGAGTAAAGGAGAAGAACTTTTCACTGGAGTTGTCCCAATTCTTGTTGAATTAGATGGTGATGTTAATGGGCACAAATTTTCTGTCAGTGGAGAGGGTGAAGGTGATGCAACATACGGAAAACTTACCCTTAAATTTATTTGCACTACTGGAAAACTACCTGTTCCATGGCCAACACTTGTCACTACTTTCTCTTATGGTGTTCAATGCTTTTCAAGATACCCAGATCATATGAAACGGCATGACTTTTTCAAGAGTGCCATGCCCGAAGGTTATGTACAGGAAAGAACTATATTTTTCAAAGATGACGGGAACTACAAGACACGTGCTGAAGTCAAGTTTGAAGGTGATACCCTTGTTAATAGAATCGAGTTAAAAGGTATTGATTTTAAAGAAGATGGAAACATTCTTGGACACAAATTGGAATACAACTATAACTCACACAATGTATACATCATGGCAGACAAACAAAAGAATGGAATCAAAGTT';

describe('re-deriving an anneal from its 3 prime end', () => {
  it('a tool-derived primer matches the tool, so its delta is zero', () => {
    const window = TEMPLATE.slice(100, 100 + ANNEAL_WINDOW);
    const derived = findanneal(window, false, true);
    const out = auditAnneal(derived, TEMPLATE);
    expect(out.found).toBe(true);
    expect(out.strand).toBe('top');
    expect(out.best).toBe(derived);
    expect(out.delta).toBe(0);
  });

  it('AN IMPROVISED PRIMER SCORES WORSE, and the better one comes back with it', () => {
    // "An arbitrary 30 bp sequence" — exactly the failure described. Taken off the template so
    // it is findable, chosen by position rather than by any property.
    const arbitrary = TEMPLATE.slice(111, 141);
    const out = auditAnneal(arbitrary, TEMPLATE);
    expect(out.found).toBe(true);
    expect(out.delta).toBeGreaterThan(0);
    expect(out.bestScore).toBeGreaterThan(out.chosenScore);
    expect(out.best).not.toBe(arbitrary);
    expect(scoreanneal(out.best)).toBe(out.bestScore);
  });

  it('finds a primer on the bottom strand and says which', () => {
    const window = TEMPLATE.slice(200, 200 + ANNEAL_WINDOW);
    const derived = findanneal(revcomp(window), false, true);
    const out = auditAnneal(derived, TEMPLATE);
    expect(out.found).toBe(true);
    expect(out.strand).toBe('bottom');
  });

  it('a primer that is not in its template is a DIFFERENT finding, not a bad score', () => {
    const out = auditAnneal('GGGGGGGGGGGGGGGGGGGG', 'ATATATATATATATATATATATAT');
    expect(out).toEqual({ found: false });
    expect(out.delta).toBeUndefined();
  });

  it('is case insensitive about the design and the template', () => {
    const window = TEMPLATE.slice(50, 50 + ANNEAL_WINDOW);
    const derived = findanneal(window, false, true);
    expect(auditAnneal(derived.toLowerCase(), TEMPLATE.toLowerCase()).delta).toBe(0);
  });
});

describe('reading a design script', () => {
  it('reports a hand-typed sequence with its line', () => {
    const src = [
      "import { findanneal } from '../src/C6-Oligos.js';",
      "const fwd = 'GATCTTTGACAGCTAGCTCAGTCCTAGG';",
      'const rev = findanneal(window, false, true);',
    ].join('\n');
    const { literals } = auditScript(src);
    expect(literals).toHaveLength(1);
    expect(literals[0]).toEqual({ line: 2, text: 'GATCTTTGACAGCTAGCTCAGTCCTAGG' });
  });

  it('leaves short strings alone — a cut site is not an improvised oligo', () => {
    expect(auditScript("const site = 'GGTCTC';").literals).toEqual([]);
  });

  it('sees literals in any quote style', () => {
    const src = 'const a = "ACGTACGTACGTACGT";\nconst b = `TTTTGGGGCCCCAAAA`;';
    expect(auditScript(src).literals.map((l) => l.line)).toEqual([1, 2]);
  });

  it('flags an import from outside C6 and allows C6 and node builtins', () => {
    const src = [
      "import fs from 'node:fs';",
      "import { findanneal } from '../src/C6-Oligos.js';",
      "import primer3 from 'primer3-wasm';",
    ].join('\n');
    const { foreignImports } = auditScript(src);
    expect(foreignImports).toEqual([{ line: 3, module: 'primer3-wasm' }]);
  });

  it('ACCEPTS THE STANDARD LIBRARY UNDER EITHER SPELLING', () => {
    // `DESIGN.md` allows "C6 and the standard library", and `fs` IS the standard library. This
    // matched `node:` only, so a design importing `fs` failed the one finding class that stops a
    // run — and C6's own bin/ scripts use the bare form, so the toolkit would have failed its
    // own audit.
    const src = ["import fs from 'fs';", "import path from 'path';", "import url from 'node:url';"].join('\n');
    expect(auditScript(src).foreignImports).toEqual([]);
  });

  it('a clean script reports nothing', () => {
    const src = "import { findanneal } from '../src/C6-Oligos.js';\nexport const o = findanneal(w, false, true);";
    expect(auditScript(src)).toEqual({ literals: [], foreignImports: [] });
  });
});
