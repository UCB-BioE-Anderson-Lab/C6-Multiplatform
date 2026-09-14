// config.js — the planner's few settled numbers.

// **THE NUMBERS LIVE WITH THE RULES THAT USE THEM** — `rules/mastermix.rules.js`, where each one
// sits beside the sentence saying why it is that number. Re-exported here because that is the name
// every existing caller imports.
export { MASTERMIX_THRESHOLD, DEFAULT_EXCESS } from '../rules/mastermix.rules.js';
import { DEFAULT_EXCESS } from '../rules/mastermix.rules.js';


/**
 * Fill in the planner's default settings around whatever the caller supplied.
 */
export function normalizeConfig(config) {
  return {
    excess: DEFAULT_EXCESS,
    ...(config || {}),
  };
}
