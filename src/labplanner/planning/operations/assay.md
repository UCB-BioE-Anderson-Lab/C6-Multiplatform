# Assay

**The step that produces data and no material.** JCA, 2026-09-11: *"An assay returns data, and
there is a shape to that data. But there is no material output."*

Two things follow, and they pull opposite ways:

- **Terminal in the dependency graph.** Information is never consumed by a later material step,
  so nothing downstream needs an assay's internals — only its place in the order. That is why
  one `assay` operation serves every kind.
- **The data has a form.** A sample, a quantity, units, an instrument and its settings. That
  form has no type yet (`docs/ONTOLOGY.md § The gaps`), which is why an assay's result currently
  comes back as an attachment and a sentence.

## The subtype is a protocol

There is no closed vocabulary for assays and there will not be one. Six operations cover
essentially all of cloning; nothing covers horse serum protection, LCMS, RNA-Seq and colony
counting at once, because they share no parameters and no procedure.

So **`protocol=` on the Assay line names the subtype**, and the subtype is a module in
`../protocols/modules/`:

    Assay  pBET8_cultures  protocol=plate_reader_fluorescence ex=483 em=525 od=600  lactis3_1_assay

A new kind of assay is a new protocol module. No grammar changes, no planner changes, and
students get it rendered in cloning-tutorials for free because that library is vendored there.

## Three questions to settle when writing one

**1. What is the negative control, and is it on the same plate?**
An assay without one measures the instrument. For a fluorescence read the untransformed host is
the control, and it must be **grown and read alongside** — not a number from last week. This is
the single most common way an assay result turns out to be unreadable after the fact.

**2. What normalises it?**
A raw fluorescence number means nothing across wells with different cell densities. OD in the
same read is what makes them comparable — which is why
`plate_reader_fluorescence` does both in one pass and why splitting them would be a mistake
(§ the simultaneity note in `validate/characterizationFile.js`).

**3. What settings, exactly?**
Excitation, emission, bandpass, gain, and the instrument's program name. JCA's workbooks ask for
excitation and emission and stop, so two students' numbers cannot be compared and neither can
this term's against next. The parameter names are LabOP's, which is the one thing worth taking
from it — a better list of what a reading needs than any of ours.

## What to ask for on the sheet

Their reading, not just their file. The raw instrument output comes back as the checkpoint
attachment; what only the person at the bench can give is **which wells they called as hits and
why**, and whether anything looked wrong — a well that did not grow is not a weak promoter, and
the two are indistinguishable once the numbers are in a spreadsheet.
