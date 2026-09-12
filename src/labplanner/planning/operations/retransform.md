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

## Controls

The same set as a Transform, for the same reason: without them a plate with no colonies has
several possible causes and no way to tell them apart. The untransformed host is the one that
matters most here, because it is also the negative control the **assay** reads against — so it
is not merely a check that the step worked, it is a sample the experiment needs later. Set it up
in the same session, from the same cells.
