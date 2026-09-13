// naming.js — the naming decisions, each callable and testable on its own.
//
// Phase 2 of `docs/TOOLKIT-PLAN.md` moves the rest of them here. This file starts with the one
// `expandClones.js` needs, so that a rule JCA stated has exactly one implementation.

/**
 * The Nth clone designation.
 *
 * JCA, 2026-09-12: *"clone designations are always [A-Z], or [0-9] or for a plate [0-9][A-Z][0-9]
 * for the Nth plate row X, column M."* → `docs/LABSHEET-SPEC.md` § 3
 *
 * Letters first, because that is what a picked colony gets; past Z it would have to become a plate
 * coordinate, and picking more than twenty-six colonies by hand is a different kind of experiment.
 */
export function cloneDesignation(i) {
  if (i < 26) return String.fromCharCode(65 + i);
  throw new Error(`cloneDesignation(${i}): past Z a clone is a plate coordinate `
                + '([0-9][A-Z][0-9]), which needs the plate it came from. Not implemented.');
}
