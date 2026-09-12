# Retransformation

**Moving a finished plasmid into the organism the experiment is actually about.** JCA,
2026-09-11: *"I think an assay-associated transformation visually resembles a cloning
transformation, but at an operation level, they are two separate things. Perhaps it is a
retransformation."*

## Why it is not a Transform

It looks identical on a bench and is a different procedure. What goes in is **miniprepped,
sequence-verified plasmid**, not an assembly reaction, and everything downstream follows from
that:

**But it is not true that it leaves the DNA untouched**, and an earlier draft of
`docs/ONTOLOGY.md` said so. JCA, 2026-09-11: *"putting the dna into the cell definitely changes
it — it gets methylated, nicks cleaned up, etc."* A plasmid moved into another host picks up
that host's methylation pattern. So whether a retransformation is declared in the construction
file or outside it is genuinely OPEN — see `docs/ONTOLOGY.md § OPEN`. Being a separate
*operation*, which is what this file is about, is settled and is a narrower claim.

| | Transform | Retransform |
|---|---|---|
| input | a Golden Gate, Gibson or ligation reaction | one verified plasmid |
| cells | a full aliquot | less — the DNA is clean and concentrated |
| colonies to pick | several; most may be wrong | few; the plasmid is already known good |
| method | heat shock, usually | often electroporation, into an organism that cannot be heat-shocked |
| organism | a cloning strain | the one the experiment is about |
| photos, antibiotic, controls | the same | the same |

**Making it a parameter of Transform was the first proposal and it was wrong.** The two share a
protocol's worth of surface and differ in what the step is FOR, which is what an operation name
carries. A parameterised version also left `binReactions.js` unable to tell them apart — see
below.

## It is not a construction operation

**A construction file describes the chemical structure of the DNA.** Nothing about the DNA
changes when it is moved into another organism, so a retransformation has no place in a CF and
`KNOWN_OPERATIONS` deliberately omits it. It belongs to the post-construction declaration —
`docs/CHARACTERIZATION.md`.

## What this fixed on its own

Two Transform jobs in one plan were binned onto **one labsheet**, because `binReactions.js` saw
two jobs of the same operation and nothing distinguishing them — while in reality they were weeks
apart, by different methods, into different organisms, at different temperatures. Giving the
second one its own operation name separates them without teaching the binner about strains.

**The narrower bug is still there and is worth knowing:** two genuine Transforms that differ in
strain or temperature will still share a sheet. That is usually right — two assemblies
transformed the same afternoon belong together — and wrong for the case where it is not. Left
alone rather than guessed at.

## Controls — three plates, not two

JCA, 2026-09-11: *"They should run that pTRK parent plasmid as a positive control on the
electroporation. So, 3 plates."*

| plate | what it is | what its absence would hide |
|---|---|---|
| the construct | the plasmid being tested | — |
| **positive: the parent plasmid** | known-good DNA, same cells, same pulse | that the cells were dead or the pulse was wrong |
| negative: untransformed | the host, no DNA | that the plate was not selecting |

**Without the positive control, a plate with no colonies has three causes and no way to choose
between them:** bad competent cells, a bad electroporation, or a construct that genuinely does
not go in. Two of those are the experiment's fault and one is the student's afternoon, and they
are indistinguishable from an empty plate.

The parent plasmid is the right positive because it is known to electroporate into this host —
it is where the backbone came from. A positive control that has never been through this
procedure proves nothing about the procedure.

**The negative does double duty and must be planned as such.** The untransformed host is both
the check that selection works and the baseline the **assay** reads against, so it is not
discarded after the plate is counted: it is grown and read alongside the samples. Set up in the
same session, from the same cells — a baseline from last week measures a different week.
