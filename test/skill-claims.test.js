import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * A skill's `claims` must name records that exist. NOTHING IN THE KERNEL CHECKS THIS.
 *
 * `c11.skill`'s own notes say "`claims` naming a record that does not exist is refused at write,
 * like `conforms`; a record claimed by two skills is an error; a record claimed by none is PRINTED
 * rather than failing." Checked 2026-09-21: no code in engine/c11 reads `data.claims` at all. The
 * sentence is true of the design and of no running code, which is the exact failure the kernel is
 * written around — a true-sounding sentence with nothing under it.
 *
 * So the enforcement lives here, for this world's skills, where it can actually run. A skill whose
 * claims rot is `experiment.author` again: a correct-sounding map of a toolkit that has moved.
 */
const ROOT = path.resolve(__dirname, '..');
const SHARABLES = path.join(ROOT, 'sharables');

const allRecords = () => {
  const out = new Set();
  const walk = (dir, prefix = '') => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(path.join(dir, e.name), `${prefix}${e.name}/`);
      else if (e.name.endsWith('.json')) out.add(prefix + e.name.replace(/\.json$/, ''));
    }
  };
  walk(SHARABLES);
  return out;
};

const skills = () => {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.json')) continue;
      let r; try { r = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { continue; }
      if (r.type === 'datum' && r.conforms === 'c11.skill') out.push(r);
    }
  };
  walk(SHARABLES);
  return out;
};

describe('every skill in this world', () => {
  const found = skills();
  const records = allRecords();

  it('there is at least one, and it is found by walking the store', () => {
    expect(found.length).toBeGreaterThan(0);
  });

  for (const s of found) {
    describe(s.id, () => {
      it('claims only records that exist', () => {
        const missing = (s.data.claims || []).filter((c) => !records.has(c));
        expect(missing, `claims naming nothing: ${missing.join(', ')}`).toEqual([]);
      });

      it('reads first a document that is on disk', () => {
        expect(fs.existsSync(path.join(ROOT, s.data.entry)), s.data.entry).toBe(true);
      });

      it('points every branch entry at a document that is on disk', () => {
        const bad = (s.data.branches || []).map((b) => b.entry).filter(Boolean)
          .filter((e) => !fs.existsSync(path.join(ROOT, e)));
        expect(bad, `branch entries that do not exist: ${bad.join(', ')}`).toEqual([]);
      });

      it('says what falls OUTSIDE it, which is the load-bearing half', () => {
        // c11.skill: "a scope that only says what it covers cannot tell a reader they are in the
        // wrong place."
        expect(s.data.scope).toMatch(/\bNOT\b/);
      });

      it('carries invariants, which is the field the type exists for', () => {
        expect((s.data.invariants || []).length).toBeGreaterThan(0);
      });
    });
  }

  it('no record is claimed by two skills — two paths to one place is two owners', () => {
    const seen = new Map(), dupes = [];
    for (const s of found) for (const c of s.data.claims || []) {
      if (seen.has(c)) dupes.push(`${c}: ${seen.get(c)} and ${s.id}`);
      seen.set(c, s.id);
    }
    expect(dupes).toEqual([]);
  });

  it('reports hand-written records no skill claims — a finding, not a failure', () => {
    const claimed = new Set(found.flatMap((s) => s.data.claims || []));
    const hand = [...records].filter((r) => !r.startsWith('generated/') && !r.startsWith('skills/'));
    const unclaimed = hand.filter((r) => !claimed.has(r));
    // PRINTED rather than failed, per c11.skill: "a record claimed by none is a finding about
    // navigation and a young store has many." These three are genuinely other scopes.
    expect(unclaimed.sort()).toEqual(['oligo.eipcr', 'oligo.schema', 'resource.clean']);
  });
});
