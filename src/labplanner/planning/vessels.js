// vessels.js — where a set of clones physically goes, and where each one sits in it.
//
// **THE DECISIONS ARE IN `rules/vessel.rules.js`, AND THIS IS THE ADAPTER PLUS THE ARITHMETIC.**
// Tubes-or-a-block and which-block are rules with reasons; computing well names from a shape is
// not a decision and stays here.
//
// **THE VESSEL IS ABOUT COUNT; THE NAME IS ABOUT WHAT KIND OF EXPERIMENT IT IS.** They were one
// decision and they are two: a library screened in a block still names its clones by plate address
// because there are hundreds of them, and four clones of one construct are `A` through `D` whether
// they sit in tubes or in a block. → `naming.js` for the second.
import { choose, BLOCK_FROM, BLOCK, BLOCKS, shape as shapeFact } from '../rules/vessel.rules.js';

export { BLOCK_FROM, BLOCK, BLOCKS };

/**
 * The shape a named vessel has, or the default block.
 *
 * An unknown name gets the default AND is worth saying out loud, which the caller does: silently
 * laying out a vessel nobody described is how the wells come out for the wrong plastic.
 *
 * @param {string=} name  what the file called it — `24-well`, `96-well`
 * @returns {{rows, cols, name, known: boolean}}
 */
export function shapeOf(name) {
  return shapeFact.of({ vessel: name });
}

/**
 * Tubes or a block, from the count alone.
 *
 * A DECLARED `vessel=` BEATS THIS, and `choose` knows it — this is the answer when nobody said.
 * → `rules/vessel.rules.js`
 */
export function vesselFor(n) {
  return choose({ n, vessel: null }).vessel;
}

/**
 * Where each clone sits, in the order somebody would fill it.
 *
 * **DOWN THE COLUMNS, NOT ALONG THE ROWS.** A1, B1, C1, D1, then A2 — because that is the axis a
 * multichannel travels and the axis a block is read along when it goes into a plate reader.
 * Filling along the rows means transferring a column that holds four unrelated cultures.
 *
 * Arithmetic, not a decision: given a shape, there is one right answer and no reason to give.
 *
 * @param {number} n        how many clones
 * @param {Object} shape    rows × cols; a 24-well block by default
 * @returns {Array<string>} well names, one per clone, in clone order
 */
export function layoutFor(n, shape = BLOCK) {
  const { rows, cols } = shape;
  if (n > rows * cols) {
    throw new Error(`layoutFor: ${n} clones will not fit a ${rows}x${cols} vessel. `
                  + 'Two blocks is a decision about the session, not about the layout.');
  }
  return Array.from({ length: n }, (_, i) =>
    `${String.fromCharCode(65 + (i % rows))}${Math.floor(i / rows) + 1}`);
}

/**
 * A one-line statement of the layout, for a sheet that has to explain itself.
 *
 * TAKES THE VESSEL, NOT JUST THE COUNT. Four clones is "one tube each" by count and goes in a
 * block anyway when something downstream reads it in a plate reader — and the sheet said both, two
 * lines apart. → `rules/vessel.rules.js`
 */
export function describeLayout(n, vessel = null, shape = BLOCK) {
  // An explicit shape overrides the rules' own lookup: `planDilutions` and the designs sometimes
  // hold a shape without holding the name it came from.
  if (shape !== BLOCK) {
    return `${n} clones in a ${shape.name}, filled down the columns: the axis a multichannel `
         + 'travels and the axis the block is read along.';
  }
  return choose({ n, vessel }).note;
}
