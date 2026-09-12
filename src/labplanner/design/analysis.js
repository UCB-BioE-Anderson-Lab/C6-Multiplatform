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
export default {
  operation: 'analysis',
  title: 'Sequence analysis',
  module: null,
  shownAsColumn: [],
  columns: (x, ctx) => {
    const reads = ctx.from(x);
    const construct = (x.params || {}).verifies || x.output;
    // The DNA tubes those reads came from — what a later session actually fetches. The reads
    // themselves are spent in the machine.
    const tubes = String((x.params || {}).tubes || '').split(',').filter(Boolean)
      .map((n) => ctx.labelOf(n) || n).join(', ');
    // FROM HERE ON, THIS CONSTRUCT IS WHICHEVER CLONE PASSED. Before this session "pBET8" is the
    // assembly reaction; after it, it is one of the minipreps, and WHICH one is the answer written
    // in the verdict column rather than anything this compiler can know. So the holder becomes a
    // sentence rather than a label — a labsheet that named one of the four would be picking for
    // them, and naming the assembly tube would send them to electroporate an unverified reaction.
    ctx.hold(construct, `the verified clone (one of ${tubes || reads})`);
    return { construct, 'reads to read': reads, 'clone that passed': '' };
  },
  values: () => ({}),
  recipe: () => null,
  notes: () => [
    'Align every read against the intended sequence of the construct, not against each other.',
    'Write down which clone is correct. That name is what the next session transforms, and if it '
    + 'is not on this sheet it is in somebody’s memory.',
  ],
};
