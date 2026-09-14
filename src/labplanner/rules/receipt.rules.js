// What one row of a returned labsheet means.
//
// This is the only place a person's handwriting enters the system, and the only place the
// inventory learns anything true. Everything upstream is generated; this is a well name typed by
// somebody standing at a freezer, and six things it can be.
//
// The rules are ordered by how sure we are, and the order matters: a well that cannot be read must
// be caught before a well that is occupied, or the occupancy check runs against a parsed nonsense
// coordinate.
//
// Rules are tried in order and the first that applies wins. `c6-rules receipt` prints this file.
import { apply, named } from './lib.js';

export const TITLE = 'What one row of a returned labsheet means';


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════

// name:  said
// when:  always
// then:  what was written in the cell, trimmed, or empty
// why:   A blank cell and a cell somebody wrote in are different answers, and the difference is
//        the whole of the first rule.
// source: inferred — a toolkit decision
export const said = {
  of: ({ returned }) => String(returned ?? '').trim(),
};

// name:  at
// when:  what was written parses as a well name
// then:  its row and column, or null
// why:   `a1`, `A01` and ` A1 ` are all A1. Compared as raw strings they made a tube that had not
//        moved look like one that had, and the report announced that the held well was free again
//        about a tube sitting exactly where it was put.
// source: inferred — a toolkit decision
export const at = {
  of: ({ returned, wellAt }) => wellAt(String(returned ?? '').trim()),
};

// name:  inTheBox
// when:  the parsed well exists on the physical box
// then:  true, false, or null where the box's shape is unknown
// why:   `wellAt` checks the SHAPE of what was typed, and a shape check passes `Z99` — which in a
//        9x9 box is row 25 of nine and column 99 of nine. It was accepted, recorded, and appended
//        to the box's own file, so the inventory asserted a tube at an address the box does not
//        have. That is the exact failure holds exist to prevent, one coordinate finer.
// source: stated 2026-09-13 in principle — "just don't say things are in there that aren't there".
//         Bounding it against the box rather than clamping is a toolkit decision.
export const inTheBox = {
  of: ({ at: a, box }) => (!a ? null : !box ? null
    : a.row >= 0 && a.col >= 0 && a.row < box.rows && a.col < box.cols),
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════

// name:  never made
// when:  the cell came back blank
// then:  release the hold, record nothing
// why:   An experiment gets abandoned, or a branch of it does. A tube nobody made records nothing,
//        so an abandoned experiment leaves no trace in the freezer — which is the whole reason the
//        inventory is written on return rather than on issue.
// source: stated 2026-09-13 — "sometimes labsheets get aborted, or just take years to finish"
// eg:    (blank)
export const neverMade = {
  alone: true,
  applies: ({ said }) => !said,
  decide: () => ({ outcome: 'released', tag: 'nothing came back for it' }),
  says: () => 'nothing came back for it',
};

// name:  not a well name
// when:  what was written does not parse as a well at all
// then:  release the hold, record nothing, and report it
// why:   "not made", "in the fridge", "B12 (upper)" — a person answering a different question than
//        the one on the sheet. Guessing at what they meant would put a specific wrong location in
//        a shared document.
//
//        The hold goes anyway. Whether the tube exists is now unknown, and a hold left standing is
//        the failure mode of the whole mechanism — a well nobody can use and nobody will release.
// source: inferred — a toolkit decision
// eg:    not made
export const notAWellName = {
  alone: true,
  applies: ({ said, at }) => !!said && !at,
  // TWO STRINGS, DELIBERATELY. `says` is the full sentence that goes to the person resolving the
  // sheet; `tag` is the terse one beside the row in the released list, which is a table.
  decide: ({ said }) => ({ outcome: 'released', problem: true, tag: `unreadable well "${said}"` }),
  // EACH SENTENCE NAMES ITS OWN CONSTRUCT, because they do not all read the same way — two are
  // `pX: …` and the occupied one is `pX was written into …`. A caller that prefixed uniformly
  // produced "pX: written into", which is not a sentence.
  says: ({ construct, said }) =>
    `${construct}: "${said}" is not a well name. The hold was released and nothing recorded — fix `
    + 'the sheet and resolve again.',
};

// name:  outside the box
// when:  it parses, but names a well the box does not have
// then:  release the hold, record nothing, and report it
// why:   Reported and not clamped. `J1` in a nine-row box is either a wrong letter or a box that
//        is bigger than we think, and a machine that quietly files it under `I1` sends somebody to
//        the wrong tube — which is worse than sending them back to the sheet.
// source: inferred — a toolkit decision, from the Z99 case
// eg:    Z99
export const outsideTheBox = {
  alone: true,
  applies: ({ inTheBox }) => inTheBox === false,
  decide: ({ said, boxName }) => ({ outcome: 'released', problem: true,
                                    tag: `"${said}" is outside ${boxName}` }),
  says: ({ construct, said, box, boxName, wellName }) =>
    `${construct}: "${said}" is not a well in ${boxName}, which is ${box.rows}x${box.cols} `
    + `(${wellName(box.rows - 1, box.cols - 1)} is the last one). The hold was released and `
    + 'nothing recorded.',
};

// name:  something else is there
// when:  the well already holds a different construct
// then:  change nothing, and report it
// why:   Two tubes cannot be in one well, and the inventory disagreeing with the freezer is the
//        thing this whole mechanism exists to prevent. So it goes to a person rather than being
//        settled by whichever write came last.
//
//        This is the one outcome that does NOT release the hold: we do not yet know what happened,
//        and letting the reservation go would lose the only record that something was expected.
// source: inferred — a toolkit decision
// eg:    occupied
export const occupied = {
  alone: true,
  applies: ({ sitting, construct }) => !!sitting && sitting.construct !== construct,
  decide: () => ({ outcome: 'conflict', problem: true }),
  says: ({ construct, boxName, well, sitting }) =>
    `${construct} was written into ${boxName} ${well}, where the inventory already has `
    + `${sitting.construct}. Nothing was changed.`,
};

// name:  already recorded there
// when:  the well already holds this same construct
// then:  nothing to add
// why:   Receiving one workbook twice appended the same rows twice and the inventory grew by a set
//        per run. The in-memory upsert was idempotent and the FILE append was not, which is an
//        asymmetry that only shows when somebody runs a command a second time.
// source: inferred — a toolkit decision, from the double-receive bug
// eg:    already there
export const alreadyRecorded = {
  applies: ({ sitting, construct }) => !!sitting && sitting.construct === construct,
  decide: () => ({ outcome: 'placed', already: true }),
  says: () => null,
};

// name:  placed
// when:  a readable well, inside the box, and empty
// then:  record the tube there and release the hold
// why:   **The sheet wins.** A hold says where the tube was expected; the returned sheet says where
//        it went, and they differ often — the student was standing at the freezer and we were not.
//        The held well is let go either way.
// source: stated 2026-09-13 — "That is when you learn about the real locations of things... The
//         inventory we store should reflect reality, not a prediction of future reality."
// eg:    B3
export const placed = {
  applies: () => true,
  decide: () => ({ outcome: 'placed', already: false }),
  says: () => null,
};


export const FACTS = named({ said, at, inTheBox });

export const RULES = named({ neverMade, notAWellName, outsideTheBox, occupied, alreadyRecorded,
                             placed });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES }, facts);

/** What a `// eg:` means here: what the student wrote in the cell, or a named situation. */
export const egFacts = (eg) => {
  const s = String(eg).trim();
  const wellAt = (n) => { const m = String(n).match(/^([A-Za-z])(\d{1,2})$/);
    return m ? { row: m[1].toUpperCase().charCodeAt(0) - 65, col: Number(m[2]) - 1 } : null; };
  const wellName = (r, c) => `${String.fromCharCode(65 + r)}${c + 1}`;
  const base = { construct: 'pX', boxName: 'cheese_temp', box: { rows: 9, cols: 9 },
                 wellAt, wellName, sitting: null, well: 'B3' };
  if (s === '(blank)') return { ...base, returned: '' };
  if (s === 'occupied') return { ...base, returned: 'B3', sitting: { construct: 'pOTHER' } };
  if (s === 'already there') return { ...base, returned: 'B3', sitting: { construct: 'pX' } };
  return { ...base, returned: s };
};
