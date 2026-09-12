# Work plan: making the labsheet toolkit real

**Proposed 2026-09-12, not started.** Reviewed and approved gate by gate before each phase begins.

JCA:

> *"I think we need to write this proper, and for you to show me domain logic code as we go to make
> edits... It has algorithms like 'choose pcr program' that encode strictly logical decisions, and
> it has ones like 'come up with 8 pcr sample names according to these conventions' which are like
> agentic prompts that instruct to return a datastructure. So, you have all these testable (and
> frankly, reviewable by me) algorithms that make micro decisions, and there is a labsheet
> datastructure that houses it all."*

`docs/DECISIONS.md` is the audit this rests on: the entry point has never run, the datastructure is
constructed by nothing, and ~12 decisions live as expressions inside `design/*.js` where nobody can
read them until they are wrong on paper.

---

## The shape being built

```
  construction file ─┐
characterization file ├─→  decisions/  ──→  LabSheet  ──→  render  ──→  .xlsx
    verification file ─┘   (named, one         (the         (template)
       inventory      ─┘    per micro-         rigorous
                            decision)          datastructure)
                                                    ↑
                                            cortex injects here
```

**Four rules this plan is accountable to.**

1. **Every decision is a named function with its own test.** If it cannot be called on its own, it
   cannot be reviewed on its own, and it will be found wrong on a printed page instead.
2. **The LabSheet is constructed, not conjured.** Objects reach the renderer through
   `models/labsheet.js` or not at all. A column header that is not in the ontology is a build error.
3. **A missing stage is fatal, never skipped.** `typeof X === 'function'` is the pattern that let a
   planner be dead for weeks with green tests.
4. **Nothing changes what the Lactis3 sheets say without showing the diff.** See the harness below.

## The regression harness, built first and used at every gate

Before any refactor: freeze today's `Lactis3-labsheets.xlsx` content as a golden text file, one line
per cell. Every gate then presents **the diff of the generated sheets**, not just the code. A phase
that is meant to change nothing and changes something has found a bug; a phase meant to change
something shows exactly what.

This is what makes "show me the code as we go" safe to say yes to.

---

## Phase 0 — the spine

**Change:** make `jobsToLabSheets` real; route `c6-packet` through `generateLabPacket`; delete the
`typeof` guards; make `models/labsheet.js` the only way a sheet is constructed, validating column
names against the ontology.

**Intended behaviour change: none.** The golden diff should be empty.

**What you review — GATE 0:**
- `models/labsheet.js` — the LabSheet shape and its ontology: which fields exist, which are
  required, what `label` / `side-label` / `construct` / `concentration` / `clone` / `culture` /
  `type` mean on a labsheet as against on an inventory sample.
- The list of column headers the validator will accept, and what happens to one that is not on it.

**This gate is the one that matters most.** Everything after it is built on the shape you approve
here, and changing it later is expensive.

## Phase 1 — naming and labelling

**Change:** extract into `decisions/naming/`, one named function each with tests —
`experimentPrefix`, `nextLabel`, `derivedLabel`, `cloneName`, `readName`, `referToInput`,
`labelLimitFor`. Every one of these was corrected by you today from inside a closure.

**Intended behaviour change: none** beyond what is already agreed.

**What you review — GATE 1:** the seven functions, as one file of domain logic, with a table of
every label the Lactis3 packet produces beside the rule that produced it.

## Phase 2 — per-operation sheet specs

**Change:** each operation's `columns` / `values` / `notes` becomes a declarative spec plus named
decisions. Eleven operations, so three review batches:

- **2a construction** — pcr, gel, zymo, goldengate, transform
- **2b verification** — pick, miniprep, sequencing, analysis
- **2c characterization** — retransform, culture, assay, dilution, stock

**What you review — GATES 2a / 2b / 2c:** for each operation, one page: the columns it emits, the
protocol it transcludes and the values it hands that protocol, what it says in prose, and the rule
behind each. Plus the rendered sheet beside it.

**Expect corrections here.** This is where every error you found today lived, and this is the first
time the rules are on one page rather than spread through a render.

## Phase 3 — the agentic decisions

Some decisions are not strictly logical and should not pretend to be: **selection criteria in the
words a person would use**, **which oligo reads a junction**, **where in the freezer a set of tubes
should go**, **whether two sessions should be one sitting**.

**Change:** define one contract — prompt in, JSON out, validated against a schema, the answer
recorded in the experiment's own file so the compile stays deterministic. Implement exactly one
(`sequencingStrategy`) as the worked example.

**What you review — GATE 3:** the contract, the schema, and the one worked example — including what
happens when the model returns something the schema rejects, and how the answer gets written back
into `Verification of <product>.txt` so it never has to be asked twice.

**No further agentic decisions are written until this gate passes.**

## Phase 4 — thin the renderer

**Change:** move the layout decisions out of `labpacket-to-xlsx.py` and into the datastructure —
which cells are entry cells, which are formulas, what a source block is. The renderer becomes a
template that draws what it is given.

**What you review — GATE 4:** the diff of the renderer (it should get much shorter), and the golden
diff (empty).

## Phase 5 — re-point Cortex

**Change:** `cortex labsheets` injects into the new LabSheet rather than the packet JSON.
`tests/test_labsheet_split.py` keeps C6 free of this lab's vocabulary throughout.

**What you review — GATE 5:** the checkpoint injection against the new shape, and a final full diff.

---

## What this does not do

- **No new experiments.** Lactis3 is the only subject until Phase 5 passes.
- **No change to the three input files' grammars** without a gate of its own.
- **No new protocol modules.** The erythromycin content is already right; it is where it is read
  from that this plan changes.

## What I would want from you at each gate

A yes, or edits to the domain logic itself. The functions are meant to be small enough to edit
directly — that is the point of pulling them out of the closures. Where a rule is wrong, the fix
should be one function and one test, not a hunt through a renderer.

## Open questions, to settle at GATE 0

1. **Does a labsheet row carry a `side-label`?** The inventory has one; today nothing emits it, and
   the miniprep sheet says "write the name on the cap and on the side" in prose instead.
2. **Is `construct` on a labsheet row the same `construct` as in the inventory?** For a miniprep,
   yes. For a transformation plate, the row's construct is a plate, not DNA.
3. **What is a control plate's construct?** Today `E1` and `(no DNA)`, which is two different kinds
   of answer in one column.
4. **Should the verification file's grammar merge into the characterization file?** They are
   different phases, but they are the same kind of document, and three files may be one too many.
