/**
 * Recipe is a domain object describing how individual reactions are assembled.
 * It is human-facing and protocol-oriented, but contains no planning logic.
 */

/**
 * @typedef {Object} RecipeComponent
 * @property {string} name
 * @property {number} volume_uL
 * @property {string=} source_construct
 * @property {string=} source_type
 * @property {string=} notes
 */

/**
 * @typedef {Object} Recipe
 * @property {string} id
 * @property {string} title
 * @property {string} operation              // e.g. 'PCR', 'Digest', 'Gibson'
 * @property {Array<RecipeComponent>} components
 * @property {Array<string>} notes
 */

/**
 * Create an empty Recipe.
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.title
 * @param {string} params.operation
 * @returns {Recipe}
 */
export function createRecipe({ id, title, operation }) {
  return {
    id,
    title,
    operation,
    components: [],
    notes: [],
  };
}

/**
 * Add a component line to a Recipe.
 *
 * @param {Recipe} recipe
 * @param {RecipeComponent} component
 */
export function addComponent(recipe, component) {
  recipe.components.push(component);
}

/**
 * Add a human-readable note to the Recipe.
 *
 * @param {Recipe} recipe
 * @param {string} note
 */
export function addRecipeNote(recipe, note) {
  recipe.notes.push(note);
}
