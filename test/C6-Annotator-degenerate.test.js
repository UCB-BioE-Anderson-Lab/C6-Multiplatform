import { annotateSequence } from 'src/C6-Annotator.js';

/**
 * Degenerate (IUPAC) feature patterns.
 *
 * These all failed before the matcher understood degeneracy, and they failed SILENTLY: the
 * pattern `GGTCTCnNNNN` was looked for as that literal string, found nowhere, and the annotation
 * came back without it looking perfectly complete. The first four tests are the capability; the
 * rest are the guards that keep it from becoming noise.
 */
describe('annotateSequence with IUPAC patterns', () => {
  const labelsOf = (a) => a.map((x) => x.label);

  test('a type IIS site written with its cut geometry is found', () => {
    const db = [{ Name: 'BsaI', Sequence: 'GGTCTCnNNNN', Type: 'restriction_site', Color: '#c9cc9d' }];
    const a = annotateSequence('AAAAAGGTCTCATTGCAAAAA', db);
    expect(labelsOf(a)).toContain('BsaI');
    const hit = a.find((x) => x.label === 'BsaI' && x.strand === 1);
    expect(hit.start).toBe(5);
    expect(hit.end).toBe(16);          // the whole pattern, recognition plus spacer plus overhang
  });

  test('a consensus with variable spacers is found', () => {
    const db = [{ Name: 'Promoter pattern', Sequence: 'TTTACAnnnnnnnnnnnnnnnnnTATTATnnnnnnA', Type: 'promoter', Color: 'DodgerBlue' }];
    //                         TTTACA + 17 any + TATTAT + 6 any + A
    const seq = 'CCC' + 'TTTACA' + 'GGCTAGCTAGCTAGCTA' + 'TATTAT' + 'GCATGC' + 'A' + 'GGG';
    const a = annotateSequence(seq, db);
    expect(labelsOf(a)).toContain('Promoter pattern');
    expect(a.find((x) => x.strand === 1).start).toBe(3);
  });

  test('a degenerate pattern is found on the reverse strand too', () => {
    const db = [{ Name: 'BsaI', Sequence: 'GGTCTCnNNNN', Type: 'restriction_site', Color: '#c9cc9d' }];
    // revcomp('GGTCTCATTGC') -- the site reads on the bottom strand only.
    const a = annotateSequence('AAAAAGCAATGAGACCAAAAA', db);
    expect(a.some((x) => x.label === 'BsaI' && x.strand === -1)).toBe(true);
    expect(a.some((x) => x.label === 'BsaI' && x.strand === 1)).toBe(false);
  });

  test('R, Y and the other two-base codes match only their own bases', () => {
    const db = [{ Name: 'purine start', Sequence: 'RRRRACGTACGT', Type: 'misc_feature', Color: 'grey' }];
    expect(labelsOf(annotateSequence('TTAGAGACGTACGTTT', db))).toContain('purine start');
    expect(labelsOf(annotateSequence('TTCTCTACGTACGTTT', db))).not.toContain('purine start');
  });

  test('overlapping degenerate hits are all reported', () => {
    const db = [{ Name: 'AT repeat', Sequence: 'ATATATATNN', Type: 'misc_feature', Color: 'grey' }];
    const a = annotateSequence('ATATATATATATATAT', db).filter((x) => x.strand === 1);
    // A greedy scan that consumed each match would find one; the pattern fits at 0, 2 and 4.
    expect(a.length).toBeGreaterThan(1);
    expect(a.map((x) => x.start)).toEqual([...new Set(a.map((x) => x.start))]);
  });

  test("an N in the SEQUENCE does not satisfy a concrete base in the pattern", () => {
    const db = [{ Name: 'T7 Promoter', Sequence: 'TAATACGACTCACTATAGGG', Type: 'promoter', Color: '#ff0000' }];
    expect(labelsOf(annotateSequence('GAAATTAATACGACTCACTATAGGGGAAT', db))).toContain('T7 Promoter');
    // One base of the read is unknown. The feature is absent, not assumed.
    expect(labelsOf(annotateSequence('GAAATTAATACGACTCNCTATAGGGGAAT', db))).not.toContain('T7 Promoter');
  });

  test("an N in the sequence DOES satisfy an N in the pattern", () => {
    const db = [{ Name: 'BsaI', Sequence: 'GGTCTCnNNNN', Type: 'restriction_site', Color: '#c9cc9d' }];
    expect(labelsOf(annotateSequence('AAAAAGGTCTCANNGCAAAAA', db))).toContain('BsaI');
  });

  test('a pattern with too few concrete bases is refused rather than matching everywhere', () => {
    const db = [{ Name: 'almost nothing', Sequence: 'ACGNNNNNNNNNNN', Type: 'misc_feature', Color: 'grey' }];
    expect(annotateSequence('ACGTTTTTTTTTTTTTTTTTTTTTTTTTTTTT', db)).toEqual([]);
  });

  test('exact patterns behave exactly as they did before', () => {
    const db = [
      { Name: 'T7 Promoter', Sequence: 'TAATACGACTCACTATAGGG', Type: 'promoter', Color: '#ff0000' },
      { Name: 'too short', Sequence: 'ACGTACGT', Type: 'misc_feature', Color: 'grey' }
    ];
    const a = annotateSequence('GAAATTAATACGACTCACTATAGGGACGTACGTGAAT', db);
    expect(labelsOf(a)).toContain('T7 Promoter');
    expect(labelsOf(a)).not.toContain('too short');   // the <10 rule is unchanged
  });
});
