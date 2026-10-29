// tolerant.js - annotation that survives a point mutation
//
// WHY THIS EXISTS. `annotateSequence` matches a library feature exactly (or by IUPAC class), so a
// promoter or CDS carrying one substitution is not annotated at all, and nothing says a near-match
// was there: a mutant reads exactly like an absent part. Measured 2026-10-29 against
// cloning-tutorials' Default_Features.txt -- Pbad, AraC, AmpR and R6K all found exact, all lost
// with one mismatch. JCA, 2026-10-29: auto-annotation "needs to be really robust ... able to find
// things that are point mutants etc of a real sequence and then be able to either say whether
// those point mutations are silent or neutral".
//
// WHAT IT DOES. Every hit is `exact` or `variant`; a variant carries its differences, and a CDS
// variant carries what they do to the protein. Substitutions only: an insertion or deletion shifts
// the window and the hit is not found. That is a known limit, not a guarantee of absence.
//
// ONE BAD ROW DOES NOT STOP THE SCAN. `annotateSequence` throws on the first library row `cleanup`
// rejects, so with three such rows in Default_Features.txt nothing is annotated at all. Here a bad
// row is skipped and RETURNED in `skipped` with its reason -- never dropped silently.

import { cleanup, revcomp } from '../C6-Seq.js';
import { annotateSequence } from '../C6-Annotator.js';

// Shorter than this, a feature is matched exactly or not at all: a 1-in-15 mismatch on a short
// pattern is as likely to be chance as a mutant.
const MIN_TOLERANT_LENGTH = 20;
const DEFAULT_MAX_MISMATCH_FRACTION = 0.05;

// Library entries carry degeneracy (AmpR and AraC have N-runs in Default_Features.txt), so a
// position agrees when the read's base is one the pattern's code allows. A read N agrees only
// with a pattern N, as in annotateSequence.
const IUPAC = {
  A: 'A', C: 'C', G: 'G', T: 'T', R: 'AG', Y: 'CT', S: 'CG', W: 'AT', K: 'GT', M: 'AC',
  B: 'CGT', D: 'AGT', H: 'ACT', V: 'ACG', N: 'ACGTN'
};
const agrees = (pat, base) => (IUPAC[pat] || '').includes(base);

const CODE = {
  ATA:'I',ATC:'I',ATT:'I',ATG:'M',ACA:'T',ACC:'T',ACG:'T',ACT:'T',AAC:'N',AAT:'N',AAA:'K',AAG:'K',
  AGC:'S',AGT:'S',AGA:'R',AGG:'R',CTA:'L',CTC:'L',CTG:'L',CTT:'L',CCA:'P',CCC:'P',CCG:'P',CCT:'P',
  CAC:'H',CAT:'H',CAA:'Q',CAG:'Q',CGA:'R',CGC:'R',CGG:'R',CGT:'R',GTA:'V',GTC:'V',GTG:'V',GTT:'V',
  GCA:'A',GCC:'A',GCG:'A',GCT:'A',GAC:'D',GAT:'D',GAA:'E',GAG:'E',GGA:'G',GGC:'G',GGG:'G',GGT:'G',
  TCA:'S',TCC:'S',TCG:'S',TCT:'S',TTC:'F',TTT:'F',TTA:'L',TTG:'L',TAC:'Y',TAT:'Y',TAA:'*',TAG:'*',
  TGC:'C',TGT:'C',TGA:'*',TGG:'W'
};

/**
 * Split a feature library into rows that can be matched and rows that cannot, with the reason.
 * `row` is the 0-based index into `db`.
 */
export function validateFeatureDb(db) {
  const valid = [], invalid = [];
  db.forEach((feature, row) => {
    try {
      const pattern = cleanup(feature.Sequence || '');
      valid.push({ feature, row, pattern });
    } catch (err) {
      invalid.push({ row, name: feature.Name, reason: err.message.split('(')[0].trim() });
    }
  });
  return { valid, invalid };
}

/**
 * What the substitutions in a CDS window do to the protein, read in the feature's own frame.
 * Returns null when the reference is not a whole number of concrete codons.
 *   effect: 'synonymous' | 'missense' | 'nonsense' | 'unknown' (an N in the read)
 */
export function codingEffect(ref, alt, differences) {
  if (ref.length % 3 !== 0 || !/^[ACGT]+$/.test(ref)) return null;
  const codons = [...new Set(differences.map(d => Math.floor(d.pos / 3)))];
  const changes = codons.map(c => {
    const from = CODE[ref.slice(c * 3, c * 3 + 3)];
    const to = CODE[alt.slice(c * 3, c * 3 + 3)];
    const effect = !to ? 'unknown' : from === to ? 'synonymous' : to === '*' ? 'nonsense' : 'missense';
    return { codon: c + 1, change: `${from}${c + 1}${to || '?'}`, effect };
  });
  const rank = ['synonymous', 'unknown', 'missense', 'nonsense'];
  const effect = changes.reduce((w, c) => rank.indexOf(c.effect) > rank.indexOf(w) ? c.effect : w, 'synonymous');
  return { effect, changes };
}

/**
 * Annotate `sequence` against `db`, finding exact hits and point-mutant variants.
 *
 * Returns { features, skipped }. Each feature has the shape `annotateSequence` returns (start,
 * end, strand, label, type, color -- minus-strand coordinates on the reverse complement, as there)
 * plus:
 *   match        'exact' | 'variant'
 *   mismatches   number of substitutions
 *   identity     fraction of the pattern's concrete positions that agree
 *   differences  [{pos, ref, alt}] -- pos within the feature, in its own orientation
 *   coding       codingEffect(...) for a CDS variant, else absent
 *
 * opts.maxMismatchFraction (default 0.05) bounds how divergent a variant may be.
 */
export function annotateTolerant(sequence, db, opts = {}) {
  const maxFraction = opts.maxMismatchFraction ?? DEFAULT_MAX_MISMATCH_FRACTION;
  sequence = cleanup(sequence);
  const { valid, invalid } = validateFeatureDb(db);

  // Exact and IUPAC hits come from the existing matcher, unchanged, so this never reports less
  // than annotateSequence does on the same valid rows.
  const exact = annotateSequence(sequence, valid.map(v => v.feature))
    .map(f => ({ ...f, match: 'exact', mismatches: 0, identity: 1, differences: [] }));

  const strands = [sequence, revcomp(sequence)];
  const variants = [];
  for (const { feature, pattern } of valid) {
    if (pattern.length < MIN_TOLERANT_LENGTH || !/^[ACGTRYSWKMBDHVN]+$/.test(pattern)) continue;
    const informative = (pattern.match(/[ACGT]/g) || []).length;
    const maxMis = Math.max(1, Math.floor(informative * maxFraction));
    // Pigeonhole: with maxMis substitutions, one of maxMis+1 disjoint seeds is untouched. Seeds
    // tile the concrete runs only, so shrink k until there are enough of them.
    const runs = [...pattern.matchAll(/[ACGT]+/g)].map(m => [m.index, m[0].length]);
    const seedsAt = (k) => runs.flatMap(([at, len]) =>
      Array.from({ length: Math.floor(len / k) }, (_, j) => at + j * k));
    let k = 16, offsets = seedsAt(k);
    while (offsets.length < maxMis + 1 && k > 8) offsets = seedsAt(--k);
    if (offsets.length === 0) continue;
    strands.forEach((seq, si) => {
      const tried = new Set();
      for (const off of offsets) {
        const seed = pattern.slice(off, off + k);
        for (let p = seq.indexOf(seed); p !== -1; p = seq.indexOf(seed, p + 1)) {
          const start = p - off;
          if (start < 0 || start + pattern.length > seq.length || tried.has(start)) continue;
          tried.add(start);
          const differences = [];
          for (let i = 0; i < pattern.length && differences.length <= maxMis; i++) {
            if (!agrees(pattern[i], seq[start + i])) differences.push({ pos: i, ref: pattern[i], alt: seq[start + i] });
          }
          if (differences.length === 0 || differences.length > maxMis) continue;
          const hit = {
            start, end: start + pattern.length, strand: si === 0 ? +1 : -1,
            label: feature.Name, type: feature.Type, color: feature.Color,
            match: 'variant', mismatches: differences.length,
            identity: 1 - differences.length / informative, differences
          };
          if ((feature.Type || '').toLowerCase() === 'cds') {
            hit.coding = codingEffect(pattern, seq.slice(start, start + pattern.length), differences);
          }
          variants.push(hit);
        }
      }
    });
  }

  // A library holds near-identical entries (CmR/cmR differ by 1 bp). Where one entry matches a
  // span exactly, its near-twins also "match" that span as variants; report only the best hit
  // for an identical span and strand.
  const best = new Map();
  for (const h of [...exact, ...variants]) {
    const key = `${h.strand}:${h.start}:${h.end}`;
    const cur = best.get(key);
    if (!cur || h.mismatches < cur[0].mismatches) best.set(key, [h]);
    else if (h.mismatches === cur[0].mismatches) cur.push(h);
  }
  const features = [...best.values()].flat().sort((a, b) => a.start - b.start);
  return { features, skipped: invalid };
}
