// vessels.js — what the picked clones go into, and where in it each one sits.
//
// JCA, 2026-09-12:
//
// > *"Whether ultimately the decision is to grow the clones in a block vs individual tubes more
// > has to do with the number of samples, but doesn't change how you would name the clones. If you
// > have more than 4 colonies to pick, generally you will want to do that in a block instead...
// > and it would be helpful to propose the clone layout within the plate in the labsheet so the
// > experimentalist doesn't have to write that out elsewhere on their own. In such cases,
// > arranging them in some logical way within the plate makes setting things up more
// > communicable."*
//
// **THE VESSEL IS ABOUT COUNT; THE NAME IS ABOUT WHAT KIND OF EXPERIMENT IT IS.** They were one
// decision in my head and they are two: a library screened in a block still names its clones by
// plate address because there are hundreds of them, and four clones of one construct are `A`
// through `D` whether they sit in tubes or in a block. → `naming.js` for the second.

/** Above this many, you stop handling individual tubes. */
export const BLOCK_FROM = 5;

/** A 24-well block: four rows, six columns. */
export const BLOCK = { rows: 4, cols: 6, name: '24-well block' };

/**
 * Tubes or a block, from the count alone.
 *
 * A DECLARED `vessel=` BEATS THIS. A culture that has to be read in a plate reader goes in a block
 * whatever the count, and the characterization file says so; this is what to do when nobody did.
 */
export function vesselFor(n) {
  return Number(n) >= BLOCK_FROM ? 'block' : 'tubes';
}

/**
 * Where each clone sits, in the order somebody would fill it.
 *
 * **DOWN THE COLUMNS, NOT ALONG THE ROWS.** A1, B1, C1, D1, then A2 — because that is the axis a
 * multichannel travels and the axis a 24-well block is read along when it goes into a plate
 * reader. Filling along the rows means transferring a column that holds four unrelated cultures.
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
 * lines apart.
 */
export function describeLayout(n, vessel = null, shape = BLOCK) {
  if ((vessel || vesselFor(n)) === 'tubes') {
    return `${n} clone${n === 1 ? '' : 's'}, one tube each — under ${BLOCK_FROM}, so a block is `
         + 'more plasticware than it saves.';
  }
  return `${n} clones in a ${shape.name}, filled down the columns: the axis a multichannel `
       + 'travels and the axis the block is read along.';
}
