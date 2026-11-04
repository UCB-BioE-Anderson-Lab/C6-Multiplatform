/**
 * README's document index names every document, and the skills it points at exist.
 *
 * **AN INDEX NOBODY CHECKS IS WORSE THAN NO INDEX**, because a reader trusts it and concludes
 * that what it omits does not exist. 17 files sat in `docs/` on 2026-11-04 with nothing in the
 * entry chain pointing at all but two of them, and the way that was discovered was somebody
 * reading the directory — which does not scale and had not happened for months.
 *
 * This is the enforcer for the claim README makes about itself.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

describe('README indexes the documents', () => {
  const docs = fs.readdirSync(path.join(root, 'docs'))
    .filter((f) => f.endsWith('.md'));

  for (const d of docs) {
    it(`names docs/${d}`, () => {
      expect(readme, `docs/${d} exists but README does not mention it`).toContain(`docs/${d}`);
    });
  }

  const planning = fs.readdirSync(path.join(root, 'docs/planning')).filter((f) => f.endsWith('.md'));
  for (const d of planning) {
    it(`names docs/planning/${d}`, () => {
      expect(readme).toContain(`docs/planning/${d}`);
    });
  }
});

describe('the front doors it points at are there', () => {
  // A skill named in README but absent from the store is the same defect as a claimed record
  // that does not exist — see test/skill-claims.test.js, which checks the other direction.
  const named = [...readme.matchAll(/sharables\/skills\/([a-z-]+\.json)/g)].map((m) => m[1]);

  it('README names at least one skill', () => expect(named.length).toBeGreaterThan(0));

  for (const s of new Set(named)) {
    it(`sharables/skills/${s} is on disk`, () => {
      expect(fs.existsSync(path.join(root, 'sharables/skills', s))).toBe(true);
    });
  }
});
