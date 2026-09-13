/**
 * What the clones go into, and what they are called, are two decisions.
 *
 * JCA, 2026-09-12:
 *
 * > *"When picking single clones of something, like you are making pBET8, not some library, you
 * > use the [A-Z] clone notation. It is when doing libraries that you refer to clones by plate
 * > address, because there are typically many clones screened, so it's unhelpful to name them
 * > sequentially. Whether ultimately the decision is to grow the clones in a block vs individual
 * > tubes more has to do with the number of samples, but doesn't change how you would name the
 * > clones."*
 *
 * I had them as one decision. Four clones of one construct are A through D whether they sit in
 * tubes or in a block; a library screened in that same block is addressed by well.
 */
import { describe, it, expect } from 'vitest';
import { BLOCK_FROM, vesselFor, layoutFor, describeLayout } from '../../src/labplanner/planning/vessels.js';
import { cloneDesignation, plateAddress } from '../../src/labplanner/planning/naming.js';

describe('the vessel is about count', () => {
  it('uses tubes up to four and a block from five', () => {
    expect(BLOCK_FROM).toBe(5);
    expect([1, 2, 4].map(vesselFor)).toEqual(['tubes', 'tubes', 'tubes']);
    expect([5, 24].map(vesselFor)).toEqual(['block', 'block']);
  });

  it('says which and why in one line', () => {
    expect(describeLayout(2)).toMatch(/one tube each/);
    expect(describeLayout(8)).toMatch(/24-well block/);
  });

  it('takes a declared vessel over the count', () => {
    // Lactis3 picks four — tubes, by count — into a block, because the culture reads it in a
    // plate reader. The sheet used to say both, two lines apart.
    expect(describeLayout(4)).toMatch(/one tube each/);
    expect(describeLayout(4, 'block')).toMatch(/24-well block/);
  });
});

describe('the layout is proposed, not left to the bench', () => {
  it('fills down the columns', () => {
    // *"arranging them in some logical way within the plate makes setting things up more
    // communicable"* — down the columns is the axis a multichannel travels and the axis a block
    // is read along. Along the rows means transferring a column of four unrelated cultures.
    expect(layoutFor(6)).toEqual(['A1', 'B1', 'C1', 'D1', 'A2', 'B2']);
  });

  it('fills a whole block', () => {
    expect(layoutFor(24)).toHaveLength(24);
    expect(layoutFor(24).at(-1)).toBe('D6');
  });

  it('refuses to spill into a second block quietly', () => {
    // Two blocks is a decision about the session — whether one person can handle 48 cultures in
    // an afternoon — not a layout that can be computed.
    expect(() => layoutFor(25)).toThrow(/will not fit/);
  });
});

describe('the notation is about the kind of experiment', () => {
  it('letters a handful of clones of one construct', () => {
    expect([0, 1, 3].map((i) => cloneDesignation(i))).toEqual(['A', 'B', 'D']);
  });

  it('addresses a library by plate, row and column', () => {
    // `[0-9][A-Z][0-9]`, and filled down the columns so the address and the well are one fact.
    expect([0, 1, 4].map((i) => cloneDesignation(i, { library: true })))
      .toEqual(['1A1', '1B1', '1A2']);
    expect(plateAddress(24)).toBe('2A1');
  });

  it('says a long run is a library rather than inventing AA', () => {
    expect(() => cloneDesignation(26)).toThrow(/is a library/);
  });

  it('has no room past plate 9, and says so', () => {
    expect(() => plateAddress(24 * 9)).toThrow(/no room/);
  });
});
