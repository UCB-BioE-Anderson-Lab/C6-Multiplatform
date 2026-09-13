# LabPlanner — construction files in, labsheets out

JCA, 2026-09-12:

> *"we should build these cheese lab sheets through the automated workflow starting from the
> construction files… you pass it the construction and characterization files and inventory, and
> it automates the rest. You would work with the user to define the characterization sequence,
> lock that down in a file, then compile."*

```bash
c6-labplan Experiments/Lactis3 \
  --inventory "Inventory/iGEM Cheese Inventory.txt" \
  --out Lactis3-labsheets.xlsx \
  --collector jca-cortex@berkeley.edu
```

## The two halves, and why the seam matters

**Deciding what the experiment does is a conversation. Compiling it is not.** Which host, which
antibiotic, which controls, which reporter read at what wavelengths — none of that is derivable
from a construction file, and none of it may be invented at render time. It is written into a
**characterization file**, which is a document somebody can read and argue with.

Everything after that is deterministic. That is what makes the compile trustworthy: every line on
a labsheet traces back to a line in a file, and none of it to a choice made while rendering.

**So a missing characterization file stops the compile.** It is not a missing input; it is a
conversation that has not happened. `--clone-only` is how you say the experiment really does end
at a verified plasmid.

## What the pipeline is

| stage | decides | where |
|---|---|---|
| `validate/` | is this file well-formed, and which kind is it | `constructionFile.js`, `characterizationFile.js` |
| `planning/` | WHICH labsheets there are, in what order, with which samples | `binReactions.js`, the `inject*.js` family |
| `planning/sequences/` | which steps share a **sitting** | named session sequences |
| `design/` | what goes ON one sheet, per operation | one module per labsheet type |
| `render/` | the .xlsx a student carries and sends back | `labpacket-to-xlsx.py` |

`c6-plan` is the planning half, `c6-packet` the projection, `c6-labplan` all of it.

## Steps that are in no file

A construction file describes the **chemical structure of the DNA**. A characterization file
describes what happens to the plasmid **once it is built**. Picking a colony, minipreping it,
reading a trace — those establish that it is built, so they belong to neither, and for a long time
that meant they were simply absent from every plan.

`injectVerification.js` adds them, exactly as `injectGel.js` and `injectCleanup.js` add the gel
and the cleanup, because *"labplanner is about planning the entire experiment, holistically"* and a
planner that stops at the transformation has planned four of nine sessions.

**What it defaults and what it refuses** is the part worth reading: four colonies is a default,
where the minipreps go in the freezer is an open decision, and the sequencing oligo is refused
outright. `c6-labplan` lists every refusal in one place at the end of a run.

## Sessions

**One labsheet is one person doing one work session**, not one operation. The pairing lives in
`planning/sequences/` as named data — `clone-and-characterize` is the nine JCA gave for Lactis3 —
so that *"do it like the Tlib3 experiment"* can eventually mean something specific. A sequence
only ever **groups** what the planner produced; it never adds or drops a step, and a step it does
not name gets its own sheet and is reported.

## The things it will not do

- Choose a sequencing oligo.
- Write the inventory. It prints the box, asks for the well, and records nothing — the presence is
  entered from the returned workbook. Putting a *hold* on a spot would be legitimate and is not
  built: `inventory.js` has no state between free and occupied.
- Name a protocol module for an operation whose chemistry the planner declined to pick.
- Render a protocol module with its defaults — the seam warns, and for the worst cases the design
  emits no module at all rather than a confident sentence about somebody else's experiment.
