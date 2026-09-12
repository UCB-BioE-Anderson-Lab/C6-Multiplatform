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
import { DESIGNS, applyDesign, labeller, labelPrefix, letterAt, LABEL_MAX }
  from '../../src/labplanner/design/index.js';

// The inventory's vocabulary, plus the per-operation facts a labsheet adds. Anything outside this
// is a word somebody invented for one table.
const DEFINED = new Set(['label', 'side-label', 'construct', 'concentration', 'clone', 'culture',
                         'type']);

const sample = (over = {}) => ({ output: 'pTESTLONGNAME', inputs: ['a'], oligos: ['o1', 'o2'],
                                 productBp: 1200, params: {}, ...over });

describe('labels', () => {
  it('names the experiment in two characters', () => {
    expect(labelPrefix('Lactis3')).toBe('L3');
    expect(labelPrefix('SLIP4')).toBe('S4');
    expect(labelPrefix('Tlib3')).toBe('T3');
    expect(labelPrefix('Cheese')).toBe('Ch');       // no number to take
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
    expect(got.slice(0, 3)).toEqual(['L3a', 'L3b', 'L3c']);
    expect(new Set(got).size).toBe(30);
    expect(got[26]).toBe('L3aa');                   // and it keeps going rather than repeating
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

  it('uses `construct` to mean the construct, on every row of a table', () => {
    // A transformation's controls put "positive control" in that column — a name on three rows
    // and a role on two, in one table the inventory reads back by its defined meaning.
    const rows = applyDesign({ operation: 'transform',
                              samples: [sample({ params: { strain: 'M', antibiotics: 'erm' },
                                                 controlStock: 'E1',
                                                 controls: [{ kind: 'positive', construct: 'E1',
                                                              dna: 'E1 plasmid', strain: null,
                                                              answers: 'a' },
                                                            { kind: 'negative', construct: '(none)',
                                                              dna: 'none', strain: null,
                                                              answers: 'b' }] })] },
                             () => ({}), { label: labeller('Lactis3') }).columns;
    expect(rows.map((r) => r.construct)).toEqual(['pTESTLONGNAME', 'E1', '(none)']);
    // Each plate takes its own label from the running sequence; a suffixed `L3a+` would be four
    // characters and a second naming scheme on one page.
    expect(rows.map((r) => r.label)).toEqual(['L3a', 'L3b', 'L3c']);
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
    expect(gg.fragments).toBe('L3a');       // the tube, not `frag`
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
      .toBe('L3a');
    const z = DESIGNS.zymo.columns({ output: 'frag', inputs: ['pSRC'] }, c);
    expect([z.label, z.from]).toEqual(['zL3a', 'L3a']);
    expect(DESIGNS.goldengate.columns({ output: 'p', inputs: ['frag'], params: {} }, c).fragments)
      .toBe('zL3a');                         // the cleaned tube, not the raw reaction
  });

  it('stops meaning the assembly once a clone has been verified', () => {
    // Before sequence analysis, "pBET8" is the Golden Gate reaction. After it, it is whichever
    // miniprep passed — and WHICH one is written on that sheet, not decided here. Naming the
    // assembly tube would send somebody to electroporate an unverified reaction.
    const c = ctx();
    DESIGNS.goldengate.columns({ output: 'pBET8', inputs: [], params: {} }, c);
    expect(c.labelOf('pBET8')).toBe('L3a');
    DESIGNS.miniprep.columns({ output: 'mp1', inputs: ['block'] }, c);
    DESIGNS.analysis.columns({ output: 'pBET8_ok', inputs: ['seq1'],
                               params: { verifies: 'pBET8', tubes: 'mp1' } }, c);
    expect(c.labelOf('pBET8')).toBe('the verified clone (one of L3b)');
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
    expect(DESIGNS.zymo.columns({ output: 'frag', inputs: ['pSRC'] }, c).label).toBe('zL3a');
  });

  it('leaves the next letter free for the next thing actually made', () => {
    const c = ctx();
    DESIGNS.pcr.columns({ output: 'frag', inputs: ['pSRC'], oligos: ['a', 'b'] }, c);
    DESIGNS.zymo.columns({ output: 'frag', inputs: ['pSRC'] }, c);
    expect(DESIGNS.goldengate.columns({ output: 'p', inputs: ['frag'], params: {} }, c).label)
      .toBe('L3b');
  });

  it('hands the cleaned tube to whatever consumes the construct next', () => {
    const c = ctx();
    DESIGNS.pcr.columns({ output: 'frag', inputs: ['pSRC'], oligos: ['a', 'b'] }, c);
    DESIGNS.zymo.columns({ output: 'frag', inputs: ['pSRC'] }, c);
    expect(DESIGNS.goldengate.columns({ output: 'p', inputs: ['frag'], params: {} }, c).fragments)
      .toBe('zL3a');
  });

  it('does not give the gel a label column at all', () => {
    const c = ctx();
    DESIGNS.pcr.columns({ output: 'frag', inputs: ['pSRC'], oligos: ['a', 'b'] }, c);
    const row = DESIGNS.gel.columns({ output: 'frag', inputs: ['pSRC'], productBp: 900 }, c);
    expect(Object.keys(row)).not.toContain('label');
    expect(row['loads tube']).toBe('L3a');
  });

  it('says on the page that nothing is recovered from a gel', () => {
    const notes = DESIGNS.gel.notes({ samples: [{ output: 'frag', productBp: 900 }] });
    expect(notes.join(' ')).toContain('no new sample');
  });
});
