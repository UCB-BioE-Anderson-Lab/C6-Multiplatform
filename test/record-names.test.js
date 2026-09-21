import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * What a record's id must communicate, from docs/PACKAGING-SPEC.md §4.4.
 *
 * THE FAILURE THIS COMES FROM. `b144.flow` answered a labsheet question at 16.69 while the record
 * written for that question scored nothing. Two things were wrong with the id and neither was the
 * record's `noun`/`verb`, which are `onboarding`/`show` and correct:
 *
 *   `b144` is a ROOM. Rooms change, and a name that encodes where something happens stops being
 *   true when it moves — the same class of error as naming a role after its holder.
 *   `flow` is a SHAPE. It says the record has stages, which is true of almost everything.
 *
 * **THE SPEC'S FIRST VERSION OF THIS RULE WAS `id === noun + '.' + verb`, AND IT WAS WRONG.**
 * Checked against the store before implementing: 3 of 14 records passed. The 11 it flagged were
 * mostly BETTER than what it would have forced — `labsheet.receive` reads better than
 * `inventory.receive`, `cf.check` better than `construction-file.check`. A rule that would make
 * eleven ids worse to fix one is not the rule; it was written from one bad example and not tested
 * against the corpus. The spec is corrected.
 *
 * So: the prefix must be a DECLARED domain word, and the suffix must not be a shape word. Adding
 * a prefix is a line in this file with a reason beside it, which is the point — `b144` could not
 * be added here without somebody reading the sentence they were writing.
 */
const ROOT = path.resolve(__dirname, '..');

/** Domain words this repository's ids may begin with. One line, one reason. */
const DOMAIN = {
  'cf':                'construction file — the abbreviation the lab actually says out loud',
  'labsheet':          'the printable page somebody carries to a bench',
  'construction-file': 'spelled out, where an id is not competing for width',
  'oligo':             'a synthetic DNA oligonucleotide',
  'experiment':        'a named piece of work with files and an outcome',
  'inventory':         'what is in the freezer and where',
  'resource':          'a repository of wetlab data, as a thing to be cleaned',
  'skills':            'the front-door namespace; `skills/<scope>` is the kernel\'s own convention',
  'generated':         'the namespace for records written from JSDoc, never by hand',
};

/**
 * Words that describe a SHAPE rather than a job. A suffix saying a thing has stages, or is a
 * system, or helps, tells a reader nothing they did not already assume.
 */
const SHAPE = ['flow', 'pipeline', 'system', 'manager', 'handler', 'helper', 'util', 'utils',
               'misc', 'stuff', 'thing', 'things', 'core', 'main', 'common', 'general'];

const handWritten = () => {
  const out = [];
  const walk = (dir, prefix = '') => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p, `${prefix}${e.name}/`); continue; }
      if (!e.name.endsWith('.json')) continue;
      const id = prefix + e.name.replace(/\.json$/, '');
      if (id.startsWith('generated/')) continue;
      out.push({ id, rec: JSON.parse(fs.readFileSync(p, 'utf8')) });
    }
  };
  walk(path.join(ROOT, 'sharables'));
  return out;
};

describe('every hand-written record id', () => {
  const records = handWritten();

  it('there are some, and they are found by walking the store', () => {
    expect(records.length).toBeGreaterThan(0);
  });

  it('begins with a declared domain word', () => {
    const bad = records.map((r) => r.id)
      .filter((id) => !(id.split(/[./]/)[0] in DOMAIN));
    expect(bad, `undeclared prefix — add it to DOMAIN with a reason, or rename: ${bad.join(', ')}`)
      .toEqual([]);
  });

  it('does not end in a word that describes a shape rather than a job', () => {
    const bad = records.map((r) => r.id)
      .filter((id) => SHAPE.includes(id.split('.').pop().toLowerCase()));
    expect(bad, `shape word where a job belongs: ${bad.join(', ')}`).toEqual([]);
  });

  it('carries the noun and verb the exact index needs, whatever the id says', () => {
    // The id is for a human reading a result list; noun/verb are for `c11 ontology`. They are
    // allowed to differ -- `labsheet.receive` is filed under `inventory` and both are right --
    // but neither may be absent, because then the record is reachable by ranking alone.
    const bad = records.filter((r) => !r.rec.noun || !r.rec.verb).map((r) => r.id);
    expect(bad, `missing noun or verb: ${bad.join(', ')}`).toEqual([]);
  });
});

/**
 * §4.5 — meta-vocabulary belongs to skills.
 *
 * "How do these fit together" is a question about a SCOPE, and the records that answer it are
 * skills. A `function` carrying that phrasing wins every domain's scope question, including
 * domains it knows nothing about: that is exactly how a safety record came to answer a labsheet
 * question. The vocabulary is a shared resource, and this test is this repository declining to
 * take more of it than one skill's worth.
 */
const META = [
  /fit together/i,
  /where do I start/i,
  /whole .*(pipeline|process|flow) in one place/i,
  /which verb (owns|chases)/i,
  /what must I not do/i,
  /how do the .* tools/i,
];

describe('meta-vocabulary is reserved to skills', () => {
  const records = handWritten();

  it('no function or datum claims a scope question', () => {
    const offenders = [];
    for (const { id, rec } of records) {
      if (rec.type === 'datum' && rec.conforms === 'c11.skill') continue;   // skills may
      const text = [rec.description, ...(rec.phrases || [])].join(' | ');
      for (const p of META) if (p.test(text)) offenders.push(`${id} matches ${p}`);
    }
    expect(offenders, offenders.join('; ')).toEqual([]);
  });

  it('and the skill that may, does — otherwise nothing would answer it', () => {
    const skills = records.filter((r) => r.rec.conforms === 'c11.skill');
    const answering = skills.filter((s) =>
      META.some((p) => p.test([s.rec.description, ...(s.rec.phrases || [])].join(' | '))));
    expect(answering.length).toBeGreaterThan(0);
  });
});
