// clone-only.js — build a plasmid and verify it. No characterization phase.
//
// The first six sessions of `clone-and-characterize`, and a separate entry rather than a prefix
// of it because an experiment that ends at the verified plasmid ENDS there: handing it the
// nine-session table leaves three empty sessions on the page, which read as work somebody forgot
// to do rather than as work that was never planned.
export default {
  id: 'clone-only',
  title: 'Build a plasmid and verify it',
  source: 'the first six sessions of clone-and-characterize',
  sessions: [
    { name: 'Antibiotic stocks', steps: ['stock'] },
    { name: 'Oligo dilutions', steps: ['dilution'] },
    { name: 'PCR', steps: ['pcr'] },
    { name: 'Gel, cleanup and assembly', steps: ['gel', 'zymo', 'goldengate', 'gibson', 'ligate'],
      long: true },
    { name: 'Transformation', steps: ['transform'] },
    { name: 'Picking', steps: ['pick'] },
    { name: 'Miniprep and sequencing', steps: ['miniprep', 'sequencing'] },
    { name: 'Sequence analysis', steps: ['analysis'] },
  ],
};
