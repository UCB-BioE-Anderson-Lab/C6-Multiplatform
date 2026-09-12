/**
 * A label goes on a cap; the defined terms go in the headers.
 *
 * JCA, 2026-09-12, of a column headed `tube` holding `pcr1`: *"The terms 'label' 'side-label'
 * 'construct' and such are defined terms. Tube is not, and pcr1 is a shitty name. It is above 3
 * letters max, which is a rule for pcr tube labels."*
 *
 * **Two rules had been conflated.** cloning-tutorials keeps CONSTRUCT names to 4-6 characters; a
 * PCR tube LABEL is shorter still, because it is written on a 200 µL cap in marker, in gloves,
 * eight times in a row. And a returned labsheet is read back into the inventory, whose columns
 * are `label`, `side-label`, `construct`, `concentration`, `clone`, `culture`, `type` — a header
 * called `tube` or `product` has to be translated by whoever does that.
 */
import { describe, it, expect } from 'vitest';
import { DESIGNS, applyDesign, tubeLabel, LABEL_MAX }
  from '../../src/labplanner/design/index.js';

// The inventory's vocabulary, plus the per-operation facts a labsheet adds. Anything outside this
// is a word somebody invented for one table.
const DEFINED = new Set(['label', 'side-label', 'construct', 'concentration', 'clone', 'culture',
                         'type']);

const sample = (over = {}) => ({ output: 'pTESTLONGNAME', inputs: ['a'], oligos: ['o1', 'o2'],
                                 productBp: 1200, params: {}, ...over });

describe('labels', () => {
  it('fits on a cap, for every operation', () => {
    for (const op of Object.keys(DESIGNS)) {
      for (const n of [1, 2, 8]) {
        for (let i = 0; i < n; i += 1) {
          expect(tubeLabel(op, i, n).length, `${op} ${i + 1}/${n}`).toBeLessThanOrEqual(LABEL_MAX);
        }
      }
    }
  });

  it('is unique within a sheet', () => {
    for (const op of Object.keys(DESIGNS)) {
      const got = Array.from({ length: 8 }, (_, i) => tubeLabel(op, i, 8));
      expect(new Set(got).size, op).toBe(8);
    }
  });

  it('is the number and nothing else for a PCR', () => {
    // What `primestar_pcr` tells the student to write: "the top label is the number from your
    // labsheet for that reaction".
    expect([0, 1].map((i) => tubeLabel('pcr', i, 2))).toEqual(['1', '2']);
  });

  it('never invents a header where a defined term exists', () => {
    // `tube`, `plate`, `block`, `reaction` and `product` were five words for two things.
    const banned = new Set(['tube', 'plate', 'block', 'reaction', 'product']);
    for (const [op, d] of Object.entries(DESIGNS)) {
      const rows = applyDesign({ operation: op, samples: [sample()] }, () => ({})).columns;
      for (const row of rows) {
        for (const k of Object.keys(row)) {
          expect(banned.has(k), `${op}: column "${k}"`).toBe(false);
        }
      }
    }
  });

  it('uses `construct` to mean the construct, on every row of a table', () => {
    // A transformation's controls put "positive control" in that column — a name on three rows
    // and a role on two, in one table the inventory reads back by its defined meaning.
    const rows = applyDesign({ operation: 'transform',
                              samples: [sample({ params: { strain: 'M', antibiotics: 'erm' },
                                                 controlStock: 'E1',
                                                 controls: [{ kind: 'positive', answers: 'a' },
                                                            { kind: 'negative', answers: 'b' }] })] },
                             () => ({})).columns;
    expect(rows.map((r) => r.construct)).toEqual(['pTESTLONGNAME', 'E1', '(no DNA)']);
    expect(rows.map((r) => r.label)).toEqual(['t', 't+', 't-']);
  });
});
