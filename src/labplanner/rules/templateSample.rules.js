// Which tube of a named construct to fetch, and where it is.
//
// A construction file names a CONSTRUCT — `pJ01`, `pBET8` — and the bench needs a box and a well.
// One construct routinely has several tubes, so `inventory/query.js` ranks them (tertiary culture
// over secondary over primary) and these rules say what the answer amounts to.
//
// The five outcomes are not five degrees of one thing. Two of them look alike on a printed page
// and mean opposite things: `absent` is a fact about the inventory DOCUMENT, and `unsearched`
// means nobody looked. A sheet that printed the second as the first would send somebody to buy
// what is already in the freezer.
//
// Rules are tried in order and the first that applies wins. `c6-rules template` prints this file.
// Who settled what is in `docs/DECISIONS.md`.
import { apply, named } from './lib.js';

export const TITLE = 'Which tube of a construct to fetch';


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════

// name:  searched
// when:  an inventory was read and holds at least one sample
// then:  true or false
// why:   An empty inventory and a construct that is genuinely missing are different findings, and
//        only one of them is about the freezer. Collapsing them makes "not in stock" the answer to
//        a question nobody asked.
// source: inferred
export const searched = {
  of: ({ inv }) => !!(inv && inv.samples && Object.keys(inv.samples).length),
};

// name:  tube
// when:  the inventory holds a tube of this construct
// then:  the best-ranked one, or null
// why:   Ranking prefers a tertiary culture over a secondary over a primary, because a later
//        passage is the one somebody has actually been using.
//
//        A tube that ranked nowhere is still a tube. The ranker only considers samples annotated
//        as plasmids, and a grid inventory annotates none of them, so an unranked match is taken
//        rather than reported as absent.
// source: inferred — the ranking is inventory/query.js; the fallback is a toolkit decision
export const tube = {
  of: ({ best, all, byName }) => (best ? best.sample : (all?.[0] ?? byName?.[0] ?? null)),
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════

// name:  nothing was searched
// when:  no inventory was read, or it holds no samples at all
// then:  unsearched — which must never print as "absent"
// why:   Absence of a search is not absence of the tube. A labsheet saying a construct is not in
//        the freezer, when no freezer was consulted, is a confident wrong answer, and somebody
//        orders or rebuilds what is sitting two boxes over.
// source: inferred
// eg:    no inventory
export const nothingSearched = {
  applies: ({ searched }) => !searched,
  decide: () => ({ status: 'unsearched' }),
  says: () => 'no inventory was read, so nothing was looked up',
};

// name:  not in the inventory
// when:  the inventory was read and holds no tube of this construct
// then:  absent
// why:   A fact about the document, stated as one. It may still be in the freezer and unrecorded,
//        which is why the wording is about the inventory rather than about the lab.
// source: inferred
// eg:    searched, no match
export const notInInventory = {
  applies: ({ searched, tube }) => searched && !tube,
  decide: () => ({ status: 'absent' }),
  says: ({ name }) => `no tube of ${name} is in the inventory`,
};

// name:  a box that tracks no wells
// when:  the tube is in a box whose wells are deliberately not recorded
// then:  box-untracked — the box is the whole answer, and nothing is asked
// why:   Some boxes are working stocks handled several times a week, and their contents move. The
//        box is stable and the well is not, so the well was never recorded.
//
//        Saying "the well is not recorded" about such a box reads as a gap somebody should close,
//        and it is not one. It needs no apology.
// source: stated 2026-09-12 — the pink training box
// eg:    untracked box
export const boxUntracked = {
  applies: ({ tube, where }) => !!tube && where.untracked,
  decide: ({ where }) => ({ status: 'box-untracked', where }),
  says: ({ where, alsoIn, described }) =>
    `${lead(described)}${where.box}.${also(alsoIn)}`,
};

// name:  the well is not recorded
// when:  the tube is in a tracked box, but this row carries no well
// then:  box-only — print the box, and ask for the well on the sheet
// why:   The tube is in there and its well is a fact nobody has. Inventing one is worse than
//        asking: an invented well exists, holds something else, and reads as fact on a printed
//        page. The returned labsheet is what fills it in.
// source: stated 2026-09-12 — never invent a well
// eg:    tracked box, no well
export const wellNotRecorded = {
  applies: ({ tube, where }) => !!tube && where.wellUnknown,
  decide: ({ where }) => ({ status: 'box-only', where }),
  says: ({ where, alsoIn, described }) =>
    `${lead(described)}${where.box} — the well is not recorded.${also(alsoIn)}`,
};

// name:  placed
// when:  the tube has a box and a well
// then:  ready — both go on the sheet
// why:   The ordinary case, and the only one that needs no sentence about itself beyond what the
//        tube is: a miniprep, a glycerol stock, a 100 µM working stock.
// source: inferred
// eg:    box and well
export const placed = {
  applies: ({ tube }) => !!tube,
  decide: ({ where }) => ({ status: 'ready', where }),
  says: ({ described }) => described || null,
};


// ── how a tube is described ─────────────────────────────────────────────────────────────────────
// Every one of these is a DESCRIPTION of something somebody is fetching, so each reads as a noun
// phrase. A labsheet is read in a hurry, and a bare verb at the end of a line is an instruction:
// a note ending "— miniprep" was read as an order to miniprep something, when the inventory's
// concentration column simply held that word.

const lead = (described) =>
  (described ? `${described[0].toUpperCase()}${described.slice(1)} in ` : 'In ');

const also = (alsoIn) => (alsoIn?.length ? ` Also in ${alsoIn.join(', ')}.` : '');

/** The concentration column, read as a description of the tube rather than as an instruction. */
export function describeTube(sample) {
  const c = String(sample?.concentration || '').trim();
  const what = !c ? ''
    : /^minipreps?$/i.test(c) ? 'miniprep DNA'
    : /^(gdna|genomic)$/i.test(c) ? 'genomic DNA'
    : /^(cells|glycerol)/i.test(c) ? c.toLowerCase()
    : `${c} stock`;
  const bits = [sample?.clone && `clone ${sample.clone}`,
                sample?.culture && `${sample.culture} culture`].filter(Boolean);
  return [what, ...bits].filter(Boolean).join(', ');
}


export const FACTS = named({ searched, tube });

export const RULES = named({ nothingSearched, notInInventory, boxUntracked, wellNotRecorded,
                             placed });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES }, facts);

/**
 * What a `// eg:` means here: a named situation, since an example is a whole inventory rather than
 * one number. The shorthand is spelled out so the printed table can run it.
 */
export const egFacts = (eg) => ({
  'no inventory':       { inv: null, name: 'pX' },
  'searched, no match': { inv: { samples: { k: {} } }, name: 'pX', best: null, all: [], byName: [] },
  'untracked box':      { inv: { samples: { k: {} } }, name: 'pX', byName: [{}],
                          all: [{ concentration: '100 uM' }], where: { box: 'Pink Training',
                          untracked: true }, described: '100 uM stock', alsoIn: [] },
  'tracked box, no well': { inv: { samples: { k: {} } }, name: 'pX', byName: [{}],
                          all: [{ concentration: 'miniprep' }], where: { box: 'cheese_temp',
                          wellUnknown: true }, described: 'miniprep DNA', alsoIn: [] },
  'box and well':       { inv: { samples: { k: {} } }, name: 'pX', byName: [{}],
                          all: [{ concentration: 'miniprep' }],
                          where: { box: 'cheese_temp', well: 'B3' }, described: 'miniprep DNA',
                          alsoIn: [] },
}[String(eg).trim()] || null);
