// readPool.js — read an oligo pool from a GenBank file, per docs/OLIGOPOOL-SPEC.md §4.2 and §8.4.
//
// JCA, 2026-09-20, ruling on how a pool reaches a construction file:
//
//   "An oligopool, like an oligo, is a named dna. You have already seen it expressed in the Tlib3
//    CF. There is nothing else in there but the name of the dna entity... The parser currently does
//    it by scanning filenames to figure it out; you just add another file type to look for."
//
// So NOTHING CHANGES IN A CONSTRUCTION FILE. `PCR G00101 T3A_R Tlib3 TL3A` is already the whole
// expression of it; only what `Tlib3` resolves to is new.
//
// WHY GENBANK RATHER THAN A FORMAT OF OUR OWN, also JCA's:
//
//   "maybe use lower case nnnnnnnn to designate a region, and an annotation to define it as a
//    variable region with a code linking the variables. Then, it would look like regular genbank to
//    any tool, and the n's if the right size still well-represent the dna."
//
// A pool file is therefore an ORDINARY .gb that any tool can open — ApE included — carrying one
// `misc_feature` per variable slot. The n-runs sit at each slot's MEAN span, so the length a naive
// reader computes is the pool's average rather than nonsense. Only the `/pool_*` qualifiers are
// ours, and a tool that ignores them still sees correct DNA.
//
// THE MEMBERS ARE NOT IN THE FILE. 180 members of 250 bp would make a .gb nobody can read, and the
// data already exists as a table beside the experiment. `/pool_members` names that TSV, relative to
// the .gb, and each slot's `/pool_bin` names the column — or several joined with `+`, since a slot
// often spans columns that were designed separately.
import fs from 'fs';
import path from 'path';
import { parseGenbank } from '../c6-server/parsers/genbank.js';

/** `43..124` or `complement(43..124)` -> zero-based half-open [start, end). */
function parseLocation(loc) {
  const m = String(loc || '').match(/(\d+)\s*\.\.\s*(\d+)/);
  if (!m) return null;
  return { start: Number(m[1]) - 1, end: Number(m[2]) };
}

/** `73..98` or `73-98` -> [73, 98]. */
function parseRange(v) {
  const m = String(v || '').match(/(\d+)\s*(?:\.\.|-)\s*(\d+)/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/**
 * True if this GenBank text describes a pool rather than an ordinary plasmid.
 *
 * **A FILE IS A POOL BECAUSE IT SAYS SO, not because it happens to contain N.** Plenty of ordinary
 * maps carry an N or two from a bad read, and treating one of those as a library would invent slots
 * that do not exist and a membership nobody declared.
 */
export function isPoolFile(text) {
  return /\/pool_slot\s*=/.test(String(text));
}

/**
 * Read a pool file into `{ name, sequence, slots, occupancy }`, or null if it is not a pool.
 *
 * Fails closed and says which file: a slot naming a bin column that the members table does not have
 * is a broken pool, and returning it with that slot silently binless would hand GoldenGate an
 * "unscreenable" refusal pointing at the wrong thing.
 *
 * @param {string} file  path to the .gb
 */
export function readPool(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (!isPoolFile(text)) return null;

  const parsed = parseGenbank(text);
  const sequence = String(parsed.data.sequence || '').toUpperCase();
  const features = parsed.data.features || [];
  const name = path.basename(file).replace(/\.(gb|gbk|ape|seq)$/i, '');

  // The members table, named once on whichever feature carries it.
  const memberRef = features.map((f) => f.qualifiers && f.qualifiers.pool_members).find(Boolean);
  // A PRODUCT POOL POINTS AT THE ORIGINAL MEMBERS TABLE AND NARROWS IT, rather than carrying its
  // own copy. `pTlib3A` is 30 of Tlib3's 180, and a second table of those 30 would be a fork of one
  // design — right until somebody edits the other one.
  const filters = [...new Set(features.flatMap((f) =>
    (f.qualifiers && f.qualifiers.pool_filter) ? [f.qualifiers.pool_filter] : []))];
  let rows = null;
  if (memberRef) {
    const tsv = path.resolve(path.dirname(file), memberRef);
    if (!fs.existsSync(tsv)) {
      throw new Error(`${path.basename(file)} names a members table "${memberRef}" that is not ` +
                      `there (looked in ${path.dirname(file)}). A pool whose members cannot be ` +
                      `read is not an empty pool — see docs/OLIGOPOOL-SPEC.md §8b.`);
    }
    // CRLF is common in these tables; a stray \r becomes part of the last column name and every
    // lookup against it silently misses.
    const [h, ...rest] = fs.readFileSync(tsv, 'utf8').replace(/\r/g, '').trim().split('\n');
    const cols = h.split('\t');
    rows = rest.map((l) => Object.fromEntries(l.split('\t').map((v, i) => [cols[i], v])));
    for (const f of filters) {
      const eq = f.indexOf('=');
      if (eq < 0) continue;
      const key = f.slice(0, eq).trim(), want = f.slice(eq + 1).trim().toUpperCase();
      // The filter names a SLOT, whose value is its bin columns joined. Resolve it through the
      // feature that declares that slot so one spelling works for both.
      const decl = features.find((x) => x.qualifiers && x.qualifiers.pool_slot === key);
      const fcols = decl && decl.qualifiers.pool_bin
        ? String(decl.qualifiers.pool_bin).split('+').map((c) => c.trim()) : [key];
      rows = rows.filter((rr) => fcols.map((c) => String(rr[c] || '')).join('').toUpperCase() === want);
    }
    rows.__source = memberRef;
    rows.__filters = filters;
  }

  const slots = [];
  for (const f of features) {
    const q = f.qualifiers || {};
    if (!q.pool_slot) continue;
    const loc = parseLocation(q.location);
    if (!loc) throw new Error(`Slot "${q.pool_slot}" in ${path.basename(file)} has no readable location.`);

    const slot = { name: q.pool_slot, start: loc.start, end: loc.end };
    const lr = parseRange(q.pool_lengths);
    slot.lengths = lr || [loc.end - loc.start, loc.end - loc.start];

    if (q.pool_bin && rows) {
      const cols = String(q.pool_bin).split('+').map((c) => c.trim());
      const missing = cols.filter((c) => !(c in rows[0]));
      if (missing.length) {
        throw new Error(`Slot "${slot.name}" in ${path.basename(file)} names bin column(s) ` +
                        `${missing.join(', ')}, which "${memberRef}" does not have. Its columns ` +
                        `are: ${Object.keys(rows[0]).join(', ')}.`);
      }
      const seen = new Set(), bin = [];
      for (const r of rows) {
        const v = cols.map((c) => String(r[c] || '')).join('').toUpperCase();
        if (v && !seen.has(v)) { seen.add(v); bin.push(v); }
      }
      slot.bin = bin;
      // KEPT SO REFINEMENT CAN NARROW MEMBERSHIP. Choosing one value of this slot selects the
      // members that carry it, and that is only recoverable if the slot remembers which columns
      // of the members table it was built from. Without it a refined pool would know its sequence
      // and not its membership, which is the half that matters for a count.
      slot.cols = cols;
    }
    slots.push(slot);
  }
  if (!slots.length) return null;

  slots.sort((a, b) => a.start - b.start);
  return {
    name,
    sequence,
    slots,
    occupancy: rows ? { source: rows.__source, rows } : null,
    isCircular: !!parsed.data.isCircular,
  };
}

/**
 * Attach pool slots to the Polynucleotides `parseCF` built, after parsing and before simulating.
 *
 * **WHY IT HAPPENS HERE AND NOT IN THE PARSER.** A construction file's inputs reach `parseCF` as
 * TEXT — `preambleFor` renders every resolved sequence as an `oligo`/`plasmid` line and prepends
 * it — and text has nowhere to carry a slot. Rather than invent a declaration syntax for something
 * no user writes, the objects are decorated once the parser has made them.
 *
 * This is the step that makes a pool behave as a pool. Without it `Tlib3` resolves to its skeleton
 * and simulates as an ordinary molecule with a lot of N in it: every guard in `library/slots.js` is
 * inert, because `hasSlots` is false for all of them.
 *
 * @param {{sequences: Object}} parsed  the return of `parseCF`
 * @param {Object} pools                name -> pool, from `projectSequences`
 */
export function attachPools(parsed, pools) {
  if (!parsed || !parsed.sequences || !pools) return parsed;
  for (const [name, pool] of Object.entries(pools)) {
    const target = parsed.sequences[name];
    if (!target) continue;
    // The preamble may have rendered a different sequence under this name — a conflict the
    // resolver already records. Decorating it with slots whose coordinates were measured against
    // the pool file would put every slot on the wrong bases, so it is skipped and left alone.
    if (String(target.sequence).toUpperCase() !== String(pool.sequence).toUpperCase()) continue;
    target.slots = pool.slots;
    target.occupancy = pool.occupancy;
  }
  return parsed;
}
