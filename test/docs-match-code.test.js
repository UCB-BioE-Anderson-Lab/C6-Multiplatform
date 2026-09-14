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
  // **A SECOND RENDERER IS A DRIFT HAZARD, AND THIS ONE DRIFTED.** `render/labsheetHtml.js` draws
  // a LabPacket to HTML, nothing calls it, and it reads `sheet.inputs` — renamed to
  // `sheet.sources` in PHASE 1. So every sheet it produces silently lacks the block saying which
  // tubes to fetch and where they are. It had a sharable advertising it as a working renderer.
  //
  // `xlsx-to-html.py` named the hazard in its own header before it happened: *"two renderers over
  // one format, drifting apart, with the preview quietly disagreeing with the thing that prints."*
  //
  // This is the general check: a record must not offer a capability that reads a field the packet
  // stopped emitting. It is keyed on the rename that actually caught one.
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
