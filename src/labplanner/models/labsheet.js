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
export const TUBE = {
  pcr:       { cap: 3,  side: false, what: 'a 200 µL PCR strip tube' },
  micro:     { cap: DNA_NAME_MAX + 2, side: true, what: 'a 1.5 mL microcentrifuge tube' },
  plate:     { cap: 12, side: false, what: 'a petri dish, written on the base' },
  block:     { cap: 12, side: false, what: 'a 24-well block' },
  none:      { cap: 0,  side: false, what: 'nothing physical' },
};

/** Is this a construct name somebody can write on a cap? → `DNA_NAME_MAX` */
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

  const lab = String(row.label ?? '').trim();
  if (lab) {
    const kind = TUBE[sheet.tube];
    if (lab.length > kind.cap) {
      throw new Error(`addSample(${sheet.id}): label ${JSON.stringify(lab)} is ${lab.length} `
        + `characters and this sheet labels ${kind.what}, which takes ${kind.cap}.`);
    }
    if (sheet.samples.some((s) => String(s.label ?? '').trim() === lab)) {
      throw new Error(`addSample(${sheet.id}): label ${JSON.stringify(lab)} is used twice. `
        + 'A label is a key; two tubes under one key are two tubes nobody can tell apart.');
    }
  }
  if (row['side-label'] && !TUBE[sheet.tube].side) {
    throw new Error(`addSample(${sheet.id}): ${TUBE[sheet.tube].what} has no side to write on.`);
  }

  sheet.samples.push({ ...row });
  return sheet;
}

/**
 * Add a `source:` row — something to fetch before starting.
 *
 * `where` is one of: `{ box, well }` for a placed tube, `{ box }` for a box that does not track
 * wells, `{ madeIn }` for something an earlier session produced, or nothing at all, which means
 * the sheet asks. → `docs/LABSHEET-SPEC.md`, and `planning/planSources.js` for which is which.
 */
export function addSource(sheet, { what, box = '', well = '', madeIn = null, ask = false,
                                   askWell = false, note = '' }) {
  if (!what) throw new Error(`addSource(${sheet.id}): a source needs something to fetch`);
  sheet.sources.push({ what, box, well, madeIn, ask, askWell, note });
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
export function setDestination(sheet, where) { sheet.destination = where || null; return sheet; }

/** A protocol transclusion, a heading, or a table the operation contributes. */
export function addBlock(sheet, block) { sheet.blocks.push(block); return sheet; }

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
