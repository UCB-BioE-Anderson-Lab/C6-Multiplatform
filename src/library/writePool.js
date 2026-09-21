// writePool.js — write a pool back out as an ordinary GenBank map. The inverse of readPool.js.
//
// WHY A PRODUCT POOL NEEDS WRITING DOWN AT ALL. `cf.sim` computes one, prints `~3898-3913 bp,
// 30 members, variable: cassette, tail` to a terminal, and exits. The pool it worked out is
// correct and then thrown away — so the next experiment, the one that moves those cassettes into
// a reporter, names `pTlib3A` and finds nothing. Exactly what `Tlib3` did before it had a file.
//
// A PRODUCT POOL IS A NAMED DNA LIKE ANY OTHER, which is JCA's ruling about inputs applied to the
// other end: written here, it is resolvable as an input downstream with no new syntax anywhere.
//
// THE MEMBERS TABLE IS NOT COPIED. A subpool product has 30 of the pool's 180 members, and writing
// 30 rows into a new file would fork the table — two copies of the same design, drifting. The map
// points at the ORIGINAL table and records the narrowing as `/pool_filter`, so there stays one
// source of truth and the 30 are derived from it every time it is read.
import { hasSlots, lengthRange, occupancyCount } from './slots.js';

const wrap = (s, n) => s.match(new RegExp(`.{1,${n}}`, 'g')) || [];

/**
 * A slotted Polynucleotide as GenBank text.
 *
 * @param {Polynucleotide} poly
 * @param {{name: string, members?: string, definition?: string, comments?: string[]}} opts
 *        members — path to the members table, relative to where this file will be written
 * @returns {string} the .gb contents
 */
export function writePool(poly, opts = {}) {
  const name = opts.name || 'pool';
  const seq = String(poly.sequence || '');
  if (!hasSlots(poly)) {
    throw new Error(`${name} has no slots — it is an ordinary molecule, and writing it through ` +
                    `writePool would claim a library that does not exist.`);
  }

  // Lowercase the variable regions. GenBank sequence is case-insensitive and lowercase
  // conventionally means soft-masked, so every tool still reads correct DNA and a person opening
  // it in ApE can see at a glance which stretches are not one sequence.
  const chars = seq.split('');
  for (const s of poly.slots) for (let i = s.start; i < s.end; i++) chars[i] = (chars[i] || '').toLowerCase();
  const shown = chars.join('');

  const n = occupancyCount(poly.occupancy, poly.slots);
  const r = lengthRange(poly);
  const topology = poly.isCircular ? 'circular' : 'linear  ';

  const out = [
    `LOCUS       ${name.padEnd(18)} ${String(seq.length).padStart(6)} bp    DNA     ${topology} SYN`,
    `DEFINITION  ${opts.definition || `${name}: a library of ${n == null ? 'an unknown number of' : n} member(s).`}`,
    'KEYWORDS    oligo pool; library.',
    `COMMENT     Lowercase n marks a variable region, written at that slot's MEAN member length.`,
    `COMMENT     ${seq.length} bp is therefore the constant sequence plus each slot's rounded mean.`,
    `COMMENT     It is close to this library's average and is right for almost no single member; it`,
    `COMMENT     can differ from the true mean by a base, because rounding each slot separately is`,
    `COMMENT     not the same as rounding the sum. Use it for a gel and a PCR program, nothing else.`,
    `COMMENT     The real range is ${r.min}-${r.max} bp${r.bound === 'outer' ? ' (an outer bound — for a sparse' : ''}`,
    ...(r.bound === 'outer' ? ['COMMENT     library the extremes of two slots need not co-occur in any member).'] : []),
    ...(opts.comments || []).map((c) => `COMMENT     ${c}`),
    'FEATURES             Location/Qualifiers',
  ];

  // The narrowing that produced this pool, if any. Recorded rather than baked in, so a reader
  // derives the members from the one table instead of trusting a copy.
  const refined = (poly.occupancy && poly.occupancy.refined) || [];
  const filters = refined.map((x) => `${x.slot}=${x.value}`);

  for (const s of poly.slots) {
    const span = s.end - s.start;
    const [lo, hi] = Array.isArray(s.lengths) ? s.lengths : [span, span];
    out.push(`     misc_feature    ${s.start + 1}..${s.end}`,
             `                     /label="${s.name}"`,
             `                     /note="variable region, ${lo}-${hi} nt across ${
               Array.isArray(s.bin) ? s.bin.length : '?'} value(s)"`,
             `                     /pool_slot="${s.name}"`,
             `                     /pool_lengths="${lo}..${hi}"`);
    if (Array.isArray(s.cols) && s.cols.length) out.push(`                     /pool_bin="${s.cols.join('+')}"`);
    if (opts.members) out.push(`                     /pool_members="${opts.members}"`);
    for (const f of filters) out.push(`                     /pool_filter="${f}"`);
  }

  out.push('ORIGIN');
  for (let i = 0; i < shown.length; i += 60) {
    out.push(`${String(i + 1).padStart(9)} ${wrap(shown.slice(i, i + 60), 10).join(' ')}`);
  }
  out.push('//');
  return out.join('\n') + '\n';
}
