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

**A second plain-text file in the project, beside the construction file** — using `Retransform`,
which is its own operation and deliberately not a construction one (§ 4 below), read by labplanner in
the same pass. For Lactis3 it would be `Characterization of pBET8.txt`:

    Retransform   pBET8   L.lactis   Erm   30   electroporation   pBET8_lactis
    Pick          pBET8_lactis   4
    Assay         pBET8_lactis   fluorescence   amilGFP   483   525

Why this shape:

- **Plain text, same grammar as a CF.** A PL can read and edit it without a tool, which is the
  property that made construction files work.
- **Separate file, not an extended CF.** Mixing them makes the CF's meaning conditional — a
  reader could no longer take every line as a statement about DNA structure.
- **In the project repo, version-controlled**, so what was planned and what was done stay
  together.
- **The operation names are the ones already in `planning/operations/`**, which is what makes the
  variants tractable: a Transform is a Transform, and the parameters say which kind.

## `phenotype=` is required on a Pick

**JCA, 2026-09-18:** *"this phenotype is a necessary field for a pick operation."*

    Pick   pX_lactis   n=4 phenotype=white, kanamycin-resistant lighting=blue+ambient   pX_clones

A `Pick` with no `phenotype=` does not compile — `PICK_WITHOUT_PHENOTYPE`, in
`validate/characterizationFile.js`.

**What it cost to learn.** On 2026-09-18 a crRNA transformation checkpoint was reviewed and
passed: plenty of colonies, controls healthy. The labsheet said the clones should be **white** —
the amilGFP is cut out in that reaction — and they were not. *"I did not re-read the labsheet and
note that the colonies should be white… it is also the context of the labsheet that is missing
from the review process."*

The sheet had told the student how many to pick and to photograph the plates. It never told them
**which** colonies. And the checkpoint sent the reviewer a photograph with no statement of what a
correct colony looks like.

**Two readers, one authored fact.** The student picking, and the reviewer deciding whether the
plate is right. It renders as the first note on the picking sheet, before the count, because
which colonies precedes how many — and it travels to the checkpoint as the reviewer's criterion.

**Why it is authored and not derived.** *"We don't have the algorithms to predict that
automatically… I think it would be relatively easy to predict from composition whether GFP is
expressed or not, but the second part of that — defining what is relevant of the phenotype to be
looking for — is much more complicated logic."* Whether a marker is expressed is computable.
Whether it is the thing to look at is a judgement about **this** experiment: nobody says "pick big
colonies" here, because size is not relevant, and only a person knows that.

**So it is free text, and deliberately not a vocabulary.** A controlled list would invite filling
the field in mechanically, which is the failure it exists to prevent. An empty `phenotype=` is
refused too — "stated, and the answer is nothing" is not a statement.

**Still open: the cloning pick.** `injectVerification.js` adds a pick after each cloning
transformation for experiments that do not author one, and that pick has no characterization file
to carry a phenotype. It is the pick in the case above. → § What is NOT settled, item 5.

## What is NOT settled, and needs a decision

1. **Is a separate file right**, or should this be a section of one experiment-level document
   that also names the construction files? An experiment with three CFs and one assay would want
   the latter.
2. **Does `Assay` belong in this grammar at all?** It has no product and no dependency edge —
   it consumes a strain and yields a number. Every other operation here makes a thing.
3. **Should pick/miniprep/sequencing be injected** from the CF rather than declared here?
4. ~~The binning bug~~ — **SETTLED 2026-09-11, and by the operation name rather than by the
   binner.** JCA: *"at an operation level, they are two separate things. Perhaps it is a
   retransformation."* A `Retransform` is its own operation, so `binReactions.js` separates the
   two without being taught about strains. See `planning/operations/retransform.md`.

   The narrower bug survives and is recorded there: two genuine Transforms differing in strain or
   temperature still share a sheet. That is usually right and sometimes not, and guessing which
   would be worse than leaving it.

5. **Where does the CLONING pick get its phenotype?** `phenotype=` is now required on a `Pick` in
   this file — but `injectVerification.js` adds a pick after each cloning transformation for any
   experiment that does not author one, and that pick has no line here to carry the field. It is
   the pick in the 2026-09-18 case: transformants off a Golden Gate, expected white because the
   amilGFP drops out, and nothing anywhere said so.

   Three shapes, and this is a decision rather than a bug:

   - **On the `Transform` step in the construction file** — `Transform frag Mach1 Kan 37 pX
     phenotype=white`. The most natural home: the plate comes from that step, and what should
     grow on it is a property of what was assembled. But it widens the construction-file grammar,
     which is shared with `c6-sim` and the 134 course, so it is not a local change.
   - **Require a characterization file wherever anything is picked.** Honest, and it makes
     `--clone-only` mean "no characterization beyond the pick" rather than "no file".
   - **A compile argument.** Cheapest, and the worst: it puts the fact in the command line
     somebody typed once instead of in a file somebody can read.

   Until this is decided, an injected cloning pick compiles with no phenotype and the sheet says
   nothing about which colonies — which is exactly the state that caused the miss.
