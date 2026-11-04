/**
 * Every schema says how its instances are found, and says it about fields it actually has.
 *
 * **THE DECLARATION IS THIS WORLD'S TO OWN** (C11 retrieval.md § 5.25). The kernel indexes what a
 * schema declares; which fields people actually look a thing up by is domain knowledge, and it
 * lives here. So this is the C6-side enforcer for a kernel-side contract: a schema with no
 * `index` is findable only by `name`, which for a sample or an oligo is close to useless, and
 * nothing outside this repository will ever tell us that happened.
 *
 * **A FIELD NAME WITH A TYPO IN IT IS THE FAILURE WORTH CATCHING.** An index on `experimnet`
 * declares a lookup nobody can use, indexes nothing, and reads exactly like a working
 * declaration — the same shape as a rule that cannot fail, one layer down.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SHARABLES = path.join(root, 'sharables');

const schemas = fs.readdirSync(SHARABLES)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ file: f, rec: JSON.parse(fs.readFileSync(path.join(SHARABLES, f), 'utf8')) }))
  .filter(({ rec }) => rec.type === 'schema');

/**
 * Schemas that deliberately carry no index, each with the reason. A LIST WITH REASONS, NOT AN
 * ALLOW-LIST — the same shape as `test/flags-exempt.txt`, and for the same reason: writing the
 * sentence is the part that makes somebody think.
 */
const NO_INDEX = {
  // 'some.schema': 'why its instances are never in a store',
};

const METHODS = ['exact', 'one-of', 'range', 'contains', 'sequence', 'words'];

/**
 * `one-of` on a field whose closed set is stated in prose rather than as a JSON Schema `enum`,
 * each with the evidence. A FIELD CAN HAVE A SMALL VOCABULARY WITHOUT DECLARING ONE — several of
 * these say so in their own `description`, counted over real rows — so the check asks for the
 * reason rather than refusing the declaration.
 */
const ONE_OF_WITHOUT_ENUM = {
  'oligo.schema.scale': "the schema's own description: across 809 rows that state it, the only values are the vendor's handful of synthesis scales",
  'oligo.schema.purification': "same description, same 809 rows: a short fixed list, with ABSENT meaning not recorded rather than a value",
  'provenance.schema.kind': 'what shape of record it is — a small fixed set of document kinds, not free text',
  'thermocycler.schema.enzyme_class': 'the polymerase classes a program is written for; a handful, fixed by the chemistry rather than by a vocabulary somebody chose',
};

describe('every schema declares how its instances are indexed', () => {
  it('there are schemas to check', () => expect(schemas.length).toBeGreaterThan(0));

  for (const { file, rec } of schemas) {
    describe(rec.id, () => {
      it('carries an index, or is exempted with a reason', () => {
        if (NO_INDEX[rec.id]) return expect(NO_INDEX[rec.id].length).toBeGreaterThan(20);
        expect(rec.index, `${file} has no index — add one, or a reason in NO_INDEX`).toBeTruthy();
      });

      it('indexes only fields the schema actually defines', () => {
        const props = rec.definition?.properties || {};
        const unknown = Object.keys(rec.index || {}).filter((f) => !(f in props));
        expect(unknown, `${file} indexes fields it does not define: ${unknown.join(', ')}`).toEqual([]);
      });

      it('uses only methods the kernel knows', () => {
        const bad = Object.values(rec.index || {}).filter((m) => !METHODS.includes(m));
        expect(bad, `${file}: unknown index method(s): ${bad.join(', ')}`).toEqual([]);
      });

      it('declares one-of only on a field with a closed set of values', () => {
        // A `one-of` on free text indexes a vocabulary nobody declared, and the field that IS an
        // enum then goes unindexed — which is how the useful lookup gets missed while the
        // declaration looks complete.
        const props = rec.definition?.properties || {};
        const wrong = Object.entries(rec.index || {})
          .filter(([f, m]) => m === 'one-of')
          .filter(([f]) => !(props[f]?.enum || props[f]?.const))
          .filter(([f]) => !ONE_OF_WITHOUT_ENUM[`${rec.id}.${f}`])
          .map(([f]) => f);
        expect(wrong, `${rec.id}: one-of on free text, and no reason given: ${wrong.join(', ')}`).toEqual([]);
      });
    });
  }
});
