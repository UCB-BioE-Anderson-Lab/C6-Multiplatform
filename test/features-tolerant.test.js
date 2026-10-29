import { annotateTolerant, validateFeatureDb, codingEffect } from 'src/features/tolerant.js';
import { revcomp } from 'src/C6-Seq.js';

/**
 * Point-mutant annotation. Before this, one substitution anywhere in a feature made it vanish
 * from the annotation with nothing to say a near-match was there.
 */
const FILL = 'CCGGTTAACCGGTTAACCGG';
// 10 codons: M K L V T S G A E stop
const CDS = 'ATGAAACTGGTTACCTCAGGTGCAGAATAA';
const PROM = 'TTGACAGCTAGCTCAGTCCTAGGTATAATGCTAGC';
const db = [
  { Name: 'gene', Sequence: CDS, Type: 'CDS', Color: 'red' },
  { Name: 'prom', Sequence: PROM, Type: 'promoter', Color: 'blue' },
];
const mutate = (s, i, b) => s.slice(0, i) + b + s.slice(i + 1);

describe('annotateTolerant', () => {
  test('an exact feature is still exact', () => {
    const { features } = annotateTolerant(FILL + PROM + FILL, db);
    const hit = features.find((f) => f.label === 'prom' && f.strand === 1);
    expect(hit.match).toBe('exact');
    expect(hit.start).toBe(FILL.length);
  });

  test('a promoter with one substitution is found as a variant, with the difference', () => {
    const { features } = annotateTolerant(FILL + mutate(PROM, 10, 'A') + FILL, db);
    const hit = features.find((f) => f.label === 'prom');
    expect(hit.match).toBe('variant');
    expect(hit.differences).toEqual([{ pos: 10, ref: PROM[10], alt: 'A' }]);
    expect(hit.coding).toBeUndefined();
  });

  test('a CDS variant says whether it is silent, missense or nonsense', () => {
    const silent = annotateTolerant(FILL + mutate(CDS, 8, 'A') + FILL, db).features;   // CTG→CTA, L
    expect(silent.find((f) => f.label === 'gene').coding.effect).toBe('synonymous');
    const missense = annotateTolerant(FILL + mutate(CDS, 3, 'G') + FILL, db).features; // AAA→GAA, K→E
    expect(missense.find((f) => f.label === 'gene').coding.changes[0].change).toBe('K2E');
    const nonsense = annotateTolerant(FILL + mutate(CDS, 3, 'T') + FILL, db).features; // AAA→TAA
    expect(nonsense.find((f) => f.label === 'gene').coding.effect).toBe('nonsense');
  });

  test('a variant on the reverse strand is found', () => {
    const { features } = annotateTolerant(FILL + revcomp(mutate(PROM, 20, 'C')) + FILL, db);
    const hit = features.find((f) => f.label === 'prom');
    expect(hit.strand).toBe(-1);
    expect(hit.match).toBe('variant');
  });

  test('too many substitutions is not a variant', () => {
    let p = PROM;
    for (const i of [2, 9, 16, 23, 30]) p = mutate(p, i, p[i] === 'A' ? 'C' : 'A');
    expect(annotateTolerant(FILL + p + FILL, db).features.some((f) => f.label === 'prom')).toBe(false);
  });

  test('a near-twin entry does not shadow the exact one', () => {
    const twins = [...db, { Name: 'prom-1bp', Sequence: mutate(PROM, 10, 'A'), Type: 'promoter' }];
    const hits = annotateTolerant(FILL + PROM + FILL, twins).features.filter((f) => f.strand === 1);
    expect(hits.map((f) => f.label)).toEqual(['prom']);
  });

  test('a bad library row is skipped and reported, and the rest still annotate', () => {
    const bad = [{ Name: 'broken', Sequence: 'ACGT<ACGT', Type: 'misc_feature' }, ...db];
    expect(validateFeatureDb(bad).invalid.map((r) => r.name)).toEqual(['broken']);
    const { features, skipped } = annotateTolerant(FILL + PROM + FILL, bad);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].row).toBe(0);
    expect(features.some((f) => f.label === 'prom')).toBe(true);
  });

  test('codingEffect abstains on a reference that is not whole codons', () => {
    expect(codingEffect('ATGAA', 'ATGAT', [{ pos: 4, ref: 'A', alt: 'T' }])).toBeNull();
  });
});

describe('annotateTolerant with degenerate library entries', () => {
  test('an entry with an N-run still finds a point mutant', () => {
    const withN = CDS.slice(0, 12) + 'NNNNNN' + CDS.slice(18);
    const ndb = [{ Name: 'geneN', Sequence: withN, Type: 'CDS' }];
    const hit = annotateTolerant(FILL + mutate(CDS, 25, 'C') + FILL, ndb).features.find((f) => f.label === 'geneN');
    expect(hit.match).toBe('variant');
    expect(hit.differences.map((d) => d.pos)).toEqual([25]);
    expect(hit.coding).toBeNull();     // a degenerate reference has no codons to compare
  });
});
