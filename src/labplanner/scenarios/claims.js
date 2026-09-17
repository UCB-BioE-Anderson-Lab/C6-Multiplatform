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

/** Which session each operation lands in, as an ordered list. */
const order = () => (p) => ({
  caption: 'the sessions, in order',
  cols: ['#', 'session', 'operations'],
  rows: p.sheets.map((s, i) => [String(i + 1), s.title.replace(/ for Experiment.*/, ''),
                                (s.metadata.operations || []).join(' + ')]),
  more: 0,
});

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
    id: 'unreadable-marker', group: 'Controls',
    claim: 'A transformation whose antibiotic field cannot be read gets no rescue step and no '
         + 'control plates — and the sheet says nothing about why. The antibiotic column is simply '
         + 'blank, with no note and no STILL TO DECIDE beside it.',
    why: 'The rule behind this says "the sheet carries the question". It does not: it carries an '
       + 'empty cell. Whether cells need an outgrowth before plating turns entirely on which '
       + 'antibiotic it is, so a blank there is the one thing a student cannot work around — and '
       + 'three control plates have silently gone missing too.',
    // **I WROTE THIS CLAIM THE WAY THE RULE READS AND THE EVIDENCE CONTRADICTED IT**, which is the
    // second time this page has caught its own author. `rules/transformRecovery.rules.js §
    // unreadable` says *"no rescue decision and no controls; the sheet carries the question"* — and
    // the sheet has `notes: []`, `open: []`, and `antibiotic: ""`. Reworded to what happens, so JCA
    // rules on the toolkit rather than on my summary of it.
    from: { scenario: 'unreadable-marker' }, show: sheet('transform'),
  },
  {
    id: 'two-culture-stages', group: 'The freezer',
    claim: 'Where a construct has two minipreps taken from different stages of a serial culture, '
         + 'the EARLIER stage is the one the sheet sends somebody to fetch.',
    why: 'It is re-isolation rather than purification: each passage is another chance to pick up a '
       + 'rearrangement, so the earliest tube is the closest to what was built.',
    from: { scenario: 'two-culture-stages' }, show: sources('pcr'),
  },

  // ── order of work ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'nothing-left-open', group: 'The freezer',
    claim: 'With a full freezer and the one open question answered, a compile carries NO open '
         + 'decisions at all — so STILL TO DECIDE is a channel that empties, not a permanent '
         + 'fixture of every sheet.',
    why: 'Every other scenario falls short of this by exactly one: the two-character tube prefix, '
       + 'which cannot be a rule because whether it collides with another group\u2019s experiment '
       + 'is a fact about the lab. It is answered here through --answers, the mechanism built for '
       + 'it, and the compile comes out clean.',
    // **THIS SCENARIO EXISTED AND NO CLAIM POINTED AT IT, SO THE PAGE NEVER RAN IT.** `c6-report`
    // writes only the folders its claims name, which is right — and it meant the one example of a
    // clean compile was missing from the page built to show what a compile looks like. Found by
    // running `c6-labplan` over the folder and discovering there was no folder.
    from: { scenario: 'everything-answered' }, show: openDecisions(),
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
