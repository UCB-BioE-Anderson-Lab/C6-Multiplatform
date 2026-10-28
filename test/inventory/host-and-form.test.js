/**
 * The two fields `sample.schema` names that the inventory does not store as written.
 *
 * **THIS TEST EXISTS BECAUSE ITS ABSENCE LET A BUG THROUGH.** `findByHost` was renamed from
 * `findByStrain` by pattern substitution, which renamed the body's reference and left the
 * parameter behind — `String(host)` against `function findByHost(inv, strain)`. A full suite of
 * 1,129 passing tests said nothing, because not one of them called it. It threw on the first real
 * inventory it was pointed at.
 *
 * `host` is a stored column; `form` is derived from the sample kind and never stored.
 */
import { describe, it, expect } from 'vitest';
import { parse } from '../../src/inventory/io.js';
import { findByHost } from '../../src/inventory/query.js';

const TSV = [
  'box\twell\tconstruct\tlabel\tconcentration\tclone\thost\tculture',
  'b1\tA1\tpLYC78\tpLYC78\tminiprep\tS1\tMach1\tsecondary',
  'b1\tA2\t\t\t-80 glycerol\t\tDH10B_Alt\t',
  'b1\tA3\t\tBacillus subtilis\tgenomic\t\tBacillus subtilis\t',
  'b1\tA4\tG00101\tG00101\t100uM\t\t\t',
  'b1\tA5\tClib\tClib\tzymo\t\t\t',
].join('\n');

const inv = parse(TSV, 'b1.tsv');
const at = (well) => Object.values(inv.samples).find((s) => s.location.well === well);

describe('host', () => {
  it('is read off the column and found by name', () => {
    expect(findByHost(inv, 'Mach1').length).toBe(1);
    expect(findByHost(inv, 'DH10B_Alt').length).toBe(1);
  });

  // The case that makes the field worth having: a genomic prep has no construct, so this is the
  // only way to reach it. → `query.js § findByHost`
  it('finds a tube that has no construct at all', () => {
    const hit = findByHost(inv, 'Bacillus subtilis');
    expect(hit.length).toBe(1);
    expect(hit[0].construct).toBeFalsy();
  });

  it('does not care about case', () => {
    expect(findByHost(inv, 'mach1').length).toBe(1);
  });

  it('returns nothing rather than throwing for a host nobody has', () => {
    expect(findByHost(inv, 'MG1655')).toEqual([]);
  });
});

describe('form', () => {
  // `sample.schema`'s enum, derived from the sample kind rather than stored — so it cannot drift
  // from the column it is read off, which is how the old `type` column came to disagree.
  it('is derived for every tube whose kind places one', () => {
    expect(at('A1').form).toBe('plasmid-dna');
    expect(at('A2').form).toBe('glycerol');
    expect(at('A3').form).toBe('other');        // genomic: the enum has no word for it
    expect(at('A4').form).toBe('dna-fragment'); // an oligo, by the µM figure
  });

  // **ABSENT, NOT 'other'.** `zymo` is a column cleanup and says nothing about what was cleaned
  // up. A form invented for it would read afterwards as one somebody recorded.
  it('is absent when the kind places nothing', () => {
    expect(at('A5').form).toBeUndefined();
  });

  it('is never written back out as a column', () => {
    expect(TSV.split('\n')[0]).not.toContain('form');
  });
});
