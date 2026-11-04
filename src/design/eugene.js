// src/design/eugene.js
//
// DERIVED FROM EUGENE. The vocabulary here — Part, Property, Device, Rule, and the enumerate-
// then-prune model where `permute` generates a design space and `Assert` filters it — is taken
// from Eugene, a domain-specific language for specifying and constraining synthetic biological
// parts, devices and systems:
//
//   Bilitchenko L, Liu A, Cheung S, Weeding E, Xia B, Leguia M, Anderson JC, Densmore D.
//   "Eugene – A Domain Specific Language for Specifying and Constraining Synthetic Biological
//   Parts, Devices, and Systems." PLoS ONE 6(4): e18882, 2011.
//
// This is a reimplementation of those ideas in JavaScript for C6, not a port: Eugene is a Java
// language with its own parser, and nothing here reads Eugene source. A design is a plain object
// and a rule is a predicate, because the caller is a JS design script and the thing it has to
// survive is `JSON.stringify`, not a grammar. J. Christopher Anderson, an author of the paper
// above, directed this derivation on 2026-11-04.
//
// WHAT IS FAITHFUL AND WHAT IS NOT. The rule operators the paper demonstrates are NOTCONTAINS,
// WITH, NOTWITH, NOTMORETHAN, BEFORE, AND and OR, asserted over devices built by `permute`.
// Those are implemented under the same names. `contains`, `not`, `exactly` and `moreThan` are
// duals and counts the paper does not show; they are marked EXTENSION in RULES so that nobody
// later cites this file as evidence that Eugene had them.

import { revcomp } from '../C6-Seq.js';

/** The property types a part type may declare, from Eugene: text, number, boolean, and arrays. */
const PROPERTY_TYPES = {
  txt: (v) => typeof v === 'string',
  num: (v) => typeof v === 'number' && Number.isFinite(v),
  bool: (v) => typeof v === 'boolean',
  'txt[]': (v) => Array.isArray(v) && v.every((x) => typeof x === 'string'),
  'num[]': (v) => Array.isArray(v) && v.every((x) => typeof x === 'number'),
};

/**
 * The rule operators. Each returns a rule: `{ op, describe(), test(device) }`.
 *
 * A rule is a predicate over a device — an ordered list of parts — and nothing else. It cannot
 * reach the inventory, the freezer or a sequence, because a constraint that silently depends on
 * what is in stock stops being a statement about the design and becomes a statement about today.
 *
 * Faithful to the paper: `notContains`, `with`, `notWith`, `notMoreThan`, `before`, `and`, `or`.
 * EXTENSION (not in the paper): `contains`, `not`, `exactly`, `moreThan`.
 */
export const RULES = {
  /** EXTENSION. The device holds at least one part with this id. */
  contains: (id) => rule('CONTAINS', `contains ${id}`, (d) => count(d, id) > 0),

  /** The device holds no part with this id. */
  notContains: (id) => rule('NOTCONTAINS', `does not contain ${id}`, (d) => count(d, id) === 0),

  /** If `a` is present then `b` must be too. A pairing, not an ordering. */
  with: (a, b) =>
    rule('WITH', `${a} appears with ${b}`, (d) => (count(d, a) === 0 ? true : count(d, b) > 0)),

  /** If `a` is present then `b` must not be. */
  notWith: (a, b) =>
    rule('NOTWITH', `${a} does not appear with ${b}`, (d) => (count(d, a) === 0 ? true : count(d, b) === 0)),

  /** Every occurrence of `a` lies before every occurrence of `b`. */
  before: (a, b) =>
    rule('BEFORE', `${a} comes before ${b}`, (d) => {
      const as = positions(d, a), bs = positions(d, b);
      if (!as.length || !bs.length) return true;
      return Math.max(...as) < Math.min(...bs);
    }),

  /** At most `n` occurrences of `id`. `RULES.notMoreThan(x, 1)` is Eugene's `NOTMORETHAN once`. */
  notMoreThan: (id, n) => rule('NOTMORETHAN', `holds at most ${n} × ${id}`, (d) => count(d, id) <= n),

  /** EXTENSION. Exactly `n` occurrences of `id`. */
  exactly: (id, n) => rule('EXACTLY', `holds exactly ${n} × ${id}`, (d) => count(d, id) === n),

  /** EXTENSION. More than `n` occurrences of `id`. */
  moreThan: (id, n) => rule('MORETHAN', `holds more than ${n} × ${id}`, (d) => count(d, id) > n),

  /** Every one of `rules` holds. */
  and: (...rules) =>
    rule('AND', rules.map((r) => r.describe()).join(' and '), (d) => rules.every((r) => r.test(d))),

  /** At least one of `rules` holds. */
  or: (...rules) =>
    rule('OR', rules.map((r) => r.describe()).join(' or '), (d) => rules.some((r) => r.test(d))),

  /** EXTENSION. The negation of a rule. */
  not: (r) => rule('NOT', `not (${r.describe()})`, (d) => !r.test(d)),

  /**
   * EXTENSION. Every part of `type` in the device has a `prop` satisfying `test`.
   *
   * Eugene declares Properties so that designs can be constrained on them, but the paper's
   * examples are all by part id, so there is no syntax of its to be faithful to. A predicate
   * cannot describe itself, which is why `label` is required rather than optional: a constraint
   * that renders as "satisfies a test" is unreviewable, and a rejection naming it tells nobody
   * what to change.
   *
   * Vacuously true when the device holds no part of that type — the absence of a promoter is a
   * job for `contains`, not for a statement about promoters.
   */
  prop: (type, propName, test, label) =>
    rule('PROPERTY', `every ${type} ${label}`, (d) =>
      flattenDevice(d).filter((p) => p.type === type)
        .every((p) => test(p.props?.[propName]))),

  /** EXTENSION. At least one part of `type` has a `prop` satisfying `test`. */
  someProp: (type, propName, test, label) =>
    rule('PROPERTY', `some ${type} ${label}`, (d) =>
      flattenDevice(d).filter((p) => p.type === type)
        .some((p) => test(p.props?.[propName]))),
};

function rule(op, text, test) {
  return { op, describe: () => text, test };
}

const ids = (device) => flattenDevice(device).map((p) => p.id);
const count = (device, id) => ids(device).filter((x) => x === id).length;
const positions = (device, id) => ids(device).reduce((acc, x, i) => (x === id ? [...acc, i] : acc), []);

/**
 * Check one device against one rule, and say which clause failed.
 *
 * A bare true/false is not enough to act on. When an `and` fails, the caller needs the clause
 * that killed it — otherwise the only way to find out why a design was rejected is to take the
 * rule apart by hand, which is how a constraint ends up being quietly deleted instead of argued
 * with. `and` and `or` are therefore descended into; every other operator reports itself.
 *
 * @param {{parts: Array<{id: string, type: string}>}} device - the device, parts in order
 * @param {{op: string, describe: function, test: function}} rule - a rule from RULES
 * @return {{pass: boolean, failures: string[]}} whether it holds, and each failing clause in words
 */
export function checkDesign(device, rule) {
  if (rule.test(device)) return { pass: true, failures: [] };
  return { pass: false, failures: explain(device, rule) };
}

function explain(device, r) {
  if (r.op === 'AND' || r.op === 'OR') {
    // The sub-rules are closed over, so recover them by re-running the children we were given.
    // AND reports only the clauses that actually failed; OR failed as a whole, so it reports
    // itself — no single clause of an OR is the culprit.
    if (r.op === 'OR') return [r.describe()];
    return (r.children || []).flatMap((c) => (c.test(device) ? [] : explain(device, c)));
  }
  return [r.describe()];
}

// `and` and `or` need their children for explain(); attach them without changing the shape above.
const _and = RULES.and, _or = RULES.or;
RULES.and = (...rules) => Object.assign(_and(...rules), { children: rules });
RULES.or = (...rules) => Object.assign(_or(...rules), { children: rules });

/**
 * Enumerate every design a specification allows, and keep the ones it does not.
 *
 * This is Eugene's `permute` followed by `Assert`, in one call: each open slot is filled with
 * every part in the library whose type matches, the cartesian product is taken, and the rules
 * decide which survive. A slot that already names an `id` is fixed and is not permuted.
 *
 * **REJECTED DESIGNS COME BACK, WITH THE REASON.** A planner that returns only what passed cannot
 * tell "nothing satisfies these rules" from "nothing of that type is in the library", and those
 * need different actions from a person — loosen a constraint, or go and find a part. The caller
 * gets both lists and decides.
 *
 * **A TRUNCATED ENUMERATION SAYS SO.** The product of a few open slots over a real parts library
 * is large, so `limit` caps the designs considered. When the cap bites, `truncated` is true and
 * `considered` is what was actually examined: a capped search that reported itself as complete
 * would be a wrong answer wearing a right one's clothes.
 *
 * @param {{name: string, slots: Array<{type: string, id?: string}>, rules?: object}} spec - the
 *   device: its slots in order, each a part type, optionally pinned to one part id
 * @param {Array<{id: string, type: string}>} library - the parts available to fill open slots
 * @param {{limit?: number}} [options] - `limit` caps how many candidate designs are built
 * @return {{designs: Array, rejected: Array, considered: number, truncated: boolean, unfilled: string[]}}
 *   passing designs, rejected ones each with `failures`, how many were built, whether the cap
 *   bit, and the types no library part could fill
 */
export function enumerateDesigns(spec, library, options = {}) {
  const limit = options.limit ?? 10000;
  const unfilled = [];

  const choices = spec.slots.map((slot) => {
    if (slot.id) {
      const fixed = library.find((p) => p.id === slot.id);
      return [fixed || { id: slot.id, type: slot.type, absent: true }];
    }
    const matches = library.filter((p) => p.type === slot.type);
    if (!matches.length) unfilled.push(slot.type);
    return matches;
  });

  if (choices.some((c) => !c.length)) {
    return { designs: [], rejected: [], considered: 0, truncated: false, unfilled };
  }

  const designs = [], rejected = [];
  let considered = 0, truncated = false;

  const build = (i, parts) => {
    if (truncated) return;
    if (i === choices.length) {
      if (considered >= limit) { truncated = true; return; }
      considered++;
      const device = { name: spec.name, parts };
      if (!spec.rules) { designs.push(device); return; }
      const { pass, failures } = checkDesign(device, spec.rules);
      if (pass) designs.push(device); else rejected.push({ ...device, failures });
      return;
    }
    for (const part of choices[i]) build(i + 1, [...parts, part]);
  };
  build(0, []);

  return { designs, rejected, considered, truncated, unfilled };
}

/**
 * Declare a part type: a name and the properties its parts carry.
 *
 * This is Eugene's `Part Promoter(ID, Sequence, Orientation, Inducible);` with the property
 * types named, so that `makePart` can reject a value of the wrong kind instead of carrying it
 * to wherever it first fails to be a number.
 *
 * **THE TYPE OBJECT IS RETURNED, NOT REGISTERED.** A module-level registry would make the result
 * of `makePart` depend on what some other file declared earlier, and a design script's output
 * would then change according to its imports. The caller holds its own types.
 *
 * @param {string} name - the type's name, e.g. `Promoter`
 * @param {Object<string,string>} properties - property name to type: `txt`, `num`, `bool`,
 *   `txt[]` or `num[]`
 * @return {{name: string, properties: Object<string,string>}} the part type
 */
export function definePartType(name, properties) {
  for (const [prop, type] of Object.entries(properties)) {
    if (!PROPERTY_TYPES[type]) {
      throw new Error(`${name}.${prop}: unknown property type '${type}' — one of ${Object.keys(PROPERTY_TYPES).join(', ')}`);
    }
  }
  return { name, properties };
}

/**
 * Instantiate a part of a declared type, checking its property values.
 *
 * **AN UNDECLARED PROPERTY IS AN ERROR, NOT AN EXTRA FIELD.** `.Strenght(0.7)` is the mistake
 * this catches, and it is the one worth catching: a typo'd property is silently absent, every
 * rule written against it is then vacuously true, and the design passes constraints nobody
 * actually applied. A rule that cannot fail is the failure this whole file exists to prevent.
 *
 * A declared property may be left unset — Eugene parts assign values to some properties and not
 * others — but a value that is present must be of the declared type.
 *
 * @param {{name: string, properties: Object}} type - from `definePartType`
 * @param {string} id - the part's id, e.g. `BBa_J23116`
 * @param {Object} [props] - property values
 * @return {{id: string, type: string, props: Object}} the part
 */
export function makePart(type, id, props = {}) {
  for (const [prop, value] of Object.entries(props)) {
    const declared = type.properties[prop];
    if (!declared) {
      throw new Error(`${type.name} ${id}: '${prop}' is not a property of ${type.name} — declared: ${Object.keys(type.properties).join(', ') || 'none'}`);
    }
    if (value !== undefined && value !== null && !PROPERTY_TYPES[declared](value)) {
      throw new Error(`${type.name} ${id}: '${prop}' must be ${declared}, got ${JSON.stringify(value)}`);
    }
  }
  return { id, type: type.name, props };
}

/**
 * The parts of a device in order, with any nested devices opened out.
 *
 * Eugene devices hold Parts or other Devices, so a rule written about a promoter must see the
 * promoter inside a cassette the design composed in. Every rule here evaluates over this, which
 * is why `before` means "before in the finished construct" rather than "before at this level".
 *
 * A device with no nesting flattens to its own parts, so a caller never has to know which it has.
 *
 * @param {{parts: Array}} device - a device, whose `parts` may hold parts or devices
 * @return {Array<{id: string, type: string}>} the parts, depth first, in order
 */
export function flattenDevice(device) {
  const out = [];
  const walk = (node) => {
    for (const item of node.parts || []) {
      if (item && Array.isArray(item.parts)) walk(item); else out.push(item);
    }
  };
  walk(device);
  return out;
}

/**
 * The DNA a device specifies, as one sequence.
 *
 * Each part contributes its `Sequence` property, reverse complemented where its `Orientation`
 * is `Reverse`. This is the bridge out of the specification and into the rest of C6: what comes
 * back is an ordinary sequence, so it simulates, anneals and gets designed against like any
 * other.
 *
 * **A PART WITH NO SEQUENCE IS NAMED, NOT SKIPPED.** A specification is routinely written before
 * every part has one — that is what phase one is for — and a concatenation that quietly omitted
 * them would return a shorter construct that looks complete. The caller gets the sequence it
 * could build and the list of what was missing, and decides whether that is an answer.
 *
 * @param {{parts: Array}} device - the device
 * @return {{sequence: string, missing: string[]}} the concatenated DNA, and the ids that had none
 */
export function deviceSequence(device) {
  const missing = [];
  let sequence = '';
  for (const part of flattenDevice(device)) {
    const seq = part.props?.Sequence;
    if (!seq) { missing.push(part.id); continue; }
    sequence += part.props?.Orientation === 'Reverse' ? revcomp(seq) : seq;
  }
  return { sequence, missing };
}

/**
 * One device as a line a person can read: its parts in order, by type and id.
 *
 * The output of an enumeration is a list of objects, and a list of objects is not something an
 * experimentalist chooses from. This renders `Promoter:J23100 → RBS:B0034 → ORF:gfp`, which is
 * what a shortlist of candidate designs has to look like before anybody can pick one.
 *
 * @param {{name?: string, parts: Array}} device - the device
 * @return {string} the device as one line
 */
export function describeDevice(device) {
  const body = flattenDevice(device).map((p) => `${p.type}:${p.id}`).join(' → ');
  return device.name ? `${device.name}: ${body}` : body;
}
