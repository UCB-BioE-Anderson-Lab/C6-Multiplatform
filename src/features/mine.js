/**
 * Mine features out of annotated plasmids, and read/write the ApE feature library.
 *
 * TWO THINGS THAT ARE NOT THE SAME, and keeping them apart is the whole design. JCA 2026-09-14:
 * *"annotation and feature are distinct. Features are standalone primitives. Annotations are
 * information inside a Plasmid object (the genbank file)."*
 *
 *   FEATURE     a standalone primitive: name, sequence, type, colour. It need not appear in any
 *               plasmid — *"There can be features that have not yet made it into a plasmid, so it
 *               cannot be a requirement that a feature live in an annotation."*
 *   ANNOTATION  a span inside one plasmid saying "this feature is here". Mining turns annotations
 *               INTO features, because many annotations never reached the library.
 *
 * IDENTITY, ruled 2026-09-14, and all three cases occur in the real data:
 *   same name + same sequence        ONE feature. Deduped.
 *   same name + DIFFERENT sequence   a DEFECT. The name must be changed; never merged, and never
 *                                    picked between.
 *   different name + same sequence   TWO features, legitimately. `P_T7` and `T7 Universal` are
 *                                    the same 20 bp and both real.
 *
 * `Default_Features.txt` IS AN OUTPUT, NOT A DATASTORE — his words. It is regenerated from the
 * mined set so ApE can autoannotate; nothing reads it back as truth.
 *
 * THE PARSE IS `parseGenbank`'s, NOT THIS FILE'S. A regex over the FEATURES block recovered 193
 * of Cheese's features where the real parser recovers 244, because GenBank wraps qualifier values
 * onto unmarked continuation lines. A second parser here would be a slower way of being wrong.
 */
import { parseGenbank } from '../c6-server/parsers/genbank.js';
import { revcomp } from '../C6-Seq.js';

// Below this, a "feature" is a restriction site or a fragment of one and matches everywhere.
// JCA 2026-09-14: mine *"at least the ones >10 bp in length"*.
const MIN_FEATURE_LENGTH = 10;

const APE_TYPE_DEFAULT = 'misc_feature';
const APE_COLOR_DEFAULT = '#c6c9d1';

/**
 * Slice a GenBank location out of a sequence. Returns null when the location cannot be read —
 * never a guess, and never an empty string, which would index as a feature matching everything.
 *
 * Handles `123..456`, `complement(...)`, `join(a..b,c..d)` and the `<`/`>` partial markers.
 * Cross-entry references (`J00194.1:1..10`) return null and are reported.
 */
export function sliceLocation(sequence, location, isCircular = false) {
  if (!location) return null;
  let loc = String(location).trim();
  let complemented = false;
  const comp = loc.match(/^complement\((.*)\)$/);
  if (comp) { complemented = true; loc = comp[1].trim(); }
  const join = loc.match(/^(?:join|order)\((.*)\)$/);
  if (join) loc = join[1].trim();
  let out = '';
  for (const part of loc.split(',')) {
    const range = part.trim().match(/^<?(\d+)\.\.>?(\d+)$/);
    if (range) {
      const a = Number(range[1]), b = Number(range[2]);
      if (a < 1 || b > sequence.length) return null;
      if (a > b) {
        // AN ORIGIN-SPANNING FEATURE ON A CIRCULAR PLASMID. `complement(9854..298)` starts at
        // 9854, runs off the end, and continues from base 1 to 298 — it is not backwards and it
        // is not corrupt. Rejecting it lost six of Cheese's features, including `slp`, the
        // S-layer protein that pTRKH3-slpGFP is named after. On a LINEAR sequence the same
        // location has no meaning, so it is still refused there.
        if (!isCircular) return null;
        out += sequence.slice(a - 1) + sequence.slice(0, b);
        continue;
      }
      out += sequence.slice(a - 1, b);
      continue;
    }
    const point = part.trim().match(/^<?(\d+)>?$/);
    if (point) { out += sequence.slice(Number(point[1]) - 1, Number(point[1])); continue; }
    return null;
  }
  if (!out) return null;
  return complemented ? revcomp(out) : out;
}

/** A feature's name, from whichever qualifier carries it. */
function featureName(q) {
  for (const k of ['label', 'gene', 'product', 'locus_tag', 'note']) {
    const v = q[k];
    if (v && String(v).trim()) return String(v).trim();
  }
  return null;
}

/**
 * One annotated plasmid -> its features. { features, skipped }
 *
 * `skipped` carries every annotation that did NOT become a feature and why — too short, no name,
 * or a location that could not be read. Seven of Cheese's annotations had `complement(119..124}`
 * with a brace where a paren belongs, invisible to any conformant parser; returning the reason is
 * how that was found rather than silently losing them.
 */
export function mineFeatures(path, text) {
  const doc = parseGenbank(text);
  const sequence = (doc.data?.sequence || doc.sequence || '').toUpperCase();
  const isCircular = Boolean(doc.data?.isCircular ?? doc.isCircular);
  const annotations = doc.data?.features || doc.features || [];
  const features = [], skipped = [];
  for (const a of annotations) {
    const q = a.qualifiers || {};
    const name = featureName(q);
    const loc = q.location;
    if (!name) { skipped.push({ path, location: loc, why: 'no label, gene or product' }); continue; }
    const seq = sliceLocation(sequence, loc, isCircular);
    if (seq === null) { skipped.push({ path, name, location: loc, why: 'location could not be read' }); continue; }
    if (seq.length < MIN_FEATURE_LENGTH) {
      skipped.push({ path, name, location: loc, why: 'shorter than ' + MIN_FEATURE_LENGTH + ' bp' });
      continue;
    }
    features.push({
      name,
      sequence: seq.toUpperCase(),
      type: a.key || APE_TYPE_DEFAULT,
      color: q.ApEinfo_fwdcolor || q.ApEinfo_revcolor || '',
      source: { path, location: loc },
    });
  }
  return { features, skipped };
}

// The standard genetic code, for comparing two variants of one gene.
//
// WHY A CONFLICT REPORT TRANSLATES. Two DNA sequences under one name look "unrelated" to any
// substring test when the difference is synonymous: codon optimisation changes a base in most
// codons, so the longest identical run collapses to ~20bp while the PROTEIN is untouched. Cheese's
// ChiA/chiA are 1,483 and 1,479bp with a 23bp longest common run — and encode identical proteins
// over all 492 residues. Reported as "unrelated" they look like two genes; reported as identical
// proteins they are obviously one gene in two DNA versions.
//
// This DECIDES NOTHING. It is the fact a person needs to look at the conflict properly.
const CODONS = (() => {
  const bases = 'TCAG';
  const aas = 'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG';
  const map = {}; let i = 0;
  for (const a of bases) for (const b of bases) for (const c of bases) map[a + b + c] = aas[i++];
  return map;
})();

/** Translate from base 1, stopping nowhere; trailing stops are trimmed. */
export function translateDna(seq) {
  const s = String(seq).toUpperCase();
  let out = '';
  for (let i = 0; i + 2 < s.length; i += 3) out += CODONS[s.slice(i, i + 3)] ?? 'X';
  return out.replace(/\*+$/, '');
}

/** Identity between two translations, over the shorter one. null when either is not codeable. */
export function proteinIdentity(a, b) {
  const pa = translateDna(a), pb = translateDna(b);
  const n = Math.min(pa.length, pb.length);
  if (!n) return null;
  let same = 0;
  for (let i = 0; i < n; i++) if (pa[i] === pb[i]) same++;
  return { identity: same / n, lengths: [pa.length, pb.length], compared: n };
}

/**
 * Collapse mined features to the distinct set, and report names that must be renamed.
 *
 * Returns { features, conflicts }: one entry per distinct (name, sequence), and the names carrying
 * more than one sequence. Conflicts are REPORTED, never resolved — a rename is a change to
 * somebody's data and belongs to them.
 */
export function dedupeFeatures(all) {
  const byKey = new Map();
  for (const f of all) {
    const key = JSON.stringify([f.name, f.sequence]);
    if (!byKey.has(key)) byKey.set(key, { ...f, sources: [] });
    byKey.get(key).sources.push(f.source);
  }
  const features = [...byKey.values()].map(({ source, ...rest }) => rest);
  // CONFLICTS ARE FOUND CASE-INSENSITIVELY, and that is not pedantry. Cheese carries `ChiA` at
  // 1,483bp and `chiA` at 1,479bp — unrelated sequences — plus `ChiCW`/`chiCW` and
  // `Terminator`/`terminator` the same way. A case-sensitive check calls those four distinct
  // features and reports nothing, which is how they sat unnoticed through two passes. Nothing
  // downstream distinguishes names by case either: ApE does not, search does not, and neither
  // does a person reading a map.
  const byName = new Map();
  for (const f of features) {
    const k = f.name.toLowerCase();
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(f);
  }
  const conflicts = [];
  for (const [, fs] of byName) {
    const distinct = new Set(fs.map(f => f.sequence));
    if (distinct.size > 1) {
      const variants = [...distinct];
      let protein = null;
      if (variants.length === 2) {
        const p = proteinIdentity(variants[0], variants[1]);
        if (p) protein = p;
      }
      conflicts.push({
        name: fs[0].name,
        spellings: [...new Set(fs.map(f => f.name))],
        protein,
        variants: fs.map(f => ({ name: f.name, sequence: f.sequence, type: f.type, sources: f.sources }))
                    .sort((a, b) => b.sources.length - a.sources.length),
      });
    }
  }
  return { features, conflicts: conflicts.sort((a, b) => a.name.localeCompare(b.name)) };
}

/**
 * The ApE feature library format: eight tab-separated fields, no header.
 *
 *   name / sequence / type / fwd_colour / rev_colour / (empty) / 0 / (empty)
 *
 * Fields six to eight are near-constant across the 626 rows of a real library — field seven is
 * `0` throughout, six and eight are empty — so they are written as observed rather than invented.
 */
export function toApeLibrary(features) {
  return features.map(f => {
    const color = f.color || APE_COLOR_DEFAULT;
    return [f.name, f.sequence, f.type || APE_TYPE_DEFAULT, color, color, '', '0', ''].join('\t');
  }).join('\n') + '\n';
}

/** Read an existing ApE library. Same eight fields; rows that are not eight are reported. */
export function fromApeLibrary(text) {
  const features = [], skipped = [];
  String(text).split(/\r\n|\r|\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const c = line.split('\t');
    if (c.length < 4) {
      skipped.push({ line: i + 1, why: c.length + ' fields, expected 8', text: line.slice(0, 80) });
      return;
    }
    features.push({ name: c[0], sequence: (c[1] || '').toUpperCase(), type: c[2], color: c[3] });
  });
  return { features, skipped };
}

/**
 * Read a bare `name<TAB>sequence` file into features.
 *
 * A THIRD FORMAT, found in Cheese with no file extension at all:
 * `Experiments/Lactis2/Antifungal sequences` holds `ChiCW` at 2,039 bp and `Afp` at 279 bp.
 * It is not GenBank and it is not an oligo list — it is a named-sequence list, and the only thing
 * distinguishing it from the bare oligo dialect is that these are genes.
 *
 * No type and no colour are recorded in this format, so both are left absent rather than
 * invented; `toApeLibrary` supplies its defaults at write time, where that substitution is
 * visible.
 */
export function readNamedSequences(path, textOrBuffer) {
  const text = typeof textOrBuffer === 'string' ? textOrBuffer : textOrBuffer.toString('utf8');
  const features = [], skipped = [];
  text.split(/\r\n|\r|\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const c = line.split('\t').map(x => x.trim());
    const [name, sequence] = c;
    if (!name || !sequence || !/^[ACGTRYSWKMBDHVNacgtryswkmbdhvn]+$/.test(sequence)) {
      skipped.push({ path, line: i + 1, why: 'not name<TAB>sequence', text: line.slice(0, 80) });
      return;
    }
    if (sequence.length < MIN_FEATURE_LENGTH) {
      skipped.push({ path, line: i + 1, name, why: 'shorter than ' + MIN_FEATURE_LENGTH + ' bp' });
      return;
    }
    features.push({ name, sequence: sequence.toUpperCase(), type: '', color: '',
                    source: { path, line: i + 1 } });
  });
  return { features, skipped };
}
