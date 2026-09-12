/**
 * The decisions were already made. Read them; do not make them again.
 *
 * JCA, 2026-09-12: *"was there a sequencing plan in the original spreadsheet? I don't recall what
 * it is, but we arent actually making a new cloning plan."*
 *
 * There was. Two reads per clone, bf037 forward and bf038 reverse; minipreps into `cheese_temp`;
 * *"Go with just 2 [colonies] unless there is significant phenotypic diversity."* All of it sat in
 * a workbook that is being retired, and the compiler was defaulting past it — picking four,
 * sequencing once, and reporting the oligo choice and the box as still open.
 *
 * A construction file describes the DNA; a characterization file describes what the plasmid is
 * for. Picking, minipreping and reading traces establish that it is BUILT, which is neither — so
 * this is their file. Every field is optional: with no file the chain is injected with its
 * defaults and each undecided field is reported as open. **The file closes decisions; it does not
 * create them.**
 */
import { describe, it, expect } from 'vitest';
import { parseVerification, verificationConfig, isVerificationFile }
  from '../../src/labplanner/validate/verificationFile.js';
import { injectVerificationJobs } from '../../src/labplanner/planning/injectVerification.js';

const FILE = [
  '# a comment',
  'Pick\tn=2 max=4 medium=2YT+Erm criteria=go with 2 unless there is significant phenotypic diversity',
  'Miniprep\tbox=cheese_temp',
  'Sequence\toligos=bf037,bf038 reads=F,R',
].join('\n');

const bin = () => [{
  operation: 'transform', round: 0, rounds: 1, depth: 2, cfs: ['pBET8'],
  jobs: [{ operation: 'transform', cf: 'pBET8', line: 4, output: 'pBET8_Mach1',
           dnaInputs: ['pBET8'], args: {} }],
}];

describe('verification file', () => {
  it('reads every decision the workbook had made', () => {
    const { steps, problems } = parseVerification(FILE, 'Verification of pBET8.txt');
    expect(problems).toEqual([]);
    expect(verificationConfig(steps)).toEqual({
      picks: 2, pickMax: 4, pickMedium: '2YT+Erm',
      pickCriteria: 'go with 2 unless there is significant phenotypic diversity',
      minprepBox: 'cheese_temp',
      sequencingOligos: ['bf037', 'bf038'], readSuffixes: ['F', 'R'],
    });
  });

  it('lets a value be a sentence', () => {
    // Splitting on whitespace turned one criterion into eight complaints about unnamed values.
    // Half of these decisions are prose; a grammar that cannot hold prose cannot hold them.
    const { steps } = parseVerification(FILE);
    expect(steps.pick.criteria).toContain('phenotypic diversity');
  });

  it('still says when a value has no key', () => {
    const { problems } = parseVerification('Pick\tn=2 4', 'v.txt');
    expect(problems.map((p) => p.code)).toEqual(['UNNAMED_VALUE']);
  });

  it('refuses a step that belongs in another file', () => {
    const { problems } = parseVerification('Transform\tstrain=Mach1', 'v.txt');
    expect(problems[0].code).toBe('UNKNOWN_STEP');
    expect(problems[0].message).toContain('pick, miniprep, sequence, analysis');
  });

  it('changes what the planner emits', () => {
    const cfg = verificationConfig(parseVerification(FILE).steps);
    const bins = injectVerificationJobs(bin(), cfg);
    const mp = bins.find((b) => b.operation === 'miniprep');
    const seq = bins.find((b) => b.operation === 'sequencing');
    expect(mp.jobs.map((j) => j.output)).toEqual(['pBET8-A', 'pBET8-B']);
    expect(mp.jobs[0].args.box).toBe('cheese_temp');
    expect(seq.jobs.map((j) => j.output.replace(/_seq$/, '')))
      .toEqual(['pBET8-AF', 'pBET8-AR', 'pBET8-BF', 'pBET8-BR']);
  });

  it('closes the decisions it answers and leaves the rest open', () => {
    const bins = injectVerificationJobs(bin(), verificationConfig(parseVerification(FILE).steps));
    for (const b of bins) expect(b.open, b.operation).toBeUndefined();
    // And with no file at all, the same three are open again.
    const bare = injectVerificationJobs(bin(), {});
    expect(bare.filter((b) => b.open).map((b) => b.operation))
      .toEqual(['pick', 'miniprep', 'sequencing']);
  });

  it('knows one by its name', () => {
    expect(isVerificationFile('Verification of pBET8.txt')).toBe(true);
    expect(isVerificationFile('Construction of pBET8.txt')).toBe(false);
  });
});
