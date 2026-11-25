/**
 * A plan as an experiment roadmap: one step per labsheet, what each waits on, and the windows
 * that make a run of bench days a flight (src/labplanner/planning/toRoadmap.js).
 *
 * JCA, 2026-11-25: *"there are flights of activity within a gant diagram where all the steps need
 * to be done within time windows before there is a pause to the scheduling."* The numbers come
 * from the protocol modules' `next` and `park` (protocols/TIMING.txt); these tests pin that they
 * are carried and never invented.
 */
import { describe, it, expect } from 'vitest';
import { extractJobsFromCFs } from '../src/labplanner/planning/cfToJobs.js';
import { binReactions } from '../src/labplanner/planning/binReactions.js';
import { toRoadmap } from '../src/labplanner/planning/toRoadmap.js';
import * as transform from '../src/labplanner/protocols/modules/heat_shock_transformation.js';
import * as pick from '../src/labplanner/protocols/modules/picking_colonies_into_block.js';
import * as miniprep from '../src/labplanner/protocols/modules/qiagen_miniprep.js';

const CF = `PCR\tbo1\tbo2\tpSRC\tfrag
GoldenGate\tfrag\tbackbone\tBsaI\tpNEW
Transform\tpNEW\tMach1\tAmp\t37\tpNEW_Mach1
`;
const CHAR = `Pick\tpNEW\tn=4 phenotype=white clone=Mach1/pNEW\tpNEW_colonies
Miniprep\tpNEW_colonies\tclone=pNEW\tpNEW_dna
`;
const timings = {
  heat_shock_transformation: transform.timing,
  picking_colonies_into_block: pick.timing,
  qiagen_miniprep: miniprep.timing,
};

function roadmap(t = timings) {
  const lifted = extractJobsFromCFs([
    { name: 'pNEW', text: CF },
    { name: 'pNEW', text: CHAR, characterization: true },
  ]);
  const binned = binReactions(lifted);
  return toRoadmap({ binned, lifted, timings: t, id: 'pnew', name: 'pNEW confirmed' });
}
const byOp = (rm, op) => rm.steps.find((s) => s.operation === op);

describe('toRoadmap', () => {
  it('makes one step per labsheet, each waiting only on its direct predecessor', () => {
    const rm = roadmap();
    expect(rm.name).toBe('pNEW confirmed');
    expect(byOp(rm, 'pick').after).toEqual([byOp(rm, 'transform').id]);
    expect(byOp(rm, 'miniprep').after).toEqual([byOp(rm, 'pick').id]);
    // the transformation waits on the assembly, and NOT also on the PCR before it
    expect(byOp(rm, 'transform').after).toEqual([byOp(rm, 'goldengate').id]);
  });

  it("hands each protocol's `next` to the step after it, in hours", () => {
    const rm = roadmap();
    expect(byOp(rm, 'pick').window).toMatchObject({ min_h: 16, max_h: 48 });
    expect(byOp(rm, 'miniprep').window).toMatchObject({ min_h: 16, max_h: 36 });
    expect(byOp(rm, 'transform').window).toBeUndefined();
  });

  it('marks a park, so the flight transform -> pick -> miniprep ends there', () => {
    const rm = roadmap();
    expect(byOp(rm, 'miniprep').park).toBe(true);
    expect(byOp(rm, 'pick').park).toBeUndefined();
  });

  it('never invents timing: no module timing is `unknown`, no window, no work_min', () => {
    const rm = roadmap({});
    const p = byOp(rm, 'pick');
    expect(p.timing).toBe('unknown');
    expect(p.window).toBeUndefined();
    expect(p.work_min).toBeUndefined();
  });

  it('reports fixed hands-on minutes only when nothing in the work scales with a count', () => {
    const rm = roadmap();
    expect(byOp(rm, 'transform').work_min).toBe(10);
    expect(byOp(rm, 'pick').work_min).toBeUndefined();      // per-colony work: unmeasured
  });
});
