

/**
 * Thermocycler program data model.
 *
 * This is a simple, descriptive representation of a PCR program.
 * It is not executable and does not encode instrument-specific behavior.
 * The goal is to capture the common structure shared by instruments such as
 * ABI ProFlex and MJ Research PTC-200.
 */

/**
 * @typedef {'hold'|'cycle'} ThermocyclerStepKind
 */

/**
 * @typedef {Object} ThermocyclerHold
 * @property {'hold'} kind
 * @property {number} temp_c
 * @property {number} time_s
 */

/**
 * @typedef {Object} ThermocyclerCycle
 * @property {'cycle'} kind
 * @property {number} count
 * @property {Array<ThermocyclerHold>} steps
 */

/**
 * @typedef {ThermocyclerHold|ThermocyclerCycle} ThermocyclerStep
 */

/**
 * @typedef {Object} ThermocyclerProgram
 * @property {string} name               // e.g. 'PG2K55'
 * @property {Array<ThermocyclerStep>} steps
 */

export {};