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
//
// **PHASE 1 AND PHASE 2, AND THE CUT IS AFTER SEQUENCING.** JCA, 2026-09-15, for Lactis3:
// *"That goes from the 10 uM dilutions up through the miniprep and sequence. After sequencing
// comes the l. lactis part. That we will do as a phase II of the experiment, and there will be
// one combined labsheet for it."*
//
// The boundary is not a convenience. Phase 1 ends at a VERIFIED PLASMID, which is the last point
// at which every student is still working alone on their own construct — and phase 2 begins by
// moving that plasmid into the host, where four constructs share one block, one plate reader run
// and one set of controls. So the two phases want opposite issuing shapes: six individual
// workbooks, then one combined one. `--phase` is how a caller asks for either.
//
// It is also honest about time. Phase 2 cannot be scheduled until phase 1 has produced something
// that sequenced correctly, and a sheet issued for work that may not happen is a sheet that
// teaches people to ignore sheets.
export default {
  id: 'clone-and-characterize',
  title: 'Clone, verify, move into the host, assay',
  source: 'JCA, 2026-09-11, for Lactis3',
  sessions: [
    // BEFORE EVEN THAT: the antibiotic. Plates are poured from a 1000x stock and a colony cannot
    // be picked off a plate nobody made, so this is the earliest session there is. It appears only
    // when the inventory cannot be shown to have the stock already.
    { name: 'Antibiotic stocks', phase: 1, steps: ['stock'],
      why: 'plates and media are made from these' },
    // BEFORE ANYTHING ELSE: the working stocks the PCR uses. Its own session because it happens on a
    // different day — JCA, 2026-09-10: *"Dilutions typically happen before PCR and sequencing"* —
    // and because it is where the sheet asks the freezer questions the inventory cannot answer.
    { name: 'Oligo dilutions', phase: 1, steps: ['dilution'],
      why: '100 uM stocks down to the 10 uM the PCR uses' },
    { name: 'PCR', phase: 1, steps: ['pcr'],
      why: 'PCR is a day. Running that is long.' },
    { name: 'Gel, cleanup and assembly', phase: 1, steps: ['gel', 'zymo', 'goldengate', 'gibson', 'ligate'],
      why: 'one sitting, but a long one — and a long labsheet',
      long: true },
    { name: 'Transformation', phase: 1, steps: ['transform'],
      why: 'next sitting' },
    { name: 'Picking', phase: 1, steps: ['pick'],
      why: 'the colonies have to grow first' },
    { name: 'Miniprep and sequencing', phase: 1, steps: ['miniprep', 'sequencing'],
      why: 'together — the submission follows straight off the prep' },
    { name: 'Sequence analysis', phase: 1, steps: ['analysis'],
      why: 'desk work, no bench' },
    // THE NAME STAYS AND THE DESIGN OVERRIDES IT. These names are JCA's own words for the nine
    // sessions and are worth keeping; what was wrong is that a session name beat a title the
    // design COMPUTED from the step. `retransform` titles itself Electroporation or Conjugation by
    // what the file said, and this name put "Electroporation" over a conjugation.
    // → `design/index.js § titleFromStep`
    { name: 'Electroporation', phase: 2, steps: ['retransform'],
      why: 'into the target organism, once the plasmid is confirmed' },
    // PICKING INTO A BLOCK IS INOCULATING THE CULTURE. `picking_colonies_into_block` picks into
    // medium, so the culture step is the same action continued — the same person, the same
    // sitting, the same block — and the overnight growth is not a session anybody attends.
    // Pairing the culture with the assay instead put the whole plate-reader protocol and the
    // inoculation on one 70-row sheet, and separated the two halves of a single action.
    { name: 'Picking and inoculation', phase: 2, steps: ['pick', 'culture'],
      why: 'of the retransformation; the block is inoculated as it is picked' },
    { name: 'Assay', phase: 2, steps: ['assay'],
      why: 'read the next day, once the block is saturated' },
  ],
};
