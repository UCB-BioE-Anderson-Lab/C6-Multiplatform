// sessions.js — group the planner's bins into work sessions, one labsheet each.
//
// JCA, 2026-09-11: *"KISS and make it one labsheet per person… it corresponds to one person
// doing work, 1 sheet per work session."*
//
// `binReactions` answers which steps MAY share a sheet — reachability in the dependency graph,
// exactly. This answers which SHOULD, which is not a graph property: it is how long a person can
// stand at a bench, and what has to incubate overnight. That knowledge is stable across
// experiments of the same shape, so it lives in `sequences/` as named data and this file applies
// it.
//
// THE GROUPING IS A WALK, NOT A SORT. The sequence names its sessions in order and the bins are
// already in dependency order, so each session takes the longest run of bins from the front whose
// operations it names. Stated that way it handles the case a lookup table cannot: `pick` appears
// in two different sessions of the same sequence — once after the cloning transformation and once
// after the electroporation — and those are two sheets, not one sheet with both on it.
//
// A BIN NO SESSION NAMES STILL GETS A SHEET. A sequence is a preference about grouping; one that
// silently dropped a step would be a plan that omits work. It becomes a session of its own and
// `unplaced` says so, because a sheet appearing outside the remembered shape is worth noticing.

/**
 * Group bins into sessions using a named sequence.
 *
 * @param {Array} bins        labsheet bins, in dependency order
 * @param {Object} sequence   from `sequences/`
 * @returns {{sessions:Array, unplaced:Array}}
 */
export function groupIntoSessions(bins, sequence) {
  const list = [...(bins || [])];
  if (!sequence) {
    return { sessions: list.map((b, i) => ({ index: i, name: null, bins: [b] })), unplaced: [] };
  }
  const sessions = [];
  const unplaced = [];
  let i = 0;
  for (const spec of sequence.sessions) {
    const named = new Set(spec.steps.map((s) => s.toLowerCase()));
    // ANYTHING BEFORE THIS SESSION THAT NO LATER SESSION NAMES IS OUT OF SHAPE. Skipping it
    // silently would let a step fall between two sessions and off the packet.
    while (i < list.length && !named.has(list[i].operation)) {
      if (laterSessionNames(sequence, spec, list[i].operation)) break;
      unplaced.push(list[i]);
      sessions.push({ index: sessions.length, name: null, bins: [list[i]], outOfShape: true });
      i += 1;
    }
    const take = [];
    while (i < list.length && named.has(list[i].operation)) { take.push(list[i]); i += 1; }
    if (take.length) sessions.push({ index: sessions.length, name: spec.name, why: spec.why || null,
                                     long: !!spec.long, bins: take });
  }
  while (i < list.length) {
    unplaced.push(list[i]);
    sessions.push({ index: sessions.length, name: null, bins: [list[i]], outOfShape: true });
    i += 1;
  }
  sessions.forEach((s, n) => { s.index = n; });
  return { sessions, unplaced };
}

function laterSessionNames(sequence, from, operation) {
  const at = sequence.sessions.indexOf(from);
  return sequence.sessions.slice(at + 1)
    .some((s) => s.steps.map((x) => x.toLowerCase()).includes(operation));
}

/** One line per session, for the text report. */
export function describeSessions({ sessions, unplaced }) {
  return sessions.map((s) =>
    `  ${String(s.index + 1).padStart(2)}. ${(s.name || s.bins[0].operation).padEnd(28)} `
  + `${s.bins.map((b) => b.operation).join(' + ')}`
  + `${s.outOfShape ? '   [outside the remembered sequence]' : ''}`
  + `${s.long ? '   [long session]' : ''}`).join('\n')
  + (unplaced.length ? `\n  ${unplaced.length} bin(s) the sequence does not name.` : '');
}
