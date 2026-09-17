// Which miniprep of a plasmid to reach for.
//
// A plasmid is minipreped more than once, and the tubes are not equivalent. Each stage past the
// first is a RE-ISOLATION: the miniprep DNA is transformed into fresh cells, a new colony is
// picked, grown, and minipreped again. The difference between the first and the second is what
// that re-isolation resolves; the difference between the second and the third is only how much of
// it there is.
//
// Rules are tried in order and the first that applies wins. `c6-rules culture` prints this file —
// this one, not the volume one, which is `wellVolume`.
import { apply, named } from './lib.js';

export const TITLE = 'Which miniprep of a plasmid to reach for';

/**
 * The serial culture stages, in the order they happen — NOT in order of preference.
 *
 * **THE TWO ORDERS ARE DIFFERENT AND USED TO BE THE SAME.** Preference is `tertiary, secondary,
 * primary, quaternary` and lives in the rules below; this list is the sequence a tube passes
 * through. Reversing this one used to produce the preference, which is why a quaternary ranked
 * above everything for as long as it did.
 */
export const STAGES = ['primary', 'secondary', 'tertiary', 'quaternary'];


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════

// name:  stage
// when:  the sample's culture field names a serial culture stage
// then:  its position in the sequence, or null for anything else
// why:   The field records whatever somebody wrote on the tube, and not all of it is a stage.
//        Real inventories hold `outgrowth` and `secondaryMM`, which are not standard terms and do
//        not refer to serial culturing at all — so they are not ranked rather than being guessed
//        at a position.
// source: stated 2026-09-13 — "outgrowth and secondaryMM are not standard terms... I would not
//         interpret them as referring to serial culturing"
export const stage = {
  of: ({ culture }) => {
    const i = STAGES.indexOf(String(culture || '').trim().toLowerCase());
    return i < 0 ? null : i;
  },
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════

// name:  not a culture stage
// when:  the field is blank, or holds something that is not one of the stages
// then:  unranked — it competes with nothing and nothing competes with it
// why:   `outgrowth` and `secondaryMM` are in real inventories and neither is a serial culture
//        stage. Scoring them as if they were would put a tube somewhere in the order on the
//        strength of a word nobody defined.
//
//        They rank the same as a blank, which is right: in both cases the tube may be perfectly
//        good and nothing here knows where it sits.
// source: stated 2026-09-13
// eg:    outgrowth; secondaryMM; (blank)
export const notAStage = {
  applies: ({ stage }) => stage == null,
  decide: () => ({ rank: 0 }),
  says: () => null,
};

// name:  the tertiary
// when:  the culture is tertiary
// then:  the tube to reach for, above every other stage
// why:   **It is as clean as the secondary and costs less to spend.** The re-isolation that
//        matters has already happened by the secondary, and a tertiary inherits it: one colony,
//        one plasmid. What it adds is quantity, and what that buys is the secondary staying in
//        the box. The secondary is the precious tube — it is the one everything else is made
//        from — so reaching for the tertiary first is how you avoid running it out.
// source: stated 2026-09-17 — "The secondary is much cleaner than the primary. The tertiary is
//         about as good as the secondary, and carries less risk of running out of the precious
//         clean secondary."
// eg:    tertiary
export const tertiary = {
  applies: ({ stage }) => stage === 2,
  decide: () => ({ rank: 4 }),
  says: () => null,
};

// name:  the secondary
// when:  the culture is secondary
// then:  second choice — taken when there is no tertiary
// why:   **The re-isolation is what makes it clean, and this is where it happens.** The primary's
//        DNA goes into fresh cells, one colony is picked, grown and minipreped. A competent cell
//        takes up one plasmid molecule, so the colony is clonal in a way the primary's was not —
//        which is what resolves contamination carried off the original plate, or a mixture of
//        plasmids that were together in one cell.
//
//        It ranks below the tertiary only because it is the stock everything else comes from, and
//        not because it is any worse.
// source: stated 2026-09-13 — "retransforming the miniprep and picking a new colony, growing that
//         up, and minprepping... it resolves things like having contamination in the original
//         minprep, a mixture of plasmids in one cell". Ordered below the tertiary 2026-09-17.
// eg:    secondary
export const secondary = {
  applies: ({ stage }) => stage === 1,
  decide: () => ({ rank: 3 }),
  says: () => null,
};

// name:  a primary miniprep
// when:  the culture is primary
// then:  third choice — taken when no re-isolated tube exists
// why:   **The primary is dirty.** Its colony came off a plate that carried other plasmids, so
//        what is in the tube is not guaranteed to be one thing: it can carry contamination from
//        the plate, or a mixture of plasmids that were in one cell. It is a starting point rather
//        than a stock.
//
//        It still outranks a fourth passage, because dirty is a known quantity and drift is not.
// source: stated 2026-09-13 — "The primary miniprep is dirty — there were other plasmids on the
//         same plate."
// eg:    primary
export const primary = {
  applies: ({ stage }) => stage === 0,
  decide: () => ({ rank: 2 }),
  says: () => null,
};

// name:  a fourth passage or beyond
// when:  quaternary or further out
// then:  last of the stages — below even the primary
// why:   **Every passage past the third is risk without gain.** The cleanup is done and the
//        quantity problem is solved, so what another passage adds is chances for the plasmid to
//        change: a deletion, a rearrangement, a recombination that grows faster than the thing you
//        built. To make more of a plasmid you go back to the secondary rather than passaging on,
//        which is why a quaternary is possible and uncommon.
//
//        **THIS USED TO RANK HIGHEST, AND IT WAS THE ONLY STAGE ORDERED BY ARITHMETIC** — the old
//        rule scored every stage past the first as `stage + 1`, so the further out a tube was the
//        more it was preferred, and a quaternary beat everything. Nothing had asked whether that
//        was true past the tertiary.
// source: stated 2026-09-17 — "A quaternary or higher is starting to potentially risk drift. So, I
//         would make the order 3>2>1>4+ in most scenarios, so make that the default."
// eg:    quaternary
export const beyondTertiary = {
  applies: ({ stage }) => stage != null && stage > 2,
  decide: () => ({ rank: 1 }),
  says: () => null,
};


export const FACTS = named({ stage });

export const RULES = named({ notAStage, tertiary, secondary, primary, beyondTertiary });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES, TITLE }, facts);

/** What a `// eg:` means here: whatever the culture field holds. */
export const egFacts = (eg) => ({ culture: String(eg).trim() === '(blank)' ? '' : String(eg).trim() });
