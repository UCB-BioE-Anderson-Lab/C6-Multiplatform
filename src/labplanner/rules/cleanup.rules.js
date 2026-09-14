// How a column cleanup binds, and what it elutes into.
//
// A silica column is not a sieve: whether a fragment sticks to it at all depends on how the
// sample is brought to the membrane. Get that wrong and the tube comes off the column empty, with
// nothing on the sheet to say why.
//
// Rules are tried in order and the first that applies wins. `c6-rules cleanup` prints this file.
import { apply, named } from './lib.js';

export const TITLE = 'How a column cleanup binds';

/** Below this, the standard bind loses the fragment. */
export const SMALL_FRAGMENT_BP = 250;


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════

// name:  shortest
// when:  always
// then:  the smallest length any sample on this sheet could be, or null where none is known
// why:   A library has a range rather than a length, and it is the SHORTEST members that wash
//        through. Judging a pool on its mean would keep the short half and lose it anyway.
// source: inferred — a toolkit decision, from the Tlib3 library amplicon
export const shortest = {
  of: ({ samples }) => {
    const lens = (samples || []).map((x) => x.productRange?.min ?? x.productBp)
      .filter((n) => n != null);
    return lens.length ? Math.min(...lens) : null;
  },
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════

// name:  no size known
// when:  nothing on the sheet has a length
// then:  the standard bind, and no remark
// why:   With no length there is nothing to decide on. Warning about small fragments on every
//        cleanup whose PCR would not simulate would train people to ignore the warning.
// source: inferred — a toolkit decision
// eg:    none
export const noSizeKnown = {
  alone: true,
  applies: ({ shortest }) => shortest == null,
  decide: () => ({ smallFragment: false }),
  says: () => null,
};

// name:  a fragment small enough to wash through
// when:  anything on the sheet is under 250 bp
// then:  bind with 1 part ADB and 3 parts isopropanol, for the whole set
// why:   The standard bind brings the sample to the membrane in a chaotropic salt, and short DNA
//        does not stick under those conditions — it goes through with the flow-through and the
//        elution is empty. Adding isopropanol makes the short fragments bind.
//
//        The whole set is bound the same way rather than splitting the sheet in two, because the
//        extra isopropanol costs a larger fragment nothing and one procedure per sheet is what a
//        person can follow. Which tubes made it necessary is said in the note.
// source: inferred — the chemistry is the Zymo protocol's own, which has carried this remedy
//         behind a flag since it was written; that a pool is judged on its floor is a toolkit
//         decision
// eg:    231; 249; 250
export const smallFragment = {
  applies: ({ shortest }) => shortest < SMALL_FRAGMENT_BP,
  decide: () => ({ smallFragment: true }),
  says: ({ samples, shortest }) => {
    const small = (samples || []).filter((x) => (x.productRange?.min ?? x.productBp ?? Infinity)
                                                < SMALL_FRAGMENT_BP);
    const rest = (samples || []).length - small.length;
    return `${small.map((x) => x.output).join(', ')} `
      + `${small.length === 1 ? 'is' : 'are'} under ${SMALL_FRAGMENT_BP} bp, so the bind is `
      + '1 part ADB + 3 parts isopropanol — with ADB alone the fragment washes straight through '
      + 'and the tube comes off the column empty.'
      + (rest ? ` The other ${rest === 1 ? 'tube is' : `${rest} tubes are`} larger; the extra `
              + 'isopropanol costs them nothing, so the whole set is bound the same way.' : '');
  },
};

// name:  the standard bind
// when:  everything on the sheet is 250 bp or more
// then:  ADB alone, as the protocol's default
// why:   The ordinary case, and it needs no sentence: the protocol on the page already describes
//        this bind, so a note would only repeat it.
// source: inferred — a toolkit decision about not restating the protocol
// eg:    250; 3762
export const standardBind = {
  applies: () => true,
  decide: () => ({ smallFragment: false }),
  says: () => null,
};


export const FACTS = named({ shortest });

export const RULES = named({ noSizeKnown, smallFragment, standardBind });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES, TITLE }, facts);

/** What a `// eg:` means here: the length of the one sample on the sheet. */
export const egFacts = (eg) => (String(eg).trim() === 'none'
  ? { samples: [{ output: 'frag', productBp: null }] }
  : { samples: [{ output: 'frag', productBp: Number(eg) }] });
