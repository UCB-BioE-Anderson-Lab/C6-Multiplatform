import { describe, it, expect } from 'vitest';
import { isCharacterizationFile } from '../../src/labplanner/validate/characterizationFile.js';

// "reconstruction" CONTAINS "construction", and the classifier was unanchored.
//
// Found 2026-09-18 by putting CBA's `cr_reconstruction` into the toolkit for the first time. Its
// oligo file is `cr_reconstruction_oligos.txt`, which matched `/construction.*\.txt$/i` through
// the folder's own name, so it was read as a construction file. Its rows —
// `oCBA14 <tab> ccata… <tab> 25nm <tab> STD` — came back as nine UNKNOWN_OPERATION problems plus
// a DUPLICATE_PRODUCT for "STD". Ten problems on a sound experiment, none of them about it.
//
// Measured before changing it: across Cheese, Assembly and this repo, 61 distinct files carry
// "construction" or "characterization" in the name. TWO do not begin with the convention, and
// both are oligo files — this one and "All Oligos for construction and sequencing pFK1 pFK2.txt".
// So anchoring fixes two real misreadings and excludes nothing that was ever meant to be read.

// The same shape `bin/c6-plan` uses, kept here so the rule is testable without spawning a CLI.
const isCF = (f) => /^construction of .*\.txt$/i.test(f);

describe('a file is a construction or characterization file by its NAME, anchored', () => {
  it('accepts the convention, in either case and either spelling', () => {
    expect(isCF('Construction of pCBA15.txt')).toBe(true);
    expect(isCF('construction of repeat fragments.txt')).toBe(true);
    expect(isCharacterizationFile('Characterization of pBET9.txt')).toBe(true);
    expect(isCharacterizationFile('Characterisation of pBET9.txt')).toBe(true);
  });

  it('THE ONE THAT COST TEN PROBLEMS: an oligo file in a folder called cr_reconstruction', () => {
    expect(isCF('cr_reconstruction_oligos.txt')).toBe(false);
    expect(isCharacterizationFile('cr_reconstruction_oligos.txt')).toBe(false);
  });

  it('and the other real file that was being misread', () => {
    expect(isCF('All Oligos for construction and sequencing pFK1 pFK2.txt')).toBe(false);
  });

  it('the word has to START the name, not merely appear in it', () => {
    for (const f of ['my construction of pX.txt', 'notes on characterization of pX.txt',
                     'deconstruction of pX.txt']) {
      expect(isCF(f), f).toBe(false);
      expect(isCharacterizationFile(f), f).toBe(false);
    }
  });

  it('" of " is required — it is what pairs the two documents by product', () => {
    // c6-labplan strips "<kind> of " to get the product name and matches the pair on it, so a
    // file without it has no product to pair on.
    expect(isCF('Construction pCBA15.txt')).toBe(false);
    expect(isCharacterizationFile('Characterization pBET9.txt')).toBe(false);
  });
});
