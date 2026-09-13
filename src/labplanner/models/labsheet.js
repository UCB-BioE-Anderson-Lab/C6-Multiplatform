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

/**
 * A DNA name has to fit on a cap. JCA: *"DNA names are special — and they need to fit on a tube
 * cap, so like 6 letters max."* `pBET8` and `pGOLD` are five.
 */
export const DNA_NAME_MAX = 6;

/** Where a name stops being writeable by hand, as against where it stops being neat.
 *  → `planning/naming.js § DNA_NAME_LIMIT` */
export const DNA_NAME_LIMIT = 8;

/**
 * How long a label may be, by what it is written on. → `docs/LABSHEET-SPEC.md` § 1
 *
 * **`micro` IS EIGHT AND NOT SIX, AND THIS IS A READING RATHER THAN A QUOTE.** JCA said two things
 * that are in tension at the character count: *"a 1.5 mL is ~6 char"*, and *"the convention for a
 * single clone miniprep is to put the construction + '-' + clone identifier"*. `pBET8-A` is seven.
 *
 * Taking the six as the rule for the DNA NAME — which is how he introduced it, *"DNA names are
 * special... so like 6 letters max"* — and the miniprep label as that name plus `-` plus one clone
 * character, the composed label is at most eight. So `DNA_NAME_MAX` is the real constraint and
 * this is its consequence.
 *
 * If the six was meant as the limit on the written string, then the convention would have to
 * produce names of four, and `pBET8-A` would already be over. Flagged at GATE 1.
 */
/**
 * The longest a clone designation gets: `[0-9][A-Z][0-9]` for the Nth plate, row X, column M.
 * A single-clone pick uses one letter; a library uses the plate address, and the label has to hold
 * whichever the experiment turns out to need.
 */
export const CLONE_MAX = 3;

export const TUBE = {
  pcr:       { cap: 3,  side: false, what: 'a 200 µL PCR strip tube' },
  // SIX FOR THE NAME, ONE FOR THE HYPHEN, THREE FOR THE CLONE. JCA, 2026-09-13, when asked whether
  // a 1.5 mL label is six characters or eight: *"Maybe 6 cap on a name (a rule on CF drafting more)
  // plus 2 more for the clone. That is all still writeable, it just takes two lines. Even a
  // pBET12-4B3 is writeable. I think we've been too strict on names."*
  //
  // `pBET12-4B3` is ten, so ten it is — the clone half is whatever the designation grammar allows,
  // not whatever a single-clone pick happens to use. The six is a rule about DRAFTING A NAME, which
  // is where it belongs and where `validate/constructionFile.js` now says it; it is not a rule this
  // model gets to enforce on a name somebody already chose.
  micro:     { cap: DNA_NAME_LIMIT + 1 + CLONE_MAX, side: true,
               what: 'a 1.5 mL microcentrifuge tube' },
  // ONE MORE CHARACTER THAN A MINIPREP, and for a stated reason: a sequencing reaction is named
  // for the tube it was set up from plus which direction was read — `pBET8-AF`, `pBET8-AR`. JCA,
  // 2026-09-12: *"sequencing labels should be 'pBET8-B', or maybe 'pBET8-Bf' and 'pBET8-Br' if
  // there are two reads. When sequencing comes back, we need to be able to precisely map it to
  // the data."* So it is DNA name + '-' + clone + read.
  //
  // These tubes leave the building, which is why the limit is a limit and not a convenience:
  // whatever is written here is the name the trace file comes back under, months later, in a
  // folder beside every other experiment's.
  sequencing: { cap: DNA_NAME_LIMIT + 1 + CLONE_MAX + 1, side: true,
                what: 'a sequencing tube sent off-site' },
  plate:     { cap: 12, side: false, what: 'a petri dish, written on the base' },
  block:     { cap: 12, side: false, what: 'a 24-well block' },
  none:      { cap: 0,  side: false, what: 'nothing physical' },
};

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
  const lab = labelIn(row);
  const kind = TUBE[tube];
  const warnings = [];
  if (lab && lab.length > kind.cap) {
    warnings.push(`label ${JSON.stringify(lab)} is ${lab.length} characters and goes on `
      + `${kind.what}, which takes ${kind.cap}. Somebody has to write it by hand.`);
  }
  if (row['side-label'] && !kind.side) {
    throw new Error(`${where}: ${kind.what} has no side to write on.`);
  }
  return { label: lab, warnings };
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
  const seen = new Set();
  for (const row of rows) {
    const { label: lab, warnings } = checkRow(`addSection(${sheet.id}/${title})`, row, columns, tube);
    for (const w of warnings) sheet.warnings.push(`${title}: ${w}`);
    if (!lab) continue;
    if (seen.has(lab)) {
      throw new Error(`addSection(${sheet.id}/${title}): label ${JSON.stringify(lab)} is used `
        + 'twice. A label is a key; two tubes under one key are two tubes nobody can tell apart.');
    }
    seen.add(lab);
  }
  sheet.blocks.push({ kind: 'heading', text: title });
  if (columns.length)
    sheet.blocks.push({ kind: 'table', rows: [columns, ...rows.map((r) => columns.map((c) => r[c]))] });
  return sheet;
}

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
  if (lab && sheet.samples.some((s) => labelIn(s) === lab)) {
    throw new Error(`addSample(${sheet.id}): label ${JSON.stringify(lab)} is used twice. `
      + 'A label is a key; two tubes under one key are two tubes nobody can tell apart.');
  }

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
  if (text) sheet.notes.push(String(text));
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
  return sheet.samples.map((s) => String(s.label ?? '').trim()).filter(Boolean);
}
