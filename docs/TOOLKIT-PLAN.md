# Work plan: making the labsheet toolkit real

**Revised 2026-09-12 against `BioE134 - 15 - LabPlanner.pptx`, which is the spec.** Not started.
Reviewed and approved gate by gate.

The first version of this plan proposed to *design* a LabSheet shape at GATE 0. That was wrong:
the shape is specified, in JCA's own lecture, with twelve worked examples. **GATE 0 is now about
reconciling what was built against that spec, not inventing anything.**

Prior reading: `docs/DECISIONS.md` (the audit — the entry point has never run), and the three decks
in `Downloads/134forcortex`.

---

## What the spec says

A **LabSheet** is a titled, sectioned document, not a table of rows. Title is `<thread>: <Operation>`
— `A: PCR`, `K: Gel and DpnI`, `A: Miniprep`. Sections seen across the twelve examples:

| section | shape | appears on |
|---|---|---|
| `samples:` | a table whose columns are per-operation | every sheet |
| `source:` / `sources:` | `label` · `location` · `note` | PCR, Zymo, Digest, Assemble, Sequencing |
| `mastermix:` | volume + reagent lines | PCR2 |
| `reaction:` | volume + reagent lines | Digest, Ligate, Assemble, PCR2 |
| `DNA Mix:` | volume + sample lines | Assemble |
| `destination:` | one value — a thermocycler, or per-sample a box/well | most |
| `program:` | `machine/program`, e.g. `main/SPE1`, `Q5/Q5-4K` | any thermocycled step |
| `protocol:` / `Instructions:` | numbered prose | Gel, Sequencing |
| `note:` | prose, may repeat | most |
| `rescue_required:` | yes/no | Transform |

**THREADS.** *"There is a notion of a thread, coded by a letter (here A) corresponding to the full
bolus of assignments for a provided input of construction files."* Sample labels are the thread
letter plus an index — `A1`, `A2`, `A3`; `O1`…`O8`. Picked colonies append a clone letter: `A1A`,
`A1B`. Locations are one token, `boxA/C1`.

**Enums, deliberately** (LabPlanner slide 9, an entire slide on why): Operation, Antibiotic,
Enzyme are closed sets, for integrity, type safety and introspection.

---

## Where what was built diverged from the spec

Ten divergences were listed here and ruled on 2026-09-12; the rulings are `docs/LABSHEET-SPEC.md`.
Three of the ten dissolved rather than being decided: there is no rule about DNA naming for the
compiler to enforce, no product namespacing, and no machine assignment to build.

## The shape being built

```
  construction file ─┐
characterization file ├─→  decisions/  ──→  LabSheet  ──→  render  ──→  .xlsx
    verification file ─┘   (named, one      (the spec'd     (template)
       inventory      ─┘    per micro-       document)
                            decision)              ↑
                                            cortex injects here
```

**Four rules this plan is accountable to.**

1. **Every decision is a named function with its own test.** If it cannot be called on its own it
   cannot be reviewed on its own, and it will be found wrong on a printed page instead.
2. **The LabSheet is constructed, not conjured.** Objects reach the renderer through the model or
   not at all; a section or column not in the spec is a build error.
3. **A missing stage is fatal, never skipped.** `typeof X === 'function'` is what let the planner be
   dead for weeks with green tests.
4. **Nothing changes what the Lactis3 sheets say without showing the diff.**

## The regression harness, built first and used at every gate

Freeze today's `Lactis3-labsheets.xlsx` as a golden text file, one line per cell. Every gate then
presents **the diff of the generated sheets**, not only the code. A phase meant to change nothing
that changes something has found a bug; a phase meant to change something shows exactly what.

---

## GATE 0 — CLOSED, 2026-09-12

`docs/LABSHEET-SPEC.md` is the output: eight rulings on the naming ontology, the file layout and
what a PCR sheet states. Two items deferred to GATE 3a where a rendered sheet makes them easy to
judge; two settled by assumption and reversible in a line.

---

## Phase 1 — the spine  *(GATE 1)*

Make `jobsToLabSheets` real; route `c6-packet` through `generateLabPacket`; delete the `typeof`
guards; make the model the only way a sheet is constructed, with section and column names validated
against the spec. Fold `Verification of pBET8.txt` back into the characterization file and teach
the parser its three new steps, with `injectVerification` demoted to the fallback for files that do
not declare them.

**Intended behaviour change:** the labels stay as they are; the pick count changes 4 → 2, which is
the verification file's value anyway, so the Lactis3 golden diff should be **empty**.

You review: `models/labsheet.js` against `docs/LABSHEET-SPEC.md`, the validator's reject list, and
the merged `Characterization of pBET8.txt` before anything compiles against it.

## Phase 2 — naming, as its own module  *(GATE 2)*

`decisions/naming/`, one named function each with tests: `dnaName`, `tubeLabel`, `sideLabel`,
`cloneDesignation`, `derivedLabel`, `referToInput`, `labelLimitFor`. The rules are now written down
— under 4 characters for a PCR cap, about 6 for a 1.5 mL, `z` and `d` as prefixes, a clone as
`[A-Z]` / `[0-9]` / `[0-9][A-Z][0-9]`, a label as an exact key — so this phase is transcription
rather than invention, and every one of them becomes reviewable on its own.

You review: seven functions on one page, plus a table of every label Lactis3 produces beside the
rule that produced it.

## Phase 3 — per-operation sheet specs  *(GATES 3a / 3b / 3c)*

Each operation becomes a declarative spec plus named decisions.

- **3a construction** — pcr, gel, zymo, goldengate, transform, plate. Settles the control-plate
  column and whether `Plate` is its own sheet. PCR gains `destination: to gel box`.
- **3b verification** — pick, miniprep, sequencing, analysis
- **3c characterization** — retransform, culture, assay, dilution, stock

Per operation, one page: sections emitted, columns, protocol transcluded and the values it gets,
prose, and the rule behind each — beside the rendered sheet.

## Phase 4 — the agentic decisions  *(GATE 4)*

> *"It has code-defined things like pcr program selection whenever things can be done strictly
> logically. It has other pieces like making up an acronym for the PCR labels that an LLM call
> needs to make. That LLM could be a full cortex context, such that the full situation can be
> considered in choosing those label names."*

So LabPlanner owns both kinds and the difference is in the decision, not in where it lives. A
logical decision is a function; an agentic one declares its **prompt, its schema and its refusal**,
and takes a resolver. C6 ships no resolver and refuses rather than inventing; Cortex supplies one
with the whole situation in context, and the answer is written back so the compile stays
deterministic.

**One worked example only** — the PCR label acronyms, which is JCA's own example — and no others
until this gate passes.

## Phase 5 — thin the renderer, re-point Cortex  *(GATE 5)*

Layout decisions move out of `labpacket-to-xlsx.py` into the model; the renderer draws what it is
given. `cortex labsheets` injects into the LabSheet rather than the packet JSON;
`cortex/tests/test_labsheet_split.py` keeps C6 free of this lab's vocabulary throughout.

## What this does not do

- **No new experiments.** Lactis3 is the only subject until GATE 6.
- **Two input grammars, not three.** The verification file folds into the characterization file
  at GATE 1; no other grammar change without a gate of its own.
- **No new protocol modules.**
- **No machine tracking.** `program:` stays; `destination:` names the *to gel* box and never a
  thermocycler, a block or a deck position.

## What I want from you at each gate

A yes, or edits to the domain logic itself. The functions are meant to be small enough to edit
directly — that is the point of pulling them out of the closures. Where a rule is wrong the fix
should be one function and one test, not a hunt through a renderer.
