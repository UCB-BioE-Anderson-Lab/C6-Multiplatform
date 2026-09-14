/**
 * Read an oligo file into oligo records, per `sharables/oligo.schema.json`.
 *
 * A record is a POINTER, not a copy: it carries `source: {path, line}` and is parsed on demand,
 * so nothing stored can drift from the file. JCA 2026-09-14: *"Cortex should just be pointing to
 * the original file and parse into this dynamically."*
 *
 * THE SERIALISATION IS THE IDT BULK ORDER FORM — tab-separated `name, sequence, scale,
 * purification`, no header — and two older dialects survive beside it. Measured over 3,088 rows
 * in 110 files across six repos:
 *
 *     name  seq  description          1,933   the lab's standing catalogue
 *     name  seq  scale  purification    807   the IDT order form
 *     name  seq                         348   bare
 *
 * DIALECT IS DECIDED PER ROW, NEVER PER FILE, and that is not a nicety: three files carry both
 * forms — `Oligos-pBET2.txt` has bet007/bet008 with scale and purification and ce007/ce008
 * without, four lines apart. A per-file sniff is the obvious design and is silently wrong there,
 * writing a scale onto rows that sit beside rows stating one.
 *
 * WHAT IS GUESSED IS DECLARED. Old files carry no scale or purification; the house standard is
 * 25nm/STD (25nm on 726 of 809 rows that state it, STD on all 809), so those are filled in — and
 * every filled-in field is listed in `assumed`. An inferred value that reads like a recorded one
 * is the failure this whole exercise keeps finding in other places.
 *
 * NOT HANDLED, ON PURPOSE:
 *   - oPool order forms (`*_order_IDT.xlsx`). JCA: *"oligopools are not oligos. They are
 *     different type because they are all mixed together."* One tube, everything mixed, no member
 *     that can be pipetted. Read as oligos they yield 181 records all called Tlib3, each claiming
 *     to be something you could fetch.
 *   - Certificates of analysis (`Idt_coa.txt`) — delivered yield, no sequence.
 *   Both are refused by `isOligoFile`, not silently mis-parsed.
 */

/**
 * Decode a file's bytes to text, honouring a byte-order mark.
 *
 * THESE FILES ARE NOT ALL UTF-8 AND ASSUMING SO LOSES DATA SILENTLY. `nisK and nisR seq
 * oligos.txt` in Cheese is UTF-16LE with CRLF — saved out of a Windows editor — and read as UTF-8
 * every one of its six oligos vanishes: the null bytes between characters break the sequence
 * pattern, so each row is rejected as "not an oligo row" and the file yields nothing. No error, no
 * empty file, just six oligos that quietly do not exist. Found on the reader's first run over
 * Cheese, by the `skipped` list that exists for exactly this.
 *
 * Callers should pass the Buffer, not a pre-decoded string.
 */
export function decodeText(buffer) {
  if (typeof buffer === 'string') return buffer;
  const b = buffer;
  if (b.length >= 2 && b[0] === 0xFF && b[1] === 0xFE) return b.toString('utf16le', 2);
  if (b.length >= 2 && b[0] === 0xFE && b[1] === 0xFF) {
    // UTF-16BE: swap pairs, since Node has no utf16be decoder.
    const swapped = Buffer.from(b.subarray(2));
    swapped.swap16();
    return swapped.toString('utf16le');
  }
  if (b.length >= 3 && b[0] === 0xEF && b[1] === 0xBB && b[2] === 0xBF) return b.toString('utf8', 3);
  return b.toString('utf8');
}

const SEQUENCE   = /^[ACGTRYSWKMBDHVNacgtryswkmbdhvn]+$/;
const SCALE      = /^\d+\s*(nm|nmol|umol|um)$/i;
const PURIFICATION = /^(STD|PAGE|HPLC|RNASE|DES|DESALT)\w*$/i;

// Short runs are names, addresses and stray words, not oligos. 15 is the shortest real oligo in
// the corpus; 10 is deliberately below it so a genuinely short one is READ rather than dropped —
// a reader that silently skips rows is indistinguishable from one that works.
const MIN_SEQUENCE_LENGTH = 10;

const DEFAULT_SCALE = '25nm';
const DEFAULT_PURIFICATION = 'STD';

/** Files this reader must not touch, by name. See NOT HANDLED above. */
export function isOligoFile(filename) {
  const base = String(filename).split(/[\\/]/).pop();
  const lower = base.toLowerCase();
  if (/_order_IDT\.xlsx$/i.test(base)) return false;   // an oPool, not oligos
  if (/idt_coa/i.test(base)) return false;             // a certificate of analysis
  if (!/\.(txt|tsv|csv)$/i.test(base)) return false;
  return lower.includes('oligo') || lower.includes('primer');
}

/**
 * One line -> one record, or null when the line is not an oligo row.
 * Returns null rather than throwing: an oligo file legitimately contains blanks, headings and
 * notes, and a parser that throws on those cannot read any real file in this corpus.
 */
export function readOligoLine(line, { path, lineNumber } = {}) {
  const cols = String(line).split('\t').map(c => c.trim());
  if (cols.length < 2) return null;
  const [name, sequence] = cols;
  if (!name) return null;
  if (!SEQUENCE.test(sequence || '') || sequence.length < MIN_SEQUENCE_LENGTH) return null;

  const record = { name, sequence };
  const third = cols[2] || '';
  const fourth = cols[3] || '';
  const assumed = [];

  // Column three is scale OR description, told apart by shape — never by which file this is.
  if (SCALE.test(third)) {
    record.scale = third;
  } else {
    record.scale = DEFAULT_SCALE;
    assumed.push('scale');
    if (third) record.description = third;
  }
  if (PURIFICATION.test(fourth)) {
    record.purification = fourth;
  } else {
    record.purification = DEFAULT_PURIFICATION;
    assumed.push('purification');
  }
  if (assumed.length) record.assumed = assumed;
  if (path !== undefined && lineNumber !== undefined) {
    record.source = { path, line: lineNumber };
  }
  return record;
}

/**
 * One file's text -> { records, skipped }.
 *
 * `skipped` is returned rather than discarded. A row this reader did not understand is a finding
 * — a new dialect, or a file that should not have been read at all — and a reader that drops them
 * silently looks exactly like a reader that works. The caller is expected to report it.
 */
export function readOligoFile(path, textOrBuffer) {
  const records = [];
  const skipped = [];
  const lines = decodeText(textOrBuffer).split(/\r\n|\r|\n/);
  lines.forEach((line, i) => {
    const lineNumber = i + 1;
    const record = readOligoLine(line, { path, lineNumber });
    if (record) records.push(record);
    else if (line.trim()) skipped.push({ path, line: lineNumber, text: line.slice(0, 120) });
  });
  return { records, skipped };
}

/**
 * Name collisions within a set of records.
 *
 * TWO DIFFERENT THINGS SHARE A NAME AND ONLY ONE IS A PROBLEM. Same name and same sequence is the
 * ordinary case — one oligo cited by two files. Same name and DIFFERENT sequence is a genuine
 * collision, and this function reports it WITHOUT choosing: 36 exist in the corpus, of three
 * different kinds (a cross-experiment reuse, a corrected redesign that kept its name, and a
 * reused catalogue number), and nothing in the data resolves the last two.
 *
 * Never resolve by mtime, by repo precedence, or by sequence length.
 */
export function findNameCollisions(records) {
  const byName = new Map();
  for (const r of records) {
    if (!byName.has(r.name)) byName.set(r.name, []);
    byName.get(r.name).push(r);
  }
  const collisions = [];
  for (const [name, rs] of byName) {
    // EACH DISTINCT SEQUENCE CARRIES ITS OWN SOURCES. A flat list of sequences beside a flat list
    // of sources cannot be read: with three files holding two sequences there is no way to say
    // which file held which, and a report nobody can act on is the same as no report. Found by
    // printing one.
    const variants = new Map();
    for (const r of rs) {
      const key = r.sequence.toUpperCase();
      if (!variants.has(key)) variants.set(key, { sequence: key, sources: [] });
      if (r.source) variants.get(key).sources.push(r.source);
    }
    if (variants.size > 1) {
      collisions.push({
        name,
        variants: [...variants.values()].sort((a, b) => b.sources.length - a.sources.length),
      });
    }
  }
  return collisions.sort((a, b) => a.name.localeCompare(b.name));
}
