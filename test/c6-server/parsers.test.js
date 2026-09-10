import { describe, it, expect } from 'vitest';
import { parseGenbank } from '../../src/c6-server/parsers/genbank.js';
import { parseSequence } from '../../src/c6-server/parsers/sequence.js';
import { parseCsv } from '../../src/c6-server/parsers/csv.js';
import { parseJson } from '../../src/c6-server/parsers/json.js';
import { parseFile } from '../../src/c6-server/parsers/index.js';

const MINI_GENBANK = `LOCUS       pMINI                    100 bp    DNA     circular SYN
DEFINITION  Minimal test plasmid.
ACCESSION   pMINI
KEYWORDS    test; plasmid.
  ORGANISM  synthetic construct
FEATURES             Location/Qualifiers
     gene            1..10
                     /gene="lacZ"
ORIGIN
        1 atgcatgcat gcatgcatgc atgcatgcat gcatgcatgc atgcatgcat gcatgcatgc
       61 atgcatgcat gcatgcatgc atgcatgcat
//`;

describe('parseGenbank', () => {
  it('extracts a circular polynucleotide', () => {
    const result = parseGenbank(MINI_GENBANK);
    expect(result.type).toBe('polynucleotide');
    expect(result.data.isCircular).toBe(true);
    expect(result.data.sequence.length).toBeGreaterThan(0);
  });

  it('populates description from DEFINITION', () => {
    const result = parseGenbank(MINI_GENBANK);
    expect(result.description).toContain('Minimal test plasmid');
  });

  it('extracts keywords from KEYWORDS and gene qualifiers', () => {
    const result = parseGenbank(MINI_GENBANK);
    expect(result.keywords).toContain('test');
    expect(result.keywords).toContain('lacZ');
  });
});

describe('parseSequence', () => {
  it('parses a plain sequence', () => {
    const result = parseSequence('ATGCATGCATGC', 'mygene.seq');
    expect(result.type).toBe('polynucleotide');
    expect(result.data.sequence).toBe('ATGCATGCATGC');
  });

  it('parses FASTA format', () => {
    const result = parseSequence('>myseq description\nATGCATGC\nATGC', 'myseq.fa');
    expect(result.data.sequence).toBe('ATGCATGCATGC');
    expect(result.description).toContain('myseq');
  });

  it('detects plasmid from filename', () => {
    const result = parseSequence('ATGCATGC', 'pUC19_plasmid.seq');
    expect(result.data.isCircular).toBe(true);
    expect(result.keywords).toContain('plasmid');
  });
});

describe('parseCsv', () => {
  it('parses CSV rows', () => {
    const csv = 'name,sequence,conc\noligo1,ATGC,100\noligo2,GCTA,50';
    const result = parseCsv(csv, 'oligos.csv');
    expect(result.type).toBe('table');
    expect(result.data).toHaveLength(2);
    expect(result.data[0].name).toBe('oligo1');
    expect(result.keywords).toContain('name');
    expect(result.keywords).toContain('sequence');
  });

  it('parses TSV rows', () => {
    const tsv = 'name\tseq\nA\tATGC';
    const result = parseCsv(tsv, 'data.tsv');
    expect(result.data[0].seq).toBe('ATGC');
  });
});

describe('parseJson', () => {
  it('parses a plain JSON object', () => {
    const result = parseJson('{"name":"myobj","description":"A test","value":42}', 'myobj.json');
    expect(result.type).toBe('json');
    expect(result.description).toBe('A test');
  });

  it('detects JSONSchema', () => {
    const schema = JSON.stringify({ $schema: 'http://json-schema.org/draft-07/schema', title: 'Polynucleotide', properties: { sequence: {} } });
    const result = parseJson(schema, 'polynucleotide.json');
    expect(result.type).toBe('model');
    expect(result.description).toContain('Polynucleotide');
  });
});

describe('parseFile dispatcher', () => {
  it('returns null for unknown extension', () => {
    expect(parseFile('file.xyz', 'content')).toBeNull();
  });

  it('dispatches .seq to sequence parser', () => {
    const result = parseFile('sequences/test.seq', 'ATGCATGC');
    expect(result?.type).toBe('polynucleotide');
  });

  it('dispatches .csv to csv parser', () => {
    const result = parseFile('oligos/batch.csv', 'name,seq\nA,ATGC');
    expect(result?.type).toBe('table');
  });
});
