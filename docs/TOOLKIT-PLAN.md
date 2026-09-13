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

## Where what was built diverges from the spec

Each of these needs a ruling. **I am not proposing to change them unilaterally** — several may be
deliberate drift since 2024, and one directly contradicts something JCA said today.

| # | spec says | built says | note |
|---|---|---|---|
| 1 | labels are `A1`, `A2` — thread letter + index | `L3a`, `L3b` — experiment prefix + letter | Threads are per bolus of CFs; my prefix is per experiment. Different concepts. |
| 2 | miniprep: `A1A` on the cap, full name `pTarget-cscB1-A` on the side | `pBET8-A` on both | **JCA today: "What you want them to write on the top... is construct+"-"+clone... You also want them to write that on the side label."** Directly contradicts slide 34. Which is current? |
| 3 | pick default is **2** (*"Default to 2"*) | `CLONE_PICKS = 4` | Lactis3's verification file says 2; the C6 default is still 4. |
| 4 | `source:` is `label` · `location` · `note`, location `boxA/C1` | `what` · `Box` · `Well` · `note` | Mine splits what the spec keeps as one token. |
| 5 | `destination:` and `program:` — thermocycler assignment, all of a thread on one block | not emitted at all | A whole decision class missing. |
| 6 | Zymo assigns `elution_volume` and a box/well `destination` per sample | Zymo emits neither | Slide 26 flags the box-placement decision as needing inventory awareness. |
| 7 | `Plate` is its own sheet after a rescued Transform | plating folded into Transform | Slide 31→32. |
| 8 | Antibiotic enum: Amp, Carb, Spec, Tet, Kan, Cam | plus Erm, Chl, Ery… | Erm is not in the 2024 enum and is what Cheese runs on. Enum needs extending, not bypassing. |
| 9 | Operation enum includes PCA, SOEing | not implemented | Out of scope for Cheese; name them as absent rather than unknown. |
| 10 | Gel sheet is `reaction` · `size` · `product`, and carries DpnI | `loads tube` · `construct` · `expected size`, no DpnI | DpnI belongs to EIPCR, not to every gel. |

**Documents I cannot read and would want.** The decks link three Google Docs that are the real
specs: *LabSheet Models*, *Example LabSheets*, and `cf_shorthand_specification.md`. Per the
standing rule I am not scraping them out of a browser — if you export them as `.docx` or `.md`
into the repo, GATE 0 gets much shorter and several of the rulings above answer themselves.

---

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

## GATE 0 — reconcile against the spec

**No code.** A table like the one above, with your ruling on each of the ten divergences, plus
whatever the exported Google Docs settle. Output: `docs/LABSHEET-SPEC.md`, the single statement of
the LabSheet shape that everything after is built against.

## Phase 1 — the spine  *(GATE 1)*

Make `jobsToLabSheets` real; route `c6-packet` through `generateLabPacket`; delete the `typeof`
guards; make the model the only way a sheet is constructed, with section and column names
validated against the spec. **Intended behaviour change: none** — golden diff empty.

You review: `models/labsheet.js` against `docs/LABSHEET-SPEC.md`, and the validator's reject list.

## Phase 2 — threads, labels and naming  *(GATE 2)*

Extract into `decisions/naming/`, one named function each with tests: `threadOf`, `sampleLabel`,
`cloneLabel`, `sideLabel`, `derivedLabel`, `referToInput`, `labelLimitFor`. This is where
divergences 1, 2 and 4 land, and where every correction you made today lived.

You review: seven functions on one page, plus a table of every label Lactis3 produces beside the
rule that produced it.

## Phase 3 — per-operation sheet specs  *(GATES 3a / 3b / 3c)*

Each operation becomes a declarative spec plus named decisions. Three batches so each review is one
sitting:

- **3a construction** — pcr, gel, zymo, goldengate, digest, ligate, transform, plate
- **3b verification** — pick, miniprep, sequencing, analysis
- **3c characterization** — retransform, culture, assay, dilution, stock

Per operation, one page: sections emitted, columns, protocol transcluded and the values it gets,
prose, and the rule behind each — beside the rendered sheet. Divergences 6, 7, 10 land here.

## Phase 4 — the decisions not yet made at all  *(GATE 4)*

`destination` and `program` (thermocycler assignment, thread-affine), and box placement at the Zymo
and the miniprep — both flagged in the spec as needing inventory awareness, both absent today.

## Phase 5 — the agentic decisions  *(GATE 5)*

Some decisions are not strictly logical and should not pretend to be: selection criteria in a
person's words, which oligo reads a junction, how much plasmid a low-copy prep needs (spec slide 35
flags this as hard), whether two sessions are one sitting.

One contract — prompt in, JSON out, validated against a schema, the answer written back into the
experiment's own file so the compile stays deterministic. **Exactly one worked example
(`sequencingStrategy`) is implemented**, and no others until this gate passes.

## Phase 6 — thin the renderer, re-point Cortex  *(GATE 6)*

Layout decisions move out of `labpacket-to-xlsx.py` into the model; the renderer draws what it is
given. `cortex labsheets` injects into the LabSheet rather than the packet JSON;
`cortex/tests/test_labsheet_split.py` keeps C6 free of this lab's vocabulary throughout.

---

## What this does not do

- **No new experiments.** Lactis3 is the only subject until GATE 6.
- **No grammar change to the three input files** without a gate of its own.
- **No new protocol modules.**
- **No robotics.** The spec's `destination` is a thermocycler block, not a deck position.

## What I want from you at each gate

A yes, or edits to the domain logic itself. The functions are meant to be small enough to edit
directly — that is the point of pulling them out of the closures. Where a rule is wrong the fix
should be one function and one test, not a hunt through a renderer.
