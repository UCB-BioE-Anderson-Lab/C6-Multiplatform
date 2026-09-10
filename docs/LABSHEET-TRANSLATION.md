# Translating an existing labsheet into the LabPacket model

**Derived from a real one**: `UCB_iGEM_SynThera/SLIP4/iGEM-Synthera-Spr26-SLIP4_7.xlsx`,
2026-09-10. JCA: *"pick one of the slip4 experiments, and first examine its labsheet and
determine the exact translation of it to the new format… those labsheets are already designed,
and you just have to convert and do checkpoint additions."*

**Nothing is built from this yet.** It records what the format actually has to hold, from a
labsheet that worked, so the model is fitted to the artefact rather than the artefact squeezed
into the model.

---

## 1. The headline: a labsheet is not one grammar. It is three.

The obvious reading — every tab is *source / samples / recipe / notes* — is true of about half
of them and quietly loses the rest.

### Kind A — operation tabs (PCR, PCR to Seq, GoldenGate, Transform1, Transform2, Zymo, Gel, Miniprep, Sequencing)

    PCR for Experiment SLIP4-7
    protocol: PrimeStar
    source:
      label | construct | concentration | Box | Well
      10 uM oGho17 | oGho17 | 10 uM | SLIP4_reagents | D2
    samples:
      label | primer1 | primer2 | template | product | program
      SY7 | oGho17 | oGho18 | pGhost12-A | pcr15 | PG6K55
    Reaction:
      32 uL ddH2O (white) … 1 uL PrimeSTAR GXL DNA Polymerase
    Notes:
      * Do only one thermocycler per program run for your section

This maps onto `LabSheet` almost exactly, and it is the kind the model was designed for.

### Kind B — decision tabs (Dilutions)

Not a procedure. A **conditional walk** with lookup tables inside it:

    Check for working stocks
    You will need 10 uM stocks; look for the samples below:
      | Construct | Box | Well | Concentration
      | oGho17 | SLIP4_reagents | D2 | 10 uM
    If those exist and contain at least 5 uL of liquid, move on to PCR.
    If not, you are going to need to make dilutions, so keep reading

**`LabSheet` has nowhere to put this.** `notes` would flatten a branch into prose and lose the
fact that a student is meant to *check something and take a different path*. This is the tab that
prevents "convert every tab to inputs/outputs/recipe" from being the answer.

### Kind C — protocol tabs with embedded layout and data capture (Assay, Pick, Pick2, Replicate)

Numbered steps, a **plate layout grid**, and a **blank table the student fills in**:

    1) Warm up 8 carb plates, label them to match the sample layout labels below
             1      2
       A  12G SpA  12G A
       B  12H SpA  12H A
    …
    7) Count red/white/green colonies and fill out the table below:
       | Sample | Replicate | Antibiotics | Green | Red | White
       | pGhost12-A | G | SpA
       | pGhost15   | G | SpA
    8) Copy that table into:
       https://docs.google.com/spreadsheets/d/16N2…  On the "Reporter Assays" slide

## 2. The checkpoint already exists, fully specified, in the labsheet

**This is the most useful thing the audit found.** Nobody has to design a checkpoint for this
experiment. Step 7 *is* one:

| the checkpoint design wants | the labsheet already has |
|---|---|
| what evidence is expected | the column headers — `Green`, `Red`, `White` |
| which operation it verifies | the pre-filled `Sample` / `Replicate` / `Antibiotics` rows |
| when it is due | its position in the packet, after step 6's overnight incubation |
| where the data goes | step 8 — **a Google Sheets URL, pasted by hand** |

So a checkpoint is not a new field to invent. It is **the identity of a table that is already
there**, plus a code that replaces the manual paste in step 8. That is a much smaller change than
`docs/CHECKPOINTS.md` assumed, and it is why converting a real labsheet had to come first.

**And it explains the collection problem.** The current answer to "how does the data get back" is
a student copying a table into a spreadsheet whose URL is embedded in a printed page — which is
exactly the failure mode the checkpoint routing was built for.

## 3. The translation, field by field

`LabPacket` = the workbook. `LabSheet` = one tab. Both exist and need no change.

| labsheet | LabSheet field | note |
|---|---|---|
| `<Op> for Experiment <ID>` | `title`, `operation`, `metadata.experiment` | operation is the first word |
| `protocol: PrimeStar` | `metadata.module` | binds to `src/labplanner/protocols/modules/` |
| `source:` table | `inputs[]` | **each row carries `Box`/`Well` — a live inventory reference**, not a name |
| `samples:` table | `outputs[]` | each row names its `product`; the other columns are that product's inputs |
| `Reaction:` block | `recipe` / `mastermix` | per-reaction volumes; `Mastermix` already scales by count × excess |
| `Notes:` | `notes[]` | |
| numbered steps (kind C) | **no home yet** | `notes[]` would lose the ordering and the embedded tables |
| plate layout grid | **no home yet** | a 2-D layout is not a list of notes |
| data-capture table | **the checkpoint** | see § 2 |
| conditional branches (kind B) | **no home yet** | see § 1 |

## 4. What must be decided before any conversion is written

1. **Do kinds B and C get first-class representation, or does the converter refuse them?**
   Refusing is defensible for a first pass — convert the nine operation tabs, leave Dilutions and
   Assay as they are — but a labsheet that is half converted is two documents, and the printed
   thing a student carries has to be whole.
2. **Is `outputs[]` the right home for the samples table?** It holds inputs too (`primer1`,
   `template`), so the row is really *an operation*, not a product. `LabSheet` may want a
   `samples[]` of its own rather than overloading `outputs`.
3. **PDF.** Nothing renders one anywhere today. The current labsheet is printed and carried into
   the lab, so this is not cosmetic — and it is the only way to check "essentially the same
   content" against the original.

## 5. Deliberately not done

No conversion has been written. The point of this pass was to find out what the format has to
hold, and it turned out to be three shapes rather than one — which is worth knowing before
thirteen planning modules are written against the assumption of one.


---

# The plan and the record are two artefacts — 2026-09-10

JCA:

> *"Maybe what happens here is you make these excel files and email them to students, they fill
> stuff in, maybe add notes to it, then send it back to you along with checkpoints, and you
> collect all this stuff in the repo as the record. So, the labsheet data structure is the plan,
> the finished excel file is the record."*

**That last sentence is the architecture, and it settles several open questions at once.**

| | plan | record |
|---|---|---|
| artefact | `*.labpacket.json` | the returned `.xlsx` |
| written by | the compiler, or a conversion | the student, at the bench |
| lifetime | regenerated whenever the plan changes | never regenerated; it is what happened |
| lives in | the project repo, versioned | the project repo, beside the plan |

**Nothing writes back from the record into the plan.** A plan edited to match its outcome stops
being a plan, and the difference between the two is the finding — the same rule the SLIP4
construction file is under.

**Why a spreadsheet and not the PDF.** Not for C6 simulation: the source workbooks do call
`pcr()` and `assemble()` through the Apps Script relay, but those are custom functions bound to
a Google Sheet and do not survive a download. What belongs in the file is **the arithmetic a
student would otherwise do on paper** —

    ddH2O to add (µL)  =IF(B9="","",B9*10)      a 100 µM stock from N nmol
    total µL           =ROUND(A27*$B$24*$D$24,1) per-reaction × reactions × excess

— written as formulas over the cell the student types into, so the number moves as they work.
**The resuspension volume was computed nowhere before this.** The tab said `put in mols` and
then *"dispense the volume of water stated in the table above"*, with nothing stating it.

**The checkpoint rides on the same file.** The Assay tab carries `cortex::<code>` and the
instruction to mail the workbook back — so the record returns by the route the promise system
already routes, and Cortex files it beside the plan.

`src/labplanner/render/labpacket-to-xlsx.py` does this. Verified by recalculation rather than by
eye: 24.6 nmol yields 246 µL and reports 100 µM; 32 µL at 1.1× excess yields 35.2 µL.

**The HTML/PDF renderer stays** — it is the printed short form, and `{protocols:false}` is the
version somebody who has done this ten times actually wants. The two are different readings of
one plan, not rivals.
