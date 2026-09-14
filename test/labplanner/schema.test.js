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

describe('the workflow is covered end to end', () => {
  // **AN AUDIT FINDING MADE INTO A CHECK, 2026-09-13.** Every step of the workflow had a sharable
  // except the three at the end — issue, the bench, receive — which are the ones with
  // consequences and the ones built most recently. `experiment.author`, the single record that
  // says how these tools fit together, stopped at "compile the labsheets". So `c6-issue` and
  // `c6-receive` existed, worked, and were connected to nothing a session would ever read.
  //
  // A tool nothing points at is invisible to the index that exists to answer *does a button for
  // this already exist?* — and a session told **no** builds it a second time.
  const hand = fs.readdirSync(path.join(root, 'sharables'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(root, 'sharables', f), 'utf8')));
  const byEntry = (bin) => hand.find((r) => String(r.entry || '').split(/\s/)[0] === bin);

  // The tools a person runs, as against the plumbing every generated record already names.
  const FRONT_DOOR = ['c6-check', 'c6-sim', 'c6-decide', 'c6-labplan', 'c6-issue', 'c6-receive'];

  it('every tool somebody runs has a sharable of its own', () => {
    for (const bin of FRONT_DOOR) {
      expect(fs.existsSync(path.join(root, 'bin', bin)), `${bin} is gone`).toBe(true);
      expect(byEntry(bin), `no sharable has \`entry: ${bin}\``).toBeTruthy();
    }
  });

  it('and the end-to-end record names all of them', () => {
    const author = hand.find((r) => r.id === 'experiment.author');
    const body = (author.steps || []).join(' ');
    for (const bin of FRONT_DOOR) expect(body, `the procedure never reaches ${bin}`).toContain(bin);
  });

  it('the record reaches the bench and back, not just the printer', () => {
    const body = hand.find((r) => r.id === 'experiment.author').steps.join(' ');
    expect(body).toMatch(/ISSUE it/);
    expect(body).toMatch(/RECEIVE it/);
    expect(body).toMatch(/where the inventory learns anything true/);
  });

  // NOT ALL ONE NOUN. 89 generated records already share `labsheet`, which is too coarse to rank
  // on; the hand-written ones for distinct acts should not pile onto it.
  it('the lifecycle acts are indexed under distinct nouns', () => {
    const nouns = ['labsheet.compile', 'labsheet.issue', 'labsheet.receive', 'labsheet.decide']
      .map((id) => hand.find((r) => r.id === id).noun);
    expect(new Set(nouns).size).toBe(nouns.length);
  });
});

// **THE RULE THAT LIVES IN THE OTHER REPO.** `sharables/generated/` is mounted by Cortex, whose
// C11 spec (`engine/c11/spec/sharables.md § 3.5.4`) refuses a datum that neither carries `data` nor
// points at a `path`: *"an unvalidated datum is the assumption § 3.5.4 forbids."* All 35 generated
// datum records were exactly that on the day the type was introduced, so `bin/health.sh` in Cortex
// went red listing every one — and `npm test` here passed, because the rule was enforced only where
// the records are read and never where they are written.
//
// A generator that can produce records invalid under the spec of the store they are written FOR
// should fail at the generator. This is that check, stated structurally so C6 needs no C11.
describe('every generated datum is a shape C11 will accept', () => {
  const dir = path.join(root, 'sharables', 'generated');
  const recs = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
                 .map((f) => [f, JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))]);
  const data = recs.filter(([, r]) => r.type === 'datum');

  it('there are some to check', () => expect(data.length).toBeGreaterThan(0));

  it('each carries data or a path, never neither', () => {
    const bad = data.filter(([, r]) => !('data' in r) && !r.path).map(([f]) => f);
    expect(bad, `${bad.length} datum record(s) hold nothing and point nowhere`).toEqual([]);
  });

  // `name` is required on a wrapper and nowhere else: the id is a file path, and a result row
  // reading `generated/plan.block_from` tells a reader nothing on its own.
  it('a wrapper names itself', () => {
    const bad = data.filter(([, r]) => r.path && !r.name).map(([f]) => f);
    expect(bad).toEqual([]);
  });

  // Both is refused, not resolved by precedence: a record holding data AND pointing at a file has
  // two answers to "what does this hold".
  it('never both', () => {
    expect(data.filter(([, r]) => 'data' in r && r.path).map(([f]) => f)).toEqual([]);
  });

  it('the file a wrapper points at exists', () => {
    for (const [f, r] of data) {
      if (r.path) expect(fs.existsSync(path.join(root, r.path)), `${f} → ${r.path}`).toBe(true);
    }
  });
});
