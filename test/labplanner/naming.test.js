/**
 * The naming decisions, each tested on its own.
 *
 * GATE 2 of `docs/TOOLKIT-PLAN.md`. Every one of these was an expression inside a `design/*.js`
 * closure until 2026-09-12, which is why JCA corrected seven of them in one afternoon from a
 * rendered sheet. JCA: *"you have all these testable (and frankly, reviewable by me) algorithms
 * that make micro decisions."* A rule you cannot call is a rule you find out about on paper.
 *
 * The rules are `docs/LABSHEET-SPEC.md`; these are the tests that hold the code to them.
 */
import { describe, it, expect } from 'vitest';
import {
  DNA_NAME_MAX, PCR_LABEL_MAX, READ_SUFFIXES, DERIVED_PREFIX,
  fitsOnACap, cloneDesignation, isCloneDesignation, cloneName, readName,
  experimentPrefix, letterAt, derivedLabel, labelLimitFor, referToInput,
} from '../../src/labplanner/planning/naming.js';

describe('what fits where', () => {
  it('keeps a DNA name to a cap', () => {
    // JCA: *"DNA names are special — and they need to fit on a tube cap, so like 6 letters max."*
    expect(DNA_NAME_MAX).toBe(6);
    expect(fitsOnACap('pBET8')).toBe(true);
    expect(fitsOnACap('Pcon-amilGFP-Term')).toBe(false);  // communicative, and not a tube name
    expect(fitsOnACap('')).toBe(false);
  });

  it('keeps a PCR label under four', () => {
    // *"pcr tubes need <4 character labels"* — a 200 µL cap, in gloves, eight times in a setup.
    expect(PCR_LABEL_MAX).toBe(3);
    expect(labelLimitFor('pcr')).toBe(3);
  });

  it('gives a 1.5 mL room for a name plus a clone', () => {
    // The two rules are in tension at the count: *"a 1.5 mL is ~6 char"* and *"construction + '-'
    // + clone identifier"*, and pBET8-A is seven. The six is the DNA name's; the composed label is
    // that plus two. JCA confirmed: *"8 characters would still be writable, that's probably about
    // the limit."*
    // TWELVE, NOT EIGHT. `naming.js` held a second cap table that said 8 and claimed in its own
    // comment to match the model, which says name + hyphen + clone = 12. This assertion is how the
    // wrong number stayed wrong: it was pinned. → `rules/label.rules.js § TUBE`
    expect(labelLimitFor('micro')).toBe(12);
    // And a sequencing tube used to fall through to the 3-character default.
    expect(labelLimitFor('sequencing')).toBe(13);
    expect(cloneName('pBET8', 0).length).toBeLessThanOrEqual(labelLimitFor('micro'));
  });

  it('falls back to the strictest limit rather than the loosest', () => {
    expect(labelLimitFor('nonsense')).toBe(PCR_LABEL_MAX);
  });
});

describe('clones', () => {
  it('designates them the way the lab writes them', () => {
    // *"clone designations are always [A-Z], or [0-9] or for a plate [0-9][A-Z][0-9]"*
    expect([0, 1, 25].map(cloneDesignation)).toEqual(['A', 'B', 'Z']);
    expect(['A', '3', '1A3'].every(isCloneDesignation)).toBe(true);
    expect(['AA', 'a', 'A1'].some(isCloneDesignation)).toBe(false);
  });

  it('refuses to invent a designation outside the grammar', () => {
    // `AA` is not in it. A run that long is a library by any reasonable reading, and a library is
    // addressed by plate, row and column. → `vessels.test.js`
    expect(() => cloneDesignation(26)).toThrow(/is a library/);
  });

  it('names a clone construct-dash-designation', () => {
    expect(cloneName('pBET8', 0)).toBe('pBET8-A');
    expect(cloneName('pBET8', 'C')).toBe('pBET8-C');
  });

  it('will not name a clone of nothing', () => {
    // The base is declared, never derived — there is no rule about DNA naming to derive it from.
    expect(() => cloneName('', 0)).toThrow(/no construct/);
  });
});

describe('sequencing reactions', () => {
  it('takes the clone\'s own name when there is one read', () => {
    // *"Those tubes get sent off, so there is no conflict in having them named the same as the
    // miniprep."*
    expect(readName('pBET8-A', 0, 1)).toBe('pBET8-A');
  });

  it('carries which read it was when there are two', () => {
    // *"maybe 'pBET8-Bf' and 'pBET8-Br' if there are two reads. When sequencing comes back, we
    // need to be able to precisely map it to the data."* Uppercase, as this lab's sheets had it.
    expect(READ_SUFFIXES).toEqual(['F', 'R']);
    expect([0, 1].map((i) => readName('pBET8-A', i, 2))).toEqual(['pBET8-AF', 'pBET8-AR']);
  });

  it('numbers past two rather than guessing a letter', () => {
    expect([0, 1, 2].map((i) => readName('pBET8-A', i, 3)))
      .toEqual(['pBET8-A1', 'pBET8-A2', 'pBET8-A3']);
  });
});

describe('derived labels', () => {
  it('prefixes, as this lab does', () => {
    // *"For a zymo, I typically add a z to whatever the PCR label was. A digest would probably
    // have a d in front."* The 2024 teaching spec suffixes (A1 → A1p); the live convention wins.
    expect(DERIVED_PREFIX).toEqual({ zymo: 'z', digest: 'd' });
    expect(derivedLabel('zymo', 'L3a')).toBe('zL3a');
    expect(derivedLabel('digest', 'L3a')).toBe('dL3a');
  });

  it('refuses for a step that makes something new', () => {
    // An assembly is not its fragments, cleaned up. Giving it a derived label would say it was.
    expect(() => derivedLabel('goldengate', 'L3a')).toThrow(/makes something new/);
  });
});

describe('experiment prefixes', () => {
  it('is the initial and the number', () => {
    expect(experimentPrefix('Lactis3')).toBe('L3');
    expect(experimentPrefix('SLIP4')).toBe('S4');
    expect(experimentPrefix('pBET2')).toBe('P2');
  });

  it('takes two letters when there is no number', () => {
    expect(experimentPrefix('Cheese')).toBe('Ch');
  });

  it('never returns nothing', () => {
    // A packet whose labels are all bare letters is a packet whose labels collide with every
    // other experiment in the freezer.
    expect(experimentPrefix('')).toBe('X');
    expect(experimentPrefix('///')).toBe('X');
  });

  it('runs past z rather than repeating', () => {
    expect([0, 25, 26, 27].map(letterAt)).toEqual(['a', 'z', 'aa', 'ab']);
  });
});

describe('referring to an input', () => {
  it('names the tube this packet made it in', () => {
    // *"At the bench, you primarily want to know the label, not what's in it."*
    expect(referToInput('frag1', (n) => (n === 'frag1' ? 'L3a' : null))).toBe('L3a');
  });

  it('keeps the freezer name for something nobody here made', () => {
    expect(referToInput('pJ01', () => null)).toBe('pJ01');
    expect(referToInput('pJ01', undefined)).toBe('pJ01');
  });
});
