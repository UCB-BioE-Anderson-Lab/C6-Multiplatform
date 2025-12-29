
/**
 * Mastermix is a domain object describing how to prepare one or more shared mixes
 * to reduce pipetting across many similar reactions.
 */

/**
 * @typedef {Object} MastermixComponent
 * @property {string} name
 * @property {number} volume_uL_per_reaction
 * @property {string=} source_construct
 * @property {string=} source_type
 * @property {string=} notes
 */

/**
 * @typedef {Object} Mastermix
 * @property {string} id
 * @property {string} title
 * @property {string} operation            // operation this mastermix supports, e.g. 'PCR'
 * @property {number} reaction_count
 * @property {number} excess_factor         // e.g. 1.1 for 10% excess
 * @property {Array<MastermixComponent>} components
 * @property {Array<string>} notes
 */

/**
 * Create an empty Mastermix.
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.title
 * @param {string} params.operation
 * @param {number} params.reaction_count
 * @param {number=} params.excess_factor
 * @returns {Mastermix}
 */
export function createMastermix({ id, title, operation, reaction_count, excess_factor }) {
  return {
    id,
    title,
    operation,
    reaction_count,
    excess_factor: (excess_factor === undefined || excess_factor === null) ? 1.1 : excess_factor,
    components: [],
    notes: [],
  };
}

/**
 * Add a component line to a Mastermix.
 *
 * @param {Mastermix} mm
 * @param {MastermixComponent} component
 */
export function addComponent(mm, component) {
  mm.components.push(component);
}

/**
 * Add a human-readable note.
 *
 * @param {Mastermix} mm
 * @param {string} note
 */
export function addMastermixNote(mm, note) {
  mm.notes.push(note);
}

/**
 * Compute total volumes for each component (uL), including excess.
 *
 * @param {Mastermix} mm
 * @returns {Array<{name: string, total_volume_uL: number}>}
 */
export function computeComponentTotals(mm) {
  const n = Number(mm.reaction_count || 0);
  const f = Number(mm.excess_factor || 1);
  return (mm.components || []).map((c) => {
    const per = Number(c.volume_uL_per_reaction || 0);
    return {
      name: c.name,
      total_volume_uL: per * n * f,
    };
  });
}
