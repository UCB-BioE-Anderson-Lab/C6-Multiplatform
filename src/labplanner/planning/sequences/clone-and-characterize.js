// clone-and-characterize.js — build a plasmid, verify it, move it into the target organism, assay.
//
// JCA gave this pairing on 2026-09-11, for Lactis3, in these words:
//
// > *"PCR is a day. Running that is long. The gel, zymo, and assemble can be done in one sitting,
// > but it's a long one, and a long labsheet. transformation is next sitting. Then picking. then
// > miniprep and seq together, then seq analysis, then retransforming, then picking, then
// > assaying."*
//
// Nine sessions. It is written down here rather than applied by hand because it is the same nine
// for every experiment of this shape, and because a pairing held in a conversation is one the next
// session re-derives and gets slightly wrong.
//
// SESSION 2 IS FLAGGED IN HIS OWN WORDS AS A LONG LABSHEET. That is a standing warning, not a
// target: the renderer says when a sheet will not fit one printed page, and the answer is to split
// the session rather than shrink the type.
export default {
  id: 'clone-and-characterize',
  title: 'Clone, verify, move into the host, assay',
  source: 'JCA, 2026-09-11, for Lactis3',
  sessions: [
    { name: 'PCR', steps: ['pcr'],
      why: 'PCR is a day. Running that is long.' },
    { name: 'Gel, cleanup and assembly', steps: ['gel', 'zymo', 'goldengate', 'gibson', 'ligate'],
      why: 'one sitting, but a long one — and a long labsheet',
      long: true },
    { name: 'Transformation', steps: ['transform'],
      why: 'next sitting' },
    { name: 'Picking', steps: ['pick'],
      why: 'the colonies have to grow first' },
    { name: 'Miniprep and sequencing', steps: ['miniprep', 'sequencing'],
      why: 'together — the submission follows straight off the prep' },
    { name: 'Sequence analysis', steps: ['analysis'],
      why: 'desk work, no bench' },
    { name: 'Electroporation', steps: ['retransform'],
      why: 'into the target organism, once the plasmid is confirmed' },
    // PICKING INTO A BLOCK IS INOCULATING THE CULTURE. `picking_colonies_into_block` picks into
    // medium, so the culture step is the same action continued — the same person, the same
    // sitting, the same block — and the overnight growth is not a session anybody attends.
    // Pairing the culture with the assay instead put the whole plate-reader protocol and the
    // inoculation on one 70-row sheet, and separated the two halves of a single action.
    { name: 'Picking and inoculation', steps: ['pick', 'culture'],
      why: 'of the retransformation; the block is inoculated as it is picked' },
    { name: 'Assay', steps: ['assay'],
      why: 'read the next day, once the block is saturated' },
  ],
};
