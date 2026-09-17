/**
 * A label goes on a cap; the defined terms go in the headers.
 *
 * JCA, 2026-09-12, of a column headed `tube` holding `pcr1`: *"The terms 'label' 'side-label'
 * 'construct' and such are defined terms. Tube is not, and pcr1 is a shitty name. It is above 3
 * letters max, which is a rule for pcr tube labels."*
 *
 * **Two rules had been conflated.** cloning-tutorials keeps CONSTRUCT names to 4-6 characters; a
 * PCR tube LABEL is shorter still, because it is written on a 200 µL cap in marker, in gloves,
 * eight times in a row. And a returned labsheet is read back into the inventory, whose columns
 * are `label`, `side-label`, `construct`, `concentration`, `clone`, `culture`, `type` — a header
 * called `tube` or `product` has to be translated by whoever does that.
 */
import { describe, it, expect } from 'vitest';
import { tubeFor } from '../../src/labplanner/planning/jobsToLabSheets.js';
import { TUBE } from '../../src/labplanner/models/labsheet.js';
import { DESIGNS, applyDesign, labeller, labelPrefix, letterAt, LABEL_MAX }
  from '../../src/labplanner/design/index.js';

// The inventory's vocabulary, plus the per-operation facts a labsheet adds. Anything outside this
// is a word somebody invented for one table.
const DEFINED = new Set(['label', 'side-label', 'construct', 'concentration', 'clone', 'culture',
                         'type']);

// Derived, not written out: these tests are about the running letter and the derived-tube
// conventions, and have no opinion about what the prefix itself is. → the pinned test below.
const P = labelPrefix('Lactis3');

const sample = (over = {}) => ({ output: 'pTESTLONGNAME', inputs: ['a'], oligos: ['o1', 'o2'],
                                 productBp: 1200, params: {}, ...over });

describe('labels', () => {
  // **THE ONLY PLACE THE PREFIX'S VALUE IS PINNED.** Everything below derives it, because those
  // tests are about the running letter and the derived-tube conventions and would otherwise all
  // break together whenever the naming rule changes — which happened on 2026-09-17, and took ten
  // assertions with it that had no opinion about prefixes at all.
  it('names the experiment in two characters: its initial, then one for the whole name', () => {
    // The initial is mnemonic; the second character is a hash, so two experiments sharing an
    // initial AND a trailing digit no longer land on the same prefix.
    // → `planning/naming.js § experimentPrefix`
    expect(labelPrefix('Lactis3')).toBe('Ln');
    expect(labelPrefix('Lymph3')).toBe('L7');
    expect(labelPrefix('Cheese')).toBe('Ck');
    for (const n of ['Lactis3', 'SLIP4', 'Tlib3', 'Cheese', '', '4-way']) {
      expect(labelPrefix(n), n).toMatch(/^[A-Z][a-z0-9]$/);
    }
    // DETERMINISTIC, because a relabelled freezer is worse than a badly-labelled one.
    expect(labelPrefix('Lactis3')).toBe(labelPrefix('Lactis3'));
    expect(labelPrefix('lactis3')).toBe(labelPrefix('Lactis3'));
  });


  it('fits on a cap for the first twenty-six tubes', () => {
    const next = labeller('Lactis3');
    for (let i = 0; i < 26; i += 1) {
      expect(next().length, `tube ${i + 1}`).toBeLessThanOrEqual(LABEL_MAX);
    }
  });

  it('runs across the whole packet, not per sheet', () => {
    // JCA, 2026-09-12: *"This is a lab with 100 people. The labels need to be distinctive and
    // unique."* A freezer box holds tubes from every session at once, so a counter that restarts
    // per sheet distinguishes nothing where it matters.
    const next = labeller('Lactis3');
    const got = Array.from({ length: 30 }, () => next());
    expect(got.slice(0, 3)).toEqual([`${P}a`, `${P}b`, `${P}c`]);
    expect(new Set(got).size).toBe(30);
    expect(got[26]).toBe(`${P}aa`);                   // and it keeps going rather than repeating
  });

  it('does not restart the alphabet at z', () => {
    expect(letterAt(25)).toBe('z');
    expect(letterAt(26)).toBe('aa');
    expect(letterAt(27)).toBe('ab');
  });

  it('never invents a header where a defined term exists', () => {
    // `tube`, `plate`, `block`, `reaction` and `product` were five words for two things.
    const banned = new Set(['tube', 'plate', 'block', 'reaction', 'product']);
    for (const [op, d] of Object.entries(DESIGNS)) {
      const rows = applyDesign({ operation: op, samples: [sample()] }, () => ({}),
                               { label: labeller('Lactis3') }).columns;
      for (const row of rows) {
        for (const k of Object.keys(row)) {
          expect(banned.has(k), `${op}: column "${k}"`).toBe(false);
        }
      }
    }
  });

  it('keeps the controls out of the samples table', () => {
    // JCA, 2026-09-12: *"the actual plasmid name of the control isn't really important to the
    // instruction, I don't think we need to represent the control experiments the same way as
    // other things."* As rows they forced `construct` to hold `E1` on two and `(none)` on a third
    // — a column of names with a placeholder in it — and each took a label out of the packet's
    // running sequence for a plate that gets counted and binned.
    const design = applyDesign({ operation: 'transform',
                              samples: [sample({ params: { strain: 'M', antibiotics: 'erm' },
                                                 controlStock: 'E1',
                                                 controls: [{ kind: 'positive' },
                                                            { kind: 'negative' },
                                                            { kind: 'restreak' }] })] },
                             () => ({}), { label: labeller('Lactis3') });
    expect(design.columns).toHaveLength(1);
    expect(design.columns[0].construct).toBe('pTESTLONGNAME');
    expect(design.columns[0].label).toBe(`${P}a`);

    // They are their own table, named for the antibiotic they govern — the only thing that varies
    // between one transformation's control set and the next.
    const table = design.blocks.find((b) => b.kind === 'table');
    expect(table.rows[0]).toEqual(['plate', 'what goes on it', 'it answers']);
    expect(table.rows.slice(1).map((r) => r[0])).toEqual(['erm +', 'erm −', 'erm streak']);
    expect(design.blocks.find((b) => b.kind === 'heading').text).toContain('erm transformation');
  });
});

/**
 * A sample label and a DNA name are different things, and a labsheet must not mix them.
 *
 * JCA, 2026-09-12, of a Cleanup table whose `construct` column read `Pcon-amilGFP-Term`:
 *
 * > *"there are sample labels, and there are dna names. Often DNA names, like Pcon-amilGFP-Term,
 * > are useful in a cf because they are communicative, but no good in the lab. So, we make up
 * > labels that correspond to the samples of them. In a labsheet, you should not mix these
 * > concepts. Here you are referring to what is encoded in the dna, not what the sample is. At the
 * > bench, you primarily want to know the label, not what's in it (though is nice for sanity
 * > checking to see both)."*
 *
 * So an input made earlier in this packet is named by the TUBE THAT HOLDS IT, with the construct
 * alongside for the sanity check. A material nobody here made keeps its own name, because that is
 * what is written on the tube in the freezer.
 */
describe('labels against DNA names', () => {
  const ctx = () => {
    const label = labeller('Lactis3');
    const labelOf = (n) => label.of(n);
    return { label, labelOf, hold: label.hold, derived: label.derived,
             from: (x) => (x.inputs || []).map((n) => labelOf(n) || n).join(', ') };
  };

  it('names an input by the tube that holds it', () => {
    const c = ctx();
    DESIGNS.pcr.columns({ output: 'frag', inputs: ['pSRC'], oligos: ['o1', 'o2'] }, c);
    const gg = DESIGNS.goldengate.columns(
      { output: 'pNEW', inputs: ['frag'], params: { enzyme: 'BsaI' } }, c);
    expect(gg.fragments).toBe(`${P}a`);       // the tube, not `frag`
    expect(gg.construct).toBe('pNEW');      // and the construct still says what it is
  });

  it('keeps the freezer name for a material nobody here made', () => {
    const c = ctx();
    const row = DESIGNS.pcr.columns({ output: 'frag', inputs: ['pJ01'], oligos: ['a', 'b'] }, c);
    expect(row.template).toBe('pJ01');
  });

  it('follows the construct as it moves from tube to tube', () => {
    // The gel loads the PCR tube; the cleanup takes that tube and makes another; the assembly
    // takes the cleaned one. Reading `inputs` for the gel and the cleanup gave the PCR's
    // TEMPLATE, so the load column said `pJ01` — the tube the reaction was set up from.
    const c = ctx();
    DESIGNS.pcr.columns({ output: 'frag', inputs: ['pSRC'], oligos: ['a', 'b'] }, c);
    expect(DESIGNS.gel.columns({ output: 'frag', inputs: ['pSRC'] }, c)['loads tube'])
      .toBe(`${P}a`);
    const z = DESIGNS.zymo.columns({ output: 'frag', inputs: ['pSRC'] }, c);
    expect([z.label, z.from]).toEqual([`z${P}a`, `${P}a`]);
    expect(DESIGNS.goldengate.columns({ output: 'p', inputs: ['frag'], params: {} }, c).fragments)
      .toBe(`z${P}a`);                         // the cleaned tube, not the raw reaction
  });

  it('stops meaning the assembly tube once a clone has been verified', () => {
    // Before sequence analysis, `pBET8` is held by the Golden Gate tube. After it, the construct
    // holds its own name again — because WHICH clone is a question the sheet asks at the bench,
    // and `="pBET8-"&<the letter they typed>` is how it is answered. An earlier version held the
    // prose "the clone that passed (one of pBET8-A, pBET8-B)", which is honest and useless in a
    // column somebody reads a tube name out of. → `test/python/test_source_links.py`
    const c = ctx();
    DESIGNS.goldengate.columns({ output: 'pBET8', inputs: [], params: {} }, c);
    expect(c.labelOf('pBET8')).toBe(`${P}a`);
    DESIGNS.miniprep.columns({ output: 'pBET8-A', inputs: ['block'] }, c);
    DESIGNS.analysis.columns({ output: 'pBET8_ok', inputs: ['pBET8-A_seq'],
                               params: { verifies: 'pBET8', tubes: 'pBET8-A' } }, c);
    expect(c.labelOf('pBET8')).toBe('pBET8');
  });
});

/**
 * A cleaned tube says what it came from; a gel says it makes nothing.
 *
 * JCA, 2026-09-12, of session 4: *"You create a gel sample L3a, and then you do a cleanup
 * reaction on the gel sample, not the pcr. But you have used the same label, so it is unclear what
 * is what. Adding a z to a label is a convention for zymo. We could do that for P for PCR, G for
 * gel."*
 *
 * Two things were wrong at once. The gel's first column held a label, which reads as naming a new
 * sample — an analytical gel makes nothing, and the tube goes on to the cleanup untouched. And the
 * cleaned tube took the next free letter, so `L3c` and `L3a` looked like two unrelated tubes when
 * one is the other, cleaned.
 *
 * The z convention is already in the lab's own sheets: `pcr15` becomes `zpcr15`. A derived label
 * answers "which tube is this" and "where did it come from" in one string.
 */
describe('derived labels', () => {
  const ctx = () => {
    const label = labeller('Lactis3');
    const labelOf = (n) => label.of(n);
    return { label, labelOf, hold: label.hold, derived: label.derived,
             from: (x) => (x.inputs || []).map((n) => labelOf(n) || n).join(', ') };
  };

  it('prefixes rather than taking the next letter', () => {
    const c = ctx();
    DESIGNS.pcr.columns({ output: 'frag', inputs: ['pSRC'], oligos: ['a', 'b'] }, c);
    expect(DESIGNS.zymo.columns({ output: 'frag', inputs: ['pSRC'] }, c).label).toBe(`z${P}a`);
  });

  it('leaves the next letter free for the next thing actually made', () => {
    const c = ctx();
    DESIGNS.pcr.columns({ output: 'frag', inputs: ['pSRC'], oligos: ['a', 'b'] }, c);
    DESIGNS.zymo.columns({ output: 'frag', inputs: ['pSRC'] }, c);
    expect(DESIGNS.goldengate.columns({ output: 'p', inputs: ['frag'], params: {} }, c).label)
      .toBe(`${P}b`);
  });

  it('hands the cleaned tube to whatever consumes the construct next', () => {
    const c = ctx();
    DESIGNS.pcr.columns({ output: 'frag', inputs: ['pSRC'], oligos: ['a', 'b'] }, c);
    DESIGNS.zymo.columns({ output: 'frag', inputs: ['pSRC'] }, c);
    expect(DESIGNS.goldengate.columns({ output: 'p', inputs: ['frag'], params: {} }, c).fragments)
      .toBe(`z${P}a`);
  });

  it('does not give the gel a label column at all', () => {
    const c = ctx();
    DESIGNS.pcr.columns({ output: 'frag', inputs: ['pSRC'], oligos: ['a', 'b'] }, c);
    const row = DESIGNS.gel.columns({ output: 'frag', inputs: ['pSRC'], productBp: 900 }, c);
    expect(Object.keys(row)).not.toContain('label');
    expect(row['loads tube']).toBe(`${P}a`);
  });

  it('says on the page that nothing is recovered from a gel', () => {
    const notes = DESIGNS.gel.notes({ samples: [{ output: 'frag', productBp: 900 }] });
    expect(notes.join(' ')).toContain('no new sample');
  });
});

/**
 * Some tubes are named and some are coded, and mixing the two on one object is the bug.
 *
 * JCA, 2026-09-12: *"What you want them to write on the top of the 1.5 mL tube is
 * construct+"-"+clone, so pBET8-B and the like. You also want them to write that on the side
 * label. The unique part of that for the set is just the B, so if you were going to ask them to
 * put codes on the samples, it makes little sense to refer to them as L3h when you are also naming
 * them B."*
 *
 * Three characters is a 200 µL PCR cap, written eight times during one setup. A 1.5 mL miniprep
 * goes into a freezer box and is found there months later, where `pBET8-A` is the only thing that
 * helps and a parallel `L3i` is a second name for the same tube.
 */
describe('named tubes against coded tubes', () => {
  const ctx = () => {
    const label = labeller('Lactis3');
    const labelOf = (n) => label.of(n);
    return { label, labelOf, hold: label.hold, derived: label.derived,
             from: (x) => (x.inputs || []).map((n) => labelOf(n) || n).join(', ') };
  };

  it('labels a miniprep with its own name', () => {
    const row = DESIGNS.miniprep.columns({ output: 'pBET8-A', inputs: ['block'] }, ctx());
    expect(row.label).toBe('pBET8-A');
    expect(Object.keys(row)).not.toContain('construct');   // the label IS the construct here
  });

  it('spends no letter on it, so the sequence stays with the coded tubes', () => {
    const c = ctx();
    DESIGNS.miniprep.columns({ output: 'pBET8-A', inputs: ['b'] }, c);
    DESIGNS.miniprep.columns({ output: 'pBET8-B', inputs: ['b'] }, c);
    expect(DESIGNS.pick.columns({ output: 'x', inputs: ['y'], params: { n: '4' } }, c).label)
      .toBe(`${P}a`);
  });

  // THE LIMIT IS THE TUBE'S, AND THE DESIGN NAMES THE TUBE RATHER THAN THE NUMBER. This used to
  // assert `DESIGNS.miniprep.labelMax > LABEL_MAX`, and the number it was asserting about was 24
  // — not a tube, just the check turned off. `TUBE_FOR` maps the operation to what it writes on
  // and `TUBE` holds the cap, so there is one table instead of a number per design.
  it('declares a limit that suits the tube it is written on', () => {
    expect(TUBE[tubeFor('miniprep')].cap).toBeGreaterThan(LABEL_MAX);
    expect(TUBE[tubeFor('pcr')].cap).toBe(LABEL_MAX);
    expect(TUBE[tubeFor('sequencing')].cap).toBe(TUBE[tubeFor('miniprep')].cap + 1);
  });

  it('asks for the name on the cap and on the side', () => {
    expect(DESIGNS.miniprep.notes({}).join(' ')).toMatch(/cap AND on the side/);
  });

  it('gives a sequencing reaction the name its trace file will come back under', () => {
    // JCA, 2026-09-12: *"Just 'B' will not be enough to distinguish samples."* A bare letter is
    // unique on the strip and nowhere else, and the file lands beside every other experiment's.
    const row = DESIGNS.sequencing.columns({ output: 'pBET8-B_seq', inputs: ['pBET8-B'],
                                            params: {} }, ctx());
    expect(row.label).toBe('pBET8-B');
    expect(row.template).toBe('pBET8-B');
    const two = DESIGNS.sequencing.columns({ output: 'pBET8-BF_seq', inputs: ['pBET8-B'],
                                            params: {} }, ctx());
    expect(two.label).toBe('pBET8-BF');
  });
});

/**
 * Two tubes under one label — the scope is the sitting, and the key is the plastic.
 *
 * JCA, 2026-09-15: *"Certainly in one experiment, you don't want to label two samples in the same
 * set the same way. It wouldn't really hurt anything if you labeled the pcr and a golden gate the
 * same label… The concern would be two pcrs with the same label happening at the same time and
 * becoming a real ambiguity in the lab."*
 *
 * **THE OLD CHECK WAS WRONG IN BOTH DIRECTIONS**, and neither could be seen from inside it: it
 * refused a duplicate WITHIN ONE SECTION, and a sitting holds several. So it permitted two
 * sections of one sheet putting one string on one kind of tube, and it allowed the miniprep /
 * sequencing pair only by the accident of their being two sections rather than because the rule
 * says they may.
 */
import { createLabSheet, addSample, addSection, labelsOf }
  from '../../src/labplanner/models/labsheet.js';

describe('two tubes under one label', () => {
  const sheet = () => createLabSheet({ id: 's7-miniprep-sequencing', title: 'Miniprep',
                                       operation: 'miniprep', columns: ['label', 'from'],
                                       tube: 'micro' });

  it('refuses two of one kind in one sitting, even across two sections', () => {
    const sh = sheet();
    addSample(sh, { label: 'pBET8-A', from: 'L3d' });
    // A SECOND SECTION OF THE SAME PAGE, on the same plastic. The old per-section check could not
    // see the section beside it and this passed silently.
    expect(() => addSection(sh, { title: 'Secondary minipreps', columns: ['label'], tube: 'micro',
                                  rows: [{ label: 'pBET8-A' }] }))
      .toThrow(/used twice/);
  });

  it('and names both places, so the second one is not the only clue', () => {
    const sh = sheet();
    addSample(sh, { label: 'pBET8-A', from: 'L3d' });
    expect(() => addSection(sh, { title: 'Secondary minipreps', columns: ['label'], tube: 'micro',
                                  rows: [{ label: 'pBET8-A' }] }))
      .toThrow(/1\.5 mL/);
  });

  // **THE CASE THE TOOLKIT RELIES ON.** Every verification sheet does this: the miniprep is
  // `pBET8-A` on a 1.5 mL and the sequencing reaction beside it is `pBET8-A` on a tube that leaves
  // the building. `naming.js § READ_SUFFIXES` calls it deliberate — the file that comes back is
  // named for what was on the tube.
  it('allows one name on two kinds of tube, which the verification sheet depends on', () => {
    const sh = sheet();
    addSample(sh, { label: 'pBET8-A', from: 'L3d' });
    expect(() => addSection(sh, { title: 'Sequencing', columns: ['label', 'template', 'oligo'],
                                  tube: 'sequencing',
                                  rows: [{ label: 'pBET8-A', template: 'pBET8-A', oligo: 'G00101' }] }))
      .not.toThrow();
  });

  it('does not reach across sittings, because one folder cannot see the lab', () => {
    const a = sheet();
    const b = sheet();
    addSample(a, { label: 'pBET8-A', from: 'L3d' });
    expect(() => addSample(b, { label: 'pBET8-A', from: 'L3d' })).not.toThrow();
  });

  // `labelsOf` READ `s.label` ONLY, and five columns can carry a label. On a picking sheet — whose
  // column is `well` — it returned nothing at all, and it was exported, documented as the thing
  // the next sheet resolves its inputs through, and called by nobody.
  it('reports every label the sitting wrote, whichever column carried it', () => {
    const sh = createLabSheet({ id: 's10-pick', title: 'Picking', operation: 'pick',
                               columns: ['well', 'clone'], tube: 'block' });
    addSample(sh, { well: 'A1', clone: 'B.subtilis/pBET8-A' });
    addSample(sh, { well: 'B1', clone: 'B.subtilis/pBET8-B' });
    addSection(sh, { title: 'Culture', columns: ['label', 'medium'], tube: 'none',
                     rows: [{ label: 'L3h', medium: 'LB+Kan' }] });
    expect(labelsOf(sh)).toEqual(['A1', 'B1', 'L3h']);
  });
});
