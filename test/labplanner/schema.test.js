/**
 * The labsheet schema describes the labsheets this toolkit actually emits.
 *
 * **A SCHEMA NOTHING VALIDATES IS A CLAIM, NOT A CONTRACT.** C11 § 3.5.4: *"Where a record claims
 * conformance to a schema, that conformance MUST be validated rather than assumed."* This is that
 * validation, run against a real compiled packet rather than a hand-written example — so the
 * schema cannot quietly describe a labsheet nobody produces.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const fixture = path.join(root, 'test/fixtures/golden');
const record = JSON.parse(fs.readFileSync(path.join(root, 'sharables/labsheet.schema.json'), 'utf8'));
const def = record.definition;
const packet = JSON.parse(execFileSync('node',
  [path.join(root, 'bin/c6-packet'), fixture, '--inventory', path.join(fixture, 'inventory.txt')],
  { encoding: 'utf8', maxBuffer: 64e6 }));

describe('the record itself', () => {
  it('is a schema, in the closed vocabulary C11 accepts', () => {
    expect(record.type).toBe('schema');
    expect(['function', 'datum', 'schema', 'view']).toContain(record.type);
  });

  it('points at the constructor that enforces it', () => {
    expect(record.requires[0].path).toBe('src/labplanner/models/labsheet.js');
    expect(fs.existsSync(path.join(root, record.requires[0].path))).toBe(true);
  });
});

describe('every sheet a real compile produces', () => {
  it('carries every required property', () => {
    for (const s of packet.sheets) {
      for (const k of def.required) {
        expect(s[k], `${s.id} has no ${k}`).toBeDefined();
      }
    }
  });

  // THE HALF THAT CATCHES DRIFT. `additionalProperties: false` means a field the code starts
  // emitting and the schema has never heard of is a failure here rather than a surprise later —
  // which is how `submits`, `warnings` and `open` would each have slipped in undocumented.
  it('emits no property the schema has not heard of', () => {
    const known = new Set(Object.keys(def.properties));
    for (const s of packet.sheets) {
      for (const k of Object.keys(s)) {
        expect(known.has(k), `${s.id} emits "${k}", which labsheet.schema.json does not describe`)
          .toBe(true);
      }
    }
  });

  it('declares a tube kind from the closed list', () => {
    for (const s of packet.sheets) expect(def.properties.tube.enum).toContain(s.tube);
  });

  it('has an id in the shape the schema states', () => {
    const re = new RegExp(def.properties.id.pattern);
    for (const s of packet.sheets) expect(re.test(s.id), s.id).toBe(true);
  });

  it('gives every source one of the four states, and no location it should not have', () => {
    for (const s of packet.sheets) {
      for (const src of s.sources || []) {
        expect(src.what, `${s.id} has a source with nothing to fetch`).toBeTruthy();
        if (src.made || src.unlocated) expect(`${src.box}${src.well}`, src.what).toBe('');
      }
    }
  });

  // The schema says a label is an exact key. The model refuses a duplicate; this checks the
  // packet that actually came out, which is the artefact somebody prints.
  it('never uses one label twice on a sheet', () => {
    const KEYS = ['label', 'tube', 'plate', 'block', 'well'];
    for (const s of packet.sheets) {
      const seen = new Set();
      for (const row of s.samples || []) {
        const lab = KEYS.map((k) => String(row[k] ?? '').trim()).find(Boolean);
        if (!lab) continue;
        expect(seen.has(lab), `${s.id} uses ${lab} twice`).toBe(false);
        seen.add(lab);
      }
    }
  });
});

describe('the hand-written sharables', () => {
  // A RECORD THAT NAMES A FILE THAT IS NOT THERE is the § 3.26 defect: a promise nothing keeps.
  // `experiment.author` pointed at `src/labplanner/planning/operations/` and at tools that had
  // been renamed, and nothing compared the list to the disk.
  const hand = fs.readdirSync(path.join(root, 'sharables'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f, JSON.parse(fs.readFileSync(path.join(root, 'sharables', f), 'utf8'))]);

  it('declare a type in C11’s closed vocabulary', () => {
    for (const [f, r] of hand)
      expect(['function', 'datum', 'schema', 'view'], f).toContain(r.type);
  });

  it('require only things that exist', () => {
    for (const [f, r] of hand)
      for (const req of r.requires || [])
        expect(fs.existsSync(path.join(root, req.path)), `${f} requires ${req.path}`).toBe(true);
  });

  // The one that says how the tools fit together has to carry the steps, or it is a description
  // of a procedure with the procedure missing.
  it('the end-to-end one carries its procedure', () => {
    const author = hand.find(([f]) => f === 'experiment.author.json')[1];
    expect(Array.isArray(author.steps)).toBe(true);
    expect(author.steps.length).toBeGreaterThan(5);
    // And it names the tools that exist now, not the ones it was written against.
    const all = author.steps.join(' ');
    for (const tool of ['c6-check', 'c6-sim', 'c6-decide', 'c6-labplan'])
      expect(all, `procedure never mentions ${tool}`).toContain(tool);
    expect(all).toMatch(/Characterization of/);
  });
});
