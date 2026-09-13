/**
 * The four operations that answer "is it what we think it is": pick, miniprep, sequencing,
 * analysis. GATE 3b of `docs/TOOLKIT-PLAN.md`.
 *
 * Both cases here are ones the golden fixture cannot see. Its verification chain is INJECTED,
 * which makes it single-read and oligo-less — so a two-read submission and the data-not-tubes
 * shape of an analysis's inputs are exactly what it has no sample of, and exactly where the two
 * defects were. A harness that only diffs what it already renders cannot warn about a shape it
 * has never rendered.
 */
import { describe, it, expect } from 'vitest';
import { applyDesign, DESIGNS } from '../../src/labplanner/design/index.js';

const nolabel = Object.assign(() => '', { of: () => null });
const run = (bin) => applyDesign(bin, () => undefined, { label: nolabel });

const read = (clone, r, oligo) => ({
  output: `pGOLD-${clone}${r}_seq`, inputs: [`pGOLD-${clone}`],
  params: { oligo, clone, read: r },
});

describe('sequencing', () => {
  it('names the read for the clone and the direction, not the clone alone', () => {
    const d = run({ operation: 'sequencing', samples: [read('B', 'F', 'bf037')] });
    expect(d.columns[0].label).toBe('pGOLD-BF');
  });

  // THE DEFECT. `samples[0].params.oligo` was handed to `cycle_sequencing` as the submission's
  // primer, so the protocol printed "primer: bf037" immediately above a table half of whose rows
  // read with bf038 — the "plate on Amp over an erm sheet" failure, one operation along.
  it('tells the protocol a primer only when every read uses the same one', () => {
    const two = run({ operation: 'sequencing',
                      samples: [read('A', 'F', 'bf037'), read('A', 'R', 'bf038')] });
    expect(two.values.cycle_sequencing.samples).toBe(2);
    expect(two.values.cycle_sequencing.primer).toBeUndefined();

    const one = run({ operation: 'sequencing',
                      samples: [read('A', 'F', 'bf037'), read('B', 'F', 'bf037')] });
    expect(one.values.cycle_sequencing.primer).toBe('bf037');
  });

  it('renders no protocol at all when no oligo has been chosen', () => {
    const d = run({ operation: 'sequencing',
                    samples: [{ output: 'pGOLD-A_seq', inputs: ['pGOLD-A'], params: {} }] });
    expect(d.module).toBe(null);
    expect(d.values).toEqual({});
  });
});

describe('analysis', () => {
  // Its inputs are chromatograms that arrive by email. The Source block asks one question —
  // which box, which well — and printing `pGOLD-AF` under it sends somebody to a freezer to look
  // for a trace file.
  it('fetches nothing', () => {
    expect(DESIGNS.analysis.fetches).toBe(false);
  });

  it('every other operation does fetch', () => {
    for (const [name, d] of Object.entries(DESIGNS))
      if (name !== 'analysis') expect(d.fetches, `${name}`).toBe(true);
  });
});

describe('miniprep', () => {
  // The strain is dropped here and nowhere else. JCA, 2026-09-12: *"When you then miniprep that
  // DNA, you end up with samples who lose the jtk165 designation, and are now just pBET8-A."*
  it('labels the tube with the construct and the clone, on cap and side', () => {
    const d = run({ operation: 'miniprep',
                    samples: [{ output: 'pGOLD-A', inputs: ['B.subtilis/pGOLD-A'],
                                params: { clone: 'A', box: 'gold_box' } }] });
    expect(d.columns[0].label).toBe('pGOLD-A');
    expect(d.notes.join(' ')).toMatch(/cap AND on the side/);
  });
});
