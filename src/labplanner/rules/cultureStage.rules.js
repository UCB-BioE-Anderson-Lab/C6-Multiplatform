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
 * The serial culture stages, worst first.
 *
 * A fourth is possible and is not common: to make more of a plasmid you normally go back to the
 * secondary rather than passaging further.
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

// name:  a primary miniprep
// when:  the culture is primary
// then:  the lowest rank of the stages
// why:   **The primary is dirty.** Its colony came off a plate that carried other plasmids, so
//        what is in the tube is not guaranteed to be one thing: it can carry contamination from
//        the plate, or a mixture of plasmids that were in one cell.
//
//        It is a starting point rather than a stock.
// source: stated 2026-09-13 — "The primary miniprep is dirty — there were other plasmids on the
//         same plate."
// eg:    primary
export const primary = {
  applies: ({ stage }) => stage === 0,
  decide: () => ({ rank: 1 }),
  says: () => null,
};

// name:  a later miniprep
// when:  secondary or beyond
// then:  ranked by stage, later first
// why:   **The secondary is a re-isolation, and that is the jump that matters.** The primary's DNA
//        is transformed into fresh cells, a single new colony is picked, grown and minipreped. A
//        competent cell takes up one plasmid molecule, so the colony is clonal in a way the
//        primary's was not — which is what resolves contamination carried from the original plate,
//        or a mixture of plasmids that were together in one cell.
//
//        Past that the gain is quantity rather than another re-isolation: a tertiary just gives you
//        more of it. So a later stage is still preferred, but as the fresher and more plentiful
//        tube rather than the cleaner one. To make more of a plasmid you normally go back to the
//        secondary rather than passaging further, which is why a quaternary is possible and
//        uncommon.
// source: stated 2026-09-13 — "retransforming the miniprep and picking a new colony, growing that
//         up, and minprepping... it resolves things like having contamination in the original
//         minprep, a mixture of plasmids in one cell". And: "The secondary does most of the
//         cleanup, and a tertiary just gives you more of it."
// eg:    secondary; tertiary; quaternary
export const later = {
  applies: ({ stage }) => stage != null && stage > 0,
  decide: ({ stage }) => ({ rank: stage + 1 }),
  says: () => null,
};


export const FACTS = named({ stage });

export const RULES = named({ notAStage, primary, later });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES }, facts);

/** What a `// eg:` means here: whatever the culture field holds. */
export const egFacts = (eg) => ({ culture: String(eg).trim() === '(blank)' ? '' : String(eg).trim() });
