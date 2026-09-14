// Whether an oligo is ready to use, can be made ready, or is not there.
//
// The same four outcomes as `primerSource`, decided once per (oligo, working strength) across a
// whole experiment rather than once per use — because the answer is what goes on the ordering list
// and on the dilution session, and both of those are about the experiment and not about one row.
//
// Rules are tried in order and the first that applies wins. `c6-rules dilution` prints this file.
import { apply, named } from './lib.js';

export const TITLE = 'Whether an oligo is ready, dilutable, or missing';

/** The tube an oligo arrives in and is kept at. */
export const STOCK_UM = 100;

/** What each use needs, in µM. Sequencing runs at a quarter of the PCR strength. */
export const WORKING_UM = { pcr: 10, sequence: 2.66, sequencing: 2.66 };

/** Tubes are labelled "10 uM" and hold 9.8 µM. A tolerance is not sloppiness, it is the format. */
export const near = (a, b) => a != null && Math.abs(a - b) <= Math.max(0.05, b * 0.05);


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════

// name:  atWorking
// when:  a tube of this oligo is at the strength this use needs
// then:  that tube, or null
// why:   One entry per oligo AND working strength, not per oligo. An oligo used both to amplify
//        and to sequence needs a 10 µM tube and a 2.66 µM tube, and they are different tubes.
//        Keying on the name alone drops the second silently, and it shows up at the bench as a
//        sequencing reaction set up at four times the intended primer concentration.
// source: inferred — a toolkit decision, from the dropped-second-tube bug
export const atWorking = {
  of: ({ tubes, workingUM }) => (tubes || []).find((s) => near(s.uM, workingUM)) || null,
};

// name:  atStock
// when:  a tube of this oligo is at 100 µM
// then:  that tube, or null
// why:   The stock is what a working dilution is made FROM, and only the stock. An oligo sitting
//        at 10 µM when sequencing needs 2.66 could in principle be diluted, but the stated rule is
//        to dilute from the 100 and there is no rule for anything else — so that case is asked
//        about rather than invented.
// source: inferred — the stock convention is the lab's; refusing to improvise from an intermediate
//         is a toolkit decision
export const atStock = {
  of: ({ tubes, stockUM }) => (tubes || []).find((s) => near(s.uM, stockUM)) || null,
};

// name:  readable
// when:  at least one tube's concentration column parses as a number
// then:  those tubes
// why:   A concentration column holding `miniprep`, `zymo` or a blank is a description of the
//        tube, not a strength. Two different states arrive at the same place — unreadable, and
//        readable-but-wrong — and a person needs to know which.
// source: inferred — a toolkit decision
export const readable = {
  of: ({ tubes }) => (tubes || []).filter((s) => s.uM != null),
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════

// name:  ready
// when:  a tube is already at the working strength
// then:  put its box and well on the sheet; nothing to make
// why:   The ordinary case, and the only one that adds no session to the experiment.
// source: inferred
// eg:    10 at 10
export const ready = {
  applies: ({ atWorking }) => !!atWorking,
  decide: () => ({ outcome: 'ready' }),
  says: () => null,
};

// name:  dilute from the stock
// when:  no working tube, but the 100 µM stock is here
// then:  a dilution session, before the session that uses it
// why:   A working stock is an earlier day's work rather than a shortage, so it becomes a labsheet
//        of its own and the later sheet points at the tube it produces.
//
//        Where that tube goes is deliberately not decided: the dilution sheet ends by putting it
//        in a freezer and the next sheet begins by fetching it, so the location is the join
//        between two sessions and choosing a good one means looking at what the box already
//        holds. Left unset, so an unplaced tube cannot be mistaken for a placed one.
// source: inferred — the 100 µM convention is the lab's; leaving the destination open is a
//         toolkit decision
// eg:    100 at 10
export const diluteFromStock = {
  applies: ({ atStock }) => !!atStock,
  decide: () => ({ outcome: 'dilute', destination: null }),
  says: ({ stockUM, workingUM }) =>
    `Make the ${workingUM} µM working stock from the ${stockUM} µM tube first. That is its own `
    + `session, before the one that uses it.`,
};

// name:  here, but not usable as either
// when:  tubes exist, at neither the working strength nor the stock
// then:  ask a person, and say what was actually found
// why:   Two different states arrive here and both need somebody: a concentration column that
//        reads as a word rather than a number, and one that reads fine and is simply neither
//        strength. Reporting them as one vague bucket loses the difference between "we cannot
//        read this" and "this is 10 µM and you wanted 2.66".
// source: inferred — a toolkit decision
// eg:    20 at 10; unreadable at 10
export const neitherStrength = {
  applies: ({ tubes }) => (tubes || []).length > 0,
  decide: () => ({ outcome: 'ask' }),
  says: ({ readable, workingUM, stockUM }) =>
    (readable.length
      ? `Found at ${readable.map((f) => `${f.uM} µM`).join(', ')} — neither the ${workingUM} µM `
        + `working stock nor a ${stockUM} µM stock to make it from.`
      : 'Present in the freezer, but at no concentration that can be read.'),
};

// name:  not here at all
// when:  no tube of this oligo is in the inventory
// then:  order it
// why:   A purchase with a lead time. It belongs on an ordering list rather than in a bench
//        session, and saying so at compile time is the only way it happens early enough.
// source: inferred
// eg:    none at 10
export const mustOrder = {
  applies: () => true,
  decide: () => ({ outcome: 'order' }),
  says: () => null,
};


export const FACTS = named({ atWorking, atStock, readable });

export const RULES = named({ ready, diluteFromStock, neitherStrength, mustOrder });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES, TITLE }, { stockUM: STOCK_UM, ...facts });

/** What a `// eg:` means here: `<what is in the freezer> at <what the use needs>`. */
export const egFacts = (eg) => {
  const m = String(eg).match(/^(\S+) at (\S+)$/);
  if (!m) return null;
  const have = m[1] === 'none' ? []
    : m[1] === 'unreadable' ? [{ uM: null, concentration: 'miniprep' }]
    : [{ uM: Number(m[1]), concentration: `${m[1]} uM` }];
  return { tubes: have, workingUM: Number(m[2]), stockUM: STOCK_UM };
};
