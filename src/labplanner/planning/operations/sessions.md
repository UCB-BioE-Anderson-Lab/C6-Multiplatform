# Sessions — where a labsheet ends

**One labsheet is one person doing one work session.** JCA, 2026-09-11: *"KISS and make it one
labsheet per person... I don't think a labsheet should represent a project; it corresponds to one
person doing work, 1 sheet per work session."* The same session may be issued to two students
with different labels; that is two labsheets, not one shared one.

**So the binning question has a second half.** `binReactions.js` answers which steps *may* share
a sheet — reachability in the dependency graph, and that is exact. It does not answer which
steps *should*, which is about how long a person can stand at a bench and what has to incubate
overnight. That is lab knowledge and it belongs here, in prose.

## The pairing for a cloning-plus-characterization experiment

JCA, 2026-09-11, for the Lactis3 workflow:

| session | steps | why |
|---|---|---|
| 1 | PCR | *"PCR is a day. Running that is long."* |
| 2 | Gel, Zymo, Assembly | *"can be done in one sitting, but it's a long one, and a long labsheet"* |
| 3 | Transformation | *"next sitting"* |
| 4 | Pick | |
| 5 | Miniprep, Sequencing | *"together"* |
| 6 | Seq analysis | desk work, no bench |
| 7 | Retransformation | into the target organism — see § the two kinds of transformation |
| 8 | Pick | of the retransformation |
| 9 | Assay | |

**Session 2 is flagged in his own words as a long labsheet.** Take that as a standing warning
rather than a target: if it will not fit one printed page at readable size, the renderer says so,
and the answer is to split it rather than to shrink the type.

**Do not read this table as a rule for every experiment.** It is the shape of one cloning
workflow that ends in an assay. An experiment with no characterization phase stops at session 6;
one screening a library picks differently and may not sequence at all.

## The two kinds of transformation, which look the same and are not

JCA, 2026-09-11: *"Many steps from cloning happen again during post-transformation processes, and
it would make sense that the same instructions given for a cloning transformation would be
similar to those in this context. They are slightly different procedures, though — you are just
transforming plasmid dna into cells, not assembly reactions, so you don't use as much cells, and
you don't need to pick tons of colonies; So, a lot is similar — take pics, antibiotics, etc; but
some differences."*

| | transforming an assembly | transforming a plasmid |
|---|---|---|
| what goes in | a Golden Gate or Gibson reaction | miniprepped, sequence-verified DNA |
| cells | a full aliquot | less |
| colonies to pick | several — most may be wrong | few — the plasmid is already known good |
| photos, antibiotic, controls | the same | the same |

**The second is not a construction step.** A construction file describes the chemical structure
of the DNA, and nothing about the DNA changes when it is moved into another organism. Where the
declaration for it belongs is an open question — see `docs/CHARACTERIZATION.md`.
