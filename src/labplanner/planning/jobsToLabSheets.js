/**
 * Plan -> LabSheets. The last planning stage, and until 2026-09-13 the file was `export {}`.
 *
 * **THE SPINE WAS NEVER CONNECTED.** `generateLabPacket` in `C6-LabPlanner.js` guards every stage
 * with `typeof X === 'function'` and requires this module's export before it will plan at all —
 * so it returned an empty packet on line one and said nothing. Four of its eleven stages did not
 * exist, two existed under other names, and the whole thing was unreachable because `bin/c6-plan`
 * drives the stages itself and `bin/c6-packet` did this file's work inline.
 *
 * That is the audit finding JCA asked for on 2026-09-12: *"I'm not sure if we've gone off the
 * rails because we have bypassed the labsheet generation code we wrote, or we never really wrote
 * it."* We never wrote it. This is it.
 *
 * **EVERY SHEET IS BUILT THROUGH `models/labsheet.js`,** which is the point of moving the code
 * rather than leaving it in a bin script. The model refuses a row whose keys do not match the
 * declared columns, a label too long for what it is written on, a duplicate label, and a
 * side-label on a tube with no side. None of those checks had ever run on a real packet, because
 * nothing outside the model's own test had ever constructed one.
 *
 * **WHAT IS NOT DECIDED HERE.** Content belongs to `design/`, one module per operation. This is a
 * projection: it walks the sessions, asks each bin's design for its table, its protocol and its
 * prose, and assembles the page. The only judgements it owns are the packet's own — which
 * materials are fetched rather than made, what order the sections come in, and what the seam
 * should warn about.
 */
import { applyDesign, labeller } from '../design/index.js';
import { decide } from './decisions/index.js';
import { groupIntoSessions } from './sessions.js';
import { allocateWells } from './allocateWells.js';
import { sequenceNamed, bestSequenceFor } from './sequences/index.js';
import {
  createLabSheet, addSample, addSection, addSource, addNote, addOpenDecision,
  setRecipe, setMastermix, setDestination, addBlock, TUBE,
} from '../models/labsheet.js';

/**
 * Which tube each operation's labels are written on. → `models/labsheet.js § TUBE`
 *
 * **THIS REPLACES `labelMax`,** which was a number a design carried so the renderer would stop
 * complaining — miniprep and sequencing both said 24, which is not a tube, it is a way of turning
 * the check off. The kind is the real fact: a PCR strip cap takes three characters because it is
 * a PCR strip cap, and a 1.5 mL takes eight because a DNA name is six and a clone letter adds two.
 *
 * An operation absent here writes on nothing and must produce no labels at all — which is a check
 * and not an oversight: `analysis` and `assay` make no tubes, and a label appearing on one of
 * their rows means a design started naming things nobody asked it to name.
 */
export const TUBE_FOR = {
  pcr: 'pcr',
  gel: 'pcr',
  // NOT A STRIP TUBE, AND THE MODEL IS WHAT FOUND THIS. Two of JCA's rules met here and
  // contradicted: *"Adding a z to a label is a convention for zymo"* and *"A pcr tube is max 3
  // char"*. A zymo label is `z` plus the PCR's own three characters — `zL3a` — which is four, and
  // for a day every one of them was written onto a cap that does not hold four.
  //
  // The resolution is physical rather than a compromise: a Zymo cleanup ELUTES INTO A 1.5 mL
  // tube. It was never a strip tube, so the three-character rule never applied to it, and the
  // prefix convention was right all along.
  zymo: 'micro',
  goldengate: 'pcr',
  transform: 'plate',
  retransform: 'plate',
  pick: 'block',
  culture: 'block',
  miniprep: 'micro',
  sequencing: 'sequencing',
  analysis: 'none',
  assay: 'none',
  dilution: 'none',
  stock: 'none',
};

/**
 * A label counter that hands out nothing. Re-applying a design to read one of its other answers
 * must not consume labels: doing so once burnt through the alphabet twice in one packet.
 */
const MUTE = Object.assign(() => '', { of: () => null, hold: () => {}, derived: () => '' });

/** The statuses that mean "this tube is in a box and the box is named". */
const LOCATED = ['ready', 'box-only', 'box-untracked'];

/**
 * Compile a plan into labsheets.
 *
 * @param {Object} plan       what `bin/c6-plan --json` produces: `{sheets, files, problems}`
 * @param {Object} ctx
 * @param {string} ctx.experiment   names the sheets and prefixes the labels
 * @param {Function=} ctx.label     the packet-wide label counter; built here if not given
 * @param {Object=} ctx.answers     answers to the declared decisions → `planning/decisions/`
 * @param {string=} ctx.sequenceId  force a session pairing rather than inferring one
 * @returns {{sheets, unplaced, warnings, sequence, decisions}}
 */
export function jobsToLabSheets(plan, { experiment, label, answers = {},
                                        sequenceId = null } = {}) {
  const warnings = [];
  const bins = plan.sheets || [];

  // CONSTRUCTS WHOSE CLONE IS CHOSEN AT THE BENCH. An analysis settles which clone passed, and the
  // sheet that uses it afterwards is written before anybody knows — so it asks for the designation
  // and computes the tube name from the answer. Per SAMPLE, not per construct: a step is after the
  // verdict or it is not, and the planner says which with `afterVerified`.
  const asksClone = (x) => (x.params?.afterVerified ? String(x.params.afterVerified) : null);

  // AN OLIGO THE DILUTION SESSION MAKES IS NOT FETCHED FROM A FREEZER. The PCR uses the 10 µM tube
  // that session 1 produced, and its location was written down there — so asking for it again on
  // the PCR sheet is the same question twice, in two places, with two answers possible.
  const diluted = new Set(bins.flatMap((s) => (s.dilution?.targets || []).map((t) => t.oligo)));

  // ONE LABSHEET IS ONE PERSON DOING ONE WORK SESSION, not one operation. JCA, 2026-09-11: *"KISS
  // and make it one labsheet per person… it corresponds to one person doing work, 1 sheet per work
  // session."* The gel, the cleanup and the assembly are one sitting; a packet that issues them as
  // three sheets makes a person carry three pages for one afternoon.
  //
  // The pairing is data, in `planning/sequences/`, because it is the same for every experiment of
  // the same shape and because a pairing held in a conversation is one the next session re-derives
  // and gets slightly wrong.
  // THE PREFIX IS A DECLARED DECISION, not a rule this file applies. It is two characters standing
  // for the experiment on every tube it makes, and whether they collide with another group's is a
  // fact about the LAB — which no file in one project can establish. → `decisions/labelPrefix.js`
  //
  // The compile does not ask anybody. It reads the answer if one is on file, falls back to the
  // rule if not, and carries the question onto sheet one either way.
  const ops = bins.map((s) => String(s.operation).toLowerCase());
  const prefix = decide('labelPrefix', {
    experiment,
    constructs: [...new Set(bins.flatMap((b) => (b.samples || []).map((x) => x.output)))].slice(0, 8),
    tubes: bins.reduce((n, b) => n + (b.samples || []).length, 0),
    hasStripTubes: ops.some((o) => tubeFor(o) === 'pcr'),
  }, answers);
  const mint = label || labeller(experiment, prefix.value);
  const sequence = sequenceId ? sequenceNamed(sequenceId) : bestSequenceFor(ops);
  if (sequenceId && !sequence) throw new Error(`jobsToLabSheets: no sequence named "${sequenceId}"`);
  const { sessions, unplaced } = groupIntoSessions(bins, sequence);
  // **WELLS ARE ALLOCATED HERE, BECAUSE HERE IS WHERE THE SITTING IS KNOWN.** `expandClones` lays
  // each step's clones out from the top-left corner, which is right for one construct and puts four
  // constructs' first colonies all in A1. → `planning/allocateWells.js`, which says why the fix is
  // not a cursor inside the expansion.
  // **A SITTING THAT OUTGROWS ITS BLOCK IS A REFUSAL, NOT A WARNING.** This pushed the messages
  // into `warnings` and carried on, which left the clones it could not seat holding the addresses
  // `expandClones` guessed — so the run printed the sentence explaining the problem and then, on
  // top of it, `label "A1" is used twice`. Two messages about one cause, the useful one first and
  // the alarming one last. `layoutFor` refuses for exactly this and says the same thing; refusing
  // here keeps the answer and the question in one place.
  const tooMany = allocateWells(sessions);
  if (tooMany.length) throw new Error(tooMany.map((p) => p.message).join('\n'));

  // Every step by the name of what it produces, so a design can read the conditions of the step
  // upstream of it — the antibiotic a pick's block needs is recorded on the plate it picks from,
  // not on the pick. The plan already carries the edges; this is an index over them.
  //
  // **BUILT AFTER THE WELLS ARE ALLOCATED, AND THE ORDER IS LOAD-BEARING.** This is a COPY of each
  // step's params, not a view of them, so an index built before `allocateWells` holds the wells
  // `expandClones` guessed and not the ones the sitting actually assigned. It sat above the
  // allocation for one run and the assay's well map lost its control row — the value was right on
  // the job and stale in the index, which is the one failure a spread copy can have.
  const byOutput = new Map();
  for (const s of bins) {
    for (const x of s.samples || []) {
      // `_inputs` as well as `_from`: the assay needs the culture's whole inoculum list to say
      // what is in each well, and `_from` alone is the first clone of four.
      byOutput.set(x.output, { ...(x.params || {}), _from: (x.inputs || [])[0],
                               _inputs: [...(x.inputs || [])] });
    }
  }
  const producer = (name) => (name ? byOutput.get(name) : undefined);
  const dilutionSession = () => sessions.findIndex((x) => x.bins.some((b) => b.dilution)) + 1;

  // WHERE EVERY MATERIAL COMES FROM. Two kinds of answer and they are not interchangeable: a thing
  // made by an earlier step of this plan is fetched from the last session's tubes, and a thing
  // nothing here makes has to be in the freezer with a box and a well.
  //
  // NOT ON A DERIVED SHEET. A gel and a cleanup share their job objects with the PCR they follow,
  // so their sources are the PCR's oligos and template — true of the reaction, false of the gel,
  // which consumes a tube of PCR product and is told so by its own Samples column.
  function sourcesOf(s) {
    if (s.derivedFrom) return [];
    const out = [];
    const seen = new Set();
    for (const x of s.samples || []) {
      for (const r of x.sources || []) {
        if (seen.has(r.name)) continue;
        seen.add(r.name);
        if (r.kind === 'oligo' && diluted.has(r.name)) {
          // THE STUDENT ALREADY WROTE THIS DOWN ONE SHEET AGO. JCA, 2026-09-12, looking at a blank
          // Box and Well beside "the 10 µM working stock you made in session 1": *"use a formula
          // to pull that info from the previous page."*
          //
          // Asking twice for one fact is how the second answer comes back different, and the
          // second ask is the one nobody fills in. `link` names the slugs the dilution sheet
          // recorded those two cells under; the renderer resolves them to live references, because
          // it is the thing that knows which cell each slug landed on.
          const n = dilutionSession();
          out.push({ what: r.name, box: '', well: '', made: true,
                     link: { box: `s${n}-dilution.working.${r.name}.box`,
                             well: `s${n}-dilution.working.${r.name}.well` },
                     note: `the 10 µM working stock you made in session ${n}` });
          continue;
        }
        out.push({
          what: r.name,
          ...(asksClone(x) === r.name ? { askClone: r.name } : {}),
          box: LOCATED.includes(r.status) ? (r.where?.box || '') : '',
          well: r.status === 'ready' ? (r.where?.well || '') : '',
          made: r.status === 'made-here',
          unlocated: r.status === 'absent' || r.status === 'unsearched',
          // IN A BOX, IN NO KNOWN WELL. The box is printed because it is right; the well is asked
          // because it moves. Anything that collapsed this into "unlocated" would throw away the
          // half of the record that is stable and send somebody to search the whole freezer.
          // ASKED ONLY WHERE THE ANSWER WOULD LAST. A box that does not track wells is a box whose
          // well moves between sessions, so the question has no answer worth writing down.
          askWell: r.status === 'box-only',
          note: r.note || '',
        });
      }
    }
    return out;
  }

  /** One operation's worth of a sheet: its table, its protocol, its conditions. */
  function sectionOf(s) {
    const d = applyDesign(s, producer, { label: mint });
    const blocks = [];
    // THIS EXPERIMENT BEFORE THE GENERIC PROCEDURE. The design's own blocks and conditions are what
    // nobody can look up — which plate is which, what is in each well, what temperature. The
    // protocol is a reference the bench already has on a cheatsheet. Ordered the other way round,
    // the assay's well map landed on page 2 behind the plate-reader protocol, so the person
    // setting the machine up had to read past the procedure to find out what was in the block.
    blocks.push(...(d.blocks || []));
    // The conditions the design asked for, in the order it asked. These are what the file said and
    // the renderer has no other way to know: the protocol is generic, the temperature is not.
    const params = (s.samples || []).reduce((a, x) => ({ ...a, ...(x.params || {}) }), {});
    const shown = d.conditions.map((k) => [k, params[k]])
      .filter(([, v]) => v !== undefined && v !== '');
    if (shown.length) {
      blocks.push({ kind: 'heading', text: 'For this experiment' });
      blocks.push({ kind: 'table', header: false, rows: shown.map(([k, v]) => [k, v]) });
    }
    if (d.module) blocks.push({ kind: 'text', text: `{${d.module}}` });
    const notes = [...d.notes];
    // ONLY ON THE SHEET IT IS ABOUT. A sample carries the note of whatever step set it, and the
    // same objects are re-binned into every later operation that touches the tube — so an
    // unqualified copy put the PCR's chemistry note on the gel/cleanup/assembly page. A note with
    // no `noteFor` is unowned and travels as before, which is how every other note still reaches
    // its sheet.
    for (const x of s.samples || []) {
      if (!x.note) continue;
      if (x.noteFor && String(x.noteFor).toLowerCase() !== String(s.operation).toLowerCase()) continue;
      notes.push(`${x.output}: ${x.note}`);
    }
    return { d, blocks, notes };
  }

  const sheets = sessions.map((session) => {
    const [first, ...rest] = session.bins;
    // MADE ON THIS PAGE IS NOT FETCHED FROM ANYWHERE. The Source block answers "where do I get
    // this", and for a tube the section above just told them to make, the answer is "you are
    // holding it". The miniprep+sequencing sheet listed pBET8-A and pBET8-B as sources of
    // themselves, because the sequencing step's input genuinely IS an earlier step's output; it is
    // just not an earlier SESSION's.
    //
    // A DERIVED BIN MAKES NOTHING. The gel and the cleanup share the PCR's job object, so their
    // samples carry the PCR's outputs — and the PCR usually ran a session earlier. Counting those
    // as made-here dropped `frag1` and `backbone` from the assembly sheet's Source block, which is
    // the one sheet that genuinely has to say which tubes to fetch.
    const madeHere = new Set(session.bins.filter((b) => !b.derivedFrom)
      .flatMap((b) => (b.samples || []).map((x) => x.output)));

    const head = sectionOf(first);
    // **DISTINCT, BECAUSE ONE OPERATION CAN NOW BE TWO BINS.** A PCR session needing both Taq and
    // PrimeSTAR is split into a bin per enzyme, and the id is built by joining the operations —
    // which produced `s3-pcr-pcr`. The id is what every checkpoint slug and every record-tab key
    // is built from, so it must describe the session and not how many tables it happens to have.
    const operations = [...new Set(session.bins.map((b) => String(b.operation).toLowerCase()))];
    const n = session.index + 1;

    // THE SHEET IS CONSTRUCTED, NOT COMPOSED. Every field below goes through the model, and the
    // model throws rather than emitting a page with two tubes under one name.
    const sheet = createLabSheet({
      id: `s${n}-${operations.join('-')}`,
      // A design that computes its title from the step overrides the pairing's name — see
      // `design/index.js § titleFromStep`. Everything else takes the lab's own word for the
      // sitting, which is better than any one operation's name for it.
      title: `${head.d.titleFromStep ? head.d.title : (session.name || head.d.title)} `
           + `for Experiment ${experiment}`,
      operation: head.d.titleFromStep ? head.d.title : (session.name || head.d.title),
      columns: Object.keys(head.d.columns[0] || {}),
      tube: tubeFor(operations[0]),
      metadata: { experiment, session: n, operations,
                  ...(head.d.module ? { module: head.d.module } : {}),
                  ...(session.why ? { source_note: session.why } : {}) },
    });

    for (const row of head.d.columns) if (Object.keys(row).length) addSample(sheet, row);
    for (const b of head.blocks) addBlock(sheet, b);
    for (const t of head.notes) addNote(sheet, t);
    if (head.d.recipe) setRecipe(sheet, head.d.recipe);
    // THE MASTERMIX PLAN TRAVELS TO THE SHEET. `makeMastermixPlan` decides whether one is worth
    // it, which components are shared, what the totals are and why — and until GATE 5 none of
    // that reached the packet, so the renderer recomputed all of it from the raw recipe with its
    // own copy of the threshold and its own guess at which components vary.
    if (first.mastermix) setMastermix(sheet, first.mastermix);
    // ANY operation in the session may be the one that sends something off-site: the miniprep is
    // the head of s7 and the sequencing beside it is what goes to the facility.
    const submits = session.bins.map((b) => applyDesign(b, producer, { label: MUTE }).submits)
      .find(Boolean);
    if (submits) sheet.submits = submits;
    if (head.d.destination) setDestination(sheet, head.d.destination);
    if (head.d.fetches) for (const src of sourcesOf(first)) addSource(sheet, src);

    // EVERY OPERATION AFTER THE FIRST IS A TITLED SECTION. The model's own `samples` and `recipe`
    // slots hold one table and one recipe, which is right for a single-operation sheet and cannot
    // carry three; the rest arrive as blocks, in the order the planner put them in, so the sheet
    // reads down the way the session runs.
    for (const b of rest) {
      const sec = sectionOf(b);
      // THROUGH THE MODEL, NOT AROUND IT. A section's rows get the same three checks the head
      // table gets, against its OWN tube kind — the miniprep's 1.5 mL takes eight characters and
      // the sequencing tube beside it on the same page takes nine, and the one that leaves the
      // building is the one that had never been checked.
      addSection(sheet, { title: sec.d.title,
                          columns: Object.keys(sec.d.columns[0] || {}),
                          tube: tubeFor(b.operation),
                          rows: sec.d.columns });
      if (sec.d.recipe && sec.d.recipe.components)
        addBlock(sheet, { kind: 'table',
                          rows: [['', 'reaction'],
                                 ...sec.d.recipe.components.map((c) => [`${c.amount} uL`, c.name])] });
      for (const blk of sec.blocks) addBlock(sheet, blk);
      for (const t of sec.notes) addNote(sheet, t);
      if (sec.d.fetches) {
        for (const src of sourcesOf(b)) {
          if (!sheet.sources.some((y) => y.what === src.what)) addSource(sheet, src);
        }
      }
    }

    // A DECISION THE PLANNER REFUSED TO MAKE IS SHOWN, NOT SWALLOWED. Which oligo reads into a
    // junction is a lookup against the project's own oligos; a guess produces an unreadable trace
    // and a week's delay, and a plan that quietly omitted the step would read as not needing it.
    for (const b of session.bins) for (const o of b.open || []) addOpenDecision(sheet, o);

    // **A PCR WITH NO COMPUTED SIZE IS AN OPEN DECISION, NOT A BLANK TO FILL IN.** The size sets
    // the extension time, so a reaction without one cannot be run as written — and the person who
    // can close it is whoever holds the template's sequence, not the student standing at the
    // thermocycler. Raised here, once per template, so `c6-labplan` prints it with the rest and
    // somebody sees it before the sheet is issued rather than at the bench.
    const noSize = new Map();
    for (const b of session.bins) {
      if (String(b.operation).toLowerCase() !== 'pcr') continue;
      for (const x of b.samples || []) {
        if (x.productBp) continue;
        const t = (x.inputs || []).join(', ') || '(no template named)';
        if (!noSize.has(t)) noSize.set(t, x.note || 'no reason was recorded');
      }
    }
    // ONE LINE, AND NOT A LECTURE ABOUT LIBRARIES. An earlier version appended the library caveat
    // to every case, including a backbone PCR off a single plasmid — advice about a situation the
    // reaction is not in. Nothing here knows whether a template is a pool; that is a fact about
    // the template and there is nowhere to say it yet.
    for (const [t, why] of noSize) {
      addOpenDecision(sheet, `the PCR on ${t} has no product size, so its extension time cannot `
        + `be set — ${String(why).replace(/\s*Decide this by hand\.$/, '')} Supply the `
        + "template's sequence, or state the expected length.");
    }

    // VALUES ONLY — this must not draw the columns again, or every row would take a second label
    // and the packet would burn through the alphabet twice.
    const values = {};
    for (const b of session.bins) Object.assign(values, applyDesign(b, producer, { label: MUTE }).values);

    sheet.sources = sheet.sources.filter((x) => !madeHere.has(x.what));
    // The dilution table has live formulas in it, so the renderer draws it rather than receiving
    // it as rows — and it carries the sheet's id so its entry cells get namespaced slugs.
    if (first.dilution) sheet.dilution = { ...first.dilution, slug: `s${n}-dilution` };
    if (Object.keys(values).length) sheet.protocol_values = values;
    // DERIVED, NOT DECLARED. The renderer runs its own label check and used to read a `labelMax`
    // each design carried — miniprep and sequencing both said 24, which is not a tube, it is the
    // check turned off. It now reads the cap of the tube kind this sheet writes on, so `TUBE` is
    // the only place the number lives.
    sheet.labelMax = TUBE[sheet.tube].cap;
    return sheet;
  });

  // WHAT THE SHEETS THEMSELVES OBJECTED TO, gathered where somebody watching a run sees it. A
  // label nobody can write on a cap is not a reason to refuse the packet and is a reason to say so.
  // THE PREFIX QUESTION GOES ON SHEET ONE, where the first tube it applies to is written. On every
  // sheet it would be a paragraph about lab-wide uniqueness repeated eleven times; nowhere, and
  // nobody would learn that it was never checked.
  if (prefix.open && sheets.length) addOpenDecision(sheets[0], prefix.open);
  if (prefix.source !== 'answered')
    warnings.push(`labelPrefix "${prefix.value}" — ${prefix.why}`);

  for (const sh of sheets) for (const w of sh.warnings || []) warnings.push(`${sh.id}: ${w}`);
  warnings.push(...seamWarnings(sheets, unplaced, sequence));
  return { sheets, unplaced, warnings, sequence, decisions: { labelPrefix: prefix } };
}

/**
 * Which tube an operation labels. Unknown operations write on nothing, which is the safe answer:
 * the model then refuses any label at all and the gap shows up as an error rather than as a page.
 */
export function tubeFor(operation) {
  return TUBE_FOR[String(operation || '').toLowerCase()] || 'none';
}

/**
 * What the seam should say. These are facts about the experiment, not about this code, and they
 * belong where somebody is watching the pipeline run — Lactis3's oligos had been ordered and the
 * inventory had not been updated, and the only place that shows is here.
 */
function seamWarnings(sheets, unplaced, sequence) {
  const out = [];
  if (unplaced.length)
    out.push(`${unplaced.length} step(s) fall outside the "${sequence ? sequence.id : 'none'}" `
           + `sequence and get their own sheets: ${unplaced.map((b) => b.operation).join(', ')}`);

  const missing = sheets.flatMap((sh) => (sh.sources || [])
    .filter((i) => i.unlocated && !/no inventory/.test(i.note)).map((i) => i.what));
  if (missing.length)
    out.push(`${missing.length} material(s) named by this plan are not in the inventory: `
           + `${[...new Set(missing)].join(', ')}`);

  if (sheets.some((sh) => (sh.sources || []).some((i) => /no inventory was read/.test(i.note))))
    out.push('no inventory was read, so no sheet says where anything is. Pass --inventory <file>.');

  // An operation with no design gets a thin default sheet, and a thin sheet is the signal that
  // nobody has written the design yet. Signals nobody sees are not signals.
  //
  // ASK THE SHEET THAT EXISTS, NOT A BLANK ONE. This probed each operation with an empty sheet, so
  // any design whose module is a function OF the sheet — the assay reads `protocol=`, the stock
  // reads which antibiotics are missing — came back as having none, and the run reported a hole
  // that was not there.
  const undesigned = [...new Set(sheets.filter((sh) => !sh.metadata.module)
    .flatMap((sh) => sh.metadata.operations)
    // The dilution sheet IS its procedure — the renderer draws the tables and the formulas.
    .filter((op) => !['retransform', 'culture', 'analysis', 'dilution'].includes(op)))];
  if (undesigned.length)
    out.push(`no protocol module for: ${undesigned.join(', ')} — `
           + 'those sheets carry conditions and no procedure');
  return out;
}
