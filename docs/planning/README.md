# Experimental planning, end to end

How an idea becomes a construct, a bench session and a result, and which part of C6 owns each
stage. This is the big-picture document: every phase below has its own page, and the ones that
are built have a skill record naming the buttons.

**Read this when you do not know where you are.** Each phase ends in an artifact and is separated
from the next by a **gate** — a condition that must hold before the next phase may start. The
gates are the load-bearing part. A phase boundary with no enforcer is marked `NOTHING`, which is
a statement about this toolkit and not a hole somebody forgot to fill in the prose.

## The phases

| | phase | ends in | gate | enforcer |
|---|---|---|---|---|
| 1a | [goal](GOAL.md) | `goal.json` — devices, slots, rules | the goal is well formed | `goal.validategoal` |
| 1b | [materials](MATERIALS.md) | annotated sequences that already exist, and where they are | every slot has candidates, or the gap is NAMED | `materials.materialsforgoal` — but no adapter feeds it a real collection yet |
| 2 | [design](DESIGN.md) | construction files, oligo orders, synthesis orders | the construction file simulates against its recorded maps | `cf.sim --maps`, `cf.check` |
| 3 | [build](../LABPLANNER.md) | the labsheet workbook | open decisions and unlocated materials reported before writing | `c6-labplan`, gated |
| 4 | [characterization](../CHARACTERIZATION.md) | the characterization file | no characterization file, no compile | `c6-labplan` refuses |
| 5 | [record](RECORD.md) | holds resolved, data filed, notes in the repo | the sheet came back and the inventory learned from it | `labsheet.receive` |

Five of those six gates have something behind them today. Phase 1b's can be checked but has
nothing feeding it, and phase 2's design audit runs as a command rather than as a gate anything
must pass; both say so on their own pages rather than reading as though the stage were closed.

## Why phase 1 is in two halves

They fail differently, and conflating them is how a design ends up constrained by what happened
to be in the freezer that week.

The **goal** is a conversation that ends in a document: what must be true of the construct —
which ORFs, under which promoters, in what order, and what must never co-occur. It says nothing
about what exists. That is what makes it reusable, arguable, and writable before anybody has
looked in a box.

The **materials** half is a query that ends in a shortlist: what in the collections could fill
each slot, where it is, and how much the hit can be trusted. It never decides that something is
absent — it ranks and shortlists, and the experimentalist picks what to go and look for.

## What is C6's and what is the lab's

C6 is a toolkit that ships. It carries no paths to any machine and knows nothing about any
particular lab, which decides the boundary at both ends of this workflow:

- **Checkpoint management is NOT C6's.** JCA, 2026-09-21: *"everything except checkpoint
  management is part of C6."* Phase 5 here covers filing data, annotating sequences and writing
  results back into the repository. Routing a checkpoint to a student, and chasing it, belongs to
  whatever installation mounts this world — `cortex.labsheets` is one lab's, wrapping
  `c6-labplan` with its own checkpoints and addresses.
- **The collections are NOT C6's either.** A goal is written here; the plasmids, boxes and
  sequence libraries it is matched against live in the project repositories that mount this one.
  Phase 1b is a search C6 defines and other worlds answer.

## The discipline that runs through all of it

**A derived value is derived by a tool, or it is marked as a judgement.** The failure this
workflow is built against is not a wrong number — it is a plausible one. An oligo picked by eye
and an oligo from `oligo.findanneal` are the same thirty characters in the file, and nothing
downstream can tell them apart. So each phase states what it may compute and what it may only
transcribe, and phase 2 carries the rule the furthest: the deliverable of a design is **the
script that produces the construction file**, not the construction file alone, because a script
is reviewable and a sequence is not.

**Absence is not zero.** "No candidate was found" and "no collection could be read" must never
render the same way, at any stage. Every search in this workflow reports which sources it
actually reached.
