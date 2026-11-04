// src/design/materials.js
//
// WHAT ALREADY EXISTS THAT COULD FILL EACH SLOT OF A GOAL. Phase 1b: the half of planning that
// looks outward, at what a lab already has, after the goal has said what the construct must be
// without naming a single plasmid.
//
// THIS RANKS. IT NEVER EXCLUDES. JCA, 2026-11-04:
//
//   "when planning, I don't think it should try to exclude. It should give all the options and
//   provide its n best bets for the experimentalist to look for and find a sample of. Let the
//   user pick which to go after."
//
// A search that drops its low-confidence hits is deciding on the experimentalist's behalf, with
// a confidence model it cannot justify, about a freezer it has never opened. Every candidate
// comes back; `best` is a recommendation sitting on top of the full list, not a filter applied
// to it.
//
// CONFIDENCE IS DECLARED BY THE SOURCE, NEVER INFERRED HERE. A verified frozen stock and a line
// in an old spreadsheet are not the same kind of hit, and which sources are which is a fact
// about a particular lab's records — not a law about freezers that a toolkit could know. Some
// boxes are better kept than others; this module is in no position to say which, so a source
// states its own confidence and that number reaches the output unchanged.
//
// C6 OWNS THE SEARCH, NOT THE RECORDS. The plasmids, boxes and sequence libraries belong to the
// project repositories that mount this one. A source is whatever one of them hands over.

/**
 * A source of candidate parts, as a world hands it to this search.
 *
 * `confidence` is the source's own claim about itself, 0 to 1, and it is carried to every
 * candidate the source supplies. `label` is how it should read to a person — "verified -80
 * tube", "plasmid stock, unverified", "sequence only, no tube" — because a number alone tells
 * an experimentalist nothing about what they are being asked to go and look for.
 *
 * A source that could not be read sets `unreadable` to the reason and supplies no parts. That
 * is NOT the same as a source with nothing in it, and `materialsForGoal` keeps them apart.
 *
 * @typedef {{name: string, confidence?: number, label?: string, parts?: Array,
 *   unreadable?: string}} Source
 */

/** What a candidate scores before its source's confidence is taken into account. */
const HAS_SEQUENCE = 0.25;

/**
 * Every part in every source that could fill one slot, best first.
 *
 * Scoring is deliberately shallow and entirely explained in the result: a candidate's score is
 * its source's declared confidence plus a quarter if the part carries a sequence. Nothing else
 * is weighed, because anything cleverer would be this module forming an opinion about a
 * lab's records it has never seen.
 *
 * **A PART WITH A SEQUENCE OUTRANKS ONE WITHOUT, AND THAT IS THE ONLY JUDGEMENT MADE HERE.** A
 * named part with no sequence cannot be designed against until somebody goes and gets it; one
 * with a sequence can be simulated today. The reason is in `why` on every candidate, so a
 * person who disagrees can see what to discount.
 *
 * @param {{type: string, id?: string}} slot - the slot from the goal's device
 * @param {Source[]} sources - the sources to search
 * @param {{n?: number}} [options] - how many to flag as best bets, default 3
 * @return {{type: string, candidates: Array, best: Array, found: number}} every candidate with
 *   its source, confidence, label, score and `why`; `best` is the top `n` of the same objects
 */
export function rankCandidates(slot, sources, options = {}) {
  const n = options.n ?? 3;
  const candidates = [];

  for (const source of sources) {
    if (source.unreadable) continue;
    for (const part of source.parts || []) {
      if (part.type !== slot.type) continue;
      if (slot.id && part.id !== slot.id) continue;
      const confidence = source.confidence ?? 0;
      const hasSeq = Boolean(part.props?.Sequence);
      const why = [
        `${slot.type} from ${source.name}`,
        source.label ? `source says: ${source.label}` : `source confidence ${confidence}`,
        hasSeq ? 'carries a sequence, so it can be designed against today'
               : 'no sequence yet — it has to be fetched or sequenced before it can be used',
      ];
      candidates.push({
        ...part,
        source: source.name,
        confidence,
        label: source.label,
        score: Number((confidence + (hasSeq ? HAS_SEQUENCE : 0)).toFixed(6)),
        why,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
  return { type: slot.type, candidates, best: candidates.slice(0, n), found: candidates.length };
}

/**
 * Run the slot search across a whole goal, and say what could not be answered.
 *
 * **ABSENCE IS NOT ZERO, AND THIS IS THE FUNCTION WHERE THAT MATTERS MOST.** Three different
 * things read as "no candidates" unless they are kept apart, and each wants a different action
 * from a person:
 *
 *   `unfilled`    a slot type nothing in any readable source can fill — go and find a part,
 *                 or loosen the goal
 *   `unreadable`  a source that could not be read at all, by name and with its reason — the
 *                 answer may be in there; nobody looked
 *   `read`        the sources that actually answered, so a thin result can be weighed against
 *                 how little was searched
 *
 * A caller gating phase 1b on this checks that `unfilled` is empty AND that `unreadable` is
 * empty or deliberately accepted. A result reporting no candidates from one unreachable mount
 * is not a finding about the freezer.
 *
 * @param {Object} goal - the goal document, as `goal.validategoal` accepts
 * @param {Source[]} sources - the sources to search
 * @param {{n?: number}} [options] - how many best bets per slot, default 3
 * @return {{devices: Array, unfilled: Array, read: string[], unreadable: Array}} per device, its
 *   slots each with candidates and best bets; the slot types nothing could fill; and which
 *   sources answered against which could not be read
 */
export function materialsForGoal(goal, sources, options = {}) {
  const read = sources.filter((s) => !s.unreadable).map((s) => s.name);
  const unreadable = sources.filter((s) => s.unreadable)
    .map((s) => ({ name: s.name, reason: s.unreadable }));

  const devices = [], unfilled = [];
  for (const device of goal.devices || []) {
    const slots = (device.slots || []).map((slot) => {
      const out = rankCandidates(slot, sources, options);
      if (!out.found) unfilled.push({ device: device.name, type: slot.type, id: slot.id });
      return { ...slot, ...out };
    });
    devices.push({ name: device.name, slots });
  }

  return { devices, unfilled, read, unreadable };
}
