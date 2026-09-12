# Our ontology

**Read off the code, not designed on a whiteboard.** Every type below is something the
repository already manipulates; the gaps at the end are the ones it does not. Written
2026-09-11 after SBOL was considered and declined (§ the appendix), so this is the answer to
"then what IS ours".

**The organising fact:** these abstractions describe **human work**. A person at a bench, a tube
in a box, a page they carry. That is the axis everything is arranged on, and it is the reason
SBOL's was the wrong one to borrow.

## The four tiers

    MOLECULE      what the DNA is                      ConstructionFile · C6-Sim
    MATTER        what is physically in the building   inventory
    WORK          what a person does, and when         labplanner
    RECORD        what came back, and what it meant    checkpoints, and mostly missing

### 1. Molecule — `Polynucleotide`, `Step`, `ConstructionFile`

A **Polynucleotide** is a sequence with topology and ends: an oligo, a plasmid, a dsDNA
fragment. A **Step** is an operation that changes one into another — `pcr`, `digest`, `ligate`,
`gibson`, `goldengate`, `transform`, and those six only. A **ConstructionFile** is an ordered
set of Steps producing a named product.

**This tier is about molecular biology and nothing else.** A Step belongs here when the molecule
comes out different. `transform` qualifies because the host methylates it and repairs nicks.

### 2. Matter — `Sample`, `Box`, `Location`, `Inventory`

A **Sample** is a physical thing that exists: a `construct` at a `Location`, with a
`concentration` that is a state word rather than a number — `uM10`, `zymo`, `miniprep`,
`dil20x`. A **Location** is `{boxname, row, col, label, sidelabel}`; a **Box** is a grid.

**The distinction the molecule tier cannot make:** `pBET8` is a Polynucleotide, and there are
four tubes of it in `cheese_temp` C1–F1. One design, four samples. This is what SBOL calls
Component and Implementation, and we already had both — under our own names, without the
ontology URIs.

**And it is the distinction the whole two-file design rests on.** JCA, 2026-09-11: *"the
Characterization File is written at the level of pBET8 — it's telling you how that theoretical
plasmid should be assayed. But at the labsheet level it gets documented as a specific sample and
clone id."* A plan names designs because instances do not exist when it is written; a labsheet
names instances because it is one run. The join is the student's own choice, recorded on the
sheet — which clone they took forward, and where the tubes went.

### 3. Work — `Job`, `LabSheet`, `LabPacket`, `Recipe`, `Mastermix`, `Protocol`

A **Job** is a Step lifted out of a construction file, carrying its dependency edges — this is
where planning happens, and `binReactions.js` works on nothing else.

A **LabSheet** is the unit of human work. Its own docstring, written before any of today's
conversation:

> *"LabSheet is a human-facing instruction unit corresponding to a single lab session /
> worksheet (one operation type per run)."*

**So "one sheet per person per work session" was the model's stated intent all along** — what
drifted was the implementation, which had grown to twelve-tab packets covering a whole project.
The correction JCA gave on 2026-09-11 restores the model rather than changing it.

A **Protocol** is the prose for how to perform an operation — `planning/operations/*.md` and
`protocols/modules/*.js`. **Operations are not confined to the molecule tier**: `pcr` is both a
Step and an operation; `zymo`, `gel`, `miniprep`, `pick`, `sequencing`, `dilution` are operations
and not Steps, because the molecule comes out the same; `retransform` and `assay` are operations
outside construction entirely.

### 4. Record — `Checkpoint`, and then it stops

A **Checkpoint** is a point in a LabSheet where evidence comes back: a type, a code, what it
verifies, what it expects. A **field** is something a person writes on the sheet, tagged for
extraction. The finished sheet, returned, is the record.

## The gaps, which are all in tier 4

Checked rather than assumed — nothing in `src/` defines any of these:

**There is no `Result`.** The ontology can say a gel was run and cannot say what the gel showed.
Evidence comes back as an attachment and a human reads it; nothing typed survives.

**There is no `Measurement`.** An assay produces a number with units, an instrument, a
wavelength, a gain — and none of that has a home. This is the one place a published vocabulary
was worth taking: LabOP's `MeasureFluorescence` parameter list is a better field set than the
Cheese workbook's, and we take the field names without the model.

**Assays are the reason this gap is hard, and the reason it is narrow.** JCA, 2026-09-11: *"An
assay returns data, and there is a shape to that data. But there is no material output."* Two
consequences, and they pull in opposite directions:

- **Terminal in the dependency graph**, because information is never consumed by a later
  material step. So the planner never needs an assay's internals — only its place in the order.
  That is why one `assay` operation can serve every subtype.
- **But the data has a shape**, and it is the shape that has no type. A colony count and a
  plate read differ in parameters and agree in form: a sample, a quantity, units, an instrument,
  its settings.

**There is no closed vocabulary for assays and there will not be one.** Six operations cover
essentially all of cloning, which is what lets a construction file be terse. Nothing covers horse
serum protection, LCMS, RNA-Seq and colony counting at once — they share no parameters and no
procedure. So the subtype is where they differ, and a subtype is a **protocol**: *"we are writing
custom subtypes of assays, that are basically protocols, and we can link back to that ontology in
cloning-tutorials to express them."*

That library exists — `src/labplanner/protocols/modules/`, vendored into cloning-tutorials for
teaching — and `plate_reader_fluorescence` was already in it, already reading fluorescence and
OD600 in one pass at 483 nm. **The subtype mechanism did not need inventing. It needed naming**,
which is `protocol=` on an Assay line.

**There is no `Person`.** A LabSheet is now one person's work session, and nothing represents
the person. Every checkpoint code is per-experiment; two students running the same experiment
collide.

**There is no `Session` distinct from `LabSheet`.** Today they are the same object, which is
right — but nothing records that session 2 follows session 1 by a day and session 4 waits on an
overnight.

## The shape of the answer

Tiers 1–3 exist, are used, and are ours. **Tier 4 is one type deep and needs three more.** That
is the honest state, and it is also why the assay phase has been hard to place all day: it is
not that assays are unlike cloning, it is that we have a rich vocabulary for doing and almost
none for finding out.

---

# Appendix — SBOL and LabOP: considered, and deliberately not adopted

**Settled 2026-09-11. Read this before proposing alignment again** — it was proposed, built, and
withdrawn in one day, and the reasoning is worth more than the four files that came and went.

## The conclusion

JCA: *"I think we have reached a conclusion that sbol is more about robots, and less about people
workers. It is a different abstraction, and there is no reason to force alignment where it isn't
naturally aligned. I think what we are describing is a complementary and compatible set of
abstractions for describing human workers instead of robots."*

**We are describing human work.** A labsheet is a page somebody carries to a bench. SBOL and
LabOP describe designs and protocols for exchange and execution by machines. Those are different
abstractions with different costs, and neither is wrong.

## The evidence, from actually building it

Four schemas were written — `sbol.component`, `sbol.sequence`, `sbol.subcomponent`,
`sbol.implementation` — and they loaded, validated, and refused a bad datum. They worked. The
problem showed up in what they demand:

**`sbol.component` requires `types`, and an SBOL type is an ontology term.** So recording
"pBET8 is a plasmid" means writing `https://identifiers.org/SBO:0000251`. That is the right cost
for a design being exchanged between institutions and the wrong one for a PL writing down what
they made. The friction is not incidental to SBOL; it is what makes SBOL interchangeable.

**LabOP's tier is wrong for us in the other direction**: its Primitive is a bench motion —
`Vortex(samples, duration)` — and adopting its Protocol tier means writing those expansions for
every protocol we already have in prose, to buy machine execution we do not want.
→ `docs/OPERATIONS.md`

## What is kept, and it is a checklist rather than a model

**LabOP's measurement parameters**, because they are simply a better list of what to record:

    MeasureFluorescence(samples, excitationWavelength, emissionWavelength,
                        emissionBandpassWidth, emissionLowpassCutoff,
                        numFlashes, gain, timepoints)

The Cheese workbook asks for excitation and emission and stops — no bandpass, no gain, no OD —
so two students' numbers cannot be compared, and neither can this term's against next. Using
those field names costs nothing and imports nothing.

## Compatible, not aligned

**Nothing here forecloses a mapping.** A Component is a construction file product; an
Implementation is an inventory row. If anyone ever needs to hand a design to a group that speaks
SBOL, that translation is a day's work against a stable target — and it is the right day to do
it, rather than paying the vocabulary cost on every record for years in case.

**What we owe our own abstractions is that they be honest about being ours.** They are for people
doing the work, they use the words those people use, and where they happen to line up with a
standard that is worth noting and is not worth engineering toward.
