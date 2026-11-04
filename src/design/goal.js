// src/design/goal.js
//
// THE GOAL IS A DOCUMENT, NOT A SCRIPT. What a construct must be — its devices, the order of
// their parts, and the constraints that hold across them — is written as JSON, committed, and
// argued with. The design that satisfies it is a JS script (`src/design/eugene.js` is what that
// script calls); the statement of what it is trying to satisfy is not code, because a goal
// expressed as code can only be reviewed by running it.
//
// So the rules in a goal file are DATA — `{"op": "BEFORE", "a": "P", "b": "orf"}` — and this
// module compiles them into the predicates `RULES` builds. That split is the point: the file
// stays readable and diffable, and the thing that evaluates it is tested code nobody retypes.
//
// This sits one stage above a construction file. A goal says *what must be true of the
// construct*; a construction file says *how it gets built*. Keeping them apart is what lets a
// goal be written before anybody knows which plasmids exist to build it from — which is the
// whole of phase one.

import { RULES } from './eugene.js';

/** How a property comparison in a goal file is read, and how it renders in a rejection. */
const COMPARATORS = {
  '>': (v, x) => v > x,
  '>=': (v, x) => v >= x,
  '<': (v, x) => v < x,
  '<=': (v, x) => v <= x,
  '==': (v, x) => v === x,
  '!=': (v, x) => v !== x,
  in: (v, x) => Array.isArray(x) && x.includes(v),
  matches: (v, x) => typeof v === 'string' && new RegExp(x).test(v),
};

/**
 * Compile a rule written as data into a rule that can be tested.
 *
 * The operators are the ones `RULES` provides, spelled in upper case as Eugene spells them:
 * `CONTAINS`, `NOTCONTAINS`, `WITH`, `NOTWITH`, `BEFORE`, `NOTMORETHAN`, `EXACTLY`, `MORETHAN`,
 * `AND`, `OR`, `NOT`, and `PROPERTY` for a comparison against a part property.
 *
 * **AN UNKNOWN OPERATOR THROWS.** It would be easy to skip one and carry on, and that is the
 * worst available behaviour: a constraint nobody noticed was dropped becomes a rule that cannot
 * fail, and the design then passes a check that was never applied. A goal file with a typo in an
 * operator is a goal file that does not load.
 *
 * @param {Object} spec - the rule as data, e.g. `{op: 'BEFORE', a: 'Ptet', b: 'gfp'}`
 * @return {{op: string, describe: function, test: function}} a rule for `checkDesign`
 */
export function compileRule(spec) {
  if (!spec || typeof spec.op !== 'string') {
    throw new Error(`a rule needs an 'op': got ${JSON.stringify(spec)}`);
  }
  switch (spec.op.toUpperCase()) {
    case 'CONTAINS': return RULES.contains(spec.id);
    case 'NOTCONTAINS': return RULES.notContains(spec.id);
    case 'WITH': return RULES.with(spec.a, spec.b);
    case 'NOTWITH': return RULES.notWith(spec.a, spec.b);
    case 'BEFORE': return RULES.before(spec.a, spec.b);
    case 'NOTMORETHAN': return RULES.notMoreThan(spec.id, spec.n);
    case 'EXACTLY': return RULES.exactly(spec.id, spec.n);
    case 'MORETHAN': return RULES.moreThan(spec.id, spec.n);
    case 'AND': return RULES.and(...(spec.rules || []).map(compileRule));
    case 'OR': return RULES.or(...(spec.rules || []).map(compileRule));
    case 'NOT': return RULES.not(compileRule(spec.rule));
    case 'PROPERTY': {
      const cmp = COMPARATORS[spec.cmp];
      if (!cmp) {
        throw new Error(`unknown comparator '${spec.cmp}' — one of ${Object.keys(COMPARATORS).join(', ')}`);
      }
      const label = `${spec.prop} ${spec.cmp} ${JSON.stringify(spec.value)}`;
      const test = (v) => cmp(v, spec.value);
      return spec.some
        ? RULES.someProp(spec.type, spec.prop, test, label)
        : RULES.prop(spec.type, spec.prop, test, label);
    }
    default:
      throw new Error(`unknown rule operator '${spec.op}' — a rule that cannot be compiled is not a rule that is skipped`);
  }
}

/**
 * Check a goal file's structure, and report everything wrong with it at once.
 *
 * This is structural only: it cannot say whether a goal is a good idea, and it cannot say
 * whether the parts it asks for exist — that is the material search, and it is deliberately a
 * separate question, because a goal is written before anybody knows what is in the freezer.
 *
 * **IT REPORTS RATHER THAN THROWS**, and returns every problem rather than the first. A goal
 * being written is normally incomplete, and a validator that stops at the first gap makes the
 * writer fix it one line per run.
 *
 * @param {Object} goal - the goal document
 * @return {{ok: boolean, problems: string[]}} whether it is well formed, and what is wrong
 */
export function validateGoal(goal) {
  const problems = [];
  const need = (cond, msg) => { if (!cond) problems.push(msg); };

  need(goal && typeof goal === 'object', 'the goal is not an object');
  if (!goal || typeof goal !== 'object') return { ok: false, problems };

  need(goal.id, 'no id — a goal is referred to by id from the designs that satisfy it');
  need(goal.title, 'no title');
  need(goal.intent, 'no intent — what the construct is FOR is the one thing nobody else can supply');
  need(goal.host && goal.host.organism, 'no host organism — promoters, origins and markers all depend on it');
  need(Array.isArray(goal.devices) && goal.devices.length, 'no devices — a goal with nothing to build is not a goal');

  for (const [i, d] of (goal.devices || []).entries()) {
    const where = `device ${d?.name || i}`;
    need(d && d.name, `${where}: no name`);
    need(Array.isArray(d?.slots) && d.slots.length, `${where}: no slots`);
    for (const [j, s] of (d?.slots || []).entries()) {
      need(s && s.type, `${where}, slot ${j}: no part type`);
    }
    for (const r of d?.rules || []) {
      try { compileRule(r); } catch (e) { problems.push(`${where}: ${e.message}`); }
    }
  }
  for (const r of goal.rules || []) {
    try { compileRule(r); } catch (e) { problems.push(`goal rules: ${e.message}`); }
  }

  return { ok: problems.length === 0, problems };
}

/**
 * Turn one device of a goal into the specification `enumerateDesigns` takes.
 *
 * The goal's own rules apply to every device in it, so they are combined with the device's own
 * here rather than being left for the caller to remember — a cross-cutting constraint that has
 * to be re-applied by hand at each call site is one that will be missing from one of them.
 *
 * @param {Object} goal - the goal document
 * @param {string} deviceName - which of its devices to enumerate
 * @return {{name: string, slots: Array, rules: Object|undefined}} the spec for `enumerateDesigns`
 */
export function goalToSpec(goal, deviceName) {
  const device = (goal.devices || []).find((d) => d.name === deviceName);
  if (!device) {
    throw new Error(`no device '${deviceName}' in goal ${goal.id} — it has ${(goal.devices || []).map((d) => d.name).join(', ') || 'none'}`);
  }
  const all = [...(goal.rules || []), ...(device.rules || [])].map(compileRule);
  return {
    name: device.name,
    slots: device.slots.map((s) => (s.id ? { type: s.type, id: s.id } : { type: s.type })),
    rules: all.length ? RULES.and(...all) : undefined,
  };
}
