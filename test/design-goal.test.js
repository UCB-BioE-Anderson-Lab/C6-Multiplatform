/**
 * The goal document: does a rule written as data behave as the rule it names, and does a goal
 * that is wrong say everything that is wrong with it.
 *
 * **THE CASE THAT MATTERS IS THE UNKNOWN OPERATOR.** A compiler that skipped one would turn a
 * constraint into a rule that cannot fail, and the design would then pass a check nobody applied
 * — the same defect, one layer up, as a property name with a typo in it.
 */
import { describe, it, expect } from 'vitest';
import { compileRule, validateGoal, goalToSpec } from '../src/design/goal.js';
import { checkDesign, enumerateDesigns } from '../src/design/eugene.js';

const P = (id, type, props) => ({ id, type, props });
const device = (...parts) => ({ name: 'd', parts });

describe('rules written as data', () => {
  const d = device(P('Ptet', 'Promoter', { Strength: 0.8 }), P('gfp', 'ORF'));

  it('compiles each operator to the rule it names', () => {
    expect(compileRule({ op: 'CONTAINS', id: 'gfp' }).test(d)).toBe(true);
    expect(compileRule({ op: 'NOTCONTAINS', id: 'gfp' }).test(d)).toBe(false);
    expect(compileRule({ op: 'BEFORE', a: 'Ptet', b: 'gfp' }).test(d)).toBe(true);
    expect(compileRule({ op: 'WITH', a: 'gfp', b: 'Ptet' }).test(d)).toBe(true);
    expect(compileRule({ op: 'NOTWITH', a: 'gfp', b: 'Ptet' }).test(d)).toBe(false);
    expect(compileRule({ op: 'NOTMORETHAN', id: 'gfp', n: 1 }).test(d)).toBe(true);
    expect(compileRule({ op: 'EXACTLY', id: 'gfp', n: 1 }).test(d)).toBe(true);
    expect(compileRule({ op: 'MORETHAN', id: 'gfp', n: 1 }).test(d)).toBe(false);
  });

  it('is case insensitive on the operator but not inventive about it', () => {
    expect(compileRule({ op: 'contains', id: 'gfp' }).test(d)).toBe(true);
  });

  it('nests and / or / not', () => {
    const r = { op: 'AND', rules: [{ op: 'CONTAINS', id: 'gfp' }, { op: 'NOT', rule: { op: 'CONTAINS', id: 'rfp' } }] };
    expect(compileRule(r).test(d)).toBe(true);
    const or = { op: 'OR', rules: [{ op: 'CONTAINS', id: 'rfp' }, { op: 'CONTAINS', id: 'gfp' }] };
    expect(compileRule(or).test(d)).toBe(true);
  });

  it('compares properties, and the rejection reads as words', () => {
    const strong = compileRule({ op: 'PROPERTY', type: 'Promoter', prop: 'Strength', cmp: '>', value: 0.5 });
    expect(strong.test(d)).toBe(true);
    const weak = compileRule({ op: 'PROPERTY', type: 'Promoter', prop: 'Strength', cmp: '<', value: 0.5 });
    expect(checkDesign(d, weak).failures).toEqual(['every Promoter Strength < 0.5']);
  });

  it('supports in and matches', () => {
    expect(compileRule({ op: 'PROPERTY', type: 'ORF', prop: 'Origin', cmp: 'in', value: ['E. coli'] })
      .test(device(P('gfp', 'ORF', { Origin: 'E. coli' })))).toBe(true);
    expect(compileRule({ op: 'PROPERTY', type: 'ORF', prop: 'ID', cmp: 'matches', value: '^BBa_' })
      .test(device(P('x', 'ORF', { ID: 'BBa_K1' })))).toBe(true);
  });

  it('AN UNKNOWN OPERATOR THROWS rather than being skipped', () => {
    expect(() => compileRule({ op: 'PRECEEDS', a: 'x', b: 'y' })).toThrow(/unknown rule operator/);
  });

  it('an unknown comparator throws', () => {
    expect(() => compileRule({ op: 'PROPERTY', type: 'P', prop: 'S', cmp: '=>', value: 1 })).toThrow(/unknown comparator/);
  });

  it('a rule with no op throws', () => {
    expect(() => compileRule({ id: 'gfp' })).toThrow(/needs an 'op'/);
  });
});

describe('validating a goal', () => {
  const good = {
    id: 'pBET11', title: 'mScarlet into JTK165-AB', intent: 'a red reporter under the native promoter',
    host: { organism: 'E. coli' },
    devices: [{ name: 'cassette', slots: [{ type: 'Promoter' }, { type: 'ORF', id: 'mScarlet' }], rules: [{ op: 'BEFORE', a: 'P', b: 'mScarlet' }] }],
  };

  it('passes a well formed goal', () => {
    expect(validateGoal(good)).toEqual({ ok: true, problems: [] });
  });

  it('reports EVERY problem, not the first', () => {
    const { ok, problems } = validateGoal({ devices: [{ slots: [] }] });
    expect(ok).toBe(false);
    expect(problems.length).toBeGreaterThan(4);
    expect(problems.join('|')).toMatch(/no id/);
    expect(problems.join('|')).toMatch(/no intent/);
    expect(problems.join('|')).toMatch(/no host organism/);
  });

  it('a rule that will not compile is a problem, named with its device', () => {
    const bad = { ...good, devices: [{ name: 'x', slots: [{ type: 'ORF' }], rules: [{ op: 'NOPE' }] }] };
    expect(validateGoal(bad).problems.join('|')).toMatch(/device x: unknown rule operator/);
  });

  it('a goal with no devices is not a goal', () => {
    expect(validateGoal({ ...good, devices: [] }).problems.join('|')).toMatch(/no devices/);
  });
});

describe('a goal feeds the enumeration', () => {
  const goal = {
    id: 'g', title: 't', intent: 'i', host: { organism: 'E. coli' },
    rules: [{ op: 'NOTCONTAINS', id: 'rfp' }],
    devices: [{ name: 'cassette', slots: [{ type: 'Promoter' }, { type: 'ORF' }] }],
  };
  const LIB = [P('J23100', 'Promoter'), P('gfp', 'ORF'), P('rfp', 'ORF')];

  it('combines the goal-wide rules with the device rules', () => {
    const spec = goalToSpec(goal, 'cassette');
    const out = enumerateDesigns(spec, LIB);
    expect(out.considered).toBe(2);
    expect(out.designs).toHaveLength(1);
    expect(out.designs[0].parts[1].id).toBe('gfp');
  });

  it('a pinned slot survives the translation', () => {
    const pinned = { ...goal, devices: [{ name: 'c', slots: [{ type: 'ORF', id: 'gfp' }] }] };
    expect(goalToSpec(pinned, 'c').slots).toEqual([{ type: 'ORF', id: 'gfp' }]);
  });

  it('asking for a device the goal does not have names the ones it has', () => {
    expect(() => goalToSpec(goal, 'nope')).toThrow(/it has cassette/);
  });
});
