// For one oligo, the tube to pull — or the reason there isn't one.
//
// Six outcomes, and they are not six degrees of the same thing. Each sends somebody somewhere
// different: to a freezer, to an earlier labsheet, to a decision, or to a purchase order with a
// lead time on it.
//
// Rules are tried in order and the first that applies wins. `c6-rules primer` prints this file.
import { apply, named } from './lib.js';

export const TITLE = 'Where one oligo comes from';

// Tubes are labelled "10 uM" and hold 9.8 µM. A tolerance is not sloppiness, it is the format.
export const near = (a, b) => a != null && Math.abs(a - b) <= Math.max(0.05, b * 0.05);


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════

// name:  searched
// when:  an inventory was read and holds at least one sample
// then:  true or false
// why:   With no inventory to search, every oligo looks absent. "We have not looked" must never
//        print as "it is not there", because the second is a purchase and the first is nothing.
// source: inferred — a toolkit decision about not printing "absent" for "not looked"
export const searched = {
  of: ({ inv }) => !!(inv && inv.samples && Object.keys(inv.samples).length),
};

// name:  atWorking
// when:  a tube of this oligo is at the strength this use needs
// then:  that tube, or null
// why:   PCR wants 10 µM and sequencing wants 2.66 µM, so the same tube is ready for one use and
//        not for the other. The strength is a property of the use, not of the oligo.
// source: inferred from the working strengths in planDilutions
export const atWorking = {
  of: ({ tubes, workingUM }) => (tubes || []).find((s) => near(s.uM, workingUM)) || null,
};

// name:  atStock
// when:  a tube of this oligo is at the 100 µM stock strength
// then:  that tube, or null
// why:   A stock tube is not a problem, it is an earlier day's work: the dilution gets its own
//        labsheet session and the PCR sheet points at it.
// source: inferred from the 100 uM stock convention
export const atStock = {
  of: ({ tubes, stockUM }) => (tubes || []).find((s) => near(s.uM, stockUM)) || null,
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════

// name:  nothing was searched
// when:  no inventory was read
// then:  unsearched
// why:   Not an answer about the oligo at all. It is the one outcome that must never be confused
//        with `absent`, which commits somebody to an order.
// source: inferred
// eg:    no inventory
export const nothingSearched = {
  alone: true,
  applies: ({ searched }) => !searched,
  decide: () => ({ status: 'unsearched' }),
  says: () =>
    'No inventory was read, so nothing was looked up. This does not mean the oligo is missing.',
};

// name:  not in the inventory
// when:  the inventory was read and holds no tube of this oligo at any strength
// then:  absent
// why:   A purchase with a lead time, not a step. It belongs in the ordering conversation rather
//        than on a bench sheet, and saying so early is the only way that happens.
// source: inferred
// eg:    nothing found
export const notInInventory = {
  alone: true,
  applies: ({ searched, tubes }) => searched && !(tubes || []).length,
  decide: () => ({ status: 'absent' }),
  // Lower case on purpose — a source row composes this into a longer phrase.
  says: ({ name }) =>
    `${name} is not in the inventory and must be ordered, which has a lead time and is not a step `
    + `on this sheet`,
};

// name:  ready, in a box that tracks no wells
// when:  a tube at working strength, in a box whose wells are deliberately not recorded
// then:  box-untracked — the box is the whole answer
// why:   A working stock handled several times a week moves around its box. The box is stable and
//        the well is not, so the well was never recorded and asking for it would be asking for
//        something nobody has.
// source: stated 2026-09-12 — the well moves around, but it is in there
// eg:    ready, untracked box
export const readyUntracked = {
  applies: ({ atWorking, where }) => !!atWorking && where.untracked,
  decide: ({ where }) => ({ status: 'box-untracked', where }),
  // NOT A WORD ABOUT WELLS — the box is the whole answer. → `templateSample.rules.js`
  says: ({ workingUM, where, name }) =>
    `Use the ${workingUM} µM ${name}, which is in ${where.box}.`,
};

// name:  ready, but the well is not recorded
// when:  a tube at working strength, in a tracked box, with no well on the row
// then:  box-only — print the box, ask for the well
// why:   The record is right about the part that is stable and silent about the part that is not.
//        Printing the box and asking for the well is the only honest rendering of that; inventing
//        a well would put a specific wrong location on a printed page.
// source: stated 2026-09-12 — never invent a well
// eg:    ready, no well
export const readyWellUnknown = {
  applies: ({ atWorking, where }) => !!atWorking && where.wellUnknown,
  decide: ({ where }) => ({ status: 'box-only', where }),
  says: ({ workingUM, where, name }) =>
    `Use the ${workingUM} µM ${name}, which is in ${where.box}, where the well is not recorded — `
    + `write down which well you took it from.`,
};

// name:  ready
// when:  a tube at working strength, with a box and a well
// then:  ready — both go on the sheet
// why:   The ordinary case. The note says only the strength, because the box and the well are
//        already columns of their own on the row.
// source: inferred
// eg:    ready
export const ready = {
  applies: ({ atWorking }) => !!atWorking,
  decide: ({ where }) => ({ status: 'ready', where }),
  says: ({ workingUM, name }) => `Use the ${workingUM} µM ${name}.`,
};

// name:  only the stock is here
// when:  no tube at working strength, but one at 100 µM
// then:  dilute — and the dilution is an earlier session
// why:   A working stock is made from the 100 µM tube on a day of its own, so this is a
//        dependency between labsheets rather than a shortage. The PCR sheet points at the
//        dilution sheet's own cells rather than restating a number somebody has not made yet.
// source: inferred
// eg:    stock only
export const onlyStock = {
  applies: ({ atStock }) => !!atStock,
  decide: ({ stockWhere }) => ({ status: 'dilute', where: stockWhere }),
  says: ({ stockUM, workingUM, name }) =>
    `Only the ${stockUM} µM stock of ${name} is in the freezer, so dilute it to ${workingUM} µM `
    + `before this reaction. That happens on the dilution sheet.`,
};

// name:  some other concentration
// when:  tubes exist, but none at working strength and none at stock
// then:  present — a person decides
// why:   A tube at 20× dilution, or one whose concentration column holds a word rather than a
//        number, is neither ready nor a known dilution. There is no rule that turns it into
//        either, so the sheet states what is there and leaves it.
// source: inferred
// eg:    odd concentration
export const someOtherConcentration = {
  applies: ({ tubes }) => (tubes || []).length > 0,
  decide: ({ firstWhere }) => ({ status: 'present', where: firstWhere }),
  says: ({ tubes, workingUM, name }) =>
    `${name} is in the freezer at ${tubes[0].concentration || 'an unrecorded concentration'}, `
    + `which is neither ${workingUM} µM nor a stock this can dilute. Decide what to use.`,
};


export const FACTS = named({ searched, atWorking, atStock });

export const RULES = named({ nothingSearched, notInInventory, readyUntracked, readyWellUnknown,
                             ready, onlyStock, someOtherConcentration });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES }, facts);

/** What a `// eg:` means here. */
export const egFacts = (eg) => {
  const tube = (uM, conc, loc) => ({ uM, concentration: conc, location: loc });
  const base = { name: 'oX', workingUM: 10, stockUM: 100, inv: { samples: { k: {} } } };
  const placed = { box: 'TPcon6A', well: 'C1' };
  return {
    'no inventory':   { ...base, inv: null },
    'nothing found':  { ...base, tubes: [] },
    'ready':          { ...base, tubes: [tube(10, '10 uM')], where: placed },
    'ready, untracked box': { ...base, tubes: [tube(10, '10 uM')],
                              where: { box: 'Pink Training', untracked: true } },
    'ready, no well': { ...base, tubes: [tube(10, '10 uM')],
                        where: { box: 'cheese_temp', wellUnknown: true } },
    'stock only':     { ...base, tubes: [tube(100, '100 uM')], stockWhere: placed },
    'odd concentration': { ...base, tubes: [tube(null, 'dil20x')], firstWhere: placed },
  }[String(eg).trim()] || null;
};
