/**
 * What a tube holds, worked out from what the tube is.
 *
 * **THIS TEST EXISTS BECAUSE THE COMPILE MATRIX CANNOT REACH THESE RULES.** The two scenario
 * experiments look up plasmid minipreps and oligos and nothing else, so `glycerolStock`,
 * `genomicPrep`, `synthesised` and `unstated` never fire there and are listed as cold. Cold in
 * the matrix is not untested: every rule below is exercised against the vocabulary a real freezer
 * actually contains, which is where these four earn their place.
 *
 * The vocabulary is taken from Pimar's inventory as it stood on 2026-10-28 — every distinct value
 * of the sample-kind column across 1,712 tubes, mangled spellings included.
 */
import { describe, it, expect } from 'vitest';
import { choose } from '../../src/labplanner/rules/sampleKind.rules.js';

const classOf = (c) => choose({ concentration: c }).class;
const ruleFor = (c) => choose({ concentration: c }).rule;

describe('the sample kind says what the molecule is', () => {
  it('reads a plasmid prep and its dilutions', () => {
    for (const k of ['miniprep', 'mini prep', 'microprep', 'dil20x', 'dil15x',
                     '20x-dilute', '20x dil.', 'diluted 25x']) {
      expect(classOf(k), k).toBe('plasmid');
    }
  });

  it('reads an oligo from a micromolar figure', () => {
    for (const k of ['10 uM', '10uM', '100 uM', '100uM', '2.66 uM', '2.66uM', '9uM']) {
      expect(classOf(k), k).toBe('oligo');
    }
  });

  // **THE MICRO SIGN DOES NOT SURVIVE EVERY ROUND TRIP THROUGH EXCEL**, and this freezer holds the
  // wreckage: 25 tubes say `100<U+FFFD>M` and 36 say `100_m` or `10_m`. They are µM stocks and must
  // classify as such, or 61 oligos drop out of primer selection for a lost character.
  it('reads an oligo whose micro sign was mangled in transit', () => {
    for (const k of ['100�M', '100_m', '10_m', '100µM']) {
      expect(classOf(k), JSON.stringify(k)).toBe('oligo');
    }
  });

  it('reads a glycerol stock as cells, which are not a PCR input at all', () => {
    expect(classOf('-80 glycerol')).toBe('cells');
    expect(ruleFor('-80 glycerol')).toBe('glycerolStock');
  });

  it('reads a genomic prep', () => {
    expect(classOf('genomic')).toBe('genomic');
    expect(ruleFor('genomic')).toBe('genomicPrep');
  });

  it('reads synthesised linear DNA', () => {
    for (const k of ['gblock', 'Twist', 'gene']) expect(classOf(k), k).toBe('dsDNA');
    expect(ruleFor('gblock')).toBe('synthesised');
  });

  // **UNKNOWN IS A VERDICT, NOT A FAILURE.** `zymo` is a column cleanup and says nothing about
  // what was cleaned up; `1:1` is a dilution of something unnamed. Callers must not exclude on
  // this, which is the half of the contract `query.js` holds.
  it('declines to place what does not place', () => {
    for (const k of ['zymo', '1:1', '', '   ']) expect(classOf(k), JSON.stringify(k)).toBe(null);
    expect(ruleFor('zymo')).toBe('unstated');
  });

  // THE CASE THAT BROKE A LOOSE PATTERN. One tube reads `diluted 10x, contains pimer1` — a
  // dilution of a PRIMER. Matching `dil` anywhere called it a plasmid, which is a positive
  // misclassification and would have dropped it from oligo selection: exactly the harm the old
  // stored `type` column caused and this rule set exists to end.
  it('does not mistake free text for a kind because it contains one', () => {
    expect(classOf('diluted 10x, contains pimer1')).toBe(null);
  });
});
