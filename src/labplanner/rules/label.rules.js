// What fits on a tube, and what a label must never do.
//
// A label is written by hand on a curved plastic surface, often by somebody wearing gloves, and it
// is read weeks later by somebody else. Three separate things can go wrong with one, and they are
// not equally serious: a long label is awkward, a label on a surface that does not exist is
// impossible, and two tubes under one label are two tubes nobody can tell apart.
//
// Rules are tried in order and the first that applies wins. `c6-rules label` prints this file.
import { apply, named } from './lib.js';

export const TITLE = 'What fits on a tube, and what a label must never do';

/** The aim when a construction file names a DNA. */
export const DNA_NAME_MAX = 6;

/** Above this it stops fitting even on a 1.5 mL, which is the largest thing anything is written on. */
export const DNA_NAME_LIMIT = 8;

/** A clone designation: a letter, a digit, or a three-character plate address. */
export const CLONE_MAX = 3;

/**
 * What each kind of tube takes, and whether it has a side.
 *
 * The caps are not arbitrary: a 1.5 mL holds a DNA name at its limit, a hyphen, and a clone
 * designation. A sequencing tube holds one more, for the read direction.
 */
export const TUBE = {
  pcr: { cap: 3, side: false, what: 'a 200 µL PCR strip tube' },
  micro: { cap: DNA_NAME_LIMIT + 1 + CLONE_MAX, side: true,
           what: 'a 1.5 mL microcentrifuge tube' },
  sequencing: { cap: DNA_NAME_LIMIT + 1 + CLONE_MAX + 1, side: true,
                what: 'a sequencing tube sent off-site' },
  plate: { cap: 12, side: false, what: 'a petri dish, written on the base' },
  block: { cap: 12, side: false, what: 'a 24-well block' },
  none: { cap: 0, side: false, what: 'nothing physical' },
};


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════

// name:  kind
// when:  always
// then:  what this row is written on, and what it takes
// why:   A row is not a label on its own. The same eight characters are comfortable on a 1.5 mL,
//        impossible on a PCR strip cap, and meaningless on a step that makes nothing physical.
// source: inferred — a toolkit decision
export const kind = {
  of: ({ tube }) => TUBE[tube] || TUBE.none,
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════

// name:  no side to write on
// when:  the row carries a side-label and the tube has no side
// then:  refuse the whole sheet
// why:   A PCR strip cap and a petri dish have one writeable surface each. A plan that asks for a
//        second one is describing a piece of plastic that does not exist, so there is no version
//        of the sheet that is right — unlike a long label, which is merely awkward.
// source: inferred — a toolkit decision about which faults are fatal
// eg:    side on a pcr tube
export const noSide = {
  alone: true,
  applies: ({ hasSideLabel, kind }) => hasSideLabel && !kind.side,
  decide: ({ kind }) => ({ fatal: `${kind.what} has no side to write on.` }),
  says: () => null,
};

// name:  longer than the tube takes
// when:  the label is longer than the cap for this kind of tube
// then:  warn, and carry on
// why:   It still gets written; it just takes two lines and somebody's patience. A label is
//        usually a construct name the construction file chose plus a clone letter, and there is no
//        naming convention to appeal to — so refusing to plan an experiment because its plasmid is
//        called `pTEST_Mach1` is stopping the job over legibility.
// source: stated — there are no rules about how DNAs are named, so this warns rather than refusing
// eg:    pTEST_Mach1-A on a pcr tube; pBET8-A on a micro tube
export const tooLong = {
  applies: ({ label, kind }) => !!label && label.length > kind.cap,
  decide: () => ({ fatal: null }),
  says: ({ label, kind }) =>
    `The label ${JSON.stringify(label)} is ${label.length} characters and goes on ${kind.what}, `
    + `which takes ${kind.cap}. Somebody has to write it by hand.`,
};

// name:  it fits
// when:  the label is within the cap, or there is no label
// then:  nothing to say
// why:   The ordinary case.
// source: inferred
// eg:    pBET8 on a micro tube
export const fits = {
  applies: () => true,
  decide: () => ({ fatal: null }),
  says: () => null,
};


export const FACTS = named({ kind });

export const RULES = named({ noSide, tooLong, fits });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES, TITLE }, facts);

/** What a `// eg:` means here: `<label> on a <kind> tube`, or `side on a <kind> tube`. */
export const egFacts = (eg) => {
  const m = String(eg).match(/^(.+?) on an? (\w+) tube$/);
  if (!m) return null;
  return m[1] === 'side'
    ? { label: 'x', tube: m[2], hasSideLabel: true }
    : { label: m[1], tube: m[2], hasSideLabel: false };
};
