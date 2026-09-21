// clone-and-screen.js — build a library, measure every clone, sequence the ones worth sequencing.
//
// JCA gave this on 2026-09-21, for Tlib3, in these words:
//
// > *"The sequence for tlib3 is pcr, gel, zymo, assemble, transform, pick many, tecan, miniprep
// > hits, sequence hits. There would be a retranformation after that for a secondary assay
// > potentially, but we aren't including that in these labsheets — it should stop at the
// > sequencing."*
//
// **THIS IS NOT `clone-and-characterize` WITH A STEP MISSING.** That one clones a construct,
// verifies it, and then moves it into a host to be assayed: sequencing is how you learn the thing
// is what you meant to build, and it happens before the measurement. Here the construct is a
// library nobody has seen the members of, the measurement comes first, and sequencing is how you
// learn what the interesting members WERE. The two orders are the difference between checking a
// build and running a screen.
//
// Compiled against the other sequence, Tlib3 came out with picking split across two sheets — one
// of them captioned "of the retransformation", of an experiment that has none — and sequencing
// stranded away from the miniprep it follows. The fit was the best available and it was still the
// wrong shape, which is what `bestSequenceFor` scoring cannot tell you on its own.
//
// **IT STOPS AT THE SEQUENCING, AND THAT IS A DECISION RATHER THAN AN OMISSION.** A retransform
// and a secondary assay may follow; they are not on these sheets. A sequence that named them would
// put empty sessions on every workbook for work nobody has scheduled.
//
// PICKING INTO A BLOCK IS INOCULATING THE CULTURE — the same person, the same sitting, the same
// block, and the overnight growth is not a session anybody attends. `clone-and-characterize` pairs
// them for the same reason in its own phase 2.
export default {
  id: 'clone-and-screen',
  title: 'Build a library, measure it, sequence what the measurement found',
  source: 'JCA, 2026-09-21, for Tlib3',
  sessions: [
    { name: 'PCR', steps: ['pcr'],
      why: 'PCR is a day. Running that is long.' },
    { name: 'Gel, cleanup and assembly', steps: ['gel', 'zymo', 'goldengate', 'gibson', 'ligate'],
      why: 'one sitting, but a long one — and a long labsheet',
      long: true },
    { name: 'Transformation', steps: ['transform'],
      why: 'next sitting' },
    { name: 'Picking and inoculation', steps: ['pick', 'culture'],
      why: 'pick many, into the block as they are picked' },
    { name: 'Assay', steps: ['assay'],
      why: 'read the next day, once the block is saturated' },
    { name: 'Miniprep', steps: ['miniprep'],
      why: 'the hits, now that the assay has said which they are' },
    { name: 'Sequencing', steps: ['sequencing'],
      why: 'what the screen found; the experiment stops here' },
  ],
};
