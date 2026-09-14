/**
 * What the renderer must not decide. GATE 5 of `docs/TOOLKIT-PLAN.md`.
 *
 * > *"Layout decisions move out of `labpacket-to-xlsx.py` into the model; the renderer draws what
 * > it is given."*
 *
 * The renderer is Python and the planner is JavaScript, so a domain rule implemented in both is a
 * rule in two languages, free to disagree, with only one of them tested. Three were: the label
 * length limit, the mastermix threshold, and whether a sheet submits to the Sanger service.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { MASTERMIX_THRESHOLD } from '../../src/labplanner/planning/config.js';
import { CHECKPOINT_FIELDS, setCheckpoint, createLabSheet } from '../../src/labplanner/models/labsheet.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const RENDERER = fs.readFileSync(
  path.join(root, 'src/labplanner/render/labpacket-to-xlsx.py'), 'utf8')
  .replace(/"""[\s\S]*?"""/g, '').replace(/^\s*#.*$/gm, '');

const fixture = path.join(root, 'test/fixtures/golden');
const packet = JSON.parse(execFileSync('node',
  [path.join(root, 'bin/c6-packet'), fixture, '--inventory', path.join(fixture, 'inventory.txt')],
  { encoding: 'utf8', maxBuffer: 64e6 }));

describe('the renderer holds no domain constant', () => {
  // Each of these was a number or a rule living in the Python, beside the same rule in the JS.
  it('has no mastermix threshold of its own', () => {
    expect(RENDERER).not.toMatch(/MASTERMIX_THRESHOLD/);
    expect(MASTERMIX_THRESHOLD).toBeGreaterThan(1);
  });

  it('has no label length limit of its own', () => {
    expect(RENDERER).not.toMatch(/LABEL_MAX/);
    expect(RENDERER).not.toMatch(/def check_labels/);
  });

  it('has no excess factor of its own', () => {
    // 1.1 was a default argument on `reaction_block`, beside `makeMastermixPlan`'s own.
    expect(RENDERER).not.toMatch(/excess\s*=\s*1\.1/);
  });
});

describe('what the sheet now carries instead', () => {
  const pcr = packet.sheets.find((s) => (s.metadata?.operations || []).includes('pcr'));

  it('the mastermix verdict, with the planner’s own reason', () => {
    expect(pcr.mastermix).toBeTruthy();
    expect(typeof pcr.mastermix.mastermix).toBe('boolean');
    expect(pcr.mastermix.why).toMatch(/reaction/);
    // Below the threshold the plan carries the per-reaction recipe; above it, the split.
    if (pcr.mastermix.mastermix) expect(pcr.mastermix.shared).toBeTruthy();
    else expect(pcr.mastermix.perReaction).toBeTruthy();
  });

  // The renderer used to decide by searching `json.dumps(sheet)` for "sanger", "sequenc",
  // "full plasmid" and "analys" — a guess over the whole document, which had already put the lab's
  // submission link on a full-plasmid step.
  it('whether anything on it is sent off-site, said by the design', () => {
    for (const s of packet.sheets) {
      if (!('submits' in s)) continue;
      expect(s.submits).toBe('sanger');
      expect(s.metadata.operations).toContain('sequencing');
    }
    expect(RENDERER).not.toMatch(/json\.dumps\(sheet\)\.lower\(\)/);
  });

  it('its own complaints, rather than the renderer re-deriving them', () => {
    for (const s of packet.sheets) expect(Array.isArray(s.warnings)).toBe(true);
  });
});

describe('the checkpoint is a declared extension point', () => {
  const sheet = () => createLabSheet({ id: 's', operation: 'PCR', tube: 'pcr' });

  // C6 knows a sheet CAN carry one and what shape it must be. It does not know which steps deserve
  // one, what a code looks like, or where the message goes — those are facts about an institution.
  it('refuses a half-filled one', () => {
    expect(() => setCheckpoint(sheet(), { type: 'checkpoint.gel', code: 'x' }))
      .toThrow(/needs delivers, expects/);
  });

  it('accepts a complete one and keeps it', () => {
    const s = sheet();
    setCheckpoint(s, { type: 'x', code: 'y', delivers: 'a photo', expects: 'the photo' });
    expect(s.checkpoint.code).toBe('y');
  });

  it('names no institution in its contract', () => {
    const src = fs.readFileSync(path.join(root, 'src/labplanner/models/labsheet.js'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const word of ['cortex', 'berkeley', 'anderson'])
      expect(src.toLowerCase(), word).not.toContain(word);
    expect(CHECKPOINT_FIELDS).toEqual(['type', 'code', 'delivers', 'expects']);
  });
});

// **A LABSHEET IS READ BY SOMEBODY AT A BENCH, NOT BY WHOEVER WROTE THE COMPILER.** JCA,
// 2026-09-13, on a note that printed on a student's transformation page — *"Amp/carb, so no rescue
// and no injected controls. Controls are still worth a conversation — see operations/transform.md"*:
//
// > *"It is an odd comment to refer to code. Seems like a note for yourself, or for me, not for a
// > student. It's odd."*
//
// Both halves gave it away: `injected controls` is the planner's word for its own decision, and
// the path resolves only inside this repository. The note was real and its reader was the person
// compiling, so it stayed in `c6-plan`'s transformations table and came off the page.
//
// This is the check that stops the next one. It scans what a person actually reads — the notes and
// the prose blocks — for the vocabulary of the source tree.
describe('nothing on a student page points at the source tree', () => {
  const CODE = /\.md\b|\.js\b|\.py\b|\bsrc\/|operations\/|planning\/|design\/|protocols\/|§/;

  // Every experiment we can compile, because the leak was in a branch only one of them takes.
  const projects = [
    [path.join(root, 'test/fixtures/golden'), ['--inventory', path.join(root, 'test/fixtures/golden/inventory.txt')]],
    [path.join(root, 'test/fixtures/tlib3'), []],
  ];

  for (const [dir, extra] of projects) {
    it(`${path.basename(dir)} — no note names a file or a § section`, () => {
      const packet = JSON.parse(execFileSync('node',
        [path.join(root, 'bin/c6-packet'), dir, ...extra],
        { encoding: 'utf8', maxBuffer: 64e6 }));
      const bad = [];
      for (const sh of packet.sheets || []) {
        for (const n of sh.notes || []) if (CODE.test(String(n))) bad.push([sh.id, n]);
        for (const b of sh.blocks || []) {
          // A `{module}` transclusion marker is the renderer's own syntax, not prose.
          if (b.kind !== 'text' || /^\{[a-z0-9_]+\}$/.test(String(b.text).trim())) continue;
          if (CODE.test(String(b.text))) bad.push([sh.id, b.text]);
        }
      }
      expect(bad.map(([id, t]) => `${id}: ${String(t).slice(0, 90)}`)).toEqual([]);
    });
  }
});
