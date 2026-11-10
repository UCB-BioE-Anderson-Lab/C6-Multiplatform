// Phosphorylate and dephosphorylate — the two Steps a KLD needs.
//
// WHY THESE EXIST. A PCR product is built hydroxyl/hydroxyl (`dsDNA()`, "It lacks 5' phosphates")
// because polymerase copies from unphosphorylated primers, and `ligate` refuses a junction with
// no phosphate on either side. So before 2026-11-10 a KLD — the standard way to close a
// site-directed mutagenesis PCR — could not be written as a construction file at all: neither
// `pcr / ligate` nor any composite verb existed. JCA, 2026-11-10: *"phosphorylate and de
// phosphorylate should be in there. Be sure to include comprehensive tests."*
//
// The tests below are the comprehensive part, and they are deliberately in four layers: the
// chemistry on one molecule, the parser, whole construction files through `simCF`, and the
// planner's tables. A kinase that works in isolation and is invisible to the validator is the
// failure this file is shaped to catch.

import { describe, it, expect } from 'vitest';
import { dsDNA, plasmid, oligo, Polynucleotide } from 'src/C6-Seq.js';
import { phosphorylate, dephosphorylate, ligate, digest, parseCF, simCF } from 'src/C6-Sim.js';
import { KNOWN_OPERATIONS, unknownOperations, validateConstructionFile } from 'src/labplanner/validate/constructionFile.js';
import { DNA_INPUTS } from 'src/labplanner/planning/job.js';

describe('phosphorylate / dephosphorylate — one molecule', () => {
  it('a PCR-like dsDNA starts with no 5-prime phosphates', () => {
    // The premise everything else rests on. If this ever changes, the KLD story changes with it.
    const frag = dsDNA('AAAGGATCCTTTGAATTCAAACCCGGGTTT');
    expect(frag.mod_ext5).toBe('hydroxyl');
    expect(frag.mod_ext3).toBe('hydroxyl');
  });

  it('phosphorylate puts phos5 on both 5-prime ends of a duplex', () => {
    const out = phosphorylate(dsDNA('AAAGGATCCTTTGAATTCAAACCCGGGTTT'));
    expect(out.mod_ext5).toBe('phos5');
    expect(out.mod_ext3).toBe('phos5');
  });

  it('dephosphorylate puts both back to hydroxyl', () => {
    const out = dephosphorylate(phosphorylate(dsDNA('AAAGGATCCTTTGAATTCAAACCCGGGTTT')));
    expect(out.mod_ext5).toBe('hydroxyl');
    expect(out.mod_ext3).toBe('hydroxyl');
  });

  it('both are idempotent, as in the tube', () => {
    const once = phosphorylate(dsDNA('AAAGGATCCTTTGAATTCAAA'));
    const twice = phosphorylate(once);
    expect(twice.mod_ext5).toBe('phos5');
    expect(twice.mod_ext3).toBe('phos5');

    const stripped = dephosphorylate(dephosphorylate(once));
    expect(stripped.mod_ext5).toBe('hydroxyl');
    expect(stripped.mod_ext3).toBe('hydroxyl');
  });

  it('nothing but the ends changes — sequence, extensions and topology survive', () => {
    const frag = new Polynucleotide('GGATCCTTTGAATTCAAACCCGGG', 'AATT', 'GGCC', true, false, false,
                                    'hydroxyl', 'hydroxyl');
    const out = phosphorylate(frag);
    expect(out.sequence).toBe(frag.sequence);
    expect(out.ext5).toBe('AATT');
    expect(out.ext3).toBe('GGCC');
    expect(out.isDoubleStranded).toBe(true);
    expect(out.isCircular).toBe(false);
    expect(out.isRNA).toBe(false);
  });

  it('the input is not mutated — the step returns a new molecule', () => {
    const frag = dsDNA('AAAGGATCCTTTGAATTCAAA');
    phosphorylate(frag);
    expect(frag.mod_ext5, 'phosphorylate mutated its input').toBe('hydroxyl');
  });

  it('a single-stranded oligo gets its one 5-prime end, and mod_ext3 is left alone', () => {
    // An oligo has ONE 5' end. `mod_ext3` describes a strand that is not there, so inventing a
    // value for it would be a fact the molecule does not have.
    const o = oligo('AAAGGATCCTTTGAATTCAAA');
    const before = o.mod_ext3;
    const out = phosphorylate(o);
    expect(out.mod_ext5).toBe('phos5');
    expect(out.mod_ext3).toBe(before);
    expect(out.isDoubleStranded).toBe(false);
  });

  it('a circular DNA is refused by both, because it has no ends', () => {
    const p = plasmid('AAAGGATCCTTTGAATTCAAACCCGGGTTTAAAGGATCC');
    expect(() => phosphorylate(p)).toThrow(/circular/i);
    expect(() => dephosphorylate(p)).toThrow(/circular/i);
    // The message has to say what to do instead, or it reads as a toolchain limit.
    expect(() => dephosphorylate(p)).toThrow(/digest|lineariz/i);
  });

  it("a library's variable regions ride through untouched", () => {
    const frag = dsDNA('AAAGGATCCTTTGAATTCAAACCCGGGTTT');
    frag.slots = [{ start: 3, end: 9, bin: ['GGATCC', 'GGTACC'] }];
    frag.occupancy = 'dense';
    const out = phosphorylate(frag);
    expect(out.slots).toEqual(frag.slots);
    expect(out.occupancy).toBe('dense');
  });
});

describe('phosphorylate / dephosphorylate — what ligate then does', () => {
  it('an unphosphorylated blunt fragment does not circularize, and a phosphorylated one does', () => {
    const frag = dsDNA('AAAGGATCCTTTGAATTCAAACCCGGGTTTACGTACGTAAA');
    expect(() => ligate([frag]), 'hydroxyl ends must not close').toThrow(/circular/i);

    const closed = ligate([phosphorylate(frag)]);
    expect(closed.isCircular).toBe(true);
    expect(closed.sequence).toBe(frag.sequence);
  });

  it('a dephosphorylated cut vector cannot self-ligate', () => {
    // The whole point of the phosphatase: strip the vector so vector-to-vector is dead, while a
    // phosphorylated insert still supplies the phosphate at each junction.
    const frag = phosphorylate(dsDNA('AAAGGATCCTTTGAATTCAAACCCGGGTTTACGTACGTAAA'));
    expect(ligate([frag]).isCircular).toBe(true);
    expect(() => ligate([dephosphorylate(frag)])).toThrow(/circular/i);
  });

  it('a sticky-ended digestion fragment can be stripped and then refuses to close', () => {
    // digest() hands back phos5 ends, as a restriction enzyme does.
    const cut = digest(plasmid('aaaGAATTCtttgcggccgcaaaccgGAATTCtttacgtacgtaaacccgggtttaaa'), ['EcoRI'], 0);
    expect(cut.mod_ext5).toBe('phos5');
    expect(ligate([cut]).isCircular).toBe(true);
    expect(() => ligate([dephosphorylate(cut)])).toThrow(/circular/i);
  });
});

describe('phosphorylate / dephosphorylate — the parser', () => {
  it('reads a phosphorylate line', () => {
    const cf = parseCF('dsdna frag AAAGGATCCTTTGAATTCAAA\nphosphorylate\tfrag\tpfrag');
    expect(cf.steps).toEqual([{ operation: 'Phosphorylate', dna: 'frag', output: 'pfrag' }]);
  });

  it('reads a dephosphorylate line', () => {
    const cf = parseCF('dsdna vec AAAGGATCCTTTGAATTCAAA\ndephosphorylate\tvec\tdvec');
    expect(cf.steps).toEqual([{ operation: 'Dephosphorylate', dna: 'vec', output: 'dvec' }]);
  });

  it('is case-insensitive, like every other verb', () => {
    const cf = parseCF('dsdna frag AAAGGATCCTTTGAATTCAAA\nPHOSPHORYLATE\tfrag\tpfrag');
    expect(cf.steps[0].operation).toBe('Phosphorylate');
  });

  it('a line missing its product says what the step needs', () => {
    expect(() => parseCF('phosphorylate\tfrag'))
      .toThrow(/Phosphorylate step requires 3 fields/);
  });
});

describe('a KLD as a whole construction file', () => {
  // Back-to-back primers on a plasmid: the forward carries the mutation, the two read outward
  // from the same point, and the linear product is the whole plasmid once round.
  const template = 'AAACCCGGGTTTACGTACGTAAAGGATCCTTTGAATTCAAACATCATCATGGTGGTGGTTAACTGACTGACTGAATTTT';
  const fwd = 'GGATCCTTTGAATTCAAACATCATCATGG';          // anneals at the BamHI site, reads right
  const rev = 'TTACGTACGTAAACCCGGGTTT';                   // reads left from just before it

  it('pcr then ligate fails — the product has no phosphates', () => {
    const cf = parseCF(
      `plasmid tmpl ${template}\noligo fwd ${fwd}\noligo rev ${rev}\n` +
      `pcr\tfwd\trev\ttmpl\tlin\nligate\tlin\tprod`);
    expect(() => simCF(cf)).toThrow(/circular/i);
  });

  it('pcr, phosphorylate, ligate closes the plasmid — this is the KLD', () => {
    const cf = parseCF(
      `plasmid tmpl ${template}\noligo fwd ${fwd}\noligo rev ${rev}\n` +
      `pcr\tfwd\trev\ttmpl\tlin\nphosphorylate\tlin\tplin\nligate\tplin\tprod`);
    const out = simCF(cf);
    const byName = Object.fromEntries(out);
    expect(byName.plin.mod_ext5).toBe('phos5');
    expect(byName.prod.isCircular).toBe(true);
    // The closed product is the linear product, nothing added or lost.
    expect(byName.prod.sequence).toBe(byName.lin.sequence);
  });

  it('dephosphorylate runs as a step and leaves the sequence alone', () => {
    const cf = parseCF(
      `dsdna frag AAAGGATCCTTTGAATTCAAACCCGGGTTTACGTACGTAAA\n` +
      `phosphorylate\tfrag\tpfrag\ndephosphorylate\tpfrag\tdfrag`);
    const byName = Object.fromEntries(simCF(cf));
    expect(byName.dfrag.mod_ext5).toBe('hydroxyl');
    expect(byName.dfrag.mod_ext3).toBe('hydroxyl');
    expect(byName.dfrag.sequence).toBe(byName.pfrag.sequence);
  });
});

describe('the planner knows both verbs', () => {
  it('they are known operations, so the validator does not report a toolchain gap', () => {
    expect(KNOWN_OPERATIONS).toContain('phosphorylate');
    expect(KNOWN_OPERATIONS).toContain('dephosphorylate');
    expect(unknownOperations('phosphorylate\tfrag\tpfrag\ndephosphorylate\tvec\tdvec')).toEqual([]);
  });

  it('their input is a dependency edge, so a KLD file has no dangling product', () => {
    expect(DNA_INPUTS.phosphorylate).toEqual(['dna']);
    expect(DNA_INPUTS.dephosphorylate).toEqual(['dna']);

    const text = 'pcr\tfwd\trev\ttmpl\tlin\nphosphorylate\tlin\tplin\nligate\tplin\tprod';
    const report = validateConstructionFile(text, 'kld.txt');
    const codes = (report.findings || []).map((f) => f.code);
    expect(codes, JSON.stringify(report.findings)).not.toContain('UNKNOWN_OPERATION');
    // `lin` and `plin` are each consumed by the next step; only `prod` is a final product.
    expect(codes).not.toContain('UNUSED_PRODUCT');
    expect(codes).not.toContain('MISSING_INPUT');
  });
});
