/**
 * The five operations of the characterization half: retransform, culture, assay, dilution, stock.
 * GATE 3c of `docs/TOOLKIT-PLAN.md`.
 */
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DESIGNS, applyDesign } from '../../src/labplanner/design/index.js';
import { planExperiment } from '../../src/labplanner/planning/planExperiment.js';
import { bestSequenceFor } from '../../src/labplanner/planning/sequences/index.js';
import { createJob } from '../../src/labplanner/planning/job.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const fixture = path.join(root, 'test/fixtures/golden');
const packet = JSON.parse(execFileSync('node',
  [path.join(root, 'bin/c6-packet'), fixture, '--inventory', path.join(fixture, 'inventory.txt')],
  { encoding: 'utf8', maxBuffer: 64e6 }));

const sheetWith = (op) => packet.sheets.find((s) => (s.metadata?.operations || []).includes(op));
const headings = (s) => (s.blocks || []).filter((b) => b.kind === 'heading').map((b) => b.text);
const tableUnder = (s, re) => {
  const b = s.blocks || [];
  const i = b.findIndex((x) => x.kind === 'heading' && re.test(x.text));
  return i < 0 ? null : b.slice(i + 1).find((x) => x.kind === 'table');
};

describe('retransform', () => {
  const s = sheetWith('retransform');

  // IT WAS `negative | untransformed` AND `positive | pCTRL` UNDER "For this experiment" — true,
  // and it does not tell anybody what to put on a plate or what the plate would prove. The
  // cloning transform had had a proper control table since GATE 3a and a student meets both in
  // one experiment.
  it('presents its controls as plates, the same way the transform does', () => {
    expect(headings(s).some((h) => /^Controls —/.test(h))).toBe(true);
    const t = tableUnder(s, /^Controls —/);
    expect(t.rows[0]).toEqual(['plate', 'what goes on it', 'it answers']);
    expect(t.rows.length).toBe(3);          // header + positive + negative
    expect(headings(s)).not.toContain('For this experiment');
  });

  // TWO, NOT THREE. The restreak belongs to the cloning transformation — JCA, 2026-09-12, asked
  // for the three-plate set on "the transformation, not the retransformation". This DNA is
  // already known good, so "is this batch of plates any good" was answered upstream.
  it('has no restreak control', () => {
    const t = tableUnder(s, /^Controls —/);
    expect(t.rows.map((r) => r[0]).join(' ')).not.toMatch(/streak/i);
  });

  // A POSITIVE CONTROL IS A REAL TUBE. The sheet said "3 plates: the sample, plus untransformed
  // and pCTRL" and never said where the second plasmid was.
  it('lists the positive control plasmid as something to fetch', () => {
    const src = (s.sources || []).find((x) => x.what === 'pCTRL');
    expect(src, 'pCTRL is not in the Source block').toBeTruthy();
    expect(src.note).toMatch(/positive control/);
  });
});

describe('alsoNeeds', () => {
  // Kept out of `dnaInputs` on purpose: everything that orders the plan reads that field, and a
  // control is consumed without being an ingredient of anything.
  it('is material consumed without an ordering edge', () => {
    const job = createJob({ operation: 'retransform', output: 'host/pX', dnaInputs: ['pX'],
                            args: { positive: 'pCTRL', negative: 'untransformed' },
                            cf: 'c', line: 1 });
    expect(job.alsoNeeds).toEqual(['pCTRL']);
    expect(job.dnaInputs).toEqual(['pX']);
  });

  it('does not collect the negative, which names cells and not a tube', () => {
    const job = createJob({ operation: 'retransform', output: 'host/pX', dnaInputs: ['pX'],
                            args: { negative: 'untransformed' }, cf: 'c', line: 1 });
    expect(job.alsoNeeds).toEqual([]);
  });

  it('is empty for every operation that does not declare it', () => {
    for (const op of ['pcr', 'transform', 'culture', 'assay', 'pick'])
      expect(createJob({ operation: op, output: 'x', args: { positive: 'pCTRL' },
                         cf: 'c', line: 1 }).alsoNeeds).toEqual([]);
  });
});

describe('assay', () => {
  const s = sheetWith('assay');

  // A plate reader returns a grid of numbers. A grid with no key is not data, and rebuilding it
  // afterwards from the picking sheet is where a control column gets read as a sample.
  it('says what is in every well, controls included', () => {
    const t = tableUnder(s, /each well/);
    expect(t).toBeTruthy();
    // THE KEY COLUMNS, not the whole header. This asserted the header exactly and broke the day
    // the readings got columns of their own — a test whose subject is "every well is accounted
    // for" failing over what else is on the row. The reading columns have their own test below.
    expect(t.rows[0].slice(0, 3)).toEqual(['well', 'what is in it', 'role']);
    const roles = t.rows.slice(1).map((r) => r[2]);
    expect(roles.filter((x) => x === 'sample').length).toBe(4);
    expect(roles.some((x) => /^control/.test(x))).toBe(true);
  });

  // **THE NUMBERS NEED SOMEWHERE TO GO, FOR EVERY WELL.** The map said which well held what and
  // stopped, so the readings stayed in an instrument export and the workbook came back describing
  // an assay it did not contain. Blank trailing columns, because those are what the xlsx renderer
  // turns into registered entry cells — a column merely drawn comes back empty.
  //
  // Stated 2026-09-21: *"Not just for the 8 clones, but for all the data. The distribution of
  // activities is an inherently interesting number even if we don't know what sequence they come
  // from."*
  it('gives every well a column per reading, blank for the bench to fill', () => {
    const t = tableUnder(s, /each well/);
    const extra = t.rows[0].slice(3);
    expect(extra.length).toBeGreaterThan(0);
    // Named after what the characterization file declared, not a fixed list.
    expect(extra).toContain('OD600');
    for (const row of t.rows.slice(1)) {
      expect(row.length).toBe(t.rows[0].length);
      expect(row.slice(3).every((c) => c === '')).toBe(true);
    }
  });

  // `expandClones` overwrites `clone` with the per-colony letter as it fans a pick out, so
  // reading it back gave `A-A`, `A-B` — bookkeeping rendered as a construct name.
  it('names the clones, not the bookkeeping letter', () => {
    const names = tableUnder(s, /each well/).rows.slice(1).map((r) => r[1]);
    expect(names[0]).toBe('L.lactis/pGOLD-A');
    for (const n of names) expect(n).not.toMatch(/^[A-Z]-[A-Z]$/);
  });

  it('agrees with the wells the pick handed out', () => {
    const wells = tableUnder(s, /each well/).rows.slice(1).map((r) => r[0]);
    const pick = sheetWith('pick');
    const picked = (pick.columns || []).map((c) => c.well).filter(Boolean);
    expect(wells.slice(0, picked.length)).toEqual(picked);
  });
});

describe('every sheet', () => {
  // The protocol is a reference the bench has on a cheatsheet; the design's own blocks are what
  // nobody can look up. Ordered the other way, the assay's well map sat on page 2 behind the
  // plate-reader procedure.
  // PER SECTION, because one sheet is one work session and may hold three operations — the pick's
  // protocol legitimately precedes the culture section's conditions. The invariant is within a
  // section, which starts at a heading named for a design.
  const TITLES = new Set(Object.values(DESIGNS).map((d) => d.title));
  it('puts what is specific to it before the generic protocol', () => {
    for (const s of packet.sheets) {
      const b = s.blocks || [];
      let proto = -1;
      b.forEach((x, i) => {
        if (x.kind === 'heading' && TITLES.has(x.text)) proto = -1;
        else if (x.kind === 'text' && /^\{.+\}$/.test(String(x.text || ''))) proto = i;
        else if (proto >= 0 && x.kind === 'heading' && x.text === 'For this experiment')
          expect.fail(`${s.id}: conditions printed after the protocol in the same section`);
      });
    }
  });
});

describe('the sheet speaks in the method the file named', () => {
  /**
   * **FOUND 2026-09-13 BY CHANGING ONE WORD.** With `method=conjugation` the sheet was titled
   * *Electroporation*, said its controls were *"all electroporated the same way"*, that *"the
   * cells survived the pulse"*, and that nothing on the page gave *"the cuvette gap, the voltage"*.
   * Six statements about a procedure nobody was doing — and a cuvette gap is not merely unhelpful
   * for a conjugation, it is meaningless.
   *
   * A method this toolkit has no words for gets NEUTRAL ones rather than another method's:
   * *took up the plasmid* is true of every route, *survived the pulse* is true of one.
   */
  const sheetFor = (method) => {
    const out = planExperiment({ cfs: [
      { name: 'pX', text: 'PCR\tbo1\tbo2\tpS\tfrag\nTransform\tfrag\tMach1\tErm\t37\tpX\n' },
      { name: 'pX', characterization: true,
        text: `Retransform\tpX\thost=L.lactis antibiotic=Erm method=${method} `
            + 'positive=pCTRL negative=untransformed\tpX_h\n' },
    ] });
    const bin = out.sheets.find((s) => s.operation === 'retransform');
    return applyDesign(bin, () => undefined,
                       { label: Object.assign(() => 'X', { of: () => null, hold: () => {} }) });
  };

  it('titles itself by how, not by the commonest how', () => {
    expect(sheetFor('electroporation').title).toBe('Electroporation');
    expect(sheetFor('conjugation').title).toBe('Conjugation');
  });

  it('says nothing about a pulse when there is no pulse', () => {
    const conj = sheetFor('conjugation');
    const said = [conj.title, ...conj.notes,
                  ...conj.blocks.flatMap((b) => (b.rows || []).flat()).map(String)].join(' ');
    for (const wrong of [/pulse/i, /cuvette/i, /electropor/i, /voltage/i])
      expect(said, `a conjugation sheet says ${wrong}`).not.toMatch(wrong);
    expect(said).toMatch(/mating/);
  });

  it('uses neutral words for a route it has no words for', () => {
    const odd = sheetFor('natural-competence');
    expect(odd.title).toBe('Transformation into the assay host');
    const said = [...odd.notes, ...odd.blocks.flatMap((b) => (b.rows || []).flat()).map(String)]
      .join(' ');
    // Neither method's specific language leaks into the other's sheet.
    for (const wrong of [/pulse/i, /cuvette/i, /mating/i, /donor/i])
      expect(said, `an unknown method borrowed ${wrong}`).not.toMatch(wrong);
  });

  // **AND ONLY WHEN THE FILE SAID SOMETHING.** A session name is the lab's own word for a sitting
  // and is normally better than any one design's, so it wins — except where a design computed a
  // title from the step, which means the file said something no static name can be right about.
  // A file declaring NO method has said nothing to contradict, so the pairing stands.
  it('leaves the pairing\u2019s name alone when no method was declared', () => {
    const out = planExperiment({ cfs: [
      { name: 'pX', text: 'PCR\tbo1\tbo2\tpS\tfrag\nTransform\tfrag\tMach1\tErm\t37\tpX\n' },
      { name: 'pX', characterization: true,
        text: 'Retransform\tpX\thost=L.lactis antibiotic=Erm\tpX_h\n'
            + 'Pick\tpX_h\tn=4 phenotype=growing on the selective plate clone=L.lactis/pX\tpX_c\n'
            + 'Assay\tpX_c\tprotocol=plate_reader_fluorescence\tr\n' },
    ] });
    const bin = out.sheets.find((s) => s.operation === 'retransform');
    const d = applyDesign(bin, () => undefined,
                          { label: Object.assign(() => 'X', { of: () => null, hold: () => {} }) });
    expect(d.titleFromStep, 'it overrode a name on the strength of nothing').toBe(false);
  });
});
