/**
 * Write a Polynucleotide back out as GenBank, and rebuild a plasmid map cleanly.
 *
 * C6 COULD READ GENBANK AND NOT WRITE IT. `parseGenbank` has existed since the server work; there
 * was no serialiser anywhere in the toolkit, which is why every "clean up a map" idea until now
 * ended in editing the original text. This is the missing half.
 *
 * JCA 2026-09-14: *"Let's clear the features on them when parsing, and autoannotate and fix the
 * feature order nicely. You can make the colors pretty too (and consistent) if you want. We want
 * really clean plasmid maps."*
 *
 * So `rebuild` is deliberately destructive about annotations and nothing else: the SEQUENCE is
 * never touched, and every feature is thrown away and re-derived from the library. That is the
 * only way the maps become consistent with each other — an annotation kept because it was already
 * there is an annotation nobody can account for.
 */
import { annotateSequence } from '../C6-Annotator.js';

const WIDTH = 60;          // ORIGIN block: 6 groups of 10, as every GenBank writer emits
const GROUP = 10;

/**
 * A colour per feature TYPE, so a map reads at a glance and two maps agree.
 *
 * COLOURING BY TYPE RATHER THAN BY FEATURE IS A CHOICE, and it trades something away: ApE's own
 * libraries colour per feature, so one plasmid's amilGFP is whatever colour somebody picked that
 * day. Per-type means every promoter is the same green in every map — which is the consistency
 * that makes a shelf of maps comparable, at the cost of the per-feature identity that was never
 * consistent anyway.
 */
export const TYPE_COLORS = {
  promoter:      '#8fd18f',
  terminator:    '#d98f8f',
  CDS:           '#8fb8d9',
  gene:          '#8fb8d9',
  exon:          '#a8c7e0',
  RBS:           '#f0c987',
  rep_origin:    '#c9c9c9',
  primer_bind:   '#9fdede',
  primer:        '#9fdede',
  protein_bind:  '#c9a8d9',
  misc_recomb:   '#d9b38f',
  mobile_element:'#bfa8a8',
  misc_feature:  '#dcdcdc',
};
export const DEFAULT_COLOR = '#dcdcdc';

// The library's own floor, repeated here because `rebuild` decides what falls below it.
const MIN_LIBRARY_LENGTH = 10;

/**
 * Is this annotation a restriction site? JCA 2026-09-14: *"We don't need the restriction sites.
 * Keep oligo binding sites, particularly ca998 and g00101. Certainly all functional
 * annotations."*
 *
 * Classified by the NAME rather than a table, because C6's own enzyme list is internal to the
 * simulator and holds fourteen — Cheese's maps cite MfeI and HindIII, neither of which is in it.
 * Restriction enzymes are named to a convention: a three-letter genus/species stem, an OPTIONAL
 * strain letter, then a Roman numeral, optionally with ApE's `(n)` disambiguator. The strain
 * letter is the part a first attempt leaves out, and it is not rare — `HindIII` is Hin + d + III
 * and `BseRI` is Bse + R + I, so both were missed until it was added. `EcoRI`, `MfeI`, `XbaI`.
 *
 * LENGTH IS REQUIRED AS WELL, so a gene that happens to be named like an enzyme is not discarded:
 * a recognition site is 4-8 bases and a CDS is not. Both conditions, never either.
 */
const REASE_NAME = /^[A-Z][a-z]{2}[A-Za-z]?[IVX]+(\(\d+\))?$/;
export const isRestrictionSite = (name, length) =>
  REASE_NAME.test(String(name).trim()) && length >= 2 && length <= 8;

export const colorFor = (type) => TYPE_COLORS[type] || TYPE_COLORS[String(type)] || DEFAULT_COLOR;

/** `123..456`, or `complement(...)`, or an origin-spanning `9854..298` on a circular map. */
function locationOf(f, length) {
  const start = f.start + 1;
  const end = f.end;
  const span = end > length ? `${start}..${end - length}` : `${start}..${end}`;
  return f.strand === -1 ? `complement(${span})` : span;
}

/**
 * Serialise to GenBank.
 *
 * Emits `/label`, `/ApEinfo_fwdcolor` and `/ApEinfo_revcolor` so ApE opens the result coloured —
 * those three are what `mineFeatures` reads back, so a map written here round-trips through the
 * miner without loss.
 */
export function toGenbank({ name, sequence, isCircular = true, features = [], date }) {
  const seq = String(sequence || '').toUpperCase();
  // GenBank months are exactly three letters. toLocaleDateString gives "SEPT" for September in
  // en-GB, which is four and which strict parsers reject.
  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const d = new Date();
  const when = date || `${String(d.getDate()).padStart(2, '0')}-${MONTHS[d.getMonth()]}-${d.getFullYear()}`;
  const out = [];
  out.push(`LOCUS       ${String(name).padEnd(24)}${String(seq.length).padStart(7)} bp    DNA     ` +
           `${isCircular ? 'circular' : 'linear  '} SYN ${when}`);
  out.push(`DEFINITION  ${name}`);
  out.push(`ACCESSION   ${name}`);
  out.push('VERSION     .');
  out.push('KEYWORDS    .');
  out.push('SOURCE      synthetic DNA construct');
  out.push('  ORGANISM  synthetic DNA construct');
  out.push('FEATURES             Location/Qualifiers');
  for (const f of features) {
    const color = f.color || colorFor(f.type);
    out.push(`     ${String(f.type || 'misc_feature').padEnd(16)}${locationOf(f, seq.length)}`);
    out.push(`                     /label="${f.label || f.name}"`);
    out.push(`                     /ApEinfo_fwdcolor="${color}"`);
    out.push(`                     /ApEinfo_revcolor="${color}"`);
  }
  out.push('ORIGIN');
  for (let i = 0; i < seq.length; i += WIDTH) {
    const line = seq.slice(i, i + WIDTH).toLowerCase();
    const groups = [];
    for (let j = 0; j < line.length; j += GROUP) groups.push(line.slice(j, j + GROUP));
    out.push(`${String(i + 1).padStart(9)} ${groups.join(' ')}`);
  }
  out.push('//');
  return out.join('\n') + '\n';
}

/**
 * Annotate a sequence against a feature library, including across the origin.
 *
 * `annotateSequence` scans a linear string, so on a circular plasmid it cannot see a feature that
 * runs off the end and continues at base 1 — the same blind spot that cost six of Cheese's
 * features when `sliceLocation` refused those locations. Here the sequence is extended by the
 * longest feature before scanning, and hits that begin beyond the real end are dropped as
 * duplicates of themselves.
 */
export function annotateCircular(sequence, featureDb, isCircular = true) {
  const seq = String(sequence).toUpperCase();
  const longest = featureDb.reduce((n, f) => Math.max(n, (f.Sequence || '').length), 0);
  const scan = isCircular && longest > 1 ? seq + seq.slice(0, Math.min(longest - 1, seq.length)) : seq;
  const hits = annotateSequence(scan, featureDb).filter(h => h.start < seq.length);
  const seen = new Set();
  const out = [];
  for (const h of hits) {
    const key = `${h.start}:${h.end}:${h.strand}:${h.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

/**
 * ORDER, and it is not simply by start position.
 *
 * Sorting by start alone scatters a CDS between the two halves of the promoter that contains it.
 * Start ascending, then LONGEST first, puts a containing feature immediately before everything
 * inside it — which is how a map reads when you open it, and how every published GenBank orders
 * its FEATURES block.
 */
export const byPosition = (a, b) =>
  a.start - b.start || (b.end - b.start) - (a.end - a.start) || String(a.label).localeCompare(String(b.label));

/**
 * Clear a map's annotations and rebuild them from the library.
 *
 * Returns { text, features, dropped } — `dropped` being the labels the original carried that the
 * rebuild did NOT recover, which is the check that matters: a feature the library does not know
 * disappears silently otherwise.
 */
export function rebuild({ name, sequence, isCircular, original = [] }, featureDb, opts = {}) {
  const length = String(sequence).length;

  // WHAT THE LIBRARY CANNOT RECOVER, AND SO MUST BE CARRIED. JCA 2026-09-14: *"We don't need the
  // restriction sites. Keep oligo binding sites, particularly ca998 and g00101. Certainly all
  // functional annotations."*
  //
  // An annotation shorter than the library's 10bp floor is a POSITIONAL fact, not a sequence one:
  // a 6bp RBS pattern occurs dozens of times in an 8kb plasmid, so re-deriving it would annotate
  // noise. Clearing and re-annotating therefore cannot preserve it — it has to be carried at its
  // original coordinates or lost. Twelve RBS annotations and a TSS in Cheese are exactly this.
  //
  // Restriction sites are the deliberate exception: short, recomputable by any tool, and not
  // wanted. They are dropped rather than carried.
  const carried = original.filter(f =>
    f.length < MIN_LIBRARY_LENGTH && !isRestrictionSite(f.label, f.length));
  const droppedSites = original.filter(f => isRestrictionSite(f.label, f.length));

  const found = annotateCircular(sequence, featureDb, isCircular);
  const features = [...found, ...carried]
    .map(f => ({ ...f, color: opts.keepColors && f.color ? f.color : colorFor(f.type) }))
    .sort(byPosition);

  const recovered = new Set(features.map(f => f.label));
  const dropped = [...new Set(original
    .filter(f => !recovered.has(f.label) && !isRestrictionSite(f.label, f.length))
    .map(f => f.label))];

  return {
    text: toGenbank({ name, sequence, isCircular, features, date: opts.date }),
    features, carried, dropped,
    droppedSites: [...new Set(droppedSites.map(f => f.label))],
  };
}
