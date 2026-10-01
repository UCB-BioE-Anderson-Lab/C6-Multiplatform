/**
 * Lay out a DNA for the `dna.view` view: every number, position and coordinate it will draw.
 *
 * THE VIEW DRAWS; THIS DECIDES. A C11 view is a pure `render(payload) -> markup` and MUST NOT
 * compute (C11 § 7.7), so everything a person reads off the page — a feature's coordinates, a
 * length, where a tick falls, which strand a phosphate is on — is worked out here, once. The view
 * turns these coordinates into SVG and nothing else, so there is one answer rather than two.
 *
 * ZOOM IS A NEW REQUEST, NOT A SCRIPT. A view cannot lay anything out, so zooming in on a region
 * means asking this producer again with `--region a..b`. Every link on the page (zoom, pan,
 * jump to a feature, change level) carries the full argument set for that request; the view
 * only turns it into a query string. That is also what lets C11 point at something: it runs
 * `show dna.view --arg sequence=... --arg region=12..17 --arg mark="BsaI site=12..17"`.
 *
 * FOUR LEVELS OF DETAIL, chosen from the span shown unless `--level` names one:
 *   circular   a whole circular molecule as a ring map
 *   linear     a ruler with features as arrows, for any span
 *   sequence   both strands as letters, 60 to a row, with the features over them
 *   molecule   a flat ladder: sugar-phosphate backbones, paired bases with their hydrogen bonds,
 *              5' and 3' ends with the chemistry C6 records at each (phos5, hydroxyl, or not
 *              stated), and single-stranded overhangs from `ext5` / `ext3`
 *
 * ABSENCE IS DRAWN (§ 7.5, § 7.6). A file that could not be read gives `status: "unreadable"`
 * and no drawing at all, never an empty map. Features are `annotated`, `none_annotated` (the
 * format could carry them and this file has none), or `not_carried` (FASTA, a bare sequence: the
 * input cannot say) — three different things a reader must not confuse.
 */
import { colorOf } from '../features/colors.js';

export const LEVELS = ['circular', 'linear', 'sequence', 'molecule'];
const LEVEL_LABEL = {
  circular: 'Circular map', linear: 'Linear map', sequence: 'Sequence', molecule: 'Molecule',
};
// The widest span each level can draw legibly. Above these a level is offered as unavailable.
const LEVEL_MAX_SPAN = { molecule: 150, sequence: 3000 };
// Auto level: below MOLECULE_AUTO the ladder, below SEQUENCE_AUTO the letters.
const MOLECULE_AUTO = 80;
const SEQUENCE_AUTO = 1200;
// The feature table lists at most this many rows; a genome has thousands, and a table nobody can
// scroll is no better than none. The page says how many were left out.
const TABLE_MAX = 200;
// Overlapping features stack in lanes; past this many the last lane takes the rest, overdrawn,
// rather than the ring shrinking to nothing. Said in a note when it happens.
const MAX_LANES = 4;

const COMPLEMENT = {
  A: 'T', T: 'A', U: 'A', G: 'C', C: 'G', R: 'Y', Y: 'R', S: 'S', W: 'W', K: 'M', M: 'K',
  B: 'V', V: 'B', D: 'H', H: 'D', N: 'N',
};

const r1 = (n) => Math.round(n * 10) / 10;
const fmt = (n) => n.toLocaleString('en-US');
const bp = (n, rna) => `${fmt(n)} ${rna ? 'nt' : 'bp'}`;
const complement = (b, rna) => {
  const c = COMPLEMENT[b] || 'N';
  return rna && c === 'T' ? 'U' : c;
};

// ---------------------------------------------------------------------------------------------
// Feature locations
// ---------------------------------------------------------------------------------------------

/**
 * A GenBank location -> { spans: [{start, end}], strand } or null when it cannot be read.
 *
 * A span on a circular molecule that runs through the origin (`2600..50`) is kept as ONE span
 * with `end > length`, so it is drawn as one arc rather than two pieces.
 */
export function parseLocation(location, length, isCircular) {
  let loc = String(location || '').replace(/\s+/g, '');
  let strand = 1;
  const comp = loc.match(/^complement\((.*)\)$/);
  if (comp) { strand = -1; loc = comp[1]; }
  const join = loc.match(/^(?:join|order)\((.*)\)$/);
  if (join) loc = join[1];
  const spans = [];
  for (const raw of loc.split(',')) {
    let part = raw;
    const inner = part.match(/^complement\((.*)\)$/);
    if (inner) { strand = -1; part = inner[1]; }
    const range = part.match(/^<?(\d+)\.\.>?(\d+)$/);
    const point = part.match(/^<?(\d+)>?$/);
    let a, b;
    if (range) { a = Number(range[1]); b = Number(range[2]); }
    else if (point) { a = b = Number(point[1]); }
    else return null;
    if (a < 1 || b < 1 || a > length || b > length) return null;
    if (a > b) {
      if (!isCircular) return null;
      b += length;
    }
    spans.push({ start: a, end: b });
  }
  return spans.length ? { spans, strand } : null;
}

function featureName(q) {
  for (const k of ['label', 'gene', 'product', 'locus_tag', 'note']) {
    if (q[k] && String(q[k]).trim()) return String(q[k]).trim();
  }
  return null;
}

/**
 * Parsed GenBank features -> { items, skipped }. `source` is dropped: it spans the whole record
 * and says what the record is, not what is in it. An annotation that cannot be placed is
 * returned in `skipped` with the reason, never silently lost.
 */
export function normaliseFeatures(raw, length, isCircular) {
  const items = [], skipped = [];
  for (const f of raw || []) {
    if (f.key === 'source') continue;
    const q = f.qualifiers || {};
    const name = featureName(q) || f.key;
    const where = parseLocation(q.location, length, isCircular);
    if (!where) {
      skipped.push({ name, location: String(q.location || ''), why: 'location could not be read' });
      continue;
    }
    const apeColor = where.strand === -1 ? q.ApEinfo_revcolor : q.ApEinfo_fwdcolor;
    const { color, why } = apeColor && /^#[0-9a-f]{6}$/i.test(apeColor)
      ? { color: apeColor, why: 'the file\'s own ApE colour' }
      : colorOf({ name, type: f.key });
    items.push({ name, type: f.key, location: q.location, ...where, color, why });
  }
  // A GENE RECORD SITTING EXACTLY UNDER ITS PRODUCT IS ONE THING DRAWN TWICE. NCBI writes a `gene`
  // and a `CDS` (or tRNA, rRNA...) with the same name, span and strand for nearly every locus:
  // MG1655 carries 4,651 genes and 4,318 CDSs. Drawn as two arrows they double every lane for no
  // information, so the gene is folded into its product and the count is reported.
  const key = (f) => `${f.name}|${f.strand}|${f.spans.map((x) => `${x.start}..${x.end}`).join(',')}`;
  const products = new Set(items.filter((f) => f.type !== 'gene').map(key));
  const kept = items.filter((f) => f.type !== 'gene' || !products.has(key(f)));
  return { items: kept, skipped, folded: items.length - kept.length };
}

// ---------------------------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------------------------

/** "a..b" -> {start, end} within 1..length, or a string saying what is wrong. */
export function parseRegion(text, length) {
  const m = String(text).replace(/[,_\s]/g, '').match(/^(\d+)(?:\.\.|-)(\d+)$/);
  if (!m) return `region "${text}" is not of the form start..end`;
  const start = Number(m[1]), end = Number(m[2]);
  if (start < 1 || end > length || start > end) {
    return `region ${start}..${end} is outside 1..${length}, or runs backwards`;
  }
  return { start, end };
}

/** "label=a..b;c..d" -> [{label, start, end}], or a string saying what is wrong. */
export function parseMarks(text, length) {
  const out = [];
  for (const part of String(text).split(';').map((s) => s.trim()).filter(Boolean)) {
    const eq = part.lastIndexOf('=');
    const label = eq >= 0 ? part.slice(0, eq).trim() : '';
    const reg = parseRegion(eq >= 0 ? part.slice(eq + 1) : part, length);
    if (typeof reg === 'string') return `mark "${part}": ${reg}`;
    out.push({ label, ...reg });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// The payload
// ---------------------------------------------------------------------------------------------

/**
 * A molecule (from `readSource`) and the request -> the payload `dna.view` draws.
 *
 * `mol` is either `{ status: 'unreadable', problem, source, name }` or the molecule:
 * `{ name, description, source, sequence, ext5, ext3, mod5, mod3, isCircular, isDoubleStranded,
 *    isRNA, featureStatus, rawFeatures, notes }`.
 * `args` are the producer's own arguments, so every link can repeat them with one change.
 */
export function layout(mol, args = {}) {
  const base = { ...args };
  delete base.region; delete base.level;
  const shell = {
    name: mol.name || 'unnamed',
    description: mol.description || '',
    source: mol.source,
    read_files: mol.read_files || [],
  };
  if (mol.status === 'unreadable') {
    return {
      ...shell, status: 'unreadable', problem: mol.problem, molecule: null, region: null,
      level: null, levels: [], nav: [], features: { status: 'not_read', items: [], skipped: [] },
      marks: [], notes: [], drawing: null,
    };
  }

  const seq = mol.sequence;
  const length = seq.length;
  const rna = Boolean(mol.isRNA);
  const ds = Boolean(mol.isDoubleStranded);
  const circular = Boolean(mol.isCircular);
  const notes = [...(mol.notes || [])];

  const { items, skipped, folded } = mol.featureStatus === 'not_carried'
    ? { items: [], skipped: [], folded: 0 }
    : normaliseFeatures(mol.rawFeatures, length, circular);
  if (folded) notes.push(`${fmt(folded)} gene records sit exactly under a product (CDS, tRNA, rRNA…) of the same name and span; each pair is drawn and listed once, as the product.`);
  const featureStatus = mol.featureStatus === 'not_carried' ? 'not_carried'
    : items.length ? 'annotated' : 'none_annotated';

  const moleculeInfo = {
    length, length_label: bp(length, rna),
    topology: circular ? 'circular' : 'linear',
    strands: ds ? 'double' : 'single',
    polymer: rna ? 'RNA' : 'DNA',
    ends: endsOf(mol),
  };
  const link = (extra) => ({ ...base, ...extra });

  const featureRow = (f) => {
    const first = f.spans[0].start;
    const last = f.spans[f.spans.length - 1].end;
    const len = f.spans.reduce((n, s) => n + s.end - s.start + 1, 0);
    const wraps = last > length;
    const pad = Math.max(5, Math.round((last - first + 1) * 0.1));
    return {
      name: f.name, type: f.type, color: f.color, color_why: f.why,
      location_label: f.spans.map((s) => s.end > length
        ? `${fmt(s.start)}..${fmt(s.end - length)}` : `${fmt(s.start)}..${fmt(s.end)}`).join(', '),
      strand_label: f.strand === -1 ? 'reverse' : 'forward',
      length_label: bp(len, rna),
      // A feature through the origin has no single a..b region to zoom to; it is drawn on the
      // ring and listed, and the table says why it has no link.
      args: wraps ? null : link({ region: `${Math.max(1, first - pad)}..${Math.min(length, last + pad)}` }),
    };
  };
  /** The table: features overlapping the stretch, in order, at most TABLE_MAX of them. */
  const table = (region, isWhole) => {
    const inside = items.filter((f) => f.spans.some((sp) => sp.start <= region.end && sp.end >= region.start))
      .sort((p, q) => p.spans[0].start - q.spans[0].start);
    const where = isWhole ? 'in this molecule' : 'in this stretch';
    return {
      items: inside.slice(0, TABLE_MAX).map(featureRow),
      table_note: inside.length > TABLE_MAX
        ? `Listing the first ${fmt(TABLE_MAX)} of ${fmt(inside.length)} features ${where}, by position. Zoom in to list the rest.`
        : !isWhole && inside.length < items.length ? `${fmt(inside.length)} of ${fmt(items.length)} features fall in this stretch.` : null,
    };
  };
  const featureRows = table({ start: 1, end: length }, true);

  const result = {
    ...shell, status: 'drawn', problem: null, molecule: moleculeInfo,
    features: { status: featureStatus, total: items.length, ...featureRows, skipped },
    notes,
  };

  // The request: region, marks, level. A bad one is drawn as a refusal with a way back.
  const whole = { start: 1, end: length };
  let region = whole;
  if (args.region) {
    const r = parseRegion(args.region, length);
    if (typeof r === 'string') return badRequest(result, r, link({}));
    region = r;
  }
  let marks = [];
  if (args.mark) {
    const m = parseMarks(args.mark, length);
    if (typeof m === 'string') return badRequest(result, m, link({}));
    marks = m;
  }
  const span = region.end - region.start + 1;
  const isWhole = span === length;
  const available = (lvl) => lvl === 'circular' ? isWhole && circular
    : lvl === 'linear' ? true : span <= LEVEL_MAX_SPAN[lvl];
  let level = args.level;
  if (level !== undefined && !LEVELS.includes(level)) {
    return badRequest(result, `level "${level}" is not one of ${LEVELS.join(', ')}`, link({}));
  }
  if (level && !available(level)) {
    return badRequest(result, `${LEVEL_LABEL[level]} cannot draw ${bp(span, rna)}`
      + (level === 'circular' ? ': it draws only a whole circular molecule'
        : `: it draws at most ${bp(LEVEL_MAX_SPAN[level], rna)}. Pick a region first`), link({}));
  }
  if (!level) {
    level = span <= MOLECULE_AUTO ? 'molecule' : span <= SEQUENCE_AUTO ? 'sequence'
      : isWhole && circular ? 'circular' : 'linear';
  }

  Object.assign(result.features, table(region, isWhole));
  const regionArg = isWhole ? {} : { region: `${region.start}..${region.end}` };
  result.region = {
    start: region.start, end: region.end, whole: isWhole,
    label: isWhole ? `whole molecule, ${bp(length, rna)}`
      : `${fmt(region.start)}..${fmt(region.end)} (${bp(span, rna)} of ${bp(length, rna)})`,
  };
  result.level = level;
  result.levels = LEVELS.map((l) => ({
    level: l, label: LEVEL_LABEL[l], current: l === level, available: available(l),
    args: available(l) ? link({ ...regionArg, level: l }) : null,
  }));
  result.nav = navigation(region, length, link, rna);
  result.marks = marks.map((m) => ({
    label: m.label, location_label: `${fmt(m.start)}..${fmt(m.end)}`,
    args: link({ region: `${m.start}..${m.end}` }),
  }));

  const ctx = { mol, seq, length, rna, ds, circular, region, isWhole, features: items, marks, link };
  result.drawing = level === 'circular' ? drawCircular(ctx)
    : level === 'linear' ? drawLinear(ctx)
      : level === 'sequence' ? drawSequence(ctx)
        : drawMolecule(ctx);
  if (!ds && (mol.ext5 || mol.ext3)) {
    notes.push('ext5/ext3 describe overhangs between two strands; a single strand has none, so they are not drawn.');
  }
  return result;
}

function badRequest(result, problem, wholeArgs) {
  return {
    ...result, status: 'bad_request', problem, region: null, level: null, levels: [],
    nav: [{ label: 'Whole molecule', args: wholeArgs }], marks: [], drawing: null,
  };
}

/** What each end of the molecule is, in words, for the summary line. */
function endsOf(mol) {
  if (mol.isCircular) return null;
  const chem = (mod) => mod === 'phos5' ? "5′ phosphate" : mod === 'hydroxyl' ? "5′ hydroxyl"
    : mod ? `5′ ${mod}` : "5′ end chemistry not stated";
  const over = (ext, side) => {
    if (!ext || !mol.isDoubleStranded) return 'blunt';
    const three = ext.startsWith('-');
    const bases = ext.replace('-', '');
    return `${bases.length}-nt ${three ? "3′" : "5′"} overhang ${bases}`;
  };
  return {
    left: { overhang: mol.isDoubleStranded ? over(mol.ext5, 'left') : 'single strand', chemistry: chem(mol.mod5) },
    right: { overhang: mol.isDoubleStranded ? over(mol.ext3, 'right') : 'single strand',
      chemistry: mol.isDoubleStranded ? chem(mol.mod3) : "3′ end" },
  };
}

function navigation(region, length, link, rna) {
  const span = region.end - region.start + 1;
  const centre = Math.round((region.start + region.end) / 2);
  const window = (w) => {
    if (w >= length) return null;
    let a = centre - Math.floor(w / 2);
    a = Math.max(1, Math.min(a, length - w + 1));
    return `${a}..${a + w - 1}`;
  };
  const shift = (d) => {
    const a = Math.max(1, Math.min(region.start + d, length - span + 1));
    return a === region.start ? null : `${a}..${a + span - 1}`;
  };
  const nav = [];
  const whole = span === length;
  if (!whole) nav.push({ label: 'Whole molecule', args: link({}) });
  const out = window(span * 3);
  if (!whole) nav.push({ label: `Zoom out (${bp(Math.min(length, span * 3), rna)})`, args: link(out ? { region: out } : {}) });
  const inner = Math.max(10, Math.floor(span / 3));
  if (inner < span) nav.push({ label: `Zoom in (${bp(inner, rna)})`, args: link({ region: window(inner) }) });
  const left = shift(-Math.ceil(span / 2));
  const right = shift(Math.ceil(span / 2));
  if (left) nav.push({ label: '← Left', args: link({ region: left }) });
  if (right) nav.push({ label: 'Right →', args: link({ region: right }) });
  return nav;
}

/** Tick spacing: 1, 2 or 5 × 10^k, giving about `target` ticks. */
function tickStep(span, target) {
  const raw = span / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}

/** Greedy lanes: each item goes in the first lane where it overlaps nothing. */
function assignLanes(items, lo, hi, maxLanes = Infinity) {
  const lanes = [];
  return items.map((it) => {
    let k = 0;
    while (k < maxLanes - 1 && lanes[k] && lanes[k].some(([a, b]) => lo(it) <= b && a <= hi(it))) k++;
    (lanes[k] = lanes[k] || []).push([lo(it), hi(it)]);
    return k;
  });
}

const textWidth = (s, px = 12) => s.length * px * 0.6;

// ---------------------------------------------------------------------------------------------
// Circular map
// ---------------------------------------------------------------------------------------------

function drawCircular({ seq, length, rna, ds, features, marks, mol, link }) {
  const W = 760, H = 640, cx = 380, cy = 320, R = 200;
  const ang = (pos) => ((pos - 1) / length) * 2 * Math.PI;
  const pt = (pos, r) => [r1(cx + r * Math.sin(ang(pos))), r1(cy - r * Math.cos(ang(pos)))];
  const arcPoints = (a, b, r) => {
    const n = Math.max(2, Math.ceil(((b - a) / length) * 180));
    return Array.from({ length: n + 1 }, (_, i) => pt(a + ((b - a) * i) / n, r));
  };

  const step = tickStep(length, 8);
  const ticks = [];
  for (let p = step; p < length; p += step) {
    const [x1, y1] = pt(p, R + 6), [x2, y2] = pt(p, R + 14), [lx, ly] = pt(p, R + 28);
    const a = ang(p);
    ticks.push({ x1, y1, x2, y2, label: fmt(p), lx, ly,
      anchor: Math.sin(a) > 0.2 ? 'start' : Math.sin(a) < -0.2 ? 'end' : 'middle' });
  }

  // Below half a degree a feature is widened to it, so a 17-bp primer site stays visible on a
  // plasmid; on a genome every gene is below it and they tile the ring, which is the truth.
  const minBp = (length * 0.5) / 360;
  const widen = (a, b) => (b - a + 1 >= minBp ? [a, b] : [(a + b) / 2 - minBp / 2, (a + b) / 2 + minBp / 2]);
  const sorted = features.map((f, i) => {
    const [a, b] = widen(f.spans[0].start, f.spans.at(-1).end);
    return { f, i, a, b };
  })
    .sort((p, q) => (q.b - q.a) - (p.b - p.a));
  const lanes = assignLanes(sorted, (s) => s.a, (s) => s.b, MAX_LANES);
  const TH = 14, GAP = 6;
  const drawn = sorted.map((s, k) => {
    const lane = lanes[k];
    const rOut = R - 12 - lane * (TH + GAP), rIn = rOut - TH, rMid = rOut - TH / 2;
    const headBp = Math.min((s.b - s.a + 1) * 0.4, (12 / (2 * Math.PI * rMid)) * length);
    const fwd = s.f.strand !== -1;
    const bodyA = fwd ? s.a : s.a + headBp, bodyB = fwd ? s.b + 1 - headBp : s.b + 1;
    const points = [...arcPoints(bodyA, bodyB, rOut)];
    if (fwd) points.push(pt(s.b + 1, rMid));
    points.push(...arcPoints(bodyA, bodyB, rIn).reverse());
    if (!fwd) points.push(pt(s.a, rMid));
    const mid = (s.a + s.b + 1) / 2;
    return { f: s.f, i: s.i, points, mid, rOut };
  });

  // Labels outside the ring, pushed apart vertically on each side so none overlap. Only a feature
  // of at least a degree is labelled, and only as many per side as fit down the canvas, biggest
  // first: a genome has thousands, and a label nobody can read is not information.
  const LABELS_PER_SIDE = 26;
  const labelled = new Set();
  for (const side of [true, false]) {
    drawn.filter((d) => Math.sin(ang(d.mid)) >= 0 === side && ((d.f.spans.at(-1).end - d.f.spans[0].start + 1) / length) * 360 >= 1)
      .sort((p, q) => (q.f.spans.at(-1).end - q.f.spans[0].start) - (p.f.spans.at(-1).end - p.f.spans[0].start))
      .slice(0, LABELS_PER_SIDE).forEach((d) => labelled.add(d));
  }
  const labels = drawn.filter((d) => labelled.has(d)).map((d) => {
    const [ex, ey] = pt(d.mid, d.rOut);
    const [lx, ly] = pt(d.mid, R + 52);
    return { d, ex, ey, lx, ly, right: Math.sin(ang(d.mid)) >= 0 };
  });
  for (const side of [true, false]) {
    const group = labels.filter((l) => l.right === side).sort((p, q) => p.ly - q.ly);
    for (let i = 1; i < group.length; i++) {
      if (group[i].ly - group[i - 1].ly < 16) group[i].ly = group[i - 1].ly + 16;
    }
  }

  const stacked = lanes.filter((k) => k === MAX_LANES - 1).length;
  const captions = [];
  if (drawn.length > labelled.size) {
    captions.push(`${fmt(drawn.length - labelled.size)} of ${fmt(drawn.length)} features are too small to label at this scale. Zoom in, or use the table.`);
  }
  if (stacked && lanes.some((k) => k === MAX_LANES - 1) && sorted.length > MAX_LANES) {
    captions.push(`Overlapping features stack ${MAX_LANES} deep; any deeper are drawn over the innermost lane.`);
  }
  return {
    kind: 'circular', width: W, height: H, caption: captions.join(' ') || null,
    rings: (ds ? [R, R - 5] : [R]).map((r) => ({ cx, cy, r })),
    centre: { x: cx, y: cy, lines: [mol.name || 'unnamed', `${bp(length, rna)} · circular`] },
    ticks,
    origin: { x1: cx, y1: cy - R - 6, x2: cx, y2: cy - R + 11, label: '1', lx: cx, ly: cy - R - 12 },
    features: drawn.map((d) => ({
      name: d.f.name, color: d.f.color, points: d.points,
      args: d.f.spans.at(-1).end > length ? null : link({ region: zoomAround(d.f, length) }),
    })),
    labels: labels.map((l) => ({
      text: l.d.f.name, x: r1(l.lx + (l.right ? 4 : -4)), y: r1(l.ly), anchor: l.right ? 'start' : 'end',
      leader: { x1: l.ex, y1: l.ey, x2: r1(l.lx), y2: r1(l.ly - 4) },
    })),
    marks: marks.map((m) => widen(m.start, m.end)).map(([a, b], i) => ({ ...marks[i], start: a, end: b })).map((m) => ({
      label: m.label, points: [...arcPoints(m.start, m.end + 1, R + 4), ...arcPoints(m.start, m.end + 1, R - 9).reverse()],
      lx: pt((m.start + m.end) / 2, R + 40)[0], ly: pt((m.start + m.end) / 2, R + 40)[1],
    })),
  };
}

function zoomAround(f, length) {
  const a = f.spans[0].start, b = f.spans.at(-1).end;
  const pad = Math.max(5, Math.round((b - a + 1) * 0.1));
  return `${Math.max(1, a - pad)}..${Math.min(length, b + pad)}`;
}

// ---------------------------------------------------------------------------------------------
// Linear map
// ---------------------------------------------------------------------------------------------

function drawLinear({ length, rna, ds, circular, region, isWhole, features, marks, link }) {
  const W = 1000, L = 40, Rm = 40;
  const span = region.end - region.start + 1;
  const scale = (W - L - Rm) / span;
  const x = (pos) => r1(L + (pos - region.start) * scale);
  const visible = [];
  for (const f of features) {
    for (const s of f.spans) {
      const a = Math.max(s.start, region.start), b = Math.min(s.end, region.end);
      if (a <= b) visible.push({ f, a, b, clipA: a > s.start, clipB: b < s.end });
    }
  }
  const TH = 14, LANE = 34;
  // Label a feature only if it is at least 10 px wide, and at most the 60 widest: at genome scale
  // every gene is a sliver, and thousands of overlapping names are not a map.
  const width = (v) => x(v.b + 1) - x(v.a);
  const labelled = new Set(visible.filter((v) => width(v) >= 10).sort((p, q) => width(q) - width(p)).slice(0, 60));
  const lo = (v) => (labelled.has(v) ? Math.min(x(v.a), (x(v.a) + x(v.b + 1)) / 2 - textWidth(v.f.name) / 2) : x(v.a));
  const hi = (v) => (labelled.has(v) ? Math.max(x(v.b + 1), (x(v.a) + x(v.b + 1)) / 2 + textWidth(v.f.name) / 2) + 6 : x(v.b + 1) + 2);
  const groups = [visible.filter((v) => v.f.strand !== -1), visible.filter((v) => v.f.strand === -1)];
  const laneSets = groups.map((g) => assignLanes(g, lo, hi, MAX_LANES));
  const count = (ls) => (ls.length ? Math.max(...ls) + 1 : 0);
  const backboneY = 40 + LANE * Math.max(1, count(laneSets[0])) + 10;
  const drawnFeatures = [];
  groups.forEach((group, gi) => {
    group.forEach((v, k) => {
      const top = gi === 0 ? backboneY - 22 - laneSets[gi][k] * LANE - TH : backboneY + 22 + laneSets[gi][k] * LANE;
      drawnFeatures.push(arrow(v, x(v.a), Math.max(x(v.b + 1), x(v.a) + 2), top, TH, link, length, gi === 1, labelled.has(v)));
    });
  });
  const below = count(laneSets[1]);
  const unlabelled = visible.length - labelled.size;
  const rulerY = backboneY + 22 + below * LANE + 14;
  const step = tickStep(span, 10);
  const ticks = [];
  for (let p = Math.ceil(region.start / step) * step; p <= region.end; p += step) {
    if (p < 1) continue;
    ticks.push({ x: x(p), y1: rulerY, y2: rulerY + 6, label: fmt(p), ly: rulerY + 20 });
  }
  const y2 = ds ? backboneY + 5 : null;
  return {
    kind: 'linear', width: W, height: rulerY + 34,
    caption: unlabelled ? `${fmt(unlabelled)} of ${fmt(visible.length)} features here are too small to label at this scale. Zoom in, or use the table.` : null,
    backbone: [{ x1: x(region.start), x2: x(region.end + 1), y: backboneY },
      ...(ds ? [{ x1: x(region.start), x2: x(region.end + 1), y: y2 }] : [])],
    ruler: { x1: x(region.start), x2: x(region.end + 1), y: rulerY },
    ticks,
    ends: [
      endMark(region.start === 1, circular, 'left', x(region.start), backboneY),
      endMark(region.end === length, circular, 'right', x(region.end + 1), backboneY),
    ],
    features: drawnFeatures,
    marks: marks.filter((m) => m.end >= region.start && m.start <= region.end).map((m) => ({
      label: m.label, x: x(Math.max(m.start, region.start)),
      // At least 3 px, so a 3-bp mark in a 10-kb window is still somewhere to look.
      w: Math.max(3, r1(x(Math.min(m.end, region.end) + 1) - x(Math.max(m.start, region.start)))),
      y: 18, h: rulerY - 18, ly: 14,
    })),
  };
}


/** What one end of the drawn stretch is: a real end of the molecule, or the molecule going on. */
function endMark(isEnd, circular, side, x, y) {
  if (isEnd && !circular) return { x, y, side, text: side === 'left' ? "5′" : "3′", kind: 'terminus' };
  return { x, y, side, text: side === 'left' ? '…' : '…', kind: 'continues' };
}

/** A feature arrow between x0 and x1, its head cut off where the feature runs past the view. */
function arrow(v, x0, x1, top, th, link, length, labelBelow = false, labelled = true) {
  const fwd = v.f.strand !== -1;
  const head = Math.min(10, (x1 - x0) * 0.5);
  const mid = r1(top + th / 2), bot = r1(top + th);
  let points;
  if (fwd && !v.clipB) points = [[x0, top], [r1(x1 - head), top], [x1, mid], [r1(x1 - head), bot], [x0, bot]];
  else if (!fwd && !v.clipA) points = [[r1(x0 + head), top], [x1, top], [x1, bot], [r1(x0 + head), bot], [x0, mid]];
  else points = [[x0, top], [x1, top], [x1, bot], [x0, bot]];
  const w = x1 - x0;
  const inside = textWidth(v.f.name, 11) + 8 < w;
  return {
    name: v.f.name, color: v.f.color, points,
    label: labelled ? { text: v.f.name, x: r1((x0 + x1) / 2),
      y: inside ? r1(top + th - 3.5) : labelBelow ? r1(top + th + 12) : r1(top - 4), inside } : null,
    args: v.f.spans.at(-1).end > length ? null : link({ region: zoomAround(v.f, length) }),
  };
}

// ---------------------------------------------------------------------------------------------
// Columns: what sits at each position of both strands, overhangs included
// ---------------------------------------------------------------------------------------------

/**
 * The drawn stretch as columns `{ top, bottom, pos }`. `top`/`bottom` is a base letter or null
 * where that strand is absent. `pos` is the 1-based position in `sequence`, or null for an
 * overhang base, which lies outside `sequence` (C6 keeps sticky ends in ext5/ext3).
 *
 * C6's convention, from `cutOnce` in C6-Sim.js: an extension is written in top-strand sense; no
 * sign is a 5' overhang and a leading '-' a 3' overhang. So at the LEFT end a 5' overhang is the
 * top strand protruding and a 3' overhang the bottom; at the RIGHT end it is the other way round.
 * Overhangs are drawn only when the stretch reaches that end of a linear double strand.
 */
export function columnsOf(mol, region) {
  const rna = Boolean(mol.isRNA), ds = Boolean(mol.isDoubleStranded);
  const seq = mol.sequence;
  const cols = [];
  const ext = (e) => (e ? e.replace('-', '').toUpperCase() : '');
  const linearDs = ds && !mol.isCircular;
  if (linearDs && region.start === 1 && mol.ext5) {
    const five = !mol.ext5.startsWith('-');
    for (const c of ext(mol.ext5)) cols.push(five ? { top: c, bottom: null, pos: null } : { top: null, bottom: complement(c, rna), pos: null });
  }
  for (let p = region.start; p <= region.end; p++) {
    const b = seq[p - 1];
    cols.push({ top: b, bottom: ds ? complement(b, rna) : null, pos: p });
  }
  if (linearDs && region.end === seq.length && mol.ext3) {
    const five = !mol.ext3.startsWith('-');
    for (const c of ext(mol.ext3)) cols.push(five ? { top: null, bottom: complement(c, rna), pos: null } : { top: c, bottom: null, pos: null });
  }
  return cols;
}

// ---------------------------------------------------------------------------------------------
// Sequence: both strands as letters, in rows
// ---------------------------------------------------------------------------------------------

function drawSequence({ mol, length, ds, circular, region, features, marks }) {
  const PER_ROW = 60, CW = 14, L = 70, W = L + PER_ROW * CW + 70;
  const cols = columnsOf(mol, region);
  const rows = [];
  let y = 10;
  for (let i = 0; i < cols.length; i += PER_ROW) {
    const chunk = cols.slice(i, i + PER_ROW);
    const xOf = (k) => r1(L + k * CW);
    // Features over this row, by column index.
    const segs = [];
    for (const f of features) {
      for (const s of f.spans) {
        let k0 = -1, k1 = -1;
        chunk.forEach((c, k) => {
          if (c.pos !== null && c.pos >= s.start && c.pos <= s.end) { if (k0 < 0) k0 = k; k1 = k; }
        });
        if (k0 >= 0) segs.push({ f, k0, k1, clipA: chunk[k0].pos > s.start, clipB: chunk[k1].pos < s.end });
      }
    }
    const fwd = segs.filter((s) => s.f.strand !== -1), rev = segs.filter((s) => s.f.strand === -1);
    const laneOf = (g) => assignLanes(g, (s) => s.k0, (s) => Math.max(s.k1, s.k0 + Math.ceil(textWidth(s.f.name, 11) / CW)));
    const lf = laneOf(fwd), lr = laneOf(rev);
    const nf = fwd.length ? Math.max(...lf) + 1 : 0, nr = rev.length ? Math.max(...lr) + 1 : 0;
    const LANE = 30;
    const topY = y + nf * LANE + 18;
    const botY = topY + 18;
    const drawn = [];
    fwd.forEach((s, k) => drawn.push(rowArrow(s, xOf(s.k0), xOf(s.k1 + 1), topY - 18 - lf[k] * LANE)));
    rev.forEach((s, k) => drawn.push(rowArrow(s, xOf(s.k0), xOf(s.k1 + 1), (ds ? botY : topY) + 10 + lr[k] * LANE, true)));
    const posIn = chunk.filter((c) => c.pos !== null);
    const markRects = marks.flatMap((m) => {
      const ks = chunk.map((c, k) => (c.pos !== null && c.pos >= m.start && c.pos <= m.end ? k : -1)).filter((k) => k >= 0);
      return ks.length ? [{ label: m.label, x: xOf(ks[0]), w: r1((ks.at(-1) - ks[0] + 1) * CW), y: topY - 13, h: ds ? 36 : 18 }] : [];
    });
    rows.push({
      left_label: posIn.length ? fmt(posIn[0].pos) : '', right_label: posIn.length ? fmt(posIn.at(-1).pos) : '',
      label_y: topY, right_x: r1(L + chunk.length * CW + 8),
      top: { text: chunk.map((c) => c.top || ' ').join(''), x: L, y: topY, width: r1(chunk.length * CW) },
      bottom: ds ? { text: chunk.map((c) => c.bottom || ' ').join(''), x: L, y: botY, width: r1(chunk.length * CW) } : null,
      features: drawn, marks: markRects,
    });
    y = (ds ? botY : topY) + 10 + nr * LANE + 22;
  }
  return {
    kind: 'sequence', width: W, height: y, label_x: L - 10,
    strand_note: ds ? "top strand 5′→3′, bottom strand 3′←5′ beneath it" : "single strand, 5′→3′",
    ends: {
      left: region.start === 1 && !circular ? "5′" : '…',
      right: region.end === length && !circular ? "3′" : '…',
    },
    rows,
  };
}

function rowArrow(s, x0, x1, top, below = false) {
  return arrow({ f: s.f, clipA: s.clipA, clipB: s.clipB }, x0, x1, r1(top), 12, () => null, Infinity, below);
}

// ---------------------------------------------------------------------------------------------
// Molecule: the flat ladder
// ---------------------------------------------------------------------------------------------

const HBONDS = { 'A:T': 2, 'T:A': 2, 'A:U': 2, 'U:A': 2, 'G:C': 3, 'C:G': 3 };

function pentagon(x, y, s) {
  return Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return [r1(x + s * Math.cos(a)), r1(y + s * Math.sin(a))];
  });
}

function drawMolecule({ mol, length, rna, ds, circular, region, features, marks }) {
  const cols = columnsOf(mol, region);
  const DX = 30, L = 120;
  const W = L + cols.length * DX + 90;
  const nf = features.length ? 1 : 0;
  const FEAT = 26;
  const RULER = 22 + nf * FEAT;
  const top = { sugar: RULER + 34, base: RULER + 68 };
  const bot = { base: RULER + 108, sugar: RULER + 142 };
  const x = (k) => r1(L + k * DX + DX / 2);

  const strand = (which) => {
    const isTop = which === 'top';
    const y = isTop ? top : bot;
    const present = cols.map((c, k) => (c[which] ? k : -1)).filter((k) => k >= 0);
    if (!present.length) return null;
    const first = present[0], last = present.at(-1);
    const nts = present.map((k) => ({
      sugar: pentagon(x(k), y.sugar, 8), glyco: { x1: x(k), y1: r1(y.sugar + (isTop ? 8 : -8)), x2: x(k), y2: r1(y.base + (isTop ? -11 : 11)) },
      base: { x: r1(x(k) - 10), y: r1(y.base - 11), w: 20, h: 22, letter: cols[k][which], tx: x(k), ty: r1(y.base + 5) },
    }));
    // Phosphates link neighbouring sugars. Top runs 5'->3' left to right, so the phosphate of a
    // nucleotide is on its LEFT; bottom runs 5'->3' right to left, so its phosphate is on its RIGHT.
    const phosphates = [];
    const backbone = [];
    for (let i = 1; i < present.length; i++) {
      const xa = x(present[i - 1]), xb = x(present[i]);
      backbone.push({ x1: xa, y1: y.sugar, x2: xb, y2: y.sugar });
      phosphates.push({ x: r1((xa + xb) / 2), y: y.sugar });
    }
    // The two ends of this strand within the drawing.
    const fivePrimeAtLeft = isTop;
    const atMoleculeEnd = (side) => {
      if (circular) return false;
      if (side === 'left') return region.start === 1;
      return region.end === length;
    };
    const ends = ['left', 'right'].map((side) => {
      const k = side === 'left' ? first : last;
      const xx = x(k);
      const outward = side === 'left' ? -1 : 1;
      const isFive = (side === 'left') === fivePrimeAtLeft;
      if (!atMoleculeEnd(side)) {
        return { kind: 'continues', side, x1: xx, x2: r1(xx + outward * DX * 0.9), y: y.sugar,
          text: side === 'left' ? `… ${fmt(region.start === 1 ? length : region.start - 1)}`
            : `${fmt(region.end === length ? 1 : region.end + 1)} …`,
          tx: r1(xx + outward * DX * 1.1), ty: r1(y.sugar + 4), anchor: side === 'left' ? 'end' : 'start' };
      }
      const prime = isFive ? "5′" : "3′";
      let chem, kind;
      if (!isFive && !ds && side === 'right' && mol.mod3) { chem = mol.mod3; kind = 'modification'; }
      else if (!isFive) { chem = 'OH'; kind = 'hydroxyl'; }
      else {
        const mod = ds ? (side === 'left' ? mol.mod5 : mol.mod3) : mol.mod5;
        if (mod === 'phos5') { chem = 'P'; kind = 'phosphate'; }
        else if (mod === 'hydroxyl') { chem = 'OH'; kind = 'hydroxyl'; }
        else if (mod) { chem = mod; kind = 'modification'; }
        else { chem = '?'; kind = 'not_stated'; }
      }
      const gx = r1(xx + outward * DX * 0.62);
      return { kind, side, prime, chem, x1: xx, x2: gx, y: y.sugar,
        gx, gy: y.sugar, px: r1(xx + outward * DX * 1.25), py: r1(y.sugar + (isTop ? -14 : 24)),
        anchor: side === 'left' ? 'end' : 'start',
        title: kind === 'phosphate' ? `${prime} phosphate` : kind === 'hydroxyl' ? `${prime} hydroxyl`
          : kind === 'not_stated' ? `${prime} end chemistry not stated in this record` : `${prime} ${chem}` };
    });
    return {
      which, direction: isTop ? "5′→3′" : "3′←5′", label_x: 8, label_y: r1(y.sugar + 4),
      nucleotides: nts, phosphates, backbone, ends,
    };
  };

  const pairs = [];
  cols.forEach((c, k) => {
    if (!c.top || !c.bottom) return;
    const n = HBONDS[`${c.top}:${c.bottom}`] || 0;
    const xs = n === 3 ? [-5, 0, 5] : n === 2 ? [-3, 3] : [];
    xs.forEach((dx) => pairs.push({ x: r1(x(k) + dx), y1: r1(top.base + 12), y2: r1(bot.base - 12) }));
  });

  const ruler = [];
  cols.forEach((c, k) => {
    if (c.pos !== null && (c.pos === region.start || c.pos % 10 === 0)) ruler.push({ x: x(k), y: 14, label: fmt(c.pos) });
  });
  const overhangs = [];
  let k = 0;
  while (k < cols.length) {
    if (cols[k].pos === null) {
      let j = k;
      while (j + 1 < cols.length && cols[j + 1].pos === null) j++;
      overhangs.push({ x: r1(L + k * DX), w: (j - k + 1) * DX, y: r1(top.sugar - 14), h: r1(bot.sugar - top.sugar + 28),
        label: `${j - k + 1}-nt overhang` });
      k = j + 1;
    } else k++;
  }

  const featureBars = [];
  for (const f of features) {
    for (const s of f.spans) {
      const ks = cols.map((c, i) => (c.pos !== null && c.pos >= s.start && c.pos <= s.end ? i : -1)).filter((i) => i >= 0);
      if (!ks.length) continue;
      featureBars.push(arrow({ f, clipA: cols[ks[0]].pos > s.start, clipB: cols[ks.at(-1)].pos < s.end },
        r1(L + ks[0] * DX), r1(L + (ks.at(-1) + 1) * DX), 26, 14, () => null, Infinity));
    }
  }
  const markRects = marks.flatMap((m) => {
    const ks = cols.map((c, i) => (c.pos !== null && c.pos >= m.start && c.pos <= m.end ? i : -1)).filter((i) => i >= 0);
    return ks.length ? [{ label: m.label, x: r1(L + ks[0] * DX), w: (ks.at(-1) - ks[0] + 1) * DX,
      y: r1(top.sugar - 16), h: r1(bot.sugar - top.sugar + 32), ly: r1(bot.sugar + 34) }] : [];
  });

  return {
    kind: 'molecule', width: W, height: r1(bot.sugar + (marks.length ? 52 : 36)),
    sugar_name: rna ? 'ribose' : 'deoxyribose',
    strands: [strand('top'), ds ? strand('bottom') : null].filter(Boolean),
    pairs, ruler, overhangs, features: featureBars, marks: markRects,
  };
}
