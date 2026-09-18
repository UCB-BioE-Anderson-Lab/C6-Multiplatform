/**
 * A characterization file comes after the whole construction file, not after one step of it.
 *
 * JCA, 2026-09-12, looking at a generated packet: *"you've got electroporation before mach1
 * transformation. Electroporation comes much later, after sequence confirmation."*
 *
 * The name-level edge was correct and insufficient. `Retransform pBET8 …` names the CONSTRUCT,
 * and the construct exists the moment the Golden Gate reaction is assembled — so the only edge
 * the graph carried ran from the assembly, and the electroporation came out at the same depth as
 * the transformation that verifies it. Tied, the sheets were separated by operation name,
 * alphabetically: "retransform" before "transform". Wrong, and it looked deliberate.
 *
 * The characterization file's own header says what the rule is: *"What happens to pBET8 once it
 * is built."* Once it is BUILT — transformed, picked, minipreped, sequenced. Two of those are in
 * neither file, which is exactly why the dependency has to be on the FILE and not on the step:
 * stated that way it holds without knowing which verification steps somebody wrote down.
 */
import { describe, it, expect } from 'vitest';
import { extractJobsFromCFs } from '../src/labplanner/planning/cfToJobs.js';
import { binReactions } from '../src/labplanner/planning/binReactions.js';

const CF = `PCR\tbo1\tbo2\tpSRC\tfrag
GoldenGate\tfrag\tbackbone\tBsaI\tpNEW
Transform\tpNEW\tMach1\tAmp\t37\tpNEW_Mach1
`;

const CHAR = `Retransform\tpNEW\thost=L.lactis antibiotic=Erm\tpNEW_lactis
Pick\tpNEW_lactis\tn=4 phenotype=growing on the selective plate\tpNEW_clones
Assay\tpNEW_clones\tprotocol=plate_reader_fluorescence\tresult
`;

function plan() {
  const lifted = extractJobsFromCFs([
    { name: 'pNEW', text: CF },
    { name: 'pNEW', text: CHAR, characterization: true },
  ]);
  const binned = binReactions(lifted);
  return { lifted, binned, order: binned.sheets.map((s) => s.operation) };
}

describe('characterization follows construction', () => {
  it('puts the electroporation after the cloning transformation', () => {
    const { order } = plan();
    expect(order.indexOf('retransform')).toBeGreaterThan(order.indexOf('transform'));
  });

  it('puts every characterization step after every construction step', () => {
    const { order } = plan();
    const construction = ['pcr', 'goldengate', 'transform'];
    const characterization = ['retransform', 'pick', 'assay'];
    const last = Math.max(...construction.map((o) => order.indexOf(o)));
    const first = Math.min(...characterization.map((o) => order.indexOf(o)));
    expect(first).toBeGreaterThan(last);
  });

  it('does not make the characterization steps depend on each other', () => {
    // The first attempt did, and it cost the whole file: both documents are read under the
    // construct's name, so filtering the file-level edges by `cf` alone caught the
    // characterization steps too. All four reported as cycles and all four vanished from the
    // plan — a packet that was simply missing its experiment, with nothing on stderr.
    const { binned } = plan();
    expect(binned.cycles).toEqual([]);
    expect(binned.sheets.map((s) => s.operation)).toContain('assay');
  });

  it('leaves a construction-only plan exactly as it was', () => {
    const lifted = extractJobsFromCFs([{ name: 'pNEW', text: CF }]);
    const order = binReactions(lifted).sheets.map((s) => s.operation);
    expect(order).toEqual(['pcr', 'goldengate', 'transform']);
  });
});
