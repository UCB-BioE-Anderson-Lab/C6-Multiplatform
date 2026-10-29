import { describe, it, expect } from 'vitest';
import { group, retype, toFeatureDb, experimentOf } from '../src/features/library.js';
import { annotateTolerant } from '../src/features/tolerant.js';
import { revcomp } from '../src/C6-Seq.js';

// A 60 bp stand-in for a promoter, and a 1-substitution copy of it under another name.
const P = 'TTGACAGCTAGCTCAGTCCTAGGTATAATGCTAGCGAATTCGAGCTCGGTACCCGGGGATC';
const P1 = P.slice(0, 30) + (P[30] === 'A' ? 'C' : 'A') + P.slice(31);
const src = (path) => ({ repo: 'R', path, experiment: null, location: null });

describe('feature library', () => {
  it('collapses one sequence under several names into one entry, reverse complements included', () => {
    const { groups } = group([
      { name: 'Pbad', sequence: P, type: 'promoter', source: src('a.gb') },
      { name: 'pBad promoter', sequence: revcomp(P), type: 'misc_feature', source: src('b.gb') },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].reference.aliases).toEqual(['pBad promoter']);
    expect(groups[0].stage).toBe('dna');
    expect(groups[0].sources).toHaveLength(2);
  });

  it('puts a point mutant in its parent group as a known variant; the most-seen member is the reference', () => {
    const { groups } = group([
      { name: 'Pbad', sequence: P, type: 'promoter', source: src('a.gb') },
      { name: 'Pbad', sequence: P, type: 'promoter', source: src('c.gb') },
      { name: 'Pbad-mut', sequence: P1, type: 'misc_feature', source: src('b.gb') },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].reference.name).toBe('Pbad');
    expect(groups[0].variants[0]).toMatchObject({ name: 'Pbad-mut', relation: { kind: 'substitution', mismatches: 1 } });
  });

  it('types a misc_feature by name, and says it guessed', () => {
    expect(retype({ name: 'R6K', type: 'misc_feature', sequence: 'A' })).toEqual({ type: 'rep_origin', typedBy: 'name' });
    expect(retype({ name: 'pBad', type: 'misc_feature', sequence: 'A' })).toEqual({ type: 'promoter', typedBy: 'name' });
    expect(retype({ name: 'whatever', type: 'misc_feature', sequence: 'ACGT' }).typedBy).toBeNull();
  });

  it('stages sub-features and cloning landmarks the file left as misc_feature', () => {
    const stage = (name, type = 'misc_feature') => group([{ name, sequence: P, type, source: src('a.gb') }]).groups[0].stage;
    expect(stage('spacer')).toBe('annotation');
    expect(stage('GSA Linker')).toBe('annotation');
    expect(stage('bind_for(3)')).toBe('cloning');
    expect(stage('NotI(1)')).toBe('cloning');
    expect(stage('attP1')).toBe('dna');
    expect(stage('source:synthetic DNA construct', 'source')).toBe('annotation');
  });

  it('joins same-named parts that overlap, and gives same-named different parts their own ids', () => {
    const other = 'GACTGACTGGCCATTAGCAGTCCATGGATCCTTAGCAAGTCGCATGCCGTAGCTAAGCT';
    const { groups, nameClashes, nameMerges } = group([
      { name: 'AmpR promoter', sequence: P, type: 'promoter', source: src('a.gb') },
      { name: 'AmpR promoter', sequence: 'GGGGG' + P.slice(10), type: 'promoter', source: src('b.gb') },
      { name: 'CDS', sequence: other, type: 'CDS', source: src('c.gb') },
      { name: 'CDS', sequence: other.split('').reverse().join(''), type: 'CDS', source: src('d.gb') },
    ]);
    expect(nameMerges).toBe(1);
    expect(groups.find(g => g.id === 'AmpR promoter').variants[0].relation.kind).toBe('same-name overlap');
    expect(nameClashes).toEqual([{ name: 'CDS', ids: ['CDS', `CDS [${other.length} bp]`] }]);
  });

  it('feeds the tolerant annotator, which reports the group a hit belongs to', () => {
    const { groups } = group([{ name: 'Pbad', sequence: P, type: 'promoter', source: src('a.gb') }]);
    const mutant = 'GGGGGGGGGG' + P1 + 'CCCCCCCCCC';
    const { features } = annotateTolerant(mutant, toFeatureDb(groups));
    expect(features).toHaveLength(1);
    expect(features[0]).toMatchObject({ label: 'Pbad', match: 'variant', mismatches: 1, group: 'Pbad', knownVariant: false });
  });

  it('names the experiment from the Experiments/ folder', () => {
    expect(experimentOf('Experiments/Tlib3/maps/p.gb')).toBe('Tlib3');
    expect(experimentOf('maps/p.gb')).toBe('maps');
  });
});
