// writePool.js — write a pool back out as a plasmid map. The inverse of readPool.js.
//
// WHY A PRODUCT POOL NEEDS WRITING DOWN AT ALL. `cf.sim` computes one, prints `~3898-3913 bp,
// 30 members, variable: cassette, tail` to a terminal, and exits. The pool it worked out is
// correct and then thrown away — so the next experiment, the one that moves those cassettes into
// a reporter, names `pTlib3A` and finds nothing. Exactly what `Tlib3` did before it had a file.
//
// **THE SERIALISER IS `plasmids/write.js`, NOT THIS FILE.** The first version of this module wrote
// its own GenBank and produced maps that were technically valid and useless: no ApE colours, every
// feature emitted as `misc_feature` whatever its type, and no ordering. JCA, on those maps: *"The
// annotations you did are crap."* A second GenBank writer in one toolkit is how two conventions
// appear, and only one of them is the one people's maps already follow.
//
// So what is left here is the part that is genuinely about pools: the variable regions, written as
// features carrying `/pool_slot` and the rest, handed to `toGenbank` with everything else.
//
// THE MEMBERS TABLE IS NOT COPIED. A subpool product has 30 of the pool's 180 members, and writing
// 30 rows into a new file would fork the table — two copies of the same design, drifting. The map
// points at the ORIGINAL table and records the narrowing as `/pool_filter`, so there stays one
// source of truth and the 30 are derived from it every time it is read.
import { hasSlots, lengthRange, occupancyCount } from './slots.js';
import { toGenbank, byPosition, colorFor } from '../plasmids/write.js';

// Variable regions get one colour, and it is not in TYPE_COLORS on purpose: they are not a kind of
// biology, they are a statement that this stretch is not one sequence. A reader should be able to
// pick them out of a map without reading a single label.
export const SLOT_COLOR = '#ffd24d';

/**
 * A slotted Polynucleotide as a GenBank plasmid map.
 *
 * @param {Polynucleotide} poly
 * @param {{name: string, members?: string, definition?: string, comments?: string[],
 *          annotations?: Array<{start,end,strand,label,type,color}>, date?: string}} opts
 *        members     — path to the members table, relative to where this file will be written
 *        annotations — ordinary features, from `annotateCircular`
 * @returns {string} the .gb/.seq contents
 */
export function writePool(poly, opts = {}) {
  const name = opts.name || 'pool';
  const seq = String(poly.sequence || '');
  if (!hasSlots(poly)) {
    throw new Error(`${name} has no slots — it is an ordinary molecule, and writing it through ` +
                    `writePool would claim a library that does not exist.`);
  }

  const n = occupancyCount(poly.occupancy, poly.slots);
  const r = lengthRange(poly);

  // The narrowing that produced this pool, if any. Recorded rather than baked in, so a reader
  // derives the members from the one table instead of trusting a copy.
  const filters = ((poly.occupancy && poly.occupancy.refined) || [])
    .map((x) => `${x.slot}=${x.value}`);

  const slotFeatures = poly.slots.map((s) => {
    const span = s.end - s.start;
    const [lo, hi] = Array.isArray(s.lengths) ? s.lengths : [span, span];
    return {
      start: s.start, end: s.end, strand: 1, type: 'misc_feature',
      label: s.name, color: SLOT_COLOR,
      qualifiers: {
        pool_slot: s.name,
        pool_lengths: `${lo}..${hi}`,
        ...(Array.isArray(s.cols) && s.cols.length ? { pool_bin: s.cols.join('+') } : {}),
        ...(opts.members ? { pool_members: opts.members } : {}),
        ...(filters.length ? { pool_filter: filters } : {}),
        note: `variable region, ${lo}-${hi} nt across ${
          Array.isArray(s.bin) ? s.bin.length : '?'} value(s) — this stretch is NOT one sequence`,
      },
    };
  });

  // **A FEATURE MAY NOT BE ANNOTATED INTO A SLOT**, and the caller is expected to have dropped
  // those already (`annotateSkeleton`). Enforced here too, because a map is read long after the
  // script that wrote it is forgotten, and a feature drawn across a variable region is a claim
  // about thirty different sequences at once.
  const clear = (opts.annotations || []).filter(
    (f) => !poly.slots.some((s) => f.start < s.end && f.end > s.start));

  const features = [...slotFeatures, ...clear]
    .map((f) => ({ ...f, color: f.color || colorFor(f.type) }))
    .sort(byPosition);

  const text = toGenbank({ name, sequence: seq, isCircular: !!poly.isCircular, features,
                           date: opts.date });

  // The library's own facts, above FEATURES. A person opening this should learn what it is before
  // meeting the annotation.
  const head = [
    `COMMENT     ${opts.definition || `${name}: a library of ${n == null ? 'an unknown number of' : n} member(s).`}`,
    `COMMENT     ${n == null ? 'An unknown number of' : n} member(s). Lowercase regions marked`,
    `COMMENT     /pool_slot are VARIABLE: the sequence there is one member's, written at that`,
    `COMMENT     slot's mean length. ${seq.length} bp is therefore the constant sequence plus each`,
    `COMMENT     slot's rounded mean — close to this library's average, right for almost no single`,
    `COMMENT     member, and able to differ from the true mean by a base because rounding each slot`,
    `COMMENT     is not rounding the sum. Use it for a gel and a PCR program, nothing else.`,
    `COMMENT     The real range is ${r.min}-${r.max} bp${r.bound === 'outer'
      ? ', an OUTER BOUND: for a sparse library the extremes of two slots' : '.'}`,
    ...(r.bound === 'outer' ? ['COMMENT     need not co-occur in any member that exists.'] : []),
    ...(opts.comments || []).map((c) => `COMMENT     ${c}`),
  ].join('\n');

  return text.replace(/^FEATURES/m, `${head}\nFEATURES`);
}
