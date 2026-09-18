import { describe, it, expect } from 'vitest';
import { isOligoFile } from '../../src/oligos/read.js';
import fs from 'node:fs';
import path from 'node:path';

// TWO SITES HELD ONE QUESTION AND THE NARROWER ONE WAS LOAD-BEARING.
//
// `projectSequences` matched `/_oligos\.txt$/i` — the name must END in `_oligos.txt`. So
// `gold_oligos.txt` and `cr_reconstruction_oligos.txt` loaded, and CBA-Ligase1's
// `oligo_CBA-Ligase1.txt` never had, for the whole life of that experiment. Its three probe PCRs
// could not simulate, no thermocycler program could be computed, and `c6-labplan` refused to
// write a workbook — reporting "the template's sequence is not in the project", which was the
// one input that WAS there.
//
// `src/oligos/read.js` already owned the right rule. Found 2026-09-18 compiling the ligase probes.

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');

describe('an oligo file is recognised by name, one rule', () => {
  it('accepts both conventions actually in use', () => {
    expect(isOligoFile('gold_oligos.txt')).toBe(true);           // the fixture
    expect(isOligoFile('cr_reconstruction_oligos.txt')).toBe(true);
    expect(isOligoFile('oligo_CBA-Ligase1.txt')).toBe(true);     // the one that never loaded
    expect(isOligoFile('Assembly oligos')).toBe(true);           // no extension at all
    expect(isOligoFile('primers.tsv')).toBe(true);
  });

  it('and still refuses what is not one', () => {
    expect(isOligoFile('Construction of pCBA11.txt')).toBe(false);
    expect(isOligoFile('Characterization of pGOLD.txt')).toBe(false);
    expect(isOligoFile('p20N31.seq')).toBe(false);
    expect(isOligoFile('notes.md')).toBe(false);
  });

  it('projectSequences uses that rule and holds no second pattern of its own', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/labplanner/planning/projectSequences.js'), 'utf8');
    expect(src).toContain('isOligoFile(base)');
    // The old regex must be gone, not merely unused beside the new call.
    const code = src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
    expect(code).not.toMatch(/\/_oligos\\\.txt\$\/i\.test/);
  });
});
