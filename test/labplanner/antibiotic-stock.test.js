/**
 * The solvent is the step people get wrong, so it goes first and it goes alone.
 *
 * JCA, 2026-09-12, on a recent erythromycin prep: *"The error they made was trying to do it in
 * water. Emphasize the solvent, but KISS."*
 *
 * It was already in the protocol — step 4 of nine, and a parenthesis in step 5. That is not where
 * somebody reading at a bench looks, and **a stock made in water looks exactly like a stock**:
 * clear liquid in a labelled tube, poured into agar that then selects for nothing. There is no
 * later step at which the mistake announces itself.
 */
import { describe, it, expect } from 'vitest';
import { factory } from '../../src/labplanner/protocols/modules/preparation_of_antibiotic_1000x_stock.js';

const erm = () => factory({ antibiotic: 'erm' });

describe('antibiotic stock', () => {
  it('says the solvent before step 1', () => {
    const first = erm().template.trim().split('\n')[0];
    expect(first.toLowerCase()).toContain('ethanol');
    expect(first.toLowerCase()).toContain('not water');
  });

  it('says it in the name and the description too, where a cheatsheet line would show it', () => {
    const r = erm();
    expect(r.name).toContain('erythromycin');
    expect(r.description).toBe('100 mg/mL in ethanol.');
  });

  it('does not claim water is wrong for the antibiotics that use it', () => {
    const amp = factory({ antibiotic: 'ampicillin' });
    expect(amp.template).not.toContain('not water');
    expect(amp.template.trim().split('\n')[0]).toContain('water');
  });

  it('gives one dissolving instruction, not two that disagree', () => {
    // The per-antibiotic note said "vortex until it clears" and the generic line two below it
    // said "vortex briefly". For erythromycin the brief one is wrong, and both were on the page.
    const t = erm().template;
    expect(t.match(/vortex/gi)).toHaveLength(1);
    expect(t).not.toContain('vortex briefly');
  });

  it('still computes the volume from the mass actually weighed', () => {
    // The arithmetic is the other half of the protocol and the emphasis must not have cost it.
    expect(factory({ antibiotic: 'erm', weighed_mg: 37 }).template).toContain('37 mg × 10 = 370');
  });
});
