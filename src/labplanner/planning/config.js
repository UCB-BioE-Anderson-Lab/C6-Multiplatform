// config.js — the planner's few settled numbers.

// FOUR OR MORE SAMPLES: MASTERMIX. Fewer: individual reactions.
//
// JCA ruled this 2026-09-10 after two statements of it disagreed at exactly 4 — *"When there are
// >=4 samples, that's when you consider doing a mastermix"* against *"If it is more than 4, you
// do mastermix"* — with *">=4 is right"*. Recorded as a constant with the ruling attached
// because 4 is a common batch size and the looser phrasing sends a reader to `>`.
export const MASTERMIX_THRESHOLD = 4;

/** Volume made per reaction, over the sum of the parts, to cover pipetting loss. */
export const DEFAULT_EXCESS = 1.1;

export function normalizeConfig(config) {
  return {
    excess: DEFAULT_EXCESS,
    ...(config || {}),
  };
}
