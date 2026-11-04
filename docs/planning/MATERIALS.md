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

**What does not exist is an adapter.** Nothing yet turns a lab's own boxes and sequence
libraries into the `Source` shape this takes, so a caller supplies sources by
hand and the gate is only as good as what was handed to it. What exists instead is
per-repository: a project that mounts C6 typically has its own search over its own freezer
boxes, its own plasmid maps or its own sequence library, each keyed to whatever that repository
happens to record. None of them takes a goal, and none of them returns the `Source` shape. The
adapter is the missing piece, and it belongs to the repository that owns the records — not
here.

## What the button must do

**IT RANKS; IT NEVER EXCLUDES.** JCA, 2026-11-04: *"when planning, I don't think it should try to
exclude. It should give all the options and provide its n best bets for the experimentalist to
look for and find a sample of. Let the user pick which to go after."* A search that drops the
low-confidence hits is deciding on the experimentalist's behalf, using a confidence model it
cannot justify, about a freezer it has never opened.

**CONFIDENCE IS A PROPERTY OF THE SOURCE, NOT A LAW.** A tube in a freezer somebody keeps
properly is a thing you can walk to; the same plasmid named in an old spreadsheet is a lead. But
which of a lab's records are which is that lab's own knowledge — some boxes are better kept than
others, and a toolkit that shipped with an opinion about it would be wrong somewhere else. So
each source declares its own confidence and its own label, and both are carried through to the
output rather than inferred here.

**A MISS IS WEAK EVIDENCE WHEN A SOURCE HAS A HORIZON.** A stock list assembled years ago is
missing everything built since, and things absent from it are routinely real. "Not in this
source" and "does not exist" are different sentences, and a source that knows its own horizon
should say so in its label.

**IT REPORTS WHICH SOURCES IT REACHED.** A source that could not be read is NAMED, never
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
