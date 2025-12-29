
/**
 * LabSheet is a human-facing instruction unit corresponding to a single
 * lab session / worksheet (one operation type per run).
 *
 * It is a domain object: it contains no planning logic, only structured
 * instructional content assembled elsewhere.
 */

/**
 * @typedef {Object} LabSheet
 * @property {string} id                 // deterministic identifier
 * @property {string} title              // human-readable title
 * @property {string} operation          // e.g. 'PCR', 'Cleanup', 'Gel'
 * @property {Object=} metadata          // optional free-form metadata
 * @property {Array<Object>} inputs      // input samples / sources
 * @property {Array<Object>} outputs     // output samples / destinations
 * @property {Object=} recipe            // Recipe object (if applicable)
 * @property {Object=} mastermix         // Mastermix object (if applicable)
 * @property {Array<string>} notes       // human-readable instructions / notes
 */

/**
 * Create an empty LabSheet with required fields initialized.
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.title
 * @param {string} params.operation
 * @param {Object=} params.metadata
 * @returns {LabSheet}
 */
export function createLabSheet({ id, title, operation, metadata }) {
  return {
    id,
    title,
    operation,
    metadata: metadata || {},
    inputs: [],
    outputs: [],
    recipe: undefined,
    mastermix: undefined,
    notes: [],
  };
}

/**
 * Add an input entry to a LabSheet.
 *
 * @param {LabSheet} sheet
 * @param {Object} input
 */
export function addInput(sheet, input) {
  sheet.inputs.push(input);
}

/**
 * Add an output entry to a LabSheet.
 *
 * @param {LabSheet} sheet
 * @param {Object} output
 */
export function addOutput(sheet, output) {
  sheet.outputs.push(output);
}

/**
 * Attach a Recipe to a LabSheet.
 *
 * @param {LabSheet} sheet
 * @param {Object} recipe
 */
export function setRecipe(sheet, recipe) {
  sheet.recipe = recipe;
}

/**
 * Attach a Mastermix plan to a LabSheet.
 *
 * @param {LabSheet} sheet
 * @param {Object} mastermix
 */
export function setMastermix(sheet, mastermix) {
  sheet.mastermix = mastermix;
}

/**
 * Add a human-readable note to the LabSheet.
 *
 * @param {LabSheet} sheet
 * @param {string} note
 */
export function addNote(sheet, note) {
  sheet.notes.push(note);
}
