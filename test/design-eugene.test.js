/**
 * The Eugene-derived rule layer: does a rule actually reject, and does a rejection say why.
 *
 * **THESE TESTS EXIST TO BE SEEN FAILING.** A constraint engine whose rules have only ever been
 * watched passing is a claim, not an enforcer — so every operator here is exercised in both
 * directions, and the explain path is asserted on a rule that fails inside an `and`, which is
 * the case where a bare boolean tells the caller nothing.
 */
import { describe, it, expect } from 'vitest';
import { RULES, checkDesign, enumerateDesigns } from '../src/design/eugene.js';

const P = (id, type) => ({ id, type });
const device = (...parts) => ({ name: 'd', parts });

const LIB = [
  P('J23100', 'Promoter'), P('J23116', 'Promoter'),
  P('B0034', 'RBS'),
  P('gfp', 'ORF'), P('rfp', 'ORF'),
  P('B0015', 'Terminator'),
];

describe('rule operators hold and fail', () => {
  const d = device(P('J23100', 'Promoter'), P('B0034', 'RBS'), P('gfp', 'ORF'));

  it('contains / notContains', () => {
    expect(RULES.contains('gfp').test(d)).toBe(true);
    expect(RULES.contains('rfp').test(d)).toBe(false);
    expect(RULES.notContains('rfp').test(d)).toBe(true);
    expect(RULES.notContains('gfp').test(d)).toBe(false);
  });

  it('with is a pairing and is vacuously true when the antecedent is absent', () => {
    expect(RULES.with('gfp', 'B0034').test(d)).toBe(true);
    expect(RULES.with('gfp', 'B0015').test(d)).toBe(false);
    expect(RULES.with('rfp', 'B0015').test(d)).toBe(true); // rfp absent, so nothing is required
  });

  it('notWith', () => {
    expect(RULES.notWith('gfp', 'rfp').test(d)).toBe(true);
    expect(RULES.notWith('gfp', 'B0034').test(d)).toBe(false);
  });

  it('before orders, and is vacuous when either side is missing', () => {
    expect(RULES.before('J23100', 'gfp').test(d)).toBe(true);
    expect(RULES.before('gfp', 'J23100').test(d)).toBe(false);
    expect(RULES.before('rfp', 'gfp').test(d)).toBe(true);
  });

  it('counts', () => {
    const two = device(P('gfp', 'ORF'), P('gfp', 'ORF'));
    expect(RULES.notMoreThan('gfp', 1).test(two)).toBe(false);
    expect(RULES.notMoreThan('gfp', 2).test(two)).toBe(true);
    expect(RULES.exactly('gfp', 2).test(two)).toBe(true);
    expect(RULES.moreThan('gfp', 1).test(two)).toBe(true);
  });

  it('and / or / not', () => {
    expect(RULES.and(RULES.contains('gfp'), RULES.contains('B0034')).test(d)).toBe(true);
    expect(RULES.and(RULES.contains('gfp'), RULES.contains('rfp')).test(d)).toBe(false);
    expect(RULES.or(RULES.contains('rfp'), RULES.contains('gfp')).test(d)).toBe(true);
    expect(RULES.not(RULES.contains('rfp')).test(d)).toBe(true);
  });
});

describe('a rejection names the clause that failed', () => {
  const d = device(P('J23100', 'Promoter'), P('gfp', 'ORF'));

  it('reports only the failing clause of an and', () => {
    const r = RULES.and(RULES.contains('gfp'), RULES.contains('B0034'), RULES.before('J23100', 'gfp'));
    const { pass, failures } = checkDesign(d, r);
    expect(pass).toBe(false);
    expect(failures).toEqual(['contains B0034']);
  });

  it('a passing rule reports no failures', () => {
    expect(checkDesign(d, RULES.contains('gfp'))).toEqual({ pass: true, failures: [] });
  });
});

describe('enumeration', () => {
  const spec = {
    name: 'expression cassette',
    slots: [{ type: 'Promoter' }, { type: 'RBS' }, { type: 'ORF' }, { type: 'Terminator' }],
    rules: RULES.notContains('rfp'),
  };

  it('permutes open slots and prunes by rule, keeping the rejects', () => {
    const out = enumerateDesigns(spec, LIB);
    // 2 promoters × 1 RBS × 2 ORFs × 1 terminator = 4 candidates; rfp kills half.
    expect(out.considered).toBe(4);
    expect(out.designs).toHaveLength(2);
    expect(out.rejected).toHaveLength(2);
    expect(out.rejected[0].failures).toEqual(['does not contain rfp']);
  });

  it('a pinned slot is not permuted', () => {
    const pinned = { ...spec, slots: [{ type: 'Promoter', id: 'J23116' }, { type: 'ORF' }] };
    const out = enumerateDesigns(pinned, LIB);
    expect(out.considered).toBe(2);
    expect(out.designs.every((d) => d.parts[0].id === 'J23116')).toBe(true);
  });

  it('a type nothing in the library can fill is NAMED, not silently dropped', () => {
    const out = enumerateDesigns({ name: 'x', slots: [{ type: 'Origin' }] }, LIB);
    expect(out.unfilled).toEqual(['Origin']);
    expect(out.designs).toEqual([]);
    expect(out.considered).toBe(0);
  });

  it('a capped enumeration says it was capped', () => {
    const out = enumerateDesigns({ ...spec, rules: undefined }, LIB, { limit: 2 });
    expect(out.truncated).toBe(true);
    expect(out.considered).toBe(2);
  });

  it('no rules means everything passes', () => {
    const out = enumerateDesigns({ ...spec, rules: undefined }, LIB);
    expect(out.designs).toHaveLength(4);
    expect(out.rejected).toEqual([]);
  });
});

import { definePartType, makePart, flattenDevice, deviceSequence, describeDevice } from '../src/design/eugene.js';

describe('part types catch the mistakes that make rules vacuous', () => {
  const Promoter = definePartType('Promoter', { Sequence: 'txt', Orientation: 'txt', Strength: 'num' });

  it('an unknown property TYPE is refused at declaration', () => {
    expect(() => definePartType('X', { Sequence: 'string' })).toThrow(/unknown property type/);
  });

  it('a typo is an error, not a silently absent property', () => {
    expect(() => makePart(Promoter, 'J23100', { Strenght: 0.7 })).toThrow(/not a property of Promoter/);
  });

  it('a value of the wrong type is refused', () => {
    expect(() => makePart(Promoter, 'J23100', { Strength: 'high' })).toThrow(/must be num/);
  });

  it('a declared property may be left unset', () => {
    expect(makePart(Promoter, 'J23100', { Sequence: 'TTGACA' }).props.Strength).toBeUndefined();
  });
});

describe('nested devices', () => {
  const cassette = { name: 'cassette', parts: [P('B0034', 'RBS'), P('gfp', 'ORF')] };
  const outer = { name: 'outer', parts: [P('J23100', 'Promoter'), cassette, P('B0015', 'Terminator')] };

  it('flattens depth first, in order', () => {
    expect(flattenDevice(outer).map((p) => p.id)).toEqual(['J23100', 'B0034', 'gfp', 'B0015']);
  });

  it('a flat device flattens to itself', () => {
    expect(flattenDevice(device(P('gfp', 'ORF')))).toEqual([P('gfp', 'ORF')]);
  });

  it('rules see through nesting', () => {
    expect(RULES.contains('gfp').test(outer)).toBe(true);
    expect(RULES.before('J23100', 'gfp').test(outer)).toBe(true);
    expect(RULES.before('gfp', 'B0015').test(outer)).toBe(true);
  });
});

describe('property rules', () => {
  const strong = { id: 'J23100', type: 'Promoter', props: { Strength: 0.9 } };
  const weak = { id: 'J23116', type: 'Promoter', props: { Strength: 0.2 } };
  const gt = (n) => (v) => v > n;

  it('every / some', () => {
    const d = device(strong, weak);
    expect(RULES.prop('Promoter', 'Strength', gt(0.5), 'is strong').test(d)).toBe(false);
    expect(RULES.someProp('Promoter', 'Strength', gt(0.5), 'is strong').test(d)).toBe(true);
    expect(RULES.prop('Promoter', 'Strength', gt(0.1), 'is above 0.1').test(d)).toBe(true);
  });

  it('is vacuously true when no part of that type is present', () => {
    expect(RULES.prop('Promoter', 'Strength', gt(0.5), 'is strong').test(device(P('gfp', 'ORF')))).toBe(true);
  });

  it('a rejection reads as words, not as a predicate', () => {
    const { failures } = checkDesign(device(weak), RULES.prop('Promoter', 'Strength', gt(0.5), 'is stronger than 0.5'));
    expect(failures).toEqual(['every Promoter is stronger than 0.5']);
  });
});

describe('the bridge back into C6', () => {
  const S = (id, type, Sequence, Orientation) => ({ id, type, props: { Sequence, Orientation } });

  it('concatenates, reverse complementing a Reverse part', () => {
    const d = device(S('p', 'Promoter', 'AAAA', 'Forward'), S('o', 'ORF', 'GGGG', 'Reverse'));
    expect(deviceSequence(d)).toEqual({ sequence: 'AAAACCCC', missing: [] });
  });

  it('a part with no sequence is NAMED, and the rest still builds', () => {
    const d = device(S('p', 'Promoter', 'AAAA', 'Forward'), P('unbuilt', 'ORF'));
    expect(deviceSequence(d)).toEqual({ sequence: 'AAAA', missing: ['unbuilt'] });
  });

  it('describes a device as one readable line', () => {
    expect(describeDevice(device(P('J23100', 'Promoter'), P('gfp', 'ORF'))))
      .toBe('d: Promoter:J23100 → ORF:gfp');
  });
});
