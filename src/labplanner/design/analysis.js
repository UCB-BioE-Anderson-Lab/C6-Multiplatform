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

export default {
  operation: 'analysis',
  title: 'Sequence analysis',
  module: null,
  shownAsColumn: ['verifies', 'tubes'],

  // ONE ROW PER CLONE, because the verdict is per clone and so is the decision to throw it away.
  // A single row for the construct had one verdict box for four answers.
  columns: (x, ctx) => {
    const construct = (x.params || {}).verifies || x.output;
    const tubes = String((x.params || {}).tubes || '').split(',').map((t) => t.trim())
      .filter(Boolean);
    const readsOf = (tube) => (x.inputs || [])
      .map((n) => String(n).replace(/_seq$/, ''))
      .filter((n) => n === tube || n.startsWith(`${tube}`))
      .join(', ');

    // FROM HERE ON, THIS CONSTRUCT IS WHICHEVER CLONE PASSED. Before this session "pBET8" is the
    // assembly reaction; after it, it is one of the minipreps, and WHICH one is the answer written
    // in the verdict rather than anything this compiler can know. So the holder becomes a sentence
    // rather than a label — naming one of them would be picking for them, and naming the assembly
    // tube would send somebody to electroporate an unverified reaction.
    ctx.hold(construct, `the clone that passed (one of ${tubes.join(', ') || construct})`);

    return (tubes.length ? tubes : [construct]).map((t) => ({
      clone: t, reads: readsOf(t) || '', result: '', explanation: '',
    }));
  },

  blocks: () => [
    { kind: 'heading', text: 'Result tokens — use one of these exactly' },
    { kind: 'table', rows: [['token', 'what it means'], ...VERDICTS] },
    { kind: 'heading', text: 'The single clone you are most confident about' },
    { kind: 'table', rows: [['clone', 'why'], ['', '']] },
  ],

  values: () => ({}),
  recipe: () => null,
  notes: () => [
    'Align every read against the intended sequence of the construct, not against each other.',
    'The whole confirmation region may not be readable. Pay attention to the assembly junctions '
    + 'and to consistency with the model.',
    'Throw out any miniprep that is not Perfect or Perfect Partial. A tube nobody trusts that '
    + 'stays in the box is a tube somebody uses next year.',
    'Write down which clone passed. Every session after this one fetches that tube, and if the '
    + 'answer is not on this sheet it is in somebody\u2019s memory.',
  ],
};
