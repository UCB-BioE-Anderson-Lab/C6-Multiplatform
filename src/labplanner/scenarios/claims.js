// claims.js — what the toolkit does, said as sentences somebody can answer true or false to.
//
// JCA, 2026-09-16, of the first version of `docs/REPORT.html`:
//
// > *"It's kinda an incomprehensible babble of facts. I really don't know how to review it. You need
// > to start over with it and express it as a series of claims questions that I can answer
// > true/false to."*
//
// He is right and the diagnosis is exact. The first page printed twenty-eight compiled experiments
// and fifteen broken ones and left the reader to work out which parts were assertions. **A page of
// evidence with no claim in it cannot be disagreed with**, so it cannot be reviewed — the reader has
// to invent the question before they can answer it, and inventing the question is the expensive
// half.
//
// So each entry here is ONE SENTENCE IN DOMAIN TERMS, asserting what the toolkit does, with the
// evidence for it underneath. The reader answers true or false. False is the useful answer: it
// means the toolkit does something a person who knows the chemistry would not do.
//
// ## Three rules about how a claim is written, and each is a way to get it wrong
//
// **A claim says what happens at a bench, never what the code does.** *"Four colonies picked into
// tubes are labelled pS-A through pS-D"* can be judged by somebody holding a marker. *"`design/
// pick.js` returns `cloneName(base, designation)`"* can be judged by nobody, and is the register the
// first report was written in.
//
// **A claim is falsifiable by its own evidence.** The sentence and the table under it are generated
// from the same run, so a claim whose wording has drifted from what the toolkit does is visible on
// the page rather than hidden in it. `test/labplanner/claims.test.js` checks that the evidence a
// claim points at actually exists.
//
// **A claim the author is confident about is still a claim.** The temptation is to list only the
// arguable ones. But the failures this repository keeps finding are in the parts nobody thought to
// look at — a picked tube took a running letter for weeks — and those are exactly the ones that
// never get written down as assertions.

// **THE EXTRACTORS CARRY THE OPERATION THEY LOOK AT, as `.op` on the function they return.** It is
// the one honest way to say which design a claim asserts something about: the extractor NAMES the
// operation whose sheet it goes and finds, so the attribution is structural rather than a guess.
// `coverage.js` reads it. Grepping the claim's sentence for `pcr` would not do — a claim can
// mention a PCR while showing a transformation sheet, and then it has asserted nothing about PCR.
const tag = (op, fn) => Object.assign(fn, { op });

import { experimentPrefix } from '../planning/naming.js';
import { CONDITIONS as LACTIS } from '../protocols/modules/lactis_electroporation.js';

/** The samples table of the sheet that carries an operation, as columns and rows. */
const sheet = (op, limit = 8) => tag(op, (p) => {
  const sh = p.sheets.find((s) => (s.metadata.operations || []).includes(op));
  if (!sh) return null;
  return { caption: sh.title,
           cols: sh.columns,
           rows: sh.samples.slice(0, limit).map((r) => sh.columns.map((c) => String(r[c] ?? ''))),
           more: Math.max(0, sh.samples.length - limit) };
});

/** A table a design contributes that is not its samples — the control plates, the well map. */
const block = (op, match) => tag(op, (p) => {
  const sh = p.sheets.find((s) => (s.metadata.operations || []).includes(op));
  if (!sh) return null;
  let heading = null;
  for (const b of sh.blocks || []) {
    if (b.kind === 'heading') heading = b.text;
    if (b.kind !== 'table' || !b.rows || b.rows.length < 2) continue;
    if (match && !(heading || '').toLowerCase().includes(match)) continue;
    return { caption: heading || sh.title, cols: b.rows[0].map(String),
             rows: b.rows.slice(1).map((r) => r.map((c) => String(c ?? ''))), more: 0 };
  }
  return null;
});

/** The `source:` rows of a sheet — what to fetch, and whether anything knows where it is. */
const sources = (op) => tag(op, (p) => {
  const sh = p.sheets.find((s) => (s.metadata.operations || []).includes(op));
  if (!sh || !sh.sources.length) return null;
  return { caption: `${sh.title} — what to fetch`,
           cols: ['material', 'box', 'well', 'what the sheet says'],
           rows: sh.sources.map((s) => [s.what, s.box || '—', s.well || '—', s.note || '']),
           more: 0 };
});

/** The prose a sheet carries below its table. */
const notes = (op) => tag(op, (p) => {
  const sh = p.sheets.find((s) => (s.metadata.operations || []).includes(op));
  if (!sh || !sh.notes.length) return null;
  return { caption: `${sh.title} — notes on the page`, lines: sh.notes };
});

/**
 * Just the note that speaks to the claim, out of a sheet that carries several.
 *
 * **A SESSION BINS THREE OPERATIONS AND THEIR PROSE ARRIVES IN ONE LIST.** `Gel, cleanup and
 * assembly` opens with the gel's note — *"this gel is analytical…"* — so a claim about how a column
 * BINDS was sitting above a paragraph about a gel, which is evidence for something else. A reader
 * would have had to notice that the sentence and the thing under it were about different steps,
 * which is the work the page exists to save.
 */
const noteMatching = (op, re) => tag(op, (p) => {
  const sh = p.sheets.find((s) => (s.metadata.operations || []).includes(op));
  const hit = (sh ? sh.notes : []).filter((n) => re.test(n));
  return hit.length ? { caption: `${sh.title} — on the page`, lines: hit } : null;
});

/** What the dilution session is actually for: which oligo, from what strength, to what. */
const dilutions = () => tag('dilution', (p) => {
  const sh = p.sheets.find((s) => s.dilution);
  if (!sh) return null;
  const d = sh.dilution;
  return { caption: `${sh.title} — ${d.stock_uM} µM down to ${d.target_uM} µM`,
           cols: ['oligo', 'what for', 'box', 'well'],
           rows: d.targets.map((t) => [t.oligo, t.description,
                                       t.located ? t.box : '(not in the inventory)',
                                       t.located ? t.well : '—']),
           more: 0 };
});

/** Every decision the compiler refused to make, or a plain statement that there were none. */
const openDecisions = () => (p) => {
  const open = p.sheets.flatMap((s) => (s.open || []).map((o) => `${s.title}: ${o}`));
  return { caption: open.length ? `${open.length} still to decide` : 'still to decide',
           lines: open.length ? open
                              : ['Nothing. Every question this compiler would not answer by rule '
                                 + 'has an answer, so no sheet carries a STILL TO DECIDE line.'] };
};

/**
 * What the naming rule gives for a spread of plausible experiment names, and which of them collide.
 *
 * **THE ONLY EVIDENCE ON THIS PAGE THAT DOES NOT COME FROM A COMPILE**, because the question is
 * about two experiments and a packet is one. It is still RUN rather than transcribed: the prefixes
 * below are whatever `experimentPrefix` returns today, so the day the rule changes this table
 * changes with it.
 */
const prefixes = () => () => {
  const names = ['Lactis3', 'Lymph3', 'Lactis2', 'Tlib3', 'Tlib4', 'BE1', 'pBET8',
                 'Subtilis1', 'Synth1', 'sensor-array'];
  // THE RULE THAT WAS REPLACED, KEPT HERE TO PUT BESIDE THE ONE THAT REPLACED IT. A claim that
  // something improved is not reviewable without the thing it improved on.
  const was = (n) => {
    const m = n.match(/^([A-Za-z])[A-Za-z_-]*?(\d+)$/);
    return m ? `${m[1].toUpperCase()}${m[2].slice(-1)}`
             : (n.replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || 'X').replace(/^./, (c) => c.toUpperCase());
  };
  const got = names.map((n) => [n, was(n), experimentPrefix(n)]);
  const tally = (i) => {
    const c = new Map();
    for (const r of got) c.set(r[i], (c.get(r[i]) || 0) + 1);
    return c;
  };
  const before = tally(1); const after = tally(2);
  return { caption: 'the same ten experiment names, under the old rule and the one in the code now',
           cols: ['experiment', 'was', 'is now', 'tubes read', ''],
           rows: got.map(([n, o, pre]) => [n, before.get(o) > 1 ? `${o}  ✗` : o, pre,
                                           `${pre}a, ${pre}b, ${pre}c`,
                                           after.get(pre) > 1 ? 'STILL COLLIDES' : '']),
           more: 0 };
};

/** What the file told the protocol — which should be four things and not a pulse. */
const protocolValues = () => (p) => {
  const sh = p.sheets.find((s) => (s.metadata.operations || []).includes('retransform'));
  const v = Object.values((sh || {}).protocol_values || {})[0] || {};
  return { caption: `${(sh || {}).title || 'the sheet'} — what the file told the protocol`,
           cols: ['the protocol is told', 'the file said'],
           rows: Object.entries(v).map(([k, x]) => [k, String(x)]), more: 0 };
};

/**
 * The organism's own numbers, read off the protocol rather than out of the prose.
 *
 * **RUN, NOT QUOTED.** If somebody changes the field strength, this table changes and the claim
 * above it stops being true on the page — which is the only way a number in a sentence stays
 * honest. → `protocols/modules/lactis_electroporation.js § CONDITIONS`
 */
const lactisConditions = () => () => ({
  caption: 'what the protocol carries, because it is the organism\u2019s and not the file\u2019s',
  cols: ['', ''],
  rows: [
    ['cuvette', `${LACTIS.cuvette_cm} cm`],
    ['pulse', `${(LACTIS.volts / 1000).toFixed(1)} kV — ${LACTIS.field_kV_per_cm} kV/cm`],
    ['time constant to expect', `${LACTIS.time_constant_ms} ms`],
    ['cells / DNA per reaction', `${LACTIS.cells_uL} µL / ${LACTIS.dna_uL} µL`],
    ['recovery', `${LACTIS.recovery_uL} µL, ${LACTIS.recover_min}–${LACTIS.recover_max_min} min at ${LACTIS.recover_C} °C`],
    ['harvested at', `OD600 ${LACTIS.harvest_od600}`],
    ['plated', `${LACTIS.plate_uL.join(', ')} µL`],
  ],
  more: 0,
});

/** Which session each operation lands in, as an ordered list. */
const order = () => (p) => ({
  caption: 'the sessions, in order',
  cols: ['#', 'session', 'operations'],
  rows: p.sheets.map((s, i) => [String(i + 1), s.title.replace(/ for Experiment.*/, ''),
                                (s.metadata.operations || []).join(' + ')]),
  more: 0,
});


/**
 * The claims JCA has already answered, and when.
 *
 * **SO THE PAGE CAN SAY WHICH ONES ARE NEW.** Thirty-six claims and five of them unanswered is a
 * hunt, and the first thing he asked on opening the page a second time was which ones were his to
 * do. A claim leaves this list by being rewritten, not by being agreed with — the date records that
 * somebody read THAT SENTENCE, so changing the sentence has to cost the ruling.
 *
 * Kept as a set of ids rather than a field on each claim, because it is a record of what happened
 * on a day and not a property of the claim. → `docs/REPORT.html`
 */
export const RULED = new Map([
  ['stock-sheet-is-prose', '2026-09-17'],
  ['assembly-names-the-tubes', '2026-09-17'],
  ['gel-is-analytical', '2026-09-17'],
  ['prefix-from-whole-name', '2026-09-17'],
  ['prefix-is-a-note', '2026-09-17'],
  ['no-antibiotic', '2026-09-17'],
  ['unknown-antibiotic', '2026-09-17'],
  ['two-culture-stages', '2026-09-17'],
  ['odd-strength-asks', '2026-09-17'],
  ['well-not-recorded', '2026-09-17'],
  ['picked-tube-name', '2026-09-15'],
  ['name-survives', '2026-09-15'],
  ['pcr-tube-code', '2026-09-15'],
  ['zymo-prefix', '2026-09-15'],
  ['library-address', '2026-09-15'],
  ['four-in-tubes', '2026-09-15'],
  ['five-in-block', '2026-09-15'],
  ['one-block-shared', '2026-09-15'],
  ['block-overflow', '2026-09-15'],
  ['short-taq', '2026-09-15'],
  ['long-program', '2026-09-15'],
  ['no-size-no-program', '2026-09-15'],
  ['small-fragment-bind', '2026-09-15'],
  ['three-plates', '2026-09-15'],
  ['amp-no-controls', '2026-09-15'],
  ['assay-well-map', '2026-09-15'],
  ['dilution-session', '2026-09-15'],
  ['absent-is-asked', '2026-09-15'],
  ['unsearched-is-not-absent', '2026-09-15'],
  ['untracked-box', '2026-09-15'],
  ['miniprep-box-not-well', '2026-09-15'],
  ['session-order', '2026-09-15'],
  ['verdict-before-use', '2026-09-15'],
  ['refuse-duplicate', '2026-09-15'],
  ['refuse-no-product', '2026-09-15'],
  ['refuse-cycle', '2026-09-15'],
  ['unknown-verb', '2026-09-15'],
  ['missing-clone-base', '2026-09-15'],
  ['long-name-warns', '2026-09-15'],
  ['silent-use-before', '2026-09-15'],
  ['silent-bad-inventory', '2026-09-15'],
]);

/**
 * Every claim, grouped the way somebody would check them: tubes, then plastic, then chemistry,
 * then controls, then the freezer, then what it refuses, then what nothing catches.
 *
 * Fields:
 *
 *   id       stable, so an answer can name it
 *   group    the heading it sits under
 *   claim    ONE SENTENCE, in domain terms, that is true or false
 *   why      optional: why this is a decision rather than an obvious consequence. Shown small.
 *   from     `{scenario}` or `{fault}` — which run the evidence comes from
 *   show     what to render underneath: a table, some lines, or the message
 */
export const CLAIMS = [
  // ── what goes on a tube ───────────────────────────────────────────────────────────────────────
  {
    id: 'picked-tube-name', group: 'What goes on a tube',
    claim: 'When four colonies are picked into tubes, each tube is labelled with the construct name '
         + 'and a clone letter — pS-A, pS-B, pS-C, pS-D — and not a short code.',
    why: 'The alternative, used until 2026-09-15, was the next letter of a per-experiment sequence '
       + '(L3h). Two naming schemes on one object.',
    from: { scenario: 'declared-verification' }, show: sheet('pick'),
  },
  {
    id: 'name-survives', group: 'What goes on a tube',
    claim: 'That same name follows the material: the colony and the miniprep made from it both say '
         + 'pS-A, and the sequencing tube adds only the read direction — pS-AF.',
    // **THE FIRST WORDING SAID THE SEQUENCING TUBE ALSO SAYS `pS-A`, AND THE TABLE UNDER IT SAID
    // `pS-AF`.** The page caught its own claim, which is the property it was built for: sentence and
    // evidence come from one run, so a claim that has drifted sits above something contradicting it
    // rather than passing as prose. Reworded to what the toolkit does, which is the thing JCA is
    // being asked to judge — a wrong sentence would have had him ruling on a behaviour that is not
    // there.
    why: 'A label that changes at each step has to be cross-referenced at each step. The sequencing '
       + 'tube leaves the building and comes back as a file named for what was written on it.',
    // THE SEQUENCING TABLE, NOT THE MINIPREP'S. The claim is about the name surviving ONTO the tube
    // that leaves, and the miniprep table alone shows half of that — a reader would have had to
    // take the other half on trust, which is the thing this page is for.
    from: { scenario: 'declared-verification' }, show: block('sequencing', 'sequencing'),
  },
  {
    id: 'pcr-tube-code', group: 'What goes on a tube',
    claim: 'A PCR tube gets a short code instead — Sha, Shb — because the cap of a 200 µL strip '
         + 'tube holds about three characters.',
    from: { scenario: 'short-product' }, show: sheet('pcr'),
  },
  {
    id: 'zymo-prefix', group: 'What goes on a tube',
    claim: 'The cleanup of PCR tube Mia is labelled zMia, so the tube says what it came from.',
    from: { scenario: 'minimal' }, show: block('zymo', 'cleanup'),
  },
  {
    id: 'library-address', group: 'What goes on a tube',
    claim: 'Thirty clones of a library are named by plate address — pS-1A1, pS-1B1 — rather than by '
         + 'letter, because letters run out and an address says where the colony was.',
    from: { scenario: 'thirty-library' }, show: sheet('miniprep', 6),
  },

  // ── plasticware ───────────────────────────────────────────────────────────────────────────────
  {
    id: 'four-in-tubes', group: 'Plasticware and layout',
    claim: 'Four picked colonies go into four tubes, one each, rather than into a block.',
    from: { scenario: 'declared-verification' }, show: notes('pick'),
  },
  {
    id: 'five-in-block', group: 'Plasticware and layout',
    claim: 'Five picked colonies go into a 24-well block instead, filled DOWN the columns — '
         + 'A1, B1, C1, D1, then A2.',
    why: 'Down the columns is the axis a multichannel travels and the axis a block is read along.',
    from: { scenario: 'five-clones' }, show: sheet('pick'),
  },
  {
    id: 'one-block-shared', group: 'Plasticware and layout',
    claim: 'Four constructs picked four ways each share ONE 24-well block, filling A1 through D4 — '
         + 'not four blocks that each start at A1.',
    from: { scenario: 'four-constructs' }, show: sheet('pick', 16),
  },
  {
    id: 'block-overflow', group: 'Plasticware and layout',
    claim: 'Thirty-two clones asked into one 24-well block is refused rather than seated somehow, '
         + 'and the message names the count and the vessel.',
    why: 'Which sitting a second block belongs to is a scheduling decision, not a layout one.',
    from: { fault: null, scenario: 'block-too-small' }, show: 'message',
  },

  // ── chemistry ─────────────────────────────────────────────────────────────────────────────────
  {
    id: 'short-taq', group: 'PCR chemistry and programs',
    claim: 'A 231 bp product is run with Taq, and its thermocycler program is the annealing '
         + 'temperature alone (55) rather than a named program.',
    from: { scenario: 'short-product' }, show: sheet('pcr'),
  },
  {
    id: 'long-program', group: 'PCR chemistry and programs',
    claim: 'A 9 kb product gets PGXL4, while a 1.4 kb product in the same experiment gets PG2K55 — '
         + 'the program follows the simulated length.',
    from: { scenario: 'long-product' }, show: sheet('pcr'),
  },
  {
    id: 'no-size-no-program', group: 'PCR chemistry and programs',
    claim: 'A PCR whose product could not be simulated gets NO program — and because a sheet '
         + 'without one tells somebody to run a reaction and cannot say how, no workbook is '
         + 'written at all. The packet still compiles, so the reaction can be looked at.',
    why: 'JCA, 2026-09-16, of the earlier behaviour: "That means the construction file is invalid. '
       + 'Either there is an error in the CF or in the simulator and it should be resolved somehow '
       + 'rather than return labsheets." The refusal is at the workbook and not in the planner, '
       + 'because a PCR whose primers nobody has chosen yet, and a file robbed of every size by one '
       + 'absent template, both still deserve to compile.',
    from: { scenario: 'unsimulatable-pcr' }, show: sheet('pcr'),
  },
  {
    id: 'small-fragment-bind', group: 'PCR chemistry and programs',
    claim: 'A cleanup of a 231 bp fragment is told to bind with added isopropanol, because short '
         + 'DNA washes through a column under the standard bind.',
    from: { scenario: 'short-product' }, show: noteMatching('zymo', /isopropanol|ADB/),
  },

  // ── controls ──────────────────────────────────────────────────────────────────────────────────
  {
    id: 'three-plates', group: 'Controls',
    claim: 'A kanamycin transformation is given three control plates beside the real one, and the '
         + 'sheet says what each one would prove.',
    why: 'A blank plate has four causes; the controls are how you tell them apart.',
    from: { scenario: 'minimal' }, show: block('transform', 'control'),
  },
  {
    id: 'amp-no-controls', group: 'Controls',
    claim: 'An ampicillin transformation is plated straight after the heat shock, with no outgrowth '
         + 'step and no control plates injected.',
    why: 'Beta-lactams act on the cell wall, so the gene need not be expressed first.',
    from: { scenario: 'amp-no-rescue' }, show: sheet('transform'),
  },
  {
    id: 'assay-well-map', group: 'Controls',
    claim: 'The assay sheet carries a map of what is in every well of the block it reads, including '
         + 'the untransformed control.',
    why: 'A plate reader returns a grid of numbers, and a grid with no key is not data.',
    from: { scenario: 'phase-two' }, show: block('assay', 'what is in each well'),
  },

  // ── the freezer ───────────────────────────────────────────────────────────────────────────────
  {
    id: 'dilution-session', group: 'The freezer',
    claim: 'Oligos held at 100 µM get a session of their own, before the PCR, that makes the 10 µM '
         + 'working stocks — rather than the PCR sheet telling somebody to dilute as they go.',
    from: { scenario: 'minimal' }, show: dilutions(),
  },
  {
    id: 'absent-is-asked', group: 'The freezer',
    claim: 'A material the inventory does not mention is asked for on the sheet — where did you '
         + 'find it — rather than being given a box and a well that nobody recorded.',
    from: { scenario: 'minimal' }, show: sources('pcr'),
  },
  {
    id: 'unsearched-is-not-absent', group: 'The freezer',
    claim: 'With no inventory at all, the sheet says nothing was looked up — which reads '
         + 'differently from a material that was looked for and not found.',
    from: { scenario: 'no-inventory' }, show: sources('pcr'),
  },
  {
    id: 'untracked-box', group: 'The freezer',
    claim: 'A tube in a box that deliberately records no wells prints the box and asks for nothing, '
         + 'rather than asking a question whose answer goes stale in days.',
    from: { scenario: 'untracked-box' }, show: sources('pcr'),
  },
  {
    id: 'miniprep-box-not-well', group: 'The freezer',
    claim: 'A miniprep sheet prints the box the tubes go in and leaves the well blank for somebody '
         + 'to write at the freezer.',
    why: 'The box is a standing decision; the well is a fact recorded when the tube exists.',
    from: { scenario: 'declared-verification' }, show: sheet('miniprep'),
  },

  {
    id: 'odd-strength-asks', group: 'The freezer',
    claim: 'An oligo held at 50 µM — neither the working strength nor the stock — is not diluted '
         + 'silently. The sheet says what was actually found and leaves the arithmetic to a person.',
    why: 'A 10 µM working stock is made from a 100 µM one by a known dilution. From 50 µM it is a '
       + 'different sum, and guessing which the tube really is puts the wrong primer concentration '
       + 'in every reaction on the sheet.',
    from: { scenario: 'odd-strength' }, show: sources('pcr'),
  },
  {
    id: 'well-not-recorded', group: 'The freezer',
    claim: 'A tube in a tracked box whose well nobody wrote down prints the box and ASKS for the '
         + 'well — rather than being reported as missing, which it is not.',
    why: 'Half the record is stable and half is a gap. Collapsing the two sends somebody to search '
       + 'a whole freezer for a tube whose box is known.',
    from: { scenario: 'well-not-recorded' }, show: sources('pcr'),
  },
  {
    id: 'unknown-antibiotic', group: 'Controls',
    claim: 'A transformation that says to plate on something which is not the name of an '
         + 'antibiotic — "Bubba" where "Carb" belongs — is REFUSED. No workbook is written, and '
         + 'the message names the word it could not read and lists the ones it knows.',
    why: 'Your ruling on 2026-09-17, of the workbook this used to produce: "If the antibiotic '
       + 'field is like Bubba instead of Carb, it is not even parsible as a CF." It used to '
       + 'compile. The parser dropped the word, the recovery rules found no antibiotic and quite '
       + 'correctly declined to guess, and the sheet came out with a blank antibiotic column and '
       + 'three control plates silently missing — every decision on the way defensible, the page '
       + 'unusable. The names are listed in the message because the fix is usually a spelling.',
    from: { fault: 'unknown-antibiotic' }, show: 'message',
  },
  {
    id: 'no-antibiotic', group: 'Controls',
    claim: 'A transformation whose antibiotic cell is left EMPTY is refused as well. No workbook '
         + 'is written, and the message says the step does not say what to plate on and lists the '
         + 'names it will accept.',
    why: 'Your ruling on 2026-09-17: "they need to state a valid antibiotic for it to be parsible '
       + 'cf." It used to compile. A rule called transformRecovery.unreadable saw no antibiotic '
       + 'and declined to guess — which was right — but declining still produced a printable page '
       + 'with a blank column and three control plates missing, and somebody takes that to a '
       + 'bench. It gets a separate message from the misspelling case, because telling somebody '
       + 'their antibiotic is not recognised when they never wrote one sends them hunting a typo '
       + 'they never made.',
    from: { fault: 'no-antibiotic' }, show: 'message',
  },
  {
    id: 'two-culture-stages', group: 'The freezer',
    claim: 'Where the same plasmid sits in the freezer minipreped at all four stages — primary, '
         + 'secondary, tertiary and quaternary — the sheet sends somebody to the TERTIARY. Not '
         + 'the freshest tube, and not the cleanest-sounding one.',
    why: 'Your ruling on 2026-09-17: "The secondary is much cleaner than the primary. The '
       + 'tertiary is about as good as the secondary, and carries less risk of running out of the '
       + 'precious clean secondary. A quaternary or higher is starting to potentially risk drift. '
       + 'So, I would make the order 3>2>1>4+." The code used to score every stage as one better '
       + 'than the last, so a quaternary outranked everything — nothing had ever asked whether '
       + 'later kept being better past the tertiary.',
    // **THE CLAIM THIS REPLACED SAID THE EARLIER STAGE WAS FETCHED, AND THE CODE FETCHED THE
    // LATER ONE.** Its own evidence table said `secondary culture` directly underneath the word
    // EARLIER and I did not look. JCA ruled it false on the domain and supplied the order, which
    // is a better outcome than I deserved from it.
    //
    // The fixture now writes all four stages. With only a primary and a secondary in the box,
    // "prefer the later one" and 3 > 2 > 1 > 4+ pick the same tube and the evidence proves
    // nothing. → `generate.js § staged`
    from: { scenario: 'two-culture-stages' }, show: sources('pcr'),
  },

  // ── order of work ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'prefix-is-a-note', group: 'The freezer',
    claim: 'The sheet no longer asks anybody about the tube prefix. It states what the labels '
         + 'start with and that nothing checked them against other experiments, and that is all — '
         + 'the line is an ordinary note, not a STILL TO DECIDE.',
    why: 'Your ruling on 2026-09-17: "It should come up with a unique-like name, but it is '
       + 'unrealistic to coordinate, and unlikely to have a collision." An instruction nobody can '
       + 'carry out, sitting in the channel reserved for ones that can, devalues every real '
       + 'question on the page — and the real ones, like where an unlocated tube is, go to the '
       + 'person who actually knows.',
    from: { scenario: 'stock-in-freezer' }, show: noteMatching('pcr', /Tube labels start/),
  },
  {
    id: 'prefix-from-whole-name', group: 'The freezer',
    claim: 'The two letters are now the experiment\u2019s initial and one character standing for '
         + 'the WHOLE name, so Lactis3 and Lymph3 no longer land on the same prefix — and neither '
         + 'do Lactis2 and Lactis3. The initial is kept so a tube still hints at where it came '
         + 'from.',
    why: 'Your "nice simple plan" on 2026-09-17, built. Across seventy-two names of the form '
       + '<organism><number>, the share of pairs that collide goes from 1.4% to 0.4%. But TWO '
       + 'CHARACTERS IS A CEILING and this does not remove the problem: twenty-one usable second '
       + 'characters means a lab running twenty experiments at once still has about a one-in-two '
       + 'chance that some pair shares a prefix. The only real lever left is a third character, '
       + 'and what stops that is the PCR strip tube cap — three characters including the running '
       + 'letter. That is a fact about the plastic, and yours to rule on rather than mine.',
    // **THE SECOND CHARACTER AVOIDS 0/O, 1/l, 2/z, 5/s, 6/b, 8/B and 9/g**, which are each other
    // at 3 mm on a frozen cap, and is lower case only because `Lk` and `LK` are not distinguishable
    // in most handwriting. That costs entropy and buys a label that means one thing — this label is
    // an exact key somebody reads back to find a tube. → `planning/naming.js § SECOND`
    from: { scenario: 'stock-in-freezer' }, show: prefixes(),
  },
  {
    id: 'gel-is-analytical', group: 'Plasticware and layout',
    claim: 'The gel before an assembly makes no new tube and nothing is cut out of it. A few µL '
         + 'come out of each PCR tube for the gel, and the PCR tube itself carries on to the '
         + 'cleanup — so the gel row shows which tube it LOADS, not a tube it produces.',
    why: 'A gel can be either: a check, or a purification you cut a band out of. They need '
       + 'different plasticware, different volumes, and the second consumes the sample. The sheet '
       + 'states which one this is rather than leaving it to the reader.',
    from: { scenario: 'minimal' }, show: sheet('gel'),
  },
  {
    id: 'assembly-names-the-tubes', group: 'Plasticware and layout',
    claim: 'The Golden Gate row names the fragments by the TUBES they are in — "zMya + zMyb", the '
         + 'cleaned-up tubes from two rows above — rather than by the construct names in the '
         + 'construction file.',
    why: 'At the bench you are looking for a tube in a rack, not a name in a file. The z prefix is '
       + 'this lab\u2019s convention for a cleaned-up tube, so zMya IS Mya after the Zymo column.',
    from: { scenario: 'minimal' }, show: block('goldengate', 'golden gate'),
  },
  {
    id: 'analysis-is-blank', group: 'Controls',
    claim: 'The sequence analysis sheet arrives with its result and explanation columns EMPTY — one '
         + 'row per clone, for a person to fill in — and a fixed list of result tokens above it to '
         + 'choose from: Perfect, Perfect Partial, Silent Mutation, Missense Mutation and the rest.',
    why: 'The verdict is the one thing in the packet the compiler cannot compute. A fixed '
       + 'vocabulary is what makes the answer readable by the next session rather than a sentence '
       + 'somebody wrote in their own words.',
    from: { scenario: 'minimal' }, show: block('analysis', 'result tokens'),
  },
  {
    id: 'analysis-picks-one', group: 'Controls',
    claim: 'Below the per-clone table the analysis sheet has a second, one-row table: the single '
         + 'clone you are most confident about, and why. Every session after this one fetches that '
         + 'tube.',
    why: 'Four verdicts do not say which tube to use next. The sheet asks for the choice in '
       + 'writing, and says on the page why: "if the answer is not on this sheet it is in '
       + 'somebody\u2019s memory".',
    from: { scenario: 'minimal' }, show: block('analysis', 'confident'),
  },
  {
    id: 'culture-block-count', group: 'Plasticware and layout',
    claim: 'Where four constructs are each picked four times, the picking sheet lists all SIXTEEN '
         + 'clones in one 24-well block, wells A1 through D4, and the note above the table says '
         + 'sixteen — the same number as the rows under it.',
    why: 'It said FOUR until 2026-09-17. The note took its count from one construct\u2019s clone '
       + 'number while the table held four constructs binned onto one sheet, so the sentence '
       + 'describing the layout disagreed with the layout. Six sheets in the matrix said it and '
       + 'nothing failed, because no test reads a note against its own table.',
    from: { scenario: 'four-constructs' }, show: noteMatching('culture', /clones in a/),
  },
  {
    id: 'culture-photograph', group: 'Controls',
    claim: 'The picking sheet tells you to photograph the plates under blue and ambient light '
         + 'BEFORE picking, and says why: the photographs are the record of what you chose '
         + 'between.',
    why: 'Once the colonies are picked the plate is spent and what else was on it is gone. If a '
       + 'clone turns out wrong later, the only way to ask whether a better colony was there is '
       + 'the photograph.',
    from: { scenario: 'four-constructs' }, show: noteMatching('culture', /[Pp]hotograph/),
  },
  {
    id: 'method-not-described', group: 'What it refuses, and what it says',
    claim: 'A characterization step asking to electroporate into an organism this toolkit has no '
         + 'procedure for is REFUSED. No workbook is written. The message names the organism, '
         + 'says a protocol is per ORGANISM rather than per method, and says where to add one.',
    why: 'Your two rulings on 2026-09-17, an hour apart. First: "the right answer is you reject '
       + 'the request, because the characterization operation was not defined" — the sheet had '
       + 'been carrying the procedure with three blanks in it, and a page that admits its own '
       + 'gaps is still a page somebody takes to a bench. Then: "the rescue volume, temps, '
       + 'voltage are all about a different organism" — which moved the missing thing. It is not '
       + 'three values a file should have supplied; it is a whole procedure nobody has written. '
       + 'B.subtilis is that gap today and is sitting here as the example of one.\n\nAnd it is not '
       + 'hypothetical. Searching a real project\u2019s entire issue history for this procedure '
       + 'turns up two independent write-ups, two months apart. Both record the cell volume, the '
       + 'DNA volume, the recovery volume and the recovery medium. NEITHER records the voltage or '
       + 'the cuvette gap. The numbers a compiler cannot guess are exactly the ones nobody writes '
       + 'down — which is why the organism has to own them, not the file.',
    from: { fault: 'method-not-described' }, show: 'message',
  },
  {
    id: 'lactis-has-its-own-numbers', group: 'What it refuses, and what it says',
    claim: 'Name L.lactis instead and the same file compiles, and the protocol underneath carries '
         + 'the ORGANISM\u2019S numbers rather than the file\u2019s: a 0.2 cm cuvette at 2.0 kV, '
         + '40 µL of cells, 1 µL of DNA, 1 mL of recovery medium, 30 °C. The file says none of '
         + 'those and is not asked to.',
    why: 'Your ruling: "I think we want this a specific L. lactis electroporation protocol, not a '
       + 'generic electroporation one with settings we have to pass in... the rescue volume, '
       + 'temps, voltage are all about a different organism, and not the same as e. coli." '
       + 'heat_shock_transformation is the precedent next door — E. coli\u2019s procedure with '
       + 'E. coli\u2019s numbers in it, not a generic transformation with the heat shock '
       + 'temperature passed in.\n\nTwo things to check below. The volumes came from your own '
       + 'issue thread, twice, two months apart. The electrical settings did NOT — nobody ever '
       + 'wrote them down — so 2.0 kV in a 0.2 cm cuvette is the published figure for this '
       + 'organism and not a record of what your machine was set to.',
    from: { scenario: 'four-constructs' }, show: lactisConditions(),
  },
  {
    id: 'retransform-conditions', group: 'Controls',
    claim: 'What the electroporation sheet does carry is one row per construct with the host, the '
         + 'antibiotic and the temperature the CHARACTERIZATION file asked for — L.lactis, Kan, '
         + '30 °C — not the ones the cloning transformation used.',
    why: 'The cloning host and the host being tested are different organisms with different '
       + 'selection and different growth temperatures. The cloning step above ran in Mach1 at 37 '
       + 'on its own marker; carrying those values forward would plate L.lactis at 37 on the '
       + 'E. coli one, and it would simply not grow.',
    from: { scenario: 'four-constructs' }, show: sheet('retransform'),
  },
  {
    id: 'stock-sheet-is-prose', group: 'The freezer' + '',
    claim: 'The antibiotic stock session has NO table at all — no rows, no columns. It is three '
         + 'notes: that the inventory records no kan stock, to check the shelf before weighing '
         + 'anything, and that plates and media are made from this so it comes first.',
    why: 'Every other session in the packet is a table of samples. This one is a session that '
       + 'exists to say something must be made before anything else can start, and there is '
       + 'nothing to tabulate — one stock, no per-sample variation. Whether a session with an '
       + 'empty table reads as a session or as a bug is the question.',
    from: { scenario: 'minimal' }, show: notes('stock'),
  },
  {
    id: 'session-order', group: 'The order of the work',
    claim: 'The sessions come out in an order somebody could actually work: stocks and dilutions '
         + 'first, then PCR, then the gel and assembly, then the transformation, and the sequence '
         + 'analysis before anything that uses a verified plasmid.',
    from: { scenario: 'phase-two' }, show: order(),
  },
  {
    id: 'verdict-before-use', group: 'The order of the work',
    claim: 'The electroporation into the assay host happens AFTER the sequence analysis, not '
         + 'beside the miniprep that feeds it.',
    from: { scenario: 'verify-and-phase-two' }, show: order(),
  },

  // ── what it refuses ───────────────────────────────────────────────────────────────────────────
  {
    id: 'refuse-duplicate', group: 'What it refuses, and what it says',
    claim: 'Two steps that both claim to make `frag` is refused, and the message names `frag`.',
    from: { fault: 'duplicate-product' }, show: 'message',
  },
  {
    id: 'refuse-no-product', group: 'What it refuses, and what it says',
    claim: 'A characterization line naming no product is refused, and the message names the line '
         + 'number and says a step needs both a subject and a product.',
    from: { fault: 'no-product' }, show: 'message',
  },
  {
    id: 'refuse-cycle', group: 'What it refuses, and what it says',
    claim: 'Two steps that each wait for the other are refused as a cycle rather than being put in '
         + 'some order anyway.',
    from: { fault: 'cycle' }, show: 'message',
  },
  {
    id: 'unknown-verb', group: 'What it refuses, and what it says',
    claim: 'A verb the grammar does not know is named, the message lists the verbs that ARE known, '
         + 'and no labsheets are written.',
    why: 'JCA, 2026-09-16: "it should not return labsheets with an unknown operation." The parser '
       + 'falls back to guessing — first token the operation, last the product — and every sheet '
       + 'built on that inherits the guess without saying so.',
    from: { fault: 'unknown-operation' }, show: 'message',
  },
  {
    id: 'missing-clone-base', group: 'What it refuses, and what it says',
    claim: 'A miniprep over a picked block with no clone= is reported once, naming the one word '
         + 'that would fix it — not once per clone.',
    from: { fault: 'cannot-expand' }, show: 'message',
  },
  {
    id: 'long-name-warns', group: 'What it refuses, and what it says',
    claim: 'A construct name too long for a tube cap is a WARNING and the experiment still '
         + 'compiles, because the name came from the file and that is the author’s to choose.',
    from: { fault: 'long-name' }, show: 'message',
  },

  // ── what used to be the bad news ───────────────────────────────────────────────────────────
  {
    id: 'silent-use-before', group: 'Mistakes that used to pass silently',
    claim: 'A construction file that says `GoldenGate frag1 …` on line 1 and `PCR … frag1` on '
         + 'line 2 — consuming a fragment the NEXT line makes — is now refused, naming both lines.',
    why: 'JCA, 2026-09-16: "Are you imagining a scenario where they first say: GoldenGate frag1 and '
       + 'then next line say PCR frag1? That would be an invalid construction file." It is, and '
       + 'nothing said so: the check existed and was structurally dead, because the map of what is '
       + 'produced was filled AS the walk went, so when line 1 was examined line 2\u2019s product '
       + 'was not in it yet and the test could never be true.',
    from: { fault: 'use-before-produced' }, show: 'message',
  },
  {
    id: 'silent-bad-inventory', group: 'Mistakes that used to pass silently',
    claim: 'An inventory file that is prose rather than a freezer produces no message either — it '
         + 'reads as an EMPTY freezer, which is a different thing.',
    from: { fault: 'inventory-unreadable' }, show: 'message',
  },
];

/**
 * One claim by name, or null.
 *
 * @param {string} id
 * @returns {Object|null}
 */
export function claim(id) {
  return CLAIMS.find((c) => c.id === id) || null;
}

/** The groups, in the order they are written. */
export function groups() {
  return [...new Set(CLAIMS.map((c) => c.group))];
}
