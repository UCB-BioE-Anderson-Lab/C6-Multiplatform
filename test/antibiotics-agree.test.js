/**
 * Every antibiotic the planner can name, the simulator must recognise.
 *
 * TWO TABLES FOR ONE FACT. `C6-Sim.js` decides whether a token on a Transform line IS an
 * antibiotic; `injectTransformRecovery.js` decides what it means. A name the first table does
 * not hold is never assigned to `step.antibiotics` at all, so the second one reports "could not
 * read which antibiotic this selects for" about a construction file that named it plainly.
 *
 * They had drifted ten entries one way and two the other before anyone noticed, and it stayed
 * invisible because the projects being planned all selected with spec or kan. It surfaced on
 * the first project that did not: erythromycin is THE marker for L. lactis, so every
 * construction file in that domain failed identically.
 *
 * The canonical VALUES are deliberately not compared. This file calls ampicillin "amp"; the
 * planner calls it "carb", because the lab uses carbenicillin in its place. What must agree is
 * what is RECOGNISED.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { ALIASES_FOR_TEST } from '../src/labplanner/planning/injectTransformRecovery.js';

function simAliases() {
  // Read rather than import: the table is a local inside parseCF, which is where it belongs —
  // hoisting it to module scope purely to make it testable would be the test changing the code
  // it tests. The shape is fixed and the parse is trivial.
  const src = fs.readFileSync(new URL('../src/C6-Sim.js', import.meta.url), 'utf8');
  const block = src.match(/const knownAntibiotics = \{([\s\S]*?)\};/);
  expect(block, 'knownAntibiotics no longer looks like a literal in C6-Sim.js').toBeTruthy();
  return new Set([...block[1].matchAll(/"([a-z]+)"\s*:/g)].map((m) => m[1]));
}

describe('the two antibiotic tables', () => {
  it('recognises every name the planner can normalise', () => {
    const sim = simAliases();
    const missing = Object.keys(ALIASES_FOR_TEST).filter((a) => !sim.has(a));
    expect(missing, `C6-Sim.js will not recognise these, so a Transform naming one reports `
      + `"could not read which antibiotic": ${missing.join(', ')}`).toEqual([]);
  });
});
