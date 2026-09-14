// How much culture a picked colony grows in, and how much of it a miniprep pellets.
//
// **ONE PHYSICAL QUANTITY, AND IT HAD FOUR DEFINITIONS.** A colony is picked into a well, the well
// is grown, and the whole well is pelleted for the miniprep — so the volume the pick declares and
// the volume the miniprep expects are the same millilitres. They were written down separately in
// `design/miniprep.js`, in `injectVerification.js`, and as defaults in two protocol modules, and
// nothing connected any of them.
//
// `injectVerification` already carried a comment about exactly this hazard — that the two modules
// "matched, and nothing connected them" — and the fix at the time added a fourth number rather
// than removing the others.
//
// Rules are tried in order and the first that applies wins. `c6-rules culture` prints this file.
import { apply, named } from './lib.js';

export const TITLE = 'How much culture a colony grows in';

/** A well of a 24-well block, and therefore what a miniprep pellets. */
export const WELL_VOLUME_ML = 4;


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════

// name:  declared
// when:  a step upstream said how much culture it grew
// then:  that volume, or null
// why:   The cells are not always grown by a `culture` step — a clone picked straight into a tube
//        is minipreped from that tube — so the volume is read back through the chain rather than
//        off whichever step immediately produced the sample.
// source: inferred — a toolkit decision
export const declared = {
  of: ({ upstreamML }) => (Number.isFinite(upstreamML) && upstreamML > 0 ? upstreamML : null),
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════

// name:  a step said so
// when:  something upstream declared a culture volume
// then:  use it
// why:   A characterization file that says `volume=10mL` has made a decision, and the miniprep
//        pellets what was actually grown rather than what is usual.
// source: inferred
// eg:    10
export const stepSaidSo = {
  applies: ({ declared }) => declared != null,
  decide: ({ declared }) => ({ mL: declared }),
  says: () => null,
};

// name:  the standard well
// when:  nothing upstream said
// then:  4 mL — one well of a 24-well block
// why:   The standard answer, and stating it is better than asking. The sheet used to tell the
//        student that nobody had said how much culture to pellet, which was true of the file and
//        is a question with a known answer — and a labsheet that asks something everybody already
//        knows teaches people to skim the questions that matter.
// source: inferred — 4 mL is the block's well volume, which is a property of the plasticware
// eg:    none
export const standardWell = {
  applies: () => true,
  decide: () => ({ mL: WELL_VOLUME_ML }),
  says: () => null,
};


export const FACTS = named({ declared });

export const RULES = named({ stepSaidSo, standardWell });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES }, facts);

/** What a `// eg:` means here: a declared volume in mL, or `none`. */
export const egFacts = (eg) => (String(eg).trim() === 'none'
  ? { upstreamML: null } : { upstreamML: Number(eg) });
