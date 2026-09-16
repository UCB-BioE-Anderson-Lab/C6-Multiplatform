/**
 * A number in a document that also exists in code.
 *
 * **THE DOCTRINE THIS ENFORCES** — `CLAUDE.md`, on why Cortex keeps finding the same defect:
 * *"treat a claim in this file about a mechanism as a claim needing an enforcer."* A document
 * asserting a threshold reads true for exactly as long as nobody compares it to the threshold.
 *
 * Two were wrong when this file was written, on 2026-09-13:
 *
 *   `docs/LABSHEET-SPEC.md` said a 1.5 mL cap takes "about 6 characters". The code said 12, after
 *   JCA loosened it — and the spec is the document that calls itself *settled*.
 *
 *   `operations/pick.md` said "4 or more" go in a block. `BLOCK_FROM` has always been 5. JCA's own
 *   words were *"more than 4 colonies"*, so the code was right and the description had been off by
 *   one since it was written.
 *
 * Neither was reachable by any test. Both were found by reading, which does not scale and did not
 * happen for weeks.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TUBE, CLONE_MAX } from '../src/labplanner/models/labsheet.js';
import { DNA_NAME_MAX, DNA_NAME_LIMIT, PCR_LABEL_MAX } from '../src/labplanner/planning/naming.js';
import { BLOCK_FROM, BLOCK } from '../src/labplanner/planning/vessels.js';
import { MASTERMIX_THRESHOLD } from '../src/labplanner/planning/config.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

// Each entry: the document, a description, and the exact string it must contain given the code.
// Written as "what the doc must say IF the constant is what it is", so changing a constant fails
// here and names the document to update rather than going quietly out of step.
const CLAIMS = [
  ['docs/LABSHEET-SPEC.md', 'the PCR cap', () => `**${TUBE.pcr.cap} characters`],
  ['docs/LABSHEET-SPEC.md', 'the 1.5 mL cap', () => `**${TUBE.micro.cap}**`],
  ['docs/LABSHEET-SPEC.md', 'the sequencing tube', () => `**${TUBE.sequencing.cap}**`],
  ['docs/LABSHEET-SPEC.md', 'the name aim and limit',
    () => `**${DNA_NAME_MAX} is the aim, ${DNA_NAME_LIMIT} is about the limit**`],
  ['src/labplanner/planning/operations/pick.md', 'the block threshold',
    () => `| ${BLOCK_FROM} or more | a ${BLOCK.rows * BLOCK.cols}-well block |`],
  ['src/labplanner/planning/operations/pick.md', 'the tube case',
    () => `| fewer than ${BLOCK_FROM} |`],
  ['src/labplanner/planning/operations/pcr.md', 'the mastermix threshold',
    () => `MASTERMIX_THRESHOLD = ${MASTERMIX_THRESHOLD}`],
];

describe('what the documents say is what the code does', () => {
  for (const [doc, what, expected] of CLAIMS) {
    it(`${doc} — ${what}`, () => {
      const want = expected();
      expect(read(doc), `${doc} no longer states ${what} as "${want}"`).toContain(want);
    });
  }
});

describe('the constants are defined in one place each', () => {
  // A number copied into a second module is a number that drifts. These are the ones a doc quotes,
  // so a second definition would make the check above pass while the code disagreed with itself.
  it('the label caps live only in the model', () => {
    expect(read('src/labplanner/planning/naming.js')).not.toMatch(/export const TUBE\b/);
    // COMMENTS STRIPPED. The renderer keeps a note saying it *used to* carry `LABEL_MAX = 3`, and
    // the record of having been wrong is worth more than a check that cannot tell code from
    // prose — the same slip this file exists to catch, one level up.
    const py = read('src/labplanner/render/labpacket-to-xlsx.py')
      .split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
    expect(py).not.toMatch(/LABEL_MAX\s*=/);
  });

  it('PCR_LABEL_MAX and the model agree', () => {
    expect(PCR_LABEL_MAX).toBe(TUBE.pcr.cap);
  });

  it('a 1.5 mL holds a name at its limit plus a hyphen plus a clone', () => {
    expect(TUBE.micro.cap).toBe(DNA_NAME_LIMIT + 1 + CLONE_MAX);
    expect(TUBE.sequencing.cap).toBe(TUBE.micro.cap + 1);
  });
});

describe('nothing in the index offers a shape the code no longer emits', () => {
  // **A RECORD MUST NOT OFFER A CAPABILITY THAT READS A FIELD THE PACKET STOPPED EMITTING.**
  //
  // The case that prompted this: `render/labsheetHtml.js` drew a LabPacket to HTML, nothing called
  // it, and it read `sheet.inputs` — renamed to `sheet.sources` in PHASE 1 — so every sheet it
  // produced silently lacked the block saying which tubes to fetch and where they are, while a
  // sharable advertised it as a working renderer. It was deleted on 2026-09-13, so this check has
  // no live subject; it is kept because the rename it watches for is the shape of the failure, not
  // the file. `xlsx-to-html.py` had named the hazard in its own header before it happened.
  const generated = fs.readdirSync(path.join(root, 'sharables/generated'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(root, 'sharables/generated', f), 'utf8')));

  it('a record for a module that reads the old field says so in its description', () => {
    for (const rec of generated) {
      const file = (rec.requires || [])[0]?.path;
      if (!file || !file.endsWith('.js') || !fs.existsSync(path.join(root, file))) continue;
      const src = fs.readFileSync(path.join(root, file), 'utf8');
      // Reads `.inputs` off a sheet, and never `.sources`. The renamed field, one way only.
      const stale = /sheet(\[['"]inputs['"]\]|\.inputs)/.test(src) && !/\.sources\b/.test(src);
      if (!stale) continue;
      expect(rec.description, `${rec.id} offers ${file}, which reads the pre-PHASE-1 shape`)
        .toMatch(/UNMAINTAINED/);
    }
  });
});

// **A DOC THAT NAMES ONLY SOME OF THE BUTTONS.** `docs/LABPLANNER-API.md` is the answer to *"what
// are all the tools in there"*, and on 2026-09-13 it named eight of twelve — missing `c6-check`,
// `c6-sim`, `c6-protocol` and `c6-golden`, and, more to the point, missing `c6-issue` and
// `c6-receive`, which are half the lifecycle and were built after the doc was written.
//
// `CLAUDE.md` on why this is the recurring shape: *"a button nameable from nowhere in the
// constitution is one a fresh session finds by luck."* Cortex's own `bin/health.sh` fails when a
// verb has no runbook, for the same reason. This is that check, pointed at C6.
describe('the API doc names every command', () => {
  const bins = fs.readdirSync(path.join(root, 'bin')).filter((f) => f.startsWith('c6-')).sort();
  // **§ 3.2, NOT THE WHOLE DOCUMENT.** Cortex Ops 16, 2026-09-16, on a check it had just been
  // bitten by: *"a check that asserts a NAME RESOLVES is weaker than it looks — `c6-issue` appears
  // somewhere in the doc is satisfied by a passing mention."* It was, here: this read the whole
  // file, so a command mentioned once in a paragraph about something else counted as documented.
  //
  // § 3.2 is generated now, so this passes by construction and is a BACKSTOP rather than the
  // mechanism — it catches the markers being deleted or the section renamed, which is the one way
  // the generator can be silently switched off.
  const doc = read('docs/LABPLANNER-API.md').split('\n');
  const from = doc.findIndex((l) => /^### 3\.2 /.test(l));
  const to = doc.findIndex((l, i) => i > from && /^### |^## /.test(l));
  const section = doc.slice(from, to).join('\n');
  it('finds some commands to check', () => expect(bins.length).toBeGreaterThan(8));
  it('finds § 3.2', () => expect(from, '§ 3.2 is gone').toBeGreaterThan(-1));
  for (const b of bins) {
    it(`${b} is named in § 3.2`, () => expect(section).toContain(b));
  }
});

// **THE COUNTS IN A SURVEY GO STALE SILENTLY.** §5 said 217 records, 218 functions, 32 data and 45
// undocumented; the store had 266, 231, 35 and 47. Nothing was wrong with the code — the document
// had simply stopped describing it, which is the failure this whole file exists for.
describe('the sharable counts in §5 are the counts in the store', () => {
  const dir = path.join(root, 'sharables', 'generated');
  const recs = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
                 .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const doc = read('docs/LABPLANNER-API.md');
  const n = (type) => recs.filter((r) => r.type === type).length;

  it('the total', () => expect(doc).toContain(`${recs.length} records in \`sharables/generated/\``));
  it('the split by type', () =>
    expect(doc).toContain(`**Two types: \`function\` (${n('function')}) and \`datum\` (${n('datum')}).**`));
});

// **A COMMAND IS NAMED AND A FLAG IS NOT, AND THE CHECK ABOVE CANNOT SEE THE DIFFERENCE.**
//
// `--only` and `--phase` decide which constructs end up in a workbook. They were built on
// 2026-09-15, documented in `bin/c6-packet`'s docstring and in their commit message, and named
// nowhere in `docs/LABPLANNER-API.md` — and nothing failed, because the check above reads `bin/`
// for COMMANDS. `cortex labsheets` passes both through, so the documented way to run it compiled
// the whole experiment into one student's workbook.
//
// ## Why an exemption file and not an allow-list
//
// Recommended by the Cortex session, 2026-09-16, which had solved the same problem one level up —
// `bin/health.sh` there asserts "every cortex verb has a runbook OR A STATED EXEMPTION":
//
// > *"An allow-list lets `--only` be skipped by someone adding a line. An exemption file makes
// > them write a sentence saying why `--only` doesn't need documenting — and there isn't one, so
// > they can't, and the act of trying is visible in review. `--json` gets one line and costs
// > nothing. The cost falls on exactly the flags that shouldn't be exempt."*
//
// So a reason-less line FAILS. Without that it is an allow-list wearing a different filename.
//
// ## Why § 3.3, and why § 3.2 would make this check vacuous
//
// The same session's sharpest point was that a check asserting a NAME RESOLVES is weaker than it
// looks: *"`c6-issue` appears somewhere in the doc" is satisfied by a passing mention.*
//
// **§ 3.2 IS NOW GENERATED AND LISTS EVERY FLAG OF EVERY COMMAND**, so scoping here to § 3 — which
// this did for one commit — made the check pass for every flag that has ever existed, including one
// nobody has explained. The generated table answers *is it listed*; it cannot answer *does anybody
// say what it does*, and a check that reads it is measuring the generator rather than the document.
//
// So this reads § 3.3 alone, which is hand-written and is where a flag's MEANING lives. Flags whose
// meaning is better explained somewhere else — `--inventory` and `--issue` belong to § 3.1's
// lifecycle, not to a list — take an exemption saying where, which is a sentence somebody has to
// write and a reader can check.
describe('every flag is named or exempted', () => {
  const doc = read('docs/LABPLANNER-API.md').split('\n');
  const from = doc.findIndex((l) => /^### 3\.3 /.test(l));
  const to = doc.findIndex((l, i) => i > from && /^### |^## /.test(l));
  const section3 = doc.slice(from, to).join('\n');

  it('finds § 3.3, and it is the hand-written one', () => {
    // A SECTION THAT MOVED OR WAS RENUMBERED WOULD MAKE EVERY CHECK BELOW PASS ON AN EMPTY STRING
    // — which is the vacuity this whole block is about, one level up.
    expect(from, '§ 3.3 is gone from docs/LABPLANNER-API.md').toBeGreaterThan(-1);
    expect(section3.length).toBeGreaterThan(500);
  });

  // QUOTED TOKENS ONLY. A flag the code READS is always a string literal; `--release` appears in
  // `c6-holds` inside a sentence explaining that the command deliberately has no such flag, and a
  // looser scan would demand documentation for a flag that does not exist.
  const flags = new Map();
  for (const f of fs.readdirSync(path.join(root, 'bin')).filter((x) => x.startsWith('c6-'))) {
    const src = fs.readFileSync(path.join(root, 'bin', f), 'utf8');
    for (const m of src.matchAll(/['"](--[a-z][a-z0-9-]*)['"]/g)) {
      if (!flags.has(m[1])) flags.set(m[1], []);
      if (!flags.get(m[1]).includes(f)) flags.get(m[1]).push(f);
    }
  }

  const lines = read('test/flags-exempt.txt').split('\n');
  const exempt = new Map();
  for (const line of lines) {
    if (!/^--/.test(line)) continue;
    const [, flag, reason] = line.match(/^(--[a-z0-9-]+)\s*(.*)$/) || [];
    exempt.set(flag, (reason || '').trim());
  }

  it('finds the flags and the exemptions', () => {
    expect(flags.size).toBeGreaterThan(20);
    expect(exempt.size).toBeGreaterThan(0);
  });

  it('every exemption carries a reason', () => {
    for (const [flag, reason] of exempt) {
      // **THE LINE THAT MAKES THIS AN EXEMPTION FILE RATHER THAN AN ALLOW-LIST.** A bare flag is
      // somebody silencing the check; a sentence is somebody arguing for it, in public.
      expect(reason.length, `${flag} is exempted with no reason — that is an allow-list entry`)
        .toBeGreaterThan(20);
    }
  });

  it('exempts nothing that § 3.3 already explains', () => {
    for (const flag of exempt.keys()) {
      // An exemption saying "§ 3 does not name this" while § 3 names it is a lie at rest, and
      // neither half's reader would catch it. → the header of test/flags-exempt.txt
      expect(section3.includes(flag),
        `${flag} is exempted AND explained in § 3.3 — delete the exemption`).toBe(false);
    }
  });

  for (const [flag, cmds] of [...flags].sort()) {
    it(`${flag} (${cmds.join(', ')})`, () => {
      if (exempt.has(flag)) return;
      expect(section3.includes(flag),
        `${flag} is read by ${cmds.join(', ')} and § 3.3 of docs/LABPLANNER-API.md does not explain it. `
        + 'Document it there, or add a line to test/flags-exempt.txt saying why it needs no '
        + 'documenting.').toBe(true);
    });
  }
});
