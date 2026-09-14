// Tubes or a block, and which block.
//
// Two questions that look like one and are not: how many pieces of plastic, and what shape they
// are. Holding them together is how a picking sheet came to say "24-well block" four lines above a
// culture table saying 96-well.
//
// Rules are tried in order and the first that applies wins. `c6-rules vessel` prints this file.
import { apply, named } from './lib.js';

export const TITLE = 'Tubes or a block, and which block';

// Above this many, you stop handling individual tubes.
export const BLOCK_FROM = 5;

/** A 24-well block: four rows, six columns. The default where nothing says otherwise. */
export const BLOCK = { rows: 4, cols: 6, name: '24-well block' };

/** The blocks a characterization file can name, by what it calls them. */
export const BLOCKS = {
  '24-well': { rows: 4, cols: 6, name: '24-well block' },
  '96-well': { rows: 8, cols: 12, name: '96-well block' },
  '48-well': { rows: 6, cols: 8, name: '48-well block' },
};


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════

// name:  declared
// when:  the line names a vessel at all — `96-well`, or plain `block`, or plain `tubes`
// then:  what it said, or null
// why:   A declared vessel beats any count. A culture that has to be read in a plate reader goes
//        in a block whatever the count, and the file is where somebody says so.
//
//        `block` and `tubes` are declarations too, even though they name no shape. They say which
//        KIND was chosen and leave the shape to the default, which is a different statement from
//        saying nothing at all.
export const declared = {
  of: ({ vessel }) => vessel || null,
};

// name:  shape
// when:  always
// then:  the rows and columns of the named block, or the 24-well default
// why:   An unknown name gets the default AND is worth saying out loud, because silently laying
//        out a vessel nobody described puts the wells out for the wrong plastic — the clone in
//        `E1` of a 96-well is in no well at all of a 24.
export const shape = {
  of: ({ vessel }) => {
    const key = String(vessel || '').trim().toLowerCase();
    const hit = BLOCKS[key];
    return hit ? { ...hit, known: true } : { ...BLOCK, known: !key };
  },
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════

// name:  the file named one
// when:  the line carries a vessel — `vessel=96-well`, or plain `block`, or plain `tubes`
// then:  that vessel, whatever the count says
// why:   Lactis3 picks four clones — under the threshold — into a block, because the culture two
//        lines later says `vessel=24-well` and the assay reads the block in a plate reader.
//        Deciding from the count alone put "one tube each" on the picking sheet and "24-well" on
//        the culture sheet, about the same four colonies.
// eg:    96-well; 24-well; block; tubes
export const fileNamedOne = {
  applies: ({ declared }) => !!declared,
  decide: ({ declared, shape }) => (declared === 'tubes'
    ? { vessel: 'tubes', rows: null, cols: null }
    : { vessel: declared, rows: shape.rows, cols: shape.cols }),
  says: ({ declared, shape, n }) => (declared === 'tubes' ? tubesNote(n) : blockNote(n, shape)),
};

// name:  few enough for tubes
// when:  under 5 clones, and nothing named a vessel
// then:  one tube each
// why:   Under five, a block is more plasticware than it saves — and a tube can be picked up,
//        labelled on its side, and put in a rack, which a well cannot.
// eg:    4
export const fewEnoughForTubes = {
  applies: ({ n }) => Number(n) < BLOCK_FROM,
  decide: () => ({ vessel: 'tubes', rows: null, cols: null }),
  says: ({ n }) => tubesNote(n),
};

// name:  enough for a block
// when:  5 or more clones, and nothing named a vessel
// then:  a block, in the default shape
// why:   Past four, the handling cost of individual tubes exceeds the block's, and a multichannel
//        becomes usable. Which block is not decided here: nothing said, so the default stands and
//        the count is what chose it.
// eg:    5; 30
export const enoughForABlock = {
  applies: ({ n }) => Number(n) >= BLOCK_FROM,
  decide: ({ shape }) => ({ vessel: 'block', rows: shape.rows, cols: shape.cols }),
  says: ({ shape, n }) => blockNote(n, shape),
};


// ── the two sentences ───────────────────────────────────────────────────────────────────────────

const tubesNote = (n) =>
  `${n} clone${Number(n) === 1 ? '' : 's'}, one tube each — under ${BLOCK_FROM}, so a block is `
  + 'more plasticware than it saves.';

const blockNote = (n, shape) =>
  `${n} clones in a ${shape.name}, filled down the columns: the axis a multichannel travels and `
  + 'the axis the block is read along.';


export const FACTS = named({ declared, shape });

export const RULES = named({ fileNamedOne, fewEnoughForTubes, enoughForABlock });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES }, facts);

/** What a `// eg:` means here: a clone count, or a vessel a file named. */
export const egFacts = (eg) => {
  const s = String(eg).trim();
  return /^\d+$/.test(s) ? { n: Number(s), vessel: null } : { n: 8, vessel: s };
};
