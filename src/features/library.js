// library.js - one feature library, aggregated from the lab's own annotated sequences
//
// WHY THIS EXISTS. JCA, 2026-10-29: *"for right now we are mainly concerned about converting the
// existing data so the primar repo the igem repos etc and documenting all the features of those
// experiments in a format that this thing can you know aggregate all the features from all these
// things and use that as the library for doing Auto annotation and then functional prediction."*
// Default_Features.txt was one hand-kept file; the features actually used live as annotations in
// a few hundred GenBank/ApE files spread over many repositories. This harvests them, keeps where
// each came from, and groups them.
//
// THE UNIT IS THE EQUIVALENCE GROUP, not the row. JCA, same thread: identifying feature elements
// within a sequence *"as equivalence groups"*. A group is one reference sequence plus its known
// variants: the same sequence under several names (aliases), and sequences that differ from the
// reference by a few substitutions or by trimmed ends (variants). Grouping DECIDES NOTHING about
// which is "right" -- the reference is simply the member seen in the most files.
//
// TYPES ARE GUESSED FROM NAMES ONLY WHERE THE FILE SAID NOTHING. A misc_feature has no stage, so
// the inference step cannot see it; `retype` gives it one by name or, for an open reading frame,
// by translation. Every retype records `typedBy` so a guess never reads as a fact.
//
// WHAT IS NOT HERE YET, deliberately empty rather than invented: `story` (the document a person
// would read to interpret the part -- pBAD needs AraC and arabinose) and `dependencies` (R6K
// needs pir). Those are the inference step's, and are slots until somebody fills them.

import fs from 'fs';
import path from 'path';
import { mineFeatures, fromApeLibrary, canonicalSequence, translateDna } from './mine.js';
import { stageOf, DNA_STAGE, PROTEIN_STAGE, RNA_STAGE, CLONING, ANNOTATION_TYPES, NOT_A_FEATURE } from './ontology.js';
import { revcomp } from '../C6-Seq.js';

const SEQUENCE_FILE = /\.(gb|gbk|genbank|ape)$/i;
const SKIP_DIR = new Set(['.git', 'node_modules']);

// The fraction of a group member that may differ from its reference: the same bound the tolerant
// matcher uses, so a known variant is exactly what the matcher would have called a variant.
const VARIANT_FRACTION = 0.05;
// A trimmed copy (a promoter cut 5 bp short) joins its parent's group when it covers this much
// of it.
const CONTAINED_FRACTION = 0.9;
const MIN_GROUP_LENGTH = 20;

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (SKIP_DIR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (SEQUENCE_FILE.test(e.name)) out.push(p);
  }
  return out;
}

/** The experiment a file belongs to: the folder under `Experiments/`, else its top folder. */
export function experimentOf(rel) {
  const parts = rel.split(path.sep);
  const i = parts.findIndex(p => /^experiments?$/i.test(p));
  if (i >= 0 && parts.length > i + 2) return parts[i + 1];
  return parts.length > 1 ? parts[0] : null;
}

/**
 * Harvest every annotation from every sequence file under each repository root, and every row of
 * any ApE feature library (`feature_libs/**\/*Features*.txt`). Repositories are READ, never
 * written. Returns raw features, each with `source: { repo, path, experiment, location }`, plus
 * everything skipped and why.
 */
export function harvest(roots) {
  const features = [], skipped = [], files = [];
  for (const root of roots) {
    const repo = path.basename(root);
    if (!fs.existsSync(root)) { skipped.push({ repo, why: 'repository not found at ' + root }); continue; }
    for (const file of walk(root)) {
      const rel = path.relative(root, file);
      let mined;
      try { mined = mineFeatures(rel, fs.readFileSync(file, 'utf8')); }
      catch (err) { skipped.push({ repo, path: rel, why: 'could not parse: ' + err.message.slice(0, 80) }); continue; }
      files.push({ repo, path: rel, features: mined.features.length });
      for (const f of mined.features) {
        features.push({ ...f, source: { repo, path: rel, experiment: experimentOf(rel), location: f.source.location } });
      }
      for (const s of mined.skipped) skipped.push({ repo, ...s });
    }
    const libDir = path.join(root, 'feature_libs');
    if (fs.existsSync(libDir)) {
      const libs = fs.readdirSync(libDir, { recursive: true }).map(p => path.join(libDir, p))
        .filter(p => /features[^/]*\.txt$/i.test(p));
      for (const file of libs) {
        const rel = path.relative(root, file);
        const lib = fromApeLibrary(fs.readFileSync(file, 'utf8'));
        files.push({ repo, path: rel, features: lib.features.length });
        for (const f of lib.features) {
          if (!/^[ACGTRYSWKMBDHVN]+$/.test(f.sequence) || f.sequence.length < 10) {
            skipped.push({ repo, path: rel, name: f.name, why: 'not a usable DNA sequence of 10 bp or more' });
            continue;
          }
          features.push({ ...f, source: { repo, path: rel, experiment: null, location: null } });
        }
        for (const s of lib.skipped) skipped.push({ repo, path: rel, ...s });
      }
    }
  }
  return { features, skipped, files };
}

// Name rules for features the file left as misc_feature. Ordered; first match wins. Kept narrow on
// purpose: a wrong type is worse than none, because inference trusts it.
const NAME_RULES = [
  [/\boriT\b/i, 'oriT'],
  [/\bori\b|origin|\boriV\b|\bR6K|\bp15A|\bColE1|\bpMB1|\bpSC101|\bRSF\d*|\b2 ?micron|\bpUC\b|\bpBBR1\b|\bf1\b|\bM13 ori/i, 'rep_origin'],
  [/terminator|\bterm\b|\brrnB\b|\bBBa_B00\d\d|\bT7Te?\b|\blambda t0|\bt0\b|\bTrrnB|\bTrnpB|\bT1\b|\bT2\b/i, 'terminator'],
  [/\boperator\b|\blacO\b|\btetO\b|\baraO\b|\bluxbox|\blux box/i, 'operator'],
  [/promoter|^P[ _-]?(bad|tac|trc|lac|lacUV5|tet|T7|J23\d*|con|ara|rha|R|L|RM|LtetO|LlacO|lux|sal|araBAD|rhaBAD|xyl)\b|\bP_(R|L|RM)\b|^J231\d\d/i, 'promoter'],
  [/dbl ?term|term$/i, 'terminator'],
  [/\bloxP\b|\bFRT\b|\batt[BPLR]\d*\b|-att\b/i, 'misc_recomb'],
  // A partition site is the DNA its partition protein binds (sopC by SopB).
  [/\bsopC\b|\bparS\b/i, 'protein_bind'],
  // Primer and assembly landmarks, in vitro: cloning ontology, never a feature.
  [/^bind_(for|rev)\b|\banneal\b|^forPCR$|^lig (for|rev)$|^oDel\d+$|\bbp upstream\b|^\+\d+ bp\b|^Region [A-Z]$|^pBRforEco$/i, 'primer_bind'],
  [/^(NotI|PstI|BamHI|EcoRI|XbaI|SpeI|XhoI|NcoI|NdeI|HindIII|KpnI|SacI|SalI|BsaI|BsmBI|BbsI|Bbs1|BseRI)\b/, 'restriction_site'],
];

function isOrf(seq) {
  if (seq.length < 150 || seq.length % 3 !== 0) return false;
  if (!/^(ATG|GTG|TTG)/.test(seq)) return false;
  const p = translateDna(seq);
  return !p.slice(0, -1).includes('*');
}

const STAGED = new Set([...DNA_STAGE, ...PROTEIN_STAGE, ...RNA_STAGE, ...CLONING, ...ANNOTATION_TYPES]);

/**
 * Give a feature a type the ontology can stage. A file type the ontology knows is kept; anything
 * else (misc_feature, and catch-alls like `regulatory`) is typed by name or, failing that, as an
 * ORF. A name the ontology already calls an annotation (a spacer, a linker, a tag) keeps its file
 * type and is marked typed by name: its stage is decided, which is what inference needs. Returns
 * the type and how it was decided.
 */
export function retype(f) {
  if (STAGED.has(f.type)) return { type: f.type, typedBy: 'file' };
  for (const [re, type] of NAME_RULES) if (re.test(f.name)) return { type, typedBy: 'name' };
  if (NOT_A_FEATURE.some(re => re.test(f.name))) return { type: f.type || 'misc_feature', typedBy: 'name' };
  const s = f.sequence;
  if (isOrf(s) || isOrf(revcomp(s))) return { type: 'CDS', typedBy: 'orf' };
  return { type: f.type || 'misc_feature', typedBy: null };
}

function mismatchCount(a, b, max) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++n > max) return n;
  return n;
}

// SAME NAME IS EVIDENCE, so two entries a person called the same thing join on a looser test than
// strangers do: 80% identity at equal length, or 80% of the shorter one's 12-mers found in the
// longer (either strand), which catches a part re-cut a few bases longer at one end or offset
// (AmpR promoter 105 vs 92 bp, the 13 bp J231xx core inside its 36 bp context). Below that, the
// name is the coincidence -- `CDS`, `DNA polymerase`, `+20 bp` -- and the groups stay apart.
const SAME_NAME_IDENTITY = 0.8;
const SAME_NAME_COVERED = 0.8;
const SAME_NAME_MIN_LENGTH = 0.5;

// Both strands' k-mers of a sequence, kept for the length of one group() call: 1,012 entries are
// all called `hypothetical protein`, and rebuilding the set per pair took five minutes.
let kmerCache = new Map();
function kmers(seq, k) {
  const key = k + ':' + seq;
  if (!kmerCache.has(key)) {
    const have = new Set();
    for (const s of [seq, revcomp(seq)]) for (let i = 0; i + k <= s.length; i++) have.add(s.slice(i, i + k));
    kmerCache.set(key, have);
  }
  return kmerCache.get(key);
}

function kmerCovered(short, long) {
  const k = Math.min(12, short.length);
  const have = kmers(long, k);
  let n = 0, total = 0;
  for (let i = 0; i + k <= short.length; i++, total++) if (have.has(short.slice(i, i + k))) n++;
  return total ? n / total : 0;
}

/** How two same-named entries are the same part, or null when they are not. */
export function sameNameRelation(a, b) {
  if (a.length === b.length) {
    const max = Math.floor(a.length * (1 - SAME_NAME_IDENTITY));
    const n = Math.min(mismatchCount(a.sequence, b.sequence, max), mismatchCount(revcomp(a.sequence), b.sequence, max));
    if (n <= max) return { kind: 'same-name substitution', mismatches: n };
  }
  const [s, l] = a.length <= b.length ? [a, b] : [b, a];
  // A sliver is not the part, whatever it is called: `KnR no RS` 102 bp is not KnR 816 bp.
  if (s.length < l.length * SAME_NAME_MIN_LENGTH) return null;
  const covered = kmerCovered(s.sequence, l.sequence);
  if (covered >= SAME_NAME_COVERED) return { kind: 'same-name overlap', covered: Math.round(covered * 100) / 100, lengthDifference: l.length - s.length };
  return null;
}

/**
 * Collapse identical sequences into one entry (all names kept), then gather near-identical entries
 * into equivalence groups. Identity is by `canonicalSequence`, so a feature and its reverse
 * complement are the same thing.
 */
export function group(raw) {
  // 1. identical sequence -> one entry
  const bySeq = new Map();
  for (const f of raw) {
    const key = canonicalSequence(f.sequence);
    if (!bySeq.has(key)) bySeq.set(key, { sequence: key, names: new Map(), types: new Map(), color: '', sources: [] });
    const e = bySeq.get(key);
    e.names.set(f.name, (e.names.get(f.name) || 0) + 1);
    e.types.set(f.type, (e.types.get(f.type) || 0) + 1);
    if (!e.color && f.color) e.color = f.color;
    e.sources.push(f.source);
  }
  const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
  const entries = [...bySeq.values()].map(e => {
    const name = top(e.names);
    const fileType = [...e.types.keys()].find(t => STAGED.has(t)) || top(e.types);
    const { type, typedBy } = retype({ name, type: fileType, sequence: e.sequence });
    return {
      name, aliases: [...e.names.keys()].filter(n => n !== name).sort(),
      sequence: e.sequence, length: e.sequence.length, type, typedBy, color: e.color,
      sources: e.sources,
    };
  });

  // 2. near-identical -> one group. Union-find over (equal length, few substitutions, either
  // strand) and (one contained in the other, covering most of it).
  const parent = entries.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  const order = entries.map((e, i) => i).filter(i => entries[i].length >= MIN_GROUP_LENGTH)
    .sort((a, b) => entries[a].length - entries[b].length);
  const how = new Map();
  for (let x = 0; x < order.length; x++) {
    const a = entries[order[x]];
    const ra = revcomp(a.sequence);
    for (let y = x + 1; y < order.length; y++) {
      const b = entries[order[y]];
      if (a.length < b.length * CONTAINED_FRACTION) break;
      let rel = null;
      if (a.length === b.length) {
        const max = Math.floor(a.length * VARIANT_FRACTION);
        const n = Math.min(mismatchCount(a.sequence, b.sequence, max), mismatchCount(ra, b.sequence, max));
        if (n <= max) rel = { kind: 'substitution', mismatches: n };
      } else if (b.sequence.includes(a.sequence) || b.sequence.includes(ra)) {
        rel = { kind: 'trimmed', lengthDifference: b.length - a.length };
      }
      if (rel) {
        union(order[x], order[y]);
        how.set(order[x] + ':' + order[y], rel); how.set(order[y] + ':' + order[x], rel);
      }
    }
  }

  // 3. same name, related sequence -> one group (see SAME NAME IS EVIDENCE above).
  const byName = new Map();
  entries.forEach((e, i) => {
    const k = e.name.toLowerCase();
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(i);
  });
  let nameMerges = 0;
  kmerCache = new Map();
  for (const idx of byName.values()) {
    for (let x = 0; x < idx.length; x++) for (let y = x + 1; y < idx.length; y++) {
      const [i, j] = [idx[x], idx[y]];
      if (find(i) === find(j)) continue;
      const rel = sameNameRelation(entries[i], entries[j]);
      if (rel) { union(i, j); how.set(i + ':' + j, rel); how.set(j + ':' + i, rel); nameMerges++; }
    }
  }
  kmerCache = new Map();

  const byRoot = new Map();
  entries.forEach((e, i) => {
    const r = find(i);
    if (!byRoot.has(r)) byRoot.set(r, []);
    byRoot.get(r).push(i);
  });
  const groups = [];
  for (const members of byRoot.values()) {
    members.sort((i, j) => entries[j].sources.length - entries[i].sources.length || entries[j].length - entries[i].length);
    const ref = entries[members[0]];
    const typed = members.map(i => entries[i]).find(e => e.typedBy === 'file')
      || members.map(i => entries[i]).find(e => e.typedBy) || ref;
    const g = {
      id: ref.name,
      type: typed.type, typedBy: typed.typedBy,
      stage: null,
      reference: { name: ref.name, aliases: ref.aliases, sequence: ref.sequence, length: ref.length, color: ref.color },
      variants: members.slice(1).map(i => {
        const e = entries[i];
        // null when the member joined through another variant rather than the reference itself.
        const rel = how.get(members[0] + ':' + i) || null;
        return { name: e.name, aliases: e.aliases, sequence: e.sequence, length: e.length, relation: rel, sources: e.sources.length };
      }),
      sources: members.flatMap(i => entries[i].sources),
      story: null,
      dependencies: [],
    };
    g.stage = stageOf({ name: g.id, type: g.type });
    groups.push(g);
  }
  // Group ids must be unique. Same-named groups still apart after step 3 are different parts under
  // one name: the most-seen keeps the bare name and the rest are told apart by what tells them
  // apart -- length, then the experiment (or repo) they came from, then a counter as a last resort.
  // Each clash is reported with the ids it became; it is the same-name-different-part defect.
  const taken = new Set();
  const clashes = new Map();
  for (const g of groups.sort((a, b) => b.sources.length - a.sources.length || a.id.localeCompare(b.id))) {
    const name = g.id;
    const where = g.sources[0] ? (g.sources[0].experiment || g.sources[0].repo) : null;
    const candidates = [name, `${name} [${g.reference.length} bp]`];
    if (where) candidates.push(`${name} [${g.reference.length} bp, ${where}]`);
    let id = candidates.find(c => !taken.has(c.toLowerCase()));
    for (let n = 2; !id; n++) if (!taken.has(`${candidates.at(-1)} #${n}`.toLowerCase())) id = `${candidates.at(-1)} #${n}`;
    taken.add(id.toLowerCase());
    g.id = id;
    const k = name.toLowerCase();
    if (!clashes.has(k)) clashes.set(k, { name, ids: [] });
    clashes.get(k).ids.push(id);
  }
  const nameClashes = [...clashes.values()].filter(c => c.ids.length > 1).sort((a, b) => a.name.localeCompare(b.name));
  return { groups: groups.sort((a, b) => a.id.localeCompare(b.id)), nameClashes, nameMerges };
}

/** The library as rows `annotateTolerant` reads: every group member, each tagged with its group. */
export function toFeatureDb(groups, { stages = null } = {}) {
  const rows = [];
  for (const g of groups) {
    if (stages && !stages.includes(g.stage)) continue;
    const members = [{ ...g.reference, variant: false }, ...g.variants.map(v => ({ ...v, variant: true }))];
    for (const m of members) {
      rows.push({ Name: m.name, Sequence: m.sequence, Type: g.type, Color: g.reference.color || '', group: g.id, knownVariant: m.variant });
    }
  }
  return rows;
}
