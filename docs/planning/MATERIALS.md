# Phase 1b — the materials

**What already exists that could fill each slot of the goal, where it is, and how much the hit
can be trusted.** The phase ends in a bag of annotated sequences that are real, and a shortlist
per slot for the things that are not yet certain.

→ the overall flow: [README.md](README.md) · previous: [GOAL.md](GOAL.md) · next: [DESIGN.md](DESIGN.md)

## Status: the ranking exists, the adapters do not

`materials.rankcandidates` and `materials.materialsforgoal` do the search and the absence
bookkeeping: every candidate for every slot, ordered by the confidence each source declares
about itself, the n best bets flagged on top, and the three kinds of nothing kept apart. The
gate is checkable — phase 1b passes when `unfilled` is empty and `unreadable` is empty or
deliberately accepted.

**What does not exist is an adapter per collection.** Nothing yet turns a particular world's
boxes and sequence libraries into the `Source` shape this takes, so a caller supplies sources by
hand and the gate is only as good as what was handed to it. What exists instead is
world-specific and was written for one collection at a time:

| | |
|---|---|
| `jtk.find` (Nissle) | the JTK historical collection — 784 verified −80 tubes, 2674 plasmid-stock positions, 202 strain records, 3693 sequences |
| `pimar.plasmid.promoter-map` (Pimar) | every CDS in the lysis/holin/APAP maps paired with its nearest upstream promoter |
| `igem-deletion.parts` (UCB iGEM Deletion) | the FEATURES tables of 34 plasmid maps, searched for an annotated part |

Three different searches, keyed to three different things, none of which takes a goal. Until one
does, this page is the specification of what it must do, and the gate between phase 1b and
phase 2 is enforced by nothing.

## What the button must do

**IT RANKS; IT NEVER EXCLUDES.** JCA, 2026-11-04: *"when planning, I don't think it should try to
exclude. It should give all the options and provide its n best bets for the experimentalist to
look for and find a sample of. Let the user pick which to go after."* A search that drops the
low-confidence hits is deciding on the experimentalist's behalf, using a confidence model it
cannot justify, about a freezer it has never opened.

**CONFIDENCE IS A PROPERTY OF THE SOURCE, NOT A LAW.** `jtk.find` reports a −80 hit as a tube you
can walk to and a plasmid-stock hit as a lead, and that is correct *for that collection* — JCA,
2026-11-04: *"those −80 things are correctly addressed and present. The plasmids and other tabs
of this, less clear if they exist."* It does not generalise. Some boxes are better than others
and the toolkit is not in a position to know which, so the ranking is declared per source and
carried through to the output rather than inferred.

**A MISS IS WEAK EVIDENCE, AND IT MUST SAY SO.** The JTK collection's dates run 2010–2012, so
something absent from it may simply be newer — `pDel7`, `pGhost` and `pBACr899` are all real and
all absent. "Not in this collection" and "does not exist" are different sentences.

**IT REPORTS WHICH SOURCES IT REACHED.** A collection that could not be read is NAMED, never
skipped. An unreachable mount and an empty result produce identical silence otherwise, and the
silence reads as "we don't have it".

## The shape of the answer

Per slot in the goal: every candidate found, each with its source, its location, its
source-declared confidence, and why it matched. Then the n best bets flagged — a recommendation,
not a filter, with the rest still listed beneath it.

The output of the phase is the parts library that [phase 2](DESIGN.md) designs against, in the
shape `eugene.enumeratedesigns` takes: parts with types and properties, including `Sequence`
where it is known. Parts with no sequence are legitimate here and are carried as such —
`eugene.devicesequence` names them rather than quietly leaving them out.

## The annotation half

What comes out of this phase should be **annotated** sequences, not bare ones, because phase 2
designs against features and the next person reads them. C6 already has that side:
`C6-Annotator.js`, the feature library and `bin/c6-featurelib`. What is missing is the search
that decides which sequences to annotate, not the annotation.
