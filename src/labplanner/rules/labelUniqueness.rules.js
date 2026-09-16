// Two tubes under one label — when that is a problem, and when it is not.
//
// **THE SCOPE IS ONE SITTING, AND THAT IS THE WHOLE RULE.** JCA, 2026-09-15:
//
// > *"Certainly in one experiment, you don't want to label two samples in the same set the same
// > way. It wouldn't really hurt anything if you labeled the pcr and a golden gate the same label.
// > And it isn't really a controllable thing to emphasize uniqueness across experiments. But
// > generally, you want distinctive labels, not just [ABCD] on pcr tubes, as there are 100 students
// > working simultaneously. The concern would be two pcrs with the same label happening at the same
// > time and becoming a real ambiguity in the lab."*
//
// Four statements, and they scope differently, which is why they are four rules and not one:
//
//   the same set          two things on the same KIND of plastic, in one sitting, must differ
//   across kinds          a PCR strip and a 1.5 mL are not confusable in the hand
//   across experiments    not ours. One project directory cannot see the other ninety-nine.
//   distinctive ≠ unique  what makes a label safe at a shared −20 is the experiment's prefix,
//                         which is `planning/decisions/labelPrefix.js` and not this file
//
// **THE LAST TWO PULL AGAINST EACH OTHER AND BOTH ARE TRUE.** Uniqueness across experiments cannot
// be checked, so it is not attempted; distinctiveness across experiments can be *designed*, and
// that is what the two-character prefix is for. Reading them as one rule gives either a check that
// cannot work or a convention nobody states.
//
// ## What this replaced, and why the old shape was wrong in both directions
//
// `models/labsheet.js` refused a duplicate WITHIN ONE SECTION. A sitting holds several — a sheet
// binning miniprep and sequencing has two, and `Gel, cleanup and assembly` has three — so:
//
//   it permitted what this rule forbids   two sections of one sheet, same plastic, one label:
//                                         invisible, because each section only looked at itself
//   it forbade by luck what this permits  `pGOLD-A` is on the miniprep AND on the sequencing tube
//                                         beside it, deliberately — that passed only because they
//                                         happened to be two sections
//
// Rules are tried in order and the first that applies wins. `c6-rules labelUniqueness` prints this.
import { apply, named } from './lib.js';

export const TITLE = 'Two tubes under one label';

/**
 * Which pairs of tube kinds are confusable enough that one label between them is a problem.
 *
 * **IT IS THE SAME PLASTIC OR IT IS NOT**, and nothing finer. A rack of PCR strips is read at a
 * glance and two caps saying `L3a` in it are two tubes nobody can tell apart; a 1.5 mL and a strip
 * tube sitting in the same box are told apart by picking one up. → `rules/label.rules.js § TUBE`
 * holds what each kind is.
 */
export const CONFUSABLE = 'the same kind of tube';


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════

// name:  clash
// when:  something already on this sheet is written with this exact string
// then:  that entry, or null
// why:   A label is an EXACT key — JCA: *"whatever the labsheet says those Strings are should be
//        treated as exact keys. When referring to those samples later, you use those keys."* So
//        the comparison is string equality and never a normalisation: two labels differing by
//        case or by a space are two labels, and making them one here would hide the sloppiness
//        rather than the collision.
// source: stated 2026-09-12 — a label is an exact key
export const clash = {
  of: ({ label, taken }) => (label
    ? (taken || []).find((t) => String(t.label) === String(label)) || null
    : null),
};

// name:  sameKind
// when:  there is a clash
// then:  whether the two are written on the same kind of tube
// why:   The thing that makes a repeated label dangerous is reaching into a rack and finding two
//        of them. That is a property of the plastic, not of the name.
// source: stated 2026-09-15 — "two pcrs with the same label happening at the same time"
export const sameKind = {
  of: ({ clash, tube }) => (clash ? String(clash.tube) === String(tube) : false),
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════

// name:  nothing else carries it
// when:  no other row on this sheet is written with this string
// then:  nothing to say
// why:   The ordinary case, and it is listed rather than left as a fall-through because a rule set
//        whose first branch is implicit is one a reader has to infer. Every label on every sheet
//        comes through here.
// source: inferred — a toolkit decision
// eg:    free
export const nothingElseCarriesIt = {
  applies: ({ clash }) => !clash,
  decide: () => ({ fatal: null }),
};

// name:  different plastic
// when:  another row carries this string, on a different kind of tube
// then:  allowed, and nothing is said
// why:   JCA, 2026-09-15: *"It wouldn't really hurt anything if you labeled the pcr and a golden
//        gate the same label."*
//
//        The case this exists for is on every verification sheet in the toolkit: a miniprep is
//        `pBET8-A` on a 1.5 mL and the sequencing reaction beside it is `pBET8-A` on a tube that
//        leaves the building. `naming.js § READ_SUFFIXES` calls that collision *"deliberate and
//        harmless"* and gives the reason — the file that comes back is named for what was on the
//        tube, so the name has to be the clone's own. One read needs no suffix; two are `F` and
//        `R`.
// source: stated 2026-09-15
// eg:    across kinds
export const differentPlastic = {
  applies: ({ sameKind }) => !sameKind,
  decide: () => ({ fatal: null }),
};

// name:  two of a kind, one sitting
// when:  another row on this sheet carries this string, on the same kind of tube
// then:  refuse, naming both places
// why:   JCA, 2026-09-15: *"The concern would be two pcrs with the same label happening at the
//        same time and becoming a real ambiguity in the lab."*
//
//        A sitting is a person at a bench with a rack in front of them, which is what "at the same
//        time" means here and why the scope is the sheet rather than the packet. Across sheets the
//        packet's own counter already keeps minted labels apart — `design/index.js § labeller`,
//        *"a freezer box holds tubes from every session at once"* — so nothing is lost by not
//        checking there, and what a later sheet genuinely shares with an earlier one is the SAME
//        tube, which is the point of the name following the sample.
// source: stated 2026-09-15
// eg:    two of a kind
export const twoOfAKindOneSitting = {
  applies: () => true,
  alone: true,
  decide: ({ label, clash, tube }) => ({
    fatal: `label ${JSON.stringify(String(label))} is used twice, both on ${describe(tube)}`
      + `${clash.where ? ` — under "${clash.where}" and here` : ''}. A label is a key; two tubes `
      + 'under one key, in one sitting, are two tubes nobody can tell apart.',
  }),
};


// ── the sentence ────────────────────────────────────────────────────────────────────────────────

// WHAT THE PLASTIC IS CALLED, in the words `rules/label.rules.js` already uses, so a person reading
// the refusal and a person reading the cap rule meet the same phrase.
import { TUBE } from './label.rules.js';

const describe = (tube) => (TUBE[tube] ? TUBE[tube].what : CONFUSABLE);


export const FACTS = named({ clash, sameKind });

export const RULES = named({ nothingElseCarriesIt, differentPlastic, twoOfAKindOneSitting });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES, TITLE }, facts);

/**
 * What a `// eg:` means here: a situation, since the facts are a pair of rows rather than a number.
 *
 * @param {string} eg
 * @returns {Object} the facts that situation produces
 */
export const egFacts = (eg) => {
  const s = String(eg).trim();
  if (s === 'free') return { label: 'L3a', tube: 'pcr', taken: [] };
  if (s === 'across kinds') {
    return { label: 'pBET8-A', tube: 'sequencing',
             taken: [{ label: 'pBET8-A', tube: 'micro', where: 'Miniprep' }] };
  }
  return { label: 'A1', tube: 'block',
           taken: [{ label: 'A1', tube: 'block', where: 'Picking' }] };
};
