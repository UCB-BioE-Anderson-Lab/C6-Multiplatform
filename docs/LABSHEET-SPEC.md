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
| 200 µL PCR strip | yes | **none** — the side is too slippery to write on | **under 4 characters** |
| 1.5 mL microcentrifuge | yes | yes | **about 6 characters** |

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
| **a DNA / construct name** | about **6 characters** | it goes on a tube cap. `pBET8` fits; `Pcon-amilGFP-Term` does not and is a working name, not a tube name. |
| **a PCR tube label** | **under 4 characters** | a 200 µL cap, written in gloves, eight times in a setup |
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

## 6. The construct is named by the construction file's LAST step

> *"A construction file should end typically with a transformation step, and that is where the
> product's 'p' + name gets stated... whatever the last step of the construction file is would be
> the name of the product construct."*
>
> *"For libraries, we often name them instead with a little l first."*

Everything before the last step is a **working name**, local to its file — `gg`, `lig`, `backbone`,
`ipcr1`. The transform names the construct: `pBET8`, `lLIB4`.

**So no namespacing.** LabPlanner slide 6 writes `pTarget-cscB1/ipcr1` on the labsheet to
disambiguate working names across files; this rule makes that unnecessary, and `cfToJobs.js`
already resolves working names file-locally.

### The consequence: `Construction of pBET8.txt` does not follow this

```
GoldenGate  Pcon-amilGFP-Term  backbone  BsaI  pBET8          ← names the construct at the assembly
Transform   pBET8  Mach1  Erm  37        pBET8_Mach1          ← names a strain-suffixed thing at the transform
```

The convention, and every 134 example, is the other way round:

```
GoldenGate  Pcon-amilGFP-Term  backbone  BsaI  gg
Transform   gg  Mach1  Erm  37           pBET8
```

**This is upstream of several downstream problems already found.** Because `pBET8` names the
assembly, the characterization file's `Retransform pBET8` resolves to the Golden Gate tube — the
bug where the electroporation sheet said to fetch the assembly reaction, which needed a special
`hold()` mechanism in `design/analysis.js` to work around. With the CF written to convention,
`pBET8` IS the transform's product and the edge is right without the workaround.

Not changed: that file is the team's, and JCA's ruling from 2026-09-11 stands —
*"'pBET8_Mach1' I would expect that to say more like 'pBET8'."* Proposed at GATE 0.

---

## Still open

1. `Verification of <product>.txt` — keep, or make these LabPlanner decisions with defaults?
2. What a control plate's product column says.
3. Pick default: 2 (spec) rather than 4 (built)?
4. `destination:` / `program:` — thermocycler assignment, in scope?
5. Is `Plate` its own sheet after a rescued transform?
6. Erm into the antibiotic enum.
