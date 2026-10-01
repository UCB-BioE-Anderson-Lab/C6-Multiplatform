# DNA fixtures

Public sequences only. C6 ships to other people, so nothing here is a lab construct.

- `pUC19.gb` is NCBI's record L09137.2, unedited, fetched from E-utilities on 2026-10-01. It has
  no annotation except `source`, which makes it the "no features annotated" case.
- `pUC19.annotated.gb` is the same record with five features added by `annotate-pUC19.mjs`. That
  script finds each feature by searching the sequence for a public probe: the lacZ and bla start
  codons, the M13 primers, and the EcoRI and HindIII sites. No coordinate in it was typed by hand.
  `test/dna-layout.test.js` regenerates the file and fails if it has drifted.
- `T7promoter.fasta` holds the 20-mer T7 promoter primer. FASTA cannot carry annotation, so it is
  the "format carries no features" case.
- `not-genbank.gb` is text with a `.gb` extension and no sequence in it, the "could not read" case.
