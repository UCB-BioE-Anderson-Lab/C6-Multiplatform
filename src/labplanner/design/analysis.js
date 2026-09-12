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
  columns: (x) => ({ clone: x.output, 'reads to read': (x.inputs || []).join(', '),
                     'verdict': '' }),
  values: () => ({}),
  recipe: () => null,
  notes: () => [
    'Align every read against the intended sequence of the construct, not against each other.',
    'Write down which clone is correct. That name is what the next session transforms, and if it '
    + 'is not on this sheet it is in somebody’s memory.',
  ],
};
