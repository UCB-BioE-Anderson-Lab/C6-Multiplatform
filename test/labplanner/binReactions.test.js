// Binning is the first stage of the planner and the one that is supposed to be EXACT.
//
// JCA, 2026-09-10: *"the pcr's to sequence cannot be binned with pcrs to clone. One has to
// happen long before the other. So, you can logic through dependencies, and this is also
// something you should be able to do precisely with code looking at input/output relationships
// of steps."*
import { describe, it, expect } from 'vitest';
import { extractJobsFromCFs } from '../../src/labplanner/planning/cfToJobs.js';
import { binReactions } from '../../src/labplanner/planning/binReactions.js';

const cf = (name, text) => ({ name, text });
const bin = (...cfs) => binReactions(extractJobsFromCFs(cfs));
const sheetsOf = (r, op) => r.sheets.filter((s) => s.operation === op);
const names = (s) => s.jobs.map((j) => j.output).sort();

// A whole small experiment: clone something, then sequence what came back.
const CLONE_THEN_SEQ = `PCR\toF\toR\tpTemplate\tfrag
GoldenGate\tfrag\tBsaI\tpNew
Transform\tpNew\tMach1\tSpec\tpNewT
PCR\tseqF\tseqR\tpNewT\tseqamp`;

describe('binning like reactions', () => {
  it('puts independent steps of one operation on one labsheet, across construction files', () => {
    const r = bin(cf('A', 'PCR\toA1\toA2\tpT\tfragA'),
                  cf('B', 'PCR\toB1\toB2\tpT\tfragB'),
                  cf('C', 'PCR\toC1\toC2\tpT\tfragC'));
    const pcr = sheetsOf(r, 'pcr');
    expect(pcr).toHaveLength(1);
    expect(names(pcr[0])).toEqual(['fragA', 'fragB', 'fragC']);
    expect(pcr[0].cfs.sort()).toEqual(['A', 'B', 'C']);
  });

  it("does NOT bin a PCR to sequence with the PCRs that clone — Chris's case", () => {
    const pcr = sheetsOf(bin(cf('X', CLONE_THEN_SEQ)), 'pcr');
    expect(pcr).toHaveLength(2);
    expect(names(pcr[0])).toEqual(['frag']);
    expect(names(pcr[1])).toEqual(['seqamp']);
    // and the later one is marked as a later round, not as a separate mystery
    expect(pcr[1].round).toBe(1);
    expect(pcr[1].rounds).toBe(2);
  });

  it('bins two transforms together even when their construction files are different lengths', () => {
    // THE CASE A DEPTH RULE GETS WRONG. Both files end in a Transform and nothing connects
    // them, so they belong on one labsheet — but one sits at depth 2 and the other at depth 3.
    // Grouping by depth would print two transformation labsheets for one afternoon's work.
    const short = 'PCR\toA\toB\tpT\tf1\nGoldenGate\tf1\tBsaI\tp1\nTransform\tp1\tMach1\tAmp\tt1';
    const long = 'PCR\toC\toD\tpT\tf2\nPCR\toE\toF\tf2\tf3\nGibson\tf3\tp2\nTransform\tp2\tMach1\tAmp\tt2';
    const tr = sheetsOf(bin(cf('S', short), cf('L', long)), 'transform');
    expect(tr).toHaveLength(1);
    expect(names(tr[0])).toEqual(['t1', 't2']);
  });

  it('separates two transforms when one makes what the other consumes', () => {
    const first = 'PCR\toA\toB\tpT\tf1\nGibson\tf1\tpMid\nTransform\tpMid\tMach1\tAmp\tpMade';
    const second = 'PCR\toC\toD\tpMade\tf2\nGibson\tf2\tpLate\nTransform\tpLate\tMach1\tAmp\tpDone';
    const r = bin(cf('1', first), cf('2', second));
    expect(sheetsOf(r, 'transform')).toHaveLength(2);
    expect(sheetsOf(r, 'pcr')).toHaveLength(2);
  });

  it('orders the labsheets so nothing is scheduled before what it consumes', () => {
    const r = bin(cf('X', CLONE_THEN_SEQ));
    const at = (op) => r.sheets.findIndex((s) => s.operation === op);
    expect(at('pcr')).toBeLessThan(at('goldengate'));
    expect(at('goldengate')).toBeLessThan(at('transform'));
    expect(r.sheets[r.sheets.length - 1].jobs[0].output).toBe('seqamp');
  });

  it('reports a dependency cycle rather than inventing an order for it', () => {
    const r = bin(cf('bad', 'PCR\toA\toB\tpLoop\tpMid\nGibson\tpMid\tpLoop'));
    expect(r.cycles.length).toBeGreaterThan(0);
  });

  it('keeps every step traceable to the file and line it came from', () => {
    const r = bin(cf('A', 'PCR\toA1\toA2\tpT\tfragA'), cf('B', 'PCR\toB1\toB2\tpT\tfragB'));
    for (const j of sheetsOf(r, 'pcr')[0].jobs) {
      expect(j.cf).toMatch(/^[AB]$/);
      expect(j.line).toBe(1);
    }
  });
});

describe('lifting jobs out of construction files', () => {
  it('separates oligos from the inputs another step could have produced', () => {
    const { jobs } = extractJobsFromCFs([cf('A', 'PCR\toF\toR\tpTemplate\tfrag')]);
    expect(jobs[0].oligos).toEqual(['oF', 'oR']);
    expect(jobs[0].dnaInputs).toEqual(['pTemplate']);
  });

  it('does not treat a strain or an antibiotic as DNA', () => {
    const { jobs } = extractJobsFromCFs([cf('A', 'Transform\tpDNA\tMach1\tSpec\tpOut')]);
    expect(jobs[0].dnaInputs).toEqual(['pDNA']);
  });

  it('lets two files each have their own `gg`, and links each to its own', () => {
    // Three of SynThera's ten construction files produce something called `gg`. It is a working
    // name for "the Golden Gate product of this file", and they are not the same molecule. A
    // global name map kept the first and silently linked pGhost3's Transform to pGhost2's
    // assembly — an order built on an edge that does not exist.
    const a = 'PCR\toA\toB\tpT\tfrag\nGoldenGate\tfrag\tBsaI\tgg\nTransform\tgg\tMach1\tAmp\tpA';
    const b = 'PCR\toC\toD\tpT\tfrag\nGoldenGate\tfrag\tBsaI\tgg\nTransform\tgg\tMach1\tAmp\tpB';
    const lifted = extractJobsFromCFs([cf('A', a), cf('B', b)]);
    const trB = lifted.jobs.find((j) => j.output === 'pB');
    expect(lifted.resolve(trB, 'gg').cf).toBe('B');
    // nobody outside A or B consumes `gg`, so the reuse is not a problem to report
    expect(lifted.problems.some((p) => p.code === 'AMBIGUOUS_ACROSS_FILES')).toBe(false);
    // and each file's steps stay in their own chain: two rounds of nothing, one sheet each
    const r = binReactions(lifted);
    expect(sheetsOf(r, 'transform')).toHaveLength(1);
    expect(names(sheetsOf(r, 'transform')[0])).toEqual(['pA', 'pB']);
  });

  it('reports a shared name only when an outsider has to consume it', () => {
    const a = 'PCR\toA\toB\tpT\tshared';
    const b = 'PCR\toC\toD\tpT\tshared';
    const c = 'PCR\toE\toF\tshared\tlater';        // which `shared`? nobody can say
    const { problems } = extractJobsFromCFs([cf('A', a), cf('B', b), cf('C', c)]);
    expect(problems.some((p) => p.code === 'AMBIGUOUS_ACROSS_FILES')).toBe(true);
  });

  it('still follows a name that genuinely crosses files', () => {
    // pGhost17 templates on pGhost16, which another file builds. That edge is the whole reason
    // those PCRs cannot share a labsheet with the ones that build it.
    const makes = 'PCR\toA\toB\tpT\tf\nGibson\tf\tasm\nTransform\tasm\tMach1\tAmp\tpMid';
    const uses = 'PCR\toC\toD\tpMid\tf2';
    const r = binReactions(extractJobsFromCFs([cf('maker', makes), cf('user', uses)]));
    expect(sheetsOf(r, 'pcr')).toHaveLength(2);
  });

  it('still finds the edges in a file C6 cannot parse, and says the read was approximate', () => {
    // pGhost16's real construction file uses `Assemble`, which parseCF rejects. Read
    // generically its inputs all arrive in one bucket — enough for dependencies, not enough to
    // tell an oligo from a template, and the job says so instead of reporting no oligos.
    const { jobs } = extractJobsFromCFs([cf('old',
      'PCR\toA\toB\tpT\tS8v\nAssemble\tS8v\tSL8\nTransform\tSL8\tMach1\tSpec\tpOut')]);
    const asm = jobs.find((j) => j.output === 'SL8');
    expect(asm.dnaInputs).toContain('S8v');
    expect(asm.approximate).toBe(true);
    expect(jobs.find((j) => j.output === 'pOut').dnaInputs).toContain('SL8');
  });
});
