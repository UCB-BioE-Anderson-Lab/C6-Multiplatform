# Phase 2 — the cloning design

**The synthetic DNA that has to be made, and how it gets built.** The phase ends in construction
files, oligo order forms and synthesis orders — and, as the thing that makes them reviewable,
**the script that produced them**.

→ the overall flow: [README.md](README.md) · previous: [MATERIALS.md](MATERIALS.md) · next: [the build](../LABPLANNER.md)

## What a design script is

An ES module exporting `design()` — sync or async — returning:

```js
{ oligos: [{ name, sequence, anneal?, template? }], cf?: "<construction file text>" }
```

`anneal` and `template` are what make an oligo checkable: the annealing region as the design used
it, and the sequence it anneals to. An oligo without them is reported UNCHECKED rather than as
passing. `oligo.eipcr` returns `fwdAnneal` and `revAnneal` for exactly this reason.

Imports are limited to C6 and the Node standard library — `fs` and `node:fs` are both the
standard library and both accepted. Anything else is a hard finding, because a second oligo
designer smuggled in from elsewhere would make every other check here meaningless.

**This contract used to live only in `bin/c6-design`'s header.** A session that wrote a design
script from this page alone, on 2026-11-04, produced one the auditor could not audit — which is
the same shape as an unchecked oligo passing, one level up.

## The deliverable is the script, not the construction file

This is the rule the whole workflow turns on, and it exists because of a specific failure. JCA,
2026-11-04:

> *"in a recent design, instead of using C6's findBestAnneal to design an oligo, you instead just
> picked an arbitrary 30 bp sequence. It might work, but it was bad design. And I had no easy way
> of reviewing how you computed your design to see that you were improvising rather than using
> the well-tested tools."*

A construction file carries results. An oligo chosen by eye and an oligo from
`oligo.findanneal` are the same thirty characters, and nothing downstream distinguishes them —
the file carries no trace of its method. So the method becomes an artifact: **a Node script that
expresses the design as C6 calls and emits the construction file**, committed beside it.

A bare DNA literal in a script is visible in a way the same literal inside a construction file
is not. That is the entire mechanism, and it needs no instrumentation: re-run the script, see
that it produces the file, read it and see C6 being called.

## Status

| | |
|---|---|
| the design pieces | **exist** — `oligo.findanneal`, `oligo.scoreanneal`, `oligo.eipcr`, `cf.sim`, `cf.check` |
| auditing a value | **exists** — `audit.auditanneal`, an anneal against what the tool would have chosen for the same 3′ end |
| auditing the text | **exists** — `audit.auditscript`, hand-typed sequences and imports from outside C6 |
| the runner | **exists** — `design.audit` (`bin/c6-design`) runs a script and collects both over the whole design |
| the advisory LLM pass | **NOT built** |

So the gate *into* phase 3 is real — a construction file must pass `cf.check` and simulate
against its recorded maps under `cf.sim --maps` — and `c6-design` exits 1 on a hard finding.
What is still true is that **running it is a step somebody takes**, not something a design must
pass through on its way to being compiled: nothing downstream refuses a construction file whose
script was never audited.

Neither audit half is sufficient alone: `auditscript` reads text and cannot tell that a value
came from the right function, and `auditanneal` checks one value and knows nothing about the
script around it.

**A design is only checkable if its oligos carry `anneal` and `template`.** `designEIPCR` returns
`fwdAnneal` and `revAnneal` for exactly this reason — it used not to, and the most tool-derived
design in the repository reported as UNCHECKED because the anneals `findanneal` had chosen were
folded into the oligo and discarded.

## What the audit must do

The deterministic half first, because it needs nobody's cooperation and no judgement:

- **Re-score, don't re-derive.** For each designed oligo, locate its annealing region on the
  stated template and score both it and what `oligo.findanneal` would have chosen. Exact
  re-derivation needs the window that was passed, which the file may not record; scoring both
  needs only the template and the sequence. Improvised choices score worse, because the tool
  exists for choices that are not obvious by eye.
- **Imports are limited** to C6 and the standard library, so a second implementation cannot be
  smuggled in from elsewhere.
- **Bare DNA literals are listed.** Any `[ACGT]{12,}` string in the script that did not come from
  a file or a C6 call is reported by name.

Then, and only as advisory, the semantic question — *could this have been done with C6 and was
not?* — which genuinely needs to know that `oligo.findanneal` exists and is the right tool. That
is a narrow question asked about the literals the deterministic pass already isolated, and its
output is a findings file somebody reads. **It never gates**, because an agent reporting that a
design looks fine is the same class of claim as the agent that wrote it.

## What a pass does and does not mean

**UNDECLARED IS NOT VERIFIED.** Where a choice was genuinely a judgement — and many are — the
audit must print it as *"no tool covers this"* rather than passing it silently. The line between
"C6 chose this" and "a person or a model chose this" belongs in the report, not in the reader's
assumptions.

**A CHECK NOBODY HAS SEEN FAIL IS A CLAIM.** Before this is relied on, it gets fed a deliberately
improvised oligo and watched going red.
