// dna.js — synthetic sequence, built to order, so a scenario can choose its product lengths.
//
// **THE POINT IS THE LENGTH, AND NOTHING ELSE ABOUT THESE SEQUENCES MEANS ANYTHING.** Three of the
// toolkit's decisions read a PCR product's size and nothing reads its bases: which thermocycler
// program, which chemistry, and whether a column cleanup has to bind a short fragment. A fixture
// carrying real sequence can only test the lengths that sequence happens to have — `gold_sequences
// .tsv` holds exactly two amplifiable products, 1374 bp and 1676 bp, so `pcrProgram.longProduct`
// and `mastermix.worthAMix` had never once fired in a compile. Building the template around the
// length wanted is what makes those reachable.
//
// **DETERMINISTIC, BECAUSE A FIXTURE THAT DIFFERS BETWEEN MACHINES IS NOT A FIXTURE.** The
// generator is seeded from the name being built, so `template('pS1', 1400)` is the same string on
// every run and a snapshot over a generated experiment means something.
//
// **NOT RANDOM-LOOKING ON PURPOSE.** These are synthetic templates in a generic toolkit and they
// are meant to read as obviously synthetic — content does not go in machinery.

/** The 3' stretch a primer anneals through. `simCF` refuses a primer whose 3'-most 18 bases do not
 *  match the template exactly, so anything shorter than that produces no product and no size. */
const ANNEAL = 22;

/** A Golden Gate tail: the enzyme site, its spacer, and then the four-base overhang. */
const TAIL_F = 'ccataGGTCTCa';
const TAIL_R = 'cagttGGTCTCt';

/** How much a pair of Golden Gate tails adds to the product a PCR yields. Both tails, both ends. */
export const TAIL_BP = TAIL_F.length + 4 + TAIL_R.length + 4;

/**
 * Four-base overhangs, in the order a multi-fragment assembly consumes them.
 *
 * Distinct, non-palindromic, and cyclic: fragment `i` carries `OVERHANGS[i]` at its left end and
 * the complement of `OVERHANGS[i+1]` at its right, so the last fragment's right end meets the
 * first fragment's left and the assembly closes. Four is the most fragments any scenario needs.
 */
export const OVERHANGS = ['GCTT', 'TACT', 'CAGA', 'ATGG'];

/**
 * A deterministic pseudo-random source, seeded by a string, for building synthetic sequence.
 *
 * @param {string} seed
 * @returns {Function} successive values in [0, 1)
 */
function rng(seed) {
  let h = 2166136261;
  for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; };
}

/**
 * The site the assemblies here cut with, in both orientations.
 *
 * **A RANDOM SEQUENCE CONTAINS ONE EVERY FEW KILOBASES, AND THEN NOTHING SIMULATES.** A four-part
 * assembly refused with *"More than one reverse enzyme site GAGACC found"* — the generator had put
 * a BsaI site inside a fragment by chance, which is a real experimental problem and a useless one
 * to reproduce in a fixture whose subject is the labsheet. So generated sequence is scrubbed of
 * them, and a scenario that WANTS an internal site would have to ask for one deliberately.
 */
const BSAI = /GGTCTC|GAGACC/g;

/**
 * A run of synthetic DNA of a given length, the same on every machine for a given seed.
 *
 * Carries no BsaI site, so an assembly built from it simulates — see `BSAI`.
 *
 * @param {number} n     how many bases
 * @param {string} seed  anything; the same seed always gives the same string
 * @returns {string}
 */
export function dna(n, seed) {
  const r = rng(seed);
  let s = '';
  for (let i = 0; i < n; i += 1) s += 'ACGT'[Math.floor(r() * 4)];
  // SCRUBBED IN A LOOP, BECAUSE ONE SUBSTITUTION CAN MAKE THE NEXT SITE. Swapping the third base
  // for an A breaks both spellings and cannot create either, but it can create one across the
  // join with what sits beside it, so this runs until the string is clean rather than once.
  for (let pass = 0; pass < 20 && BSAI.test(s); pass += 1) {
    BSAI.lastIndex = 0;
    s = s.replace(BSAI, (m) => `${m.slice(0, 2)}A${m.slice(3)}`);
    BSAI.lastIndex = 0;
  }
  BSAI.lastIndex = 0;
  return s;
}

/**
 * The reverse complement of a DNA string, for building the reverse primer of a pair.
 *
 * @param {string} s
 * @returns {string}
 */
export function revcomp(s) {
  return String(s).split('').reverse()
    .map((c) => ({ A: 'T', T: 'A', C: 'G', G: 'C', a: 't', t: 'a', c: 'g', g: 'c' }[c] || c)).join('');
}

/**
 * A synthetic plasmid and the primer pair that amplifies a product of exactly the length asked for.
 *
 * The product is the requested length INCLUDING the Golden Gate tails, because that is the number
 * every downstream decision reads — the program, the chemistry and the cleanup all measure what
 * comes out of the tube, not what was amplified off the template.
 *
 * @param {Object} p
 * @param {string} p.name       what the plasmid is called; also the seed
 * @param {number} p.bp         the product length wanted, tails included
 * @param {string} p.left       the four-base overhang at the product's left end
 * @param {string} p.right      the four-base overhang the NEXT fragment carries at its left end
 * @returns {{plasmid: string, forward: string, reverse: string, bp: number}}
 */
export function amplicon({ name, bp, left = OVERHANGS[0], right = OVERHANGS[1] }) {
  // THE CORE IS WHAT IS AMPLIFIED; THE TAILS ARE ADDED BY THE PRIMERS. Asking for 231 bp and
  // getting 263 back is the kind of quiet off-by-a-constant that makes a boundary scenario test
  // the wrong side of the boundary, so the arithmetic is done here and once.
  const core = Math.max(ANNEAL * 2, bp - TAIL_BP);
  const body = dna(core, `${name}:core`);
  // Flanks so the primers have somewhere to sit that is not the very end of the molecule.
  const plasmid = dna(300, `${name}:up`) + body + dna(300, `${name}:dn`);
  return {
    plasmid,
    forward: `${TAIL_F}${left}${body.slice(0, ANNEAL)}`,
    reverse: `${TAIL_R}${revcomp(right)}${revcomp(body.slice(-ANNEAL))}`,
    bp: core + TAIL_BP,
  };
}
