/**
 * LabSheet — one person, one work session, one page.
 *
 * Written 2026-09-12 against `docs/LABSHEET-SPEC.md`, which JCA settled at GATE 0, and against the
 * twelve worked examples in `BioE134 - 15 - LabPlanner.pptx`. **This file is the only way a sheet
 * is constructed.** Before it, `c6-packet` emitted plain objects shaped like a LabSheet without
 * being one, which is how `tube` and `product` stood as column headers for two weeks with nothing
 * to object.
 *
 * ## A sheet is sections, not a table
 *
 * The spec's examples carry: `samples:`, `source:`, `mastermix:`, `reaction:`, `DNA Mix:`,
 * `destination:`, `program:`, `protocol:`, `note:`, `rescue_required:`. Only `samples` is a table,
 * and its columns are the operation's own.
 *
 * ## A label is an exact key
 *
 * JCA: *"whatever the labsheet says those Strings are should be treated as exact keys. When
 * referring to those samples later, you use those keys."*
 *
 * That is the load-bearing sentence. A label is an identifier: every later reference — the next
 * sheet, the returned workbook, the inventory — resolves through that exact string. So this model
 * **refuses a duplicate label within a sheet**, and nothing downstream may prettify one.
 *
 * ## Two surfaces, not two names
 *
 * `label` is written on the cap; `sideLabel` on the side. A PCR tube has no side — *"the side is
 * too slippery"* — and takes under four characters. A 1.5 mL takes about six, and for a
 * single-clone miniprep both surfaces carry the same string: construct + `-` + clone.
 */


/** Where a name stops being writeable by hand, as against where it stops being neat.
 *  → `planning/naming.js § DNA_NAME_LIMIT` */


/**
 * How long a label may be, by what it is written on. → `docs/LABSHEET-SPEC.md` § 1
 *
 * **A NAME, A HYPHEN AND A CLONE.** JCA said two things that read as being in tension — *"a 1.5 mL
 * is ~6 char"* and *"the convention for a single clone miniprep is to put the construction + '-' +
 * clone identifier"* — and settled it on 2026-09-13:
 *
 * > *"Maybe 6 cap on a name (a rule on CF drafting more) plus 2 more for the clone. That is all
 * > still writeable, it just takes two lines. Even a pBET12-4B3 is writeable. I think we've been
 * > too strict on names, but in general less characters is more legible than more characters."*
 *
 * So the six is a rule about DRAFTING A NAME and lives where names are drafted — `DNA_NAME_MAX`,
 * said by `validate/constructionFile.js` while somebody is still typing. What a cap has to hold is
 * a name at its practical limit (`DNA_NAME_LIMIT`, eight — *"about the limit"*), a hyphen, and a
 * clone designation which may be a plate address. Twelve. `pBET12-4B3` is ten and fits with room.
 *
 * A sequencing tube is one more again, for the read direction.
 */
// **THE CAPS AND WHAT THEY ARE WRITTEN ON LIVE IN `rules/label.rules.js`**, beside the rules that
// use them, so a cap cannot change without walking past the sentence saying why it is that number.
export { TUBE, DNA_NAME_MAX, DNA_NAME_LIMIT, CLONE_MAX } from '../rules/label.rules.js';
import { TUBE, choose as checkLabel } from '../rules/label.rules.js';
import { choose as checkUnique } from '../rules/labelUniqueness.rules.js';

/**
 * Is this a construct name somebody can write on a tube cap?
 *
 * @param {string} name
 * @returns {boolean}
 */
export function fitsOnACap(name) {
  return String(name || '').trim().length > 0 && String(name).trim().length <= DNA_NAME_MAX;
}

/**
 * The inventory's vocabulary, which a labsheet shares so a returned sheet reads straight back in.
 * → `src/inventory/io.js`. Anything outside this set must be declared by the operation.
 */
export const ONTOLOGY = ['label', 'side-label', 'construct', 'concentration', 'clone', 'culture',
                         'type'];

/** A clone designation: a letter, a number, or plate/row/column. → spec § 3 */
export const CLONE = /^([A-Z]|[0-9]|[0-9][A-Z][0-9])$/;

/**
 * Is this string a clone designation — a letter, a digit, or a plate address?
 *
 * @param {string} s
 * @returns {boolean}
 */
export function isCloneDesignation(s) { return CLONE.test(String(s || '')); }

/**
 * Start a sheet.
 *
 * `columns` is declared UP FRONT and every row is checked against it. A row with a key the sheet
 * did not declare is the bug this model exists to catch: it is how a column appears on one
 * operation and not another, and how a header nobody chose reaches paper.
 *
 * @param {Object} p
 * @param {string} p.id          stable, machine-facing: `s4-gel-zymo-goldengate`
 * @param {string} p.title       what a person reads at the top of the page
 * @param {string} p.operation   the operation, or the session's name where it holds several
 * @param {Array<string>} p.columns  the `samples:` table's columns, in order
 * @param {string=} p.tube       which of `TUBE` the labels are written on; default `none`
 * @returns {Object} LabSheet
 */
export function createLabSheet({ id, title, operation, columns = [], tube = 'none', metadata = {} }) {
  if (!id) throw new Error('createLabSheet: a sheet needs an id');
  if (!TUBE[tube]) throw new Error(`createLabSheet: unknown tube kind ${tube!== undefined ? JSON.stringify(tube) : ''}`);
  return {
    id,
    title: title || id,
    operation: operation || '',
    tube,
    columns: [...columns],
    metadata: { ...metadata },
    samples: [],      // the `samples:` table
    sources: [],      // `source:` — what to fetch, and from where
    recipe: null,     // `reaction:`
    mastermix: null,  // `mastermix:`
    destination: null,
    program: null,
    blocks: [],       // protocol transclusions, headings, extra tables
    notes: [],        // `note:`
    open: [],         // decisions this compiler refused to make
    warnings: [],     // things true of this sheet that somebody should know before printing it
    // **EVERY LABEL THIS SITTING WRITES, AND WHAT IT IS WRITTEN ON.** A sheet holds several
    // sections and each used to check only itself, so two of them could put one string on one kind
    // of tube and nothing objected. The register is DECLARED here rather than kept in a closure or
    // hung on the object later, because `setCheckpoint`'s docstring says why: *"a slot nothing
    // declares is a slot nothing can be wrong about."*
    //
    // `{label, tube, where}` — `where` is the section's heading, so a refusal can name both places
    // rather than only the second one. → `rules/labelUniqueness.rules.js`
    labels: [],
    checkpoint: null, // a routing instruction a host institution attaches — see `setCheckpoint`
  };
}

/**
 * Add one row to `samples:`.
 *
 * THREE THINGS ARE CHECKED, and each of them was a real bug before it was a check:
 *
 * 1. **The keys match the declared columns exactly.** `tube`/`product` drifted in as headers
 *    because nothing compared a row to a contract.
 * 2. **The label fits what it is written on.** Three characters is a PCR cap, not every tube; a
 *    miniprep is named `pBET8-A` and checking it against a strip tube's limit flags every correct
 *    row. The sheet says which kind it is.
 * 3. **No two rows share a label.** A label is a key; two tubes with one key are two tubes nobody
 *    can tell apart, and the sheet is where that becomes physical.
 */
/**
 * THE LABEL COLUMN IS NOT ALWAYS CALLED "label". A PCR makes tubes, a transformation makes plates,
 * a culture fills a block — and the column reads better named for the thing somebody writes on.
 * Checking only `label` meant that renaming a column silently retired the check.
 */
export const LABEL_KEYS = ['label', 'tube', 'plate', 'block', 'well'];

/** The string somebody has to write on something, out of whichever column carries it. */
function labelIn(row) {
  for (const k of LABEL_KEYS) {
    const v = String(row[k] ?? '').trim();
    if (v) return v;
  }
  return '';
}

/**
 * Check one row against a set of declared columns and a tube kind.
 *
 * **LENGTH IS A WARNING; EVERYTHING ELSE HERE IS FATAL.** That split is not a softening, it is
 * about who owns the string. A column that does not match the contract and a side-label on a tube
 * with no side are the COMPILER's errors and it must not emit the page. A label that is too long
 * usually is not: `pBET8-A` is a construct name the file chose plus a clone letter, and JCA settled
 * that naming — *"We aren't redesigning construction files here… There are no rules about how DNAs
 * are named anyway."* A compiler that refuses to plan an experiment because its plasmid is called
 * `pTEST_Mach1` has stopped doing the job over a matter of legibility.
 *
 * So it is said, loudly, at the seam and in the sheet's own warnings — and the labels the compiler
 * MINTS are three characters by construction, so nothing is lost where it does own the name.
 *
 * @returns {{label: string, warnings: Array<string>}}
 */
function checkRow(where, row, want, tube) {
  const keys = Object.keys(row);
  const extra = keys.filter((k) => !want.includes(k));
  const missing = want.filter((k) => !keys.includes(k));
  if (extra.length || missing.length) {
    throw new Error(`${where}: row does not match the declared columns`
      + `${extra.length ? `\n  not declared: ${extra.join(', ')}` : ''}`
      + `${missing.length ? `\n  missing: ${missing.join(', ')}` : ''}`
      + `\n  declared: ${want.join(', ')}`);
  }
  // WHETHER A LABEL FITS IS A RULE — `rules/label.rules.js`. Whether the row matches its declared
  // columns, above, is this model's own business and stays here.
  const lab = labelIn(row);
  const got = checkLabel({ label: lab, tube, hasSideLabel: !!row['side-label'] });
  if (got.fatal) throw new Error(`${where}: ${got.fatal}`);
  return { label: lab, warnings: got.note ? [got.note] : [] };
}

/**
 * Register a label against the sitting, refusing a second tube of the same kind under it.
 *
 * **THE SCOPE IS THE SHEET AND THE KEY IS THE PLASTIC**, which is a rule with a reason and lives
 * in `rules/labelUniqueness.rules.js` rather than here. This is the adapter: the model owns the
 * register because the model is what mints and holds labels, and the rule owns the question of
 * whether a repeat matters.
 */
function register(sheet, where, label, tube) {
  if (!label) return;
  const got = checkUnique({ label, tube, taken: sheet.labels });
  if (got && got.fatal) throw new Error(`${where}: ${got.fatal}`);
  sheet.labels.push({ label, tube, where });
}

/**
 * A second operation's table on the same page.
 *
 * **A SESSION IS ONE PERSON'S SITTING AND MAY HOLD THREE OPERATIONS**, and until this existed only
 * the FIRST one's table went through the model — the rest were pushed in as raw blocks. So the
 * miniprep's labels were checked and the sequencing labels beside them on the same page were not,
 * which is precisely backwards: the sequencing tubes leave the building.
 *
 * Each section declares its own columns and its own tube kind, because they are different objects:
 * a 1.5 mL takes eight characters and the sequencing tube sent off-site takes nine.
 */
export function addSection(sheet, { title, columns = [], tube = 'none', rows = [] }) {
  if (!TUBE[tube]) throw new Error(`addSection(${sheet.id}): unknown tube kind ${JSON.stringify(tube)}`);
  for (const row of rows) {
    const { label: lab, warnings } = checkRow(`addSection(${sheet.id}/${title})`, row, columns, tube);
    for (const w of warnings) sheet.warnings.push(`${title}: ${w}`);
    // AGAINST THE WHOLE SITTING, NOT AGAINST THIS SECTION. A per-section `Set` was the old check
    // and it could not see the section beside it. → `register`
    register(sheet, `addSection(${sheet.id}/${title})`, lab, tube);
  }
  sheet.blocks.push({ kind: 'heading', text: title });
  if (columns.length)
    sheet.blocks.push({ kind: 'table', rows: [columns, ...rows.map((r) => columns.map((c) => r[c]))] });
  return sheet;
}

/**
 * Add one row to the sheet's `samples:` table — one thing somebody labels.
 *
 * Checked against the columns this sheet declared, against the cap of the tube it writes on, and
 * against the labels already on it. → `checkRow`, which says what each check is for.
 *
 * @param {Object} sheet
 * @param {Object} row   keys must match `sheet.columns` exactly
 * @returns {Object} the sheet
 */
export function addSample(sheet, row) {
  const keys = Object.keys(row);
  const want = sheet.columns;
  const extra = keys.filter((k) => !want.includes(k));
  const missing = want.filter((k) => !keys.includes(k));
  if (extra.length || missing.length) {
    throw new Error(`addSample(${sheet.id}): row does not match the declared columns`
      + `${extra.length ? `\n  not declared: ${extra.join(', ')}` : ''}`
      + `${missing.length ? `\n  missing: ${missing.join(', ')}` : ''}`
      + `\n  declared: ${want.join(', ')}`);
  }

  const { label: lab, warnings } = checkRow(`addSample(${sheet.id})`, row, want, sheet.tube);
  for (const w of warnings) sheet.warnings.push(w);
  register(sheet, `addSample(${sheet.id})`, lab, sheet.tube);

  sheet.samples.push({ ...row });
  return sheet;
}

/**
 * Add a `source:` row — something to fetch before starting.
 *
 * **FOUR STATES, AND THEY ARE NOT INTERCHANGEABLE.** This was written at GATE 1 from the spec, with
 * a `madeIn` field and a single `ask` flag, before `planning/planSources.js` worked out what the
 * real answers are. It silently dropped every field it did not know, so routing the packet through
 * this model turned six located tubes into six blanks. The states:
 *
 *   located    `box` and `well` are both known — printed, not asked
 *   `askWell`  the box is named and does not track wells, so the box prints and the well is asked.
 *              Collapsing this into "unlocated" throws away the half of the record that is stable
 *              and sends somebody to search a whole freezer.
 *   `unlocated` nothing in the inventory says where it is. That is a gap in the document, not
 *              proof the tube is missing, so the sheet asks and the returned workbook updates it.
 *   `made`     an earlier session of this plan produced it; there is no box to give. `link` names
 *              the slugs another sheet recorded its box and well under, so the renderer can point
 *              a formula at them rather than asking twice.
 *
 * `askClone` is the fifth thing and is not a state: the construct is known, the clone is not,
 * because an analysis has not happened yet when this sheet is written.
 */
export function addSource(sheet, { what, box = '', well = '', made = false, unlocated = false,
                                   askWell = false, askClone = null, link = null, note = '' }) {
  if (!what) throw new Error(`addSource(${sheet.id}): a source needs something to fetch`);
  if (made && (box || well)) {
    throw new Error(`addSource(${sheet.id}): ${JSON.stringify(what)} is made by an earlier `
      + 'session AND given a box. One of those is wrong, and the box is the one somebody acts on.');
  }
  if (unlocated && (box || well)) {
    throw new Error(`addSource(${sheet.id}): ${JSON.stringify(what)} is marked unlocated and `
      + 'carries a location.');
  }
  sheet.sources.push({ what, box, well, made, unlocated, askWell, askClone, link, note });
  return sheet;
}

/** `note:` — prose below the table. */
export function addNote(sheet, text) {
  // **THE SAME SENTENCE TWICE IS NOISE, AND ONE SHEET BINS SEVERAL OPERATIONS.** `Gel, cleanup and
  // assembly` runs three designs over the same samples, so a note attached to a SAMPLE — the PCR
  // chemistry one, say — is contributed once by the gel and once by the cleanup. It printed twice,
  // three lines apart, on a page whose whole job is to be read quickly.
  //
  // Exact text only: two notes about two different tubes are two notes, and must both survive.
  if (!text) return sheet;
  const t = String(text);
  if (!sheet.notes.includes(t)) sheet.notes.push(t);
  return sheet;
}

/**
 * A decision this compiler would not make.
 *
 * Carried on the sheet rather than printed and forgotten, so `c6-labplan` can list them all in one
 * place at the end of a run. A labsheet showing a hole is right; a person reading eleven sheets to
 * find the holes is not.
 */
export function addOpenDecision(sheet, text) {
  if (text) sheet.open.push(String(text));
  return sheet;
}

/** `reaction:` — what goes in one tube. → `models/recipe.js` */
export function setRecipe(sheet, recipe) { sheet.recipe = recipe || null; return sheet; }

/** `mastermix:` — what is premixed for several. → `models/mastermix.js` */
export function setMastermix(sheet, mm) { sheet.mastermix = mm || null; return sheet; }

/**
 * `program:` and `destination:`.
 *
 * JCA, 2026-09-12: *"We don't need to track specific thermocyclers or block ids. The program being
 * run in a pcr is absolutely essential information for a labsheet. The destination is pretty much
 * always the 'to gel' box, and it is good to keep that stated as all pcrs get put in that box."*
 *
 * So `program` is a thermocycler program and `destination` is where the finished tubes go. Neither
 * is a machine, a block or a deck position.
 */
export function setProgram(sheet, program) { sheet.program = program || null; return sheet; }

/**
 * Where the finished tubes go — the *to gel* box, not a thermocycler or a deck position.
 *
 * @param {Object} sheet
 * @param {string} where
 * @returns {Object} the sheet
 */
export function setDestination(sheet, where) { sheet.destination = where || null; return sheet; }

/** A protocol transclusion, a heading, or a table the operation contributes. */
export function addBlock(sheet, block) { sheet.blocks.push(block); return sheet; }

/**
 * The four fields a checkpoint must have to be renderable. → `setCheckpoint`
 */
export const CHECKPOINT_FIELDS = ['type', 'code', 'delivers', 'expects'];

/**
 * A point at which somebody outside this sheet wants to hear how it went.
 *
 * **THIS IS THE DECLARED EXTENSION POINT, AND IT IS EMPTY ON PURPOSE.** JCA, 2026-09-12:
 *
 * > *"There are things that labplanner does automatically, and then there are things that are
 * > cortex specific you do for my lab. the checkpoints, as well as a training box vs control
 * > stocks are very lab specific add-ins… what belongs in C6 would be the generalized one that
 * > compiles cf and characterization f to a labsheet."*
 *
 * So this toolkit knows that a sheet CAN carry one and what shape it has to be; it does not know
 * which steps deserve one, what a code looks like, or where the message goes. Those are facts
 * about an institution, and a lab that has never heard of this one must be able to use C6 without
 * inheriting them. `cortex/tests/test_labsheet_split.py` compiles an experiment with C6 alone and
 * reads the workbook back looking for this lab's vocabulary in it.
 *
 * It was an undeclared key until GATE 5 — the injector set `sheet.checkpoint = {...}` on a plain
 * object and the renderer read whichever fields it happened to find, so a checkpoint missing
 * `expects` drew a heading, a routing line and no instruction. A slot nothing declares is a slot
 * nothing can be wrong about.
 *
 * @param {Object} sheet
 * @param {{type, code, delivers, expects, arrives?}} cp
 */
export function setCheckpoint(sheet, cp) {
  if (!cp) { sheet.checkpoint = null; return sheet; }
  const missing = CHECKPOINT_FIELDS.filter((k) => !String(cp[k] ?? '').trim());
  if (missing.length) {
    throw new Error(`setCheckpoint(${sheet.id}): a checkpoint needs ${missing.join(', ')}. `
      + 'A half-filled one renders as a heading and a routing code with nothing telling somebody '
      + 'what to send, which is worse than no checkpoint at all.');
  }
  sheet.checkpoint = { ...cp };
  return sheet;
}

/**
 * Every label this sheet defines, in order. The next sheet resolves its inputs through these.
 *
 * WHY THE MODEL OWNS THIS rather than each design keeping its own map: a label is a key, and the
 * thing that mints keys should be the thing that answers lookups on them. Today that map lives in
 * a closure in `design/index.js`, which is why nothing could check it.
 */
export function labelsOf(sheet) {
  // **IT READ `s.label` ONLY, AND FIVE COLUMNS CAN CARRY ONE.** `LABEL_KEYS` exists because a PCR
  // makes tubes, a transformation makes plates and a culture fills a block, so on a picking sheet
  // — whose column is `well` — this returned nothing at all, and on a gel sheet nothing either.
  // It was exported, documented as the thing the next sheet resolves its inputs through, and
  // called by nobody, which is why the gap could sit there: a correct-looking mechanism wired to
  // nothing is this repository's most persistent shape.
  //
  // Reading the register instead makes it right by construction — the register is what every
  // label goes through — and it now carries the sections' labels too, which the old one could
  // never have seen.
  return sheet.labels.map((t) => t.label);
}
