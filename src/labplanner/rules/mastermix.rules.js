// Whether to make a mastermix, and which components go in it.
//
// Two questions, and the second only arises if the first says yes: is a shared mix worth setting
// up at all, and then which parts of the reaction are actually common to every tube.
//
// Rules are tried in order and the first that applies wins. `c6-rules mastermix` prints this file.
import { apply, named } from './lib.js';

export const TITLE = 'Whether to make a mastermix, and what goes in it';

/** How many reactions make a mastermix worth setting up. */
export const MASTERMIX_THRESHOLD = 4;

/** Volume made per reaction, over the sum of the parts, to cover pipetting loss. */
export const DEFAULT_EXCESS = 1.1;


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════

// name:  reactions
// when:  always
// then:  how many tubes this session sets up
// why:   The only input to the first decision. A mastermix trades one careful measurement for many
//        sloppy ones, and whether that trade is worth making is a question of how many.
// source: inferred — a restatement of what the threshold is for
export const reactions = {
  of: ({ jobs }) => (jobs || []).length,
};

// name:  common
// when:  a component's value is identical on every tube, and recorded on every tube
// then:  that component can go in the shared mix
// why:   A component that differs between tubes cannot be premixed, and one whose value nobody
//        wrote down is not known to be identical — it is only known to be unrecorded.
//
//        An empty field on every job makes a set of one member, the empty string, and the
//        component would have joined the mix on the strength of nobody having written it down.
//        Varying components stay per-tube unless they are positively identical.
// source: inferred — a toolkit decision, from the empty-field bug
export const common = {
  of: ({ jobs, recipe, valueOf }) => (recipe || []).filter((c) => {
    if (!c.varies) return true;
    const values = new Set((jobs || []).map((j) => valueOf(j, c.varies)));
    return values.size === 1 && ![...values].includes('');
  }),
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════

// name:  too few to be worth it
// when:  under 4 reactions
// then:  set them up individually; no mastermix
// why:   A scaled total has no meaning at the bench when you would pipette the ones. Below four,
//        making a mix is an extra tube, an extra transfer and an extra thing to mislabel, for no
//        saving.
// source: stated 2026-09-10 — two statements of this disagreed at exactly 4, and the ruling was
//         ">=4 is right"
// eg:    1; 3; 4
export const tooFew = {
  alone: true,
  applies: ({ reactions }) => reactions < MASTERMIX_THRESHOLD,
  decide: ({ reactions }) => ({ mastermix: false, reactions }),
  says: ({ reactions }) =>
    `${reactions} reaction(s) — under ${MASTERMIX_THRESHOLD}, so set them up individually. `
    + 'A scaled total has no meaning at the bench when you would pipette the ones.',
};

// name:  worth a mix
// when:  4 or more reactions
// then:  premix everything common to all of them; the rest goes in tube by tube
// why:   Past four tubes the same measurement repeated four times is four chances to be out, and
//        one larger measurement is more accurate as well as quicker.
//
//        The mix is made with 10% over the sum of the parts, because the last tube of a series
//        comes up short otherwise — every transfer leaves a little behind.
// source: stated 2026-09-10 for the threshold; inferred for the 10% overage, which is the
//         conventional figure and was not stated
// eg:    4; 8; 30
export const worthAMix = {
  applies: ({ reactions }) => reactions >= MASTERMIX_THRESHOLD,
  decide: ({ reactions, common, recipe, excess }) => ({
    mastermix: true, reactions, excess,
    shared: common,
    perTube: (recipe || []).filter((c) => !common.includes(c)),
  }),
  says: ({ reactions, common, recipe }) => {
    const perTube = (recipe || []).filter((c) => !common.includes(c));
    return `${reactions} reactions share ${common.map((c) => c.key).join(', ')}; `
      + (perTube.length
          ? `${perTube.map((c) => c.key).join(' and ')} differ between samples and go in tube by `
            + 'tube'
          : 'every component is common, so the whole reaction is one mix');
  },
};


export const FACTS = named({ reactions, common });

export const RULES = named({ tooFew, worthAMix });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES }, facts);

/** What a `// eg:` means here: a number of reactions, all sharing one recipe. */
export const egFacts = (eg) => ({
  jobs: Array.from({ length: Number(eg) }, () => ({ template: 'same' })),
  recipe: [{ key: 'buffer', uL: 10 }, { key: 'template', uL: 1, varies: 'template' }],
  valueOf: (j, f) => String(j[f] ?? ''),
  excess: DEFAULT_EXCESS,
});
