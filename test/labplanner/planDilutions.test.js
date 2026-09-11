// Dilutions: four outcomes per oligo, and they are not four degrees of the same thing.
//
// JCA, 2026-09-10: *"When looking for the oligos to use in PCR, you first search for a 10 uM
// stock. If that doesn't exist, you search for a 100uM stock. If that doesn't exist you say to
// buy it… you only have a dilution labsheet if there weren't ready-to-use oligos in the
// inventory. For sequencing, you look for a 2.66 uM oligo, not 10 uM."*
import { describe, it, expect } from 'vitest';
import { createInventory, addBox, upsertSample } from '../../src/inventory/inventory.js';
import { parseTabular } from '../../src/inventory/io.js';
import { planDilutions, concentrationUM } from '../../src/labplanner/planning/planDilutions.js';

function inv(...tubes) {
  let i = addBox(createInventory(), { name: 'RE', rows: 8, cols: 12 });
  tubes.forEach(([construct, concentration, row, col]) => {
    i = upsertSample(i, { location: { boxname: 'RE', row, col, label: construct, sidelabel: '' },
                          construct, concentration, type: 'oligo' });
  });
  return i;
}
const pcr = (...oligos) => [{ operation: 'pcr', cf: 'A', line: 1, output: 'p', oligos, dnaInputs: [] }];
const seq = (...oligos) => [{ operation: 'sequence', cf: 'A', line: 1, output: 's', oligos, dnaInputs: [] }];

describe('planDilutions', () => {
  it('uses a 10 uM stock where one exists, and gives its box and well', () => {
    const p = planDilutions(pcr('oA'), inv(['oA', '10 uM', 3, 1]));
    expect(p.ready).toHaveLength(1);
    expect(p.ready[0].source.box).toBe('RE');
    expect(p.ready[0].source.well).toBe('D2');     // row 3, col 1 -> D2, both 0-based
    expect(p.dilute).toHaveLength(0);
  });

  it('makes a dilution step when only the 100 uM exists', () => {
    const p = planDilutions(pcr('oA'), inv(['oA', '100 uM', 2, 1]));
    expect(p.ready).toHaveLength(0);
    expect(p.dilute).toHaveLength(1);
    expect(p.dilute[0].fromUM).toBe(100);
    expect(p.dilute[0].from.well).toBe('C2');
    // where it goes is judgement, and an unplaced tube must not look placed
    expect(p.dilute[0].destination).toBeNull();
  });

  it('says to ORDER one that is nowhere — not a labsheet', () => {
    const p = planDilutions(pcr('oMissing'), inv(['oA', '10 uM', 3, 1]));
    expect(p.order.map((o) => o.oligo)).toEqual(['oMissing']);
    expect(p.dilute).toHaveLength(0);
  });

  it('wants 2.66 uM for sequencing, not 10', () => {
    const i = inv(['sA', '2.66 uM', 0, 3], ['pB', '10 uM', 0, 4]);
    expect(planDilutions(seq('sA'), i).ready).toHaveLength(1);
    // a 10 uM tube does not satisfy a sequencing oligo
    const p = planDilutions(seq('pB'), i);
    expect(p.ready).toHaveLength(0);
    expect(p.ask).toHaveLength(1);
  });

  it('an oligo used to amplify AND to sequence needs both tubes', () => {
    // Keying on the name alone dropped the second silently, and the failure shows up at the
    // bench as a sequencing reaction at four times the intended primer concentration.
    const jobs = [...pcr('oBoth'), ...seq('oBoth')];
    const p = planDilutions(jobs, inv(['oBoth', '10 uM', 1, 1], ['oBoth', '100 uM', 0, 1]));
    expect(p.ready.map((r) => r.workingUM)).toEqual([10]);
    expect(p.dilute.map((d) => d.workingUM)).toEqual([2.66]);
  });

  it('refuses an inventory it could not read rather than ordering everything', () => {
    // The real failure: SynThera's inventory opens with provenance comments, the parser read one
    // as the header, and this reported six oligos sitting in a freezer as needing to be bought.
    const p = planDilutions(pcr('oA', 'oB'), createInventory());
    expect(p.error).toMatch(/could not be read/);
    expect(p.order).toHaveLength(0);
    expect(p.wanted.map((w) => w.oligo)).toEqual(['oA', 'oB']);
  });

  it('reads a tabular inventory whose header is preceded by comments', () => {
    const text = '# where this came from\n# and what was not inferred\n'
               + 'construct\tconcentration\tbox\twell\noA\t10 uM\tRE\tD2\n';
    const i = parseTabular(text);
    expect(Object.keys(i.samples)).toHaveLength(1);
    expect(planDilutions(pcr('oA'), i).ready).toHaveLength(1);
  });

  it('treats a labelled concentration as approximate, because tubes are', () => {
    expect(concentrationUM('10 uM')).toBe(10);
    expect(concentrationUM('uM100')).toBe(100);
    expect(concentrationUM('25nm')).toBe(0.025);
    expect(concentrationUM('miniprep')).toBeNull();
    expect(planDilutions(pcr('oA'), inv(['oA', '9.8 uM', 3, 1])).ready).toHaveLength(1);
  });

  it('carries which steps are waiting on each oligo', () => {
    const p = planDilutions(pcr('oA'), inv(['oA', '10 uM', 3, 1]));
    expect(p.ready[0].neededBy[0]).toMatchObject({ cf: 'A', output: 'p', operation: 'pcr' });
  });
});
