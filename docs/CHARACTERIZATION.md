# The post-construction phase — where should it be declared?

**OPEN. This is a proposal, not a decision.** Written 2026-09-11 so the question has one home
rather than being re-derived by whoever next plans an experiment that ends in an assay.

## What is settled

**A construction file describes the chemical structure of the DNA and nothing else.** JCA,
2026-09-11: *"A construction file is about the chemical structure of the dna, and nothing more is
happening in the experiment after that point."* So the CF ends at the transformation that
produces the verified plasmid, and that is correct rather than a gap.

**Labplanner is nonetheless responsible for the whole experiment.** *"labplanner is about
planning the entire experiment, holistically."* So the phase after the CF is labplanner's to
plan — it simply has no input describing it.

**The steps are the same operations with different parameters**, not new ones — § the two kinds
of transformation in `planning/operations/sessions.md`.

## What is missing

For Lactis3, the CF yields five labsheets: pcr, gel, zymo, goldengate, transform. The workbook
that students actually work from has thirteen. The other eight — pick, miniprep, sequencing, seq
analysis, electroporation, pick2, assay — are most of what a person does, and nothing in the repo
states them.

**Two of those eight are arguably still construction's business:** pick, miniprep and sequencing
verify that the DNA is what the CF says it is. They follow from a Transform the way a gel follows
from a PCR, and could be injected the way `injectGel.js` injects a gel. That is a separate
question from the one below and a smaller one.

**The rest genuinely cannot be derived.** Which organism the plasmid goes into, by what method,
at what temperature, and what is then measured — none of it is a fact about the DNA. It has to be
declared by a person.

## The proposal

**A second plain-text file in the project, beside the construction file**, read by labplanner in
the same pass. For Lactis3 it would be `Characterization of pBET8.txt`:

    Transform   pBET8   L.lactis   Erm   30   pBET8_lactis   electroporation
    Pick        pBET8_lactis   4
    Assay       pBET8_lactis   fluorescence   amilGFP   483   525

Why this shape:

- **Plain text, same grammar as a CF.** A PL can read and edit it without a tool, which is the
  property that made construction files work.
- **Separate file, not an extended CF.** Mixing them makes the CF's meaning conditional — a
  reader could no longer take every line as a statement about DNA structure.
- **In the project repo, version-controlled**, so what was planned and what was done stay
  together.
- **The operation names are the ones already in `planning/operations/`**, which is what makes the
  variants tractable: a Transform is a Transform, and the parameters say which kind.

## What is NOT settled, and needs a decision

1. **Is a separate file right**, or should this be a section of one experiment-level document
   that also names the construction files? An experiment with three CFs and one assay would want
   the latter.
2. **Does `Assay` belong in this grammar at all?** It has no product and no dependency edge —
   it consumes a strain and yields a number. Every other operation here makes a thing.
3. **Should pick/miniprep/sequencing be injected** from the CF rather than declared here?
4. **The binning bug this exposed**, which is real regardless: adding the second Transform to a
   CF puts both transformations on ONE labsheet, because `binReactions.js` sees two Transform
   jobs and nothing that distinguishes them. They are weeks apart, by different methods, into
   different organisms, at different temperatures. Binning must consider strain and method, not
   just operation.
