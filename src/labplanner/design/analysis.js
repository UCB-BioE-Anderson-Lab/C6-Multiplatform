// analysis.js — the design of a sequence-analysis session.
//
// DESK WORK, AND STILL A SESSION. JCA's pairing names it as one of the nine: *"then seq
// analysis"*. It is where a wrong clone is caught, it takes a sitting, and a plan that omits it
// hands somebody a retransformation of an unverified plasmid.
//
// NOTHING IS MADE HERE, so there is no tube and no protocol module — the work is reading traces
// against the intended sequence. What the sheet carries is which reads belong to which clone and
// a place to write down which clone won, because that answer is the input to every later step and
// is otherwise held in somebody's memory.
// THE VERDICT VOCABULARY. Transcribed from the Lactis3-1 workbook's Seq Analysis tab, which is
// being retired — it is ordinary molecular biology and not one lab's convention, which is why it
// belongs here rather than in Cortex.
//
// **A free-text verdict is a column nobody can count.** "kinda matches", "close enough" and "1 bp
// off" are three people describing the same trace, and a term that distinguishes a silent mutation
// from a missense one is the difference between throwing a clone away and keeping it.
/**
 * The eight verdicts a sequencing read may be given, and what each means.
 *
 * **A FREE-TEXT VERDICT IS A COLUMN NOBODY CAN COUNT.** "kinda matches", "close enough" and "1 bp
 * off" are three people describing one trace, and the term that separates a silent mutation from a
 * missense one is the difference between keeping a clone and binning it.
 *
 * Transcribed from the Lactis3-1 workbook's Seq Analysis tab, which this retires. In C6 rather
 * than Cortex because it is ordinary molecular biology, not one lab's convention — ruled by JCA,
 * 2026-09-13: *"Those are appropriately in C6. Whether that ontology is sufficient is another
 * question, but what you did is good for now."*
 */
export const VERDICTS = [
  ['Perfect', 'Full region covered, matches the model.'],
  ['Perfect Partial', 'Matches where readable, but the region is not fully covered.'],
  ['Silent Mutation', 'Base change in the ORF, same amino acid.'],
  ['Missense Mutation', 'Base change in the ORF, the amino acid changes.'],
  ['Nonsense Mutation', 'Base change in the ORF, creates a stop codon.'],
  ['Indel', 'Insertion or deletion in the region — may frameshift.'],
  ['Mixed Clone', 'Two sequences in one trace; the colony was not clonal.'],
  ['Failed', 'Read unusable, or it will not align to the target.'],
];

// **TWO SESSIONS SHARE THIS OPERATION AND ARE NOT THE SAME WORK.** An analysis over sequencing
// reads asks *is this the plasmid we meant to build*; an analysis over an assay asks *what did the
// numbers say*. `planning/expandClones.js` marks the second with `of=assay`, from the graph, and
// everything below forks on it.
//
// The fork exists because the unforked sheet was WRONG rather than merely thin: a 96-clone Tecan
// screen was handed a page headed "Sequence analysis" carrying the eight read verdicts and the
// instruction to align every read against the intended sequence. Nothing about it was true of the
// session it named, and it was the session the whole screen turns on.
const OF_ASSAY = (x) => String((x?.params || {}).of || '') === 'assay';

export default {
  operation: 'analysis',
  title: ({ samples } = {}) => (OF_ASSAY(samples?.[0]) ? 'Assay analysis' : 'Sequence analysis'),
  module: null,
  // WHAT GOES UNDER THE TABLE. Declared, so a field the planner adds later cannot
  // leak onto the page. Anything in a column, in the notes, or bookkeeping is absent
  // by not being named here.
  conditions: [],
  // NOTHING IS FETCHED FOR AN ANALYSIS. Its inputs are trace files that arrive by email from the
  // sequencing facility, and the Source block asks one question — which box, which well. Listing
  // `pBET8-AF` there sent somebody to a freezer to look for a chromatogram.
  fetches: false,

  // ONE ROW PER CLONE, because the verdict is per clone and so is the decision to throw it away.
  // A single row for the construct had one verdict box for four answers.
  columns: (x, ctx) => {
    const construct = (x.params || {}).verifies || x.output;
    // THE MEASUREMENT BRANCH HAS NO PER-CLONE ROWS TO PRINT. The clones are in the assay's plate
    // map, ninety-six of them, and reprinting that here is the same table a third time. What this
    // sheet needs is the three numbers everything else is computed from, which is what it asks for.
    if (OF_ASSAY(x)) {
      ctx.hold(construct, construct);
      return [{ 'what to report': 'pTP2 mean (RFU/OD)', value: '' },
              { 'what to report': 'Mach1 mean (RFU/OD)', value: '' },
              { 'what to report': 'clones measured', value: '' }];
    }
    const tubes = String((x.params || {}).tubes || '').split(',').map((t) => t.trim())
      .filter(Boolean);
    const readsOf = (tube) => (x.inputs || [])
      .map((n) => String(n).replace(/_seq$/, ''))
      .filter((n) => n === tube || n.startsWith(`${tube}`))
      .join(', ');

    // AFTER THIS SESSION, `pBET8` MEANS THE CLONE THAT PASSED — and the labsheet says `pBET8`,
    // because nobody knows which clone that is when the sheet is written. JCA, 2026-09-12: *"It is
    // unknown when we write the labsheet which clone is being taken into this, so it is
    // appropriately written up as just pBET8. When the student goes to do this, they will type in
    // which clone(s) they are applying it to, so the spreadsheet should give a place for them to
    // put in this info, and then you can refer to the full actual clone name (pBET8-A) calculated
    // from the supplied clone designation."*
    //
    // An earlier version held a sentence — "the clone that passed (one of pBET8-A, pBET8-B)" —
    // which is honest prose and useless in a column somebody has to read a tube name out of. The
    // construct keeps its own name, and the sheet that uses it asks for the letter.
    ctx.hold(construct, construct);

    return (tubes.length ? tubes : [construct]).map((t) => ({
      clone: t, reads: readsOf(t) || '', result: '', explanation: '',
    }));
  },

  blocks: ({ samples } = {}) => (OF_ASSAY(samples?.[0]) ? [
    { kind: 'heading', text: 'What this session produces' },
    { kind: 'table', rows: [['output', 'what it is'],
      ['sorted list', 'every clone, one row, as a percent of the pTP2 mean — lowest first'],
      ['histogram', 'the same percentages binned, so the shape of the library is visible'],
      ['floor', 'the Mach1 mean as a percent of pTP2, drawn on the histogram']] },
    { kind: 'heading', text: 'Which clones to carry forward' },
    { kind: 'table', rows: [['clone', 'percent of pTP2', 'why this one'],
                            ...Array.from({ length: 8 }, () => ['', '', ''])] },
  ] : [
    { kind: 'heading', text: 'Result tokens — use one of these exactly' },
    { kind: 'table', rows: [['token', 'what it means'], ...VERDICTS] },
    { kind: 'heading', text: 'The single clone you are most confident about' },
    { kind: 'table', rows: [['clone', 'why'], ['', '']] },
  ]),

  values: () => ({}),
  recipe: () => null,
  notes: ({ samples } = {}) => (OF_ASSAY(samples?.[0]) ? [
    // NORMALISE BEFORE ANYTHING ELSE. Tlib2's workbook does OD, then fluorescence, then
    // fluorescence/OD, then percent-of-pTP2, in four sheets in that order — and the order is the
    // method. A percentage computed off raw RFU is a statement about how much culture was in the
    // well.
    'Divide every well\u2019s fluorescence by its own OD600 first. Everything below is computed '
    + 'from that ratio, never from raw fluorescence.',
    'Average the control wells, then express every clone as a percent of the pTP2 mean. Without '
    + 'pTP2 and Mach1 on the same plate the percentages mean nothing.',
    // THE FLOOR IS A BAND, NOT A LINE. Measured twice: Mach1 read 3.04% of pTP2 in Tlib2 and
    // 3.24% in Tlib1, two runs with quite different absolute signal — but the Mach1 wells carry
    // ~13% CV, so 2 SD spans roughly 2.2% to 3.9%.
    'Mark the Mach1 mean on the histogram. Clones at or below it drove the reporter to zero and '
    + 'the spread among them is measurement noise \u2014 they cannot be ranked against each other.',
    'Report the sorted list and the histogram together. A ranked list without the distribution '
    + 'hides how many clones are piled on the floor, which is the thing the next decision turns on.',
  ] : [
    'Align every read against the intended sequence of the construct, not against each other.',
    'The whole confirmation region may not be readable. Pay attention to the assembly junctions '
    + 'and to consistency with the model.',
    'Throw out any miniprep that is not Perfect or Perfect Partial. A tube nobody trusts that '
    + 'stays in the box is a tube somebody uses next year.',
    // **NOT "THAT TUBE".** JCA, 2026-09-17, ruling the claim about this table true and adding:
    // *"yes, unless there is a secondary or tertiary of it, in which case it would pick those."*
    // The note said every later session fetches the tube named here, and that is not what happens
    // — once a re-isolated miniprep of the same construct exists, `rules/cultureStage.rules.js`
    // sends people to the tertiary, then the secondary, and this tube is third in that order. The
    // note was describing a rule the toolkit does not follow, on the sheet where the choice is
    // recorded.
    'Write down which clone passed. Later sessions go to that construct, and where a re-isolated '
    + 'miniprep of it exists they go to that one instead — but the choice recorded here is what '
    + 'they are re-isolations OF. If the answer is not on this sheet it is in somebody\u2019s '
    + 'memory.',
  ]),
};
