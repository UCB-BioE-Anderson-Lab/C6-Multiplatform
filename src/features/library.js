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
import { stageOf, DNA_STAGE, PROTEIN_STAGE, RNA_STAGE, CLONING } from './ontology.js';
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
  [/\bori\b|origin|\bR6K|\bp15A|\bColE1|\bpMB1|\bpSC101|\bRSF\d*|\b2 ?micron|\bpUC\b|\bpBBR1\b|\bf1\b|\bM13 ori/i, 'rep_origin'],
  [/terminator|\bterm\b|\brrnB\b|\bBBa_B00\d\d|\bT7Te?\b|\blambda t0|\bt0\b|\bTrrnB|\bT1\b|\bT2\b/i, 'terminator'],
  [/\boperator\b|\blacO\b|\btetO\b|\baraO\b|\bluxbox|\blux box/i, 'operator'],
  [/promoter|^P[ _-]?(bad|tac|trc|lac|lacUV5|tet|T7|J23\d*|con|ara|rha|R|L|LtetO|LlacO|lux|sal|araBAD|rhaBAD|xyl)\b|^J231\d\d/i, 'promoter'],
  [/dbl ?term|term$/i, 'terminator'],
  [/\bloxP\b|\bFRT\b|\battB\b|\battP\b|\battL\b|\battR\b/i, 'misc_recomb'],
];

function isOrf(seq) {
  if (seq.length < 150 || seq.length % 3 !== 0) return false;
  if (!/^(ATG|GTG|TTG)/.test(seq)) return false;
  const p = translateDna(seq);
  return !p.slice(0, -1).includes('*');
}

const STAGED = new Set([...DNA_STAGE, ...PROTEIN_STAGE, ...RNA_STAGE, ...CLONING]);

/**
 * Give a feature a type the ontology can stage. A file type the ontology knows is kept; anything
 * else (misc_feature, and catch-alls like `regulatory`) is typed by name or, failing that, as an
 * ORF. Returns the type and how it was decided.
 */
export function retype(f) {
  if (STAGED.has(f.type)) return { type: f.type, typedBy: 'file' };
  for (const [re, type] of NAME_RULES) if (re.test(f.name)) return { type, typedBy: 'name' };
  const s = f.sequence;
  if (isOrf(s) || isOrf(revcomp(s))) return { type: 'CDS', typedBy: 'orf' };
  return { type: f.type || 'misc_feature', typedBy: null };
}

function mismatchCount(a, b, max) {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++n > max) return n;
  return n;
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
  // Group ids must be unique; two unrelated groups that share a top name get a suffix, and that
  // collision is itself worth reporting -- it is the same-name-different-sequence defect.
  const seen = new Map();
  const nameClashes = [];
  for (const g of groups.sort((a, b) => b.sources.length - a.sources.length || a.id.localeCompare(b.id))) {
    const k = g.id.toLowerCase();
    const n = (seen.get(k) || 0) + 1;
    seen.set(k, n);
    if (n > 1) { nameClashes.push(g.id); g.id = `${g.id} #${n}`; }
  }
  return { groups: groups.sort((a, b) => a.id.localeCompare(b.id)), nameClashes: [...new Set(nameClashes)].sort() };
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
