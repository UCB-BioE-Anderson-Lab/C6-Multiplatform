# The labsheet naming ontology

**Settled 2026-09-12 by JCA, answering GATE 0.** This is the statement everything in
`docs/TOOLKIT-PLAN.md` is built against. Where it disagrees with
`BioE134 - 15 - LabPlanner.pptx`, this file wins and says so.

---

## 1. `label` and `side-label` are two surfaces, not two names

> *"'label' means what is written on the cap. 'side-label' is what is written on the side. A pcr
> tube only has a top label, as the side is too slippery."*

| tube | `label` | `side-label` | limit |
|---|---|---|---|
| 200 µL PCR strip | yes | **none** — the side is too slippery to write on | **3 characters** |
| 1.5 mL microcentrifuge | yes | yes | **12** — a name, a hyphen, a clone designation |
| a sequencing tube, sent off-site | yes | yes | **13** — one more, for the read direction |

**REVISED 2026-09-13, and the first version said six.** It read *"a 1.5 mL is ~6 char"* as the
limit on the written string, which conflicts with the convention two lines below — `pBET8-A` is
seven. JCA settled it:

> *"Maybe 6 cap on a name (a rule on CF drafting more) plus 2 more for the clone. That is all still
> writeable, it just takes two lines. Even a pBET12-4B3 is writeable. I think we've been too strict
> on names, but in general less characters is more legible than more characters."*

So the six is a rule about **drafting a name**, and it lives where names are drafted — §3 below,
said by `c6-check` while somebody is still typing. What a *cap* has to hold is a name at its
practical limit, a hyphen, and a clone designation which may be a plate address. Enforced by
`models/labsheet.js § TUBE`, which is the only place these numbers exist.

**They may hold the same string, and for a miniprep they do.**

> *"the convention for a single clone miniprep is to put the construction + '-' + clone
> identifier, and to both top and side label with that combined String"*

So `pBET8-A` on the cap and `pBET8-A` on the side. **This supersedes LabPlanner slide 34**
(`A1A` on the cap, the full name on the side), which was the 2024 teaching example.

## 2. A label is an exact key

> *"whatever the labsheet says those Strings are should be treated as exact keys. When referring
> to those samples later, you use those keys."*

This is the load-bearing sentence for the datastructure. A label is an identifier, not a
decoration: every later reference — another sheet, the returned workbook, the inventory — resolves
through that exact string. **A renderer that prettifies a label breaks a key**, and two samples
sharing a label within a scope where both exist is a defect, not an inconvenience.

## 3. Three different things get named, and each has its own rule

> *"What is important is what you are naming — are you naming a prefix for the experiment, for a
> sample, or something else."*

| what | rule | why |
|---|---|---|
| **a DNA / construct name** | **6 is the aim, 8 is about the limit** | it goes on a 1.5 mL cap with a clone designation after it. `pBET8` fits easily; `pGhost17` is eight and this lab has used it for years; `Pcon-amilGFP-Term` is a working name, not a tube name. Warned about by `c6-check` while the file is being drafted — after that the name is the key every later step resolves through. |
| **a PCR tube label** | **3 characters, including the running letter** | a 200 µL cap, written in gloves, eight times in a setup. `L3a`. |
| **a clone designation** | `[A-Z]`, or `[0-9]`, or `[0-9][A-Z][0-9]` for a plate — Nth plate, row X, column M | so `A`, or `3`, or `1A3` |

Whether a short label's prefix stands for the experiment or for a thread is **not fixed** —
*"It really can be either."* What must be fixed is which of the three things above is being named.

## 4. Derived labels are prefixes

> *"For a zymo, I typically add a z to whatever the PCR label was. A digest would probably have a d
> in front of the original PCR label."*

Prefix, not suffix. **This supersedes the 134 spec's `A1` → `A1p` → `A1d`.**

## 5. A sequencing reaction is named for the miniprep it reads

> *"Sequencing reactions are usually construct name + '-' + clone identifier, same as what is
> written on the miniprep tube. Those tubes get sent off, so there is no conflict in having them
> named the same as the miniprep."*

So `pBET8-A`, identical to the miniprep's label. The collision is deliberate and harmless: the
reaction leaves the building. Two reads of one clone still need telling apart — `pBET8-AF` and
`pBET8-AR`, which is what the Lactis3 workbook used.

## 6. There are no rules about how DNAs are named, and the compiler may not assume any

> *"We aren't redesigning construction files here. We are compiling CF to labsheets. There are no
> rules about how DNAs are named anyway."* — JCA, 2026-09-12

**This corrects an earlier draft of this file, which was wrong.** He had described the usual
practice — *"A construction file should end typically with a transformation step, and that is where
the product's 'p' + name gets stated... For libraries, we often name them instead with a little l
first"* — and I read a convention as a constraint, concluded that `Construction of pBET8.txt`
breaks it, and proposed correcting the team's file. There is nothing to correct. **Typical is not
required, and a compiler that only works on files following a convention is a compiler that fails
on real input.**

So:

- A construction file may name its product at any step, under any name.
- Working names are file-local; `cfToJobs.js` already resolves them that way and that is the whole
  answer to two files each producing a `gg`.
- **No namespacing.** LabPlanner slide 6's `pTarget-cscB1/ipcr1` is not adopted.
- Where a name means one thing early and another later — `pBET8` is the assembly reaction until a
  clone is verified, and the verified clone after — **that is the toolkit's problem to carry**, not
  the file's to avoid. It is carried today by the holder map in `design/index.js`.

## 7. A PCR sheet states its program and its destination

> *"We don't need to track specific thermocyclers or block ids. The program being run in a pcr is
> absolutely essential information for a labsheet. The destination is pretty much always the 'to
> gel' box, and it is good to keep that stated as all pcrs get put in that box."*

So of LabPlanner's two fields, **`program:` yes and machine assignment no**. `destination:` stays,
but it names where the finished tubes go — the *to gel* box — and not a thermocycler block. No
machine inventory, no thread affinity, no contention.

## 8. Everything after the construction file lives in the characterization file

`Verification of <product>.txt` was added 2026-09-11 and is **folded back in**: the characterization
file describes what happens to the plasmid once it is built, and confirming that it is built is
part of that. One grammar, not two.

The verification steps therefore become **declarable**, where today they are always injected:

```
Pick        pBET8_Mach1     n=2 medium=2YT+Erm      pBET8_colonies
Miniprep    pBET8_colonies  box=cheese_temp         pBET8_clones
Sequence    pBET8_clones    oligos=bf037,bf038 reads=F,R   pBET8_reads
```

`injectVerification.js` keeps its job for the files that do not declare them — an experiment with
no characterization file at all still needs picking and sequencing — so **declared wins, injected
is the fallback**, and the open-decision reporting stays either way.

## Settled by assumption, say otherwise

- Pick default becomes **2**, per the spec, rather than 4.
- **Erm joins the antibiotic enum**, with Chl and the rest C6-Sim already knows.

## Still open, to settle at GATE 3a with a rendered sheet in front of you

- What a control plate's product column says.
- Whether `Plate` is its own sheet after a rescued transform.
