# Transformation

Mostly a transcription of the construction file — *"this one is just displaying the info in the
cf, not much to think about"* — with two exceptions that matter more than the rest of the sheet.

## 1. The antibiotic decides whether a rescue step is needed

*"Look at the antibiotic being selected for, which is in the CF, if not Carb/Amp you need to
inject a rescue step."* — JCA, 2026-09-10

Carb and Amp select for a β-lactamase that works on the cell surface, so plating straight after
heat shock is fine. Everything else — Kan, Spec, Cam, Erm — needs the resistance gene expressed
before selection, so the cells get an outgrowth in rich medium first. Exact, from one field of
the CF. `injectTransformRecovery.js`.

## 2. Controls — the part a labsheet usually omits and shouldn't

*"What is important to include though is injected controls for this."*

**When the antibiotic is not Amp/Carb, the students poured those plates themselves**, so the
plates are as unproven as the transformation:

> *"If they are using something other than amp/carb, they will have made their own plates, so
> they should include the control strain from the control stocks box in the -80 streaking that on
> one of the plates. They should also do a tranformation control, positive and negative (meaning
> with and without dna added) with the same competent cells and the control plasmid."*

So three controls, each answering a different question:

| control | what it distinguishes |
|---|---|
| control strain streaked on one plate | the plates select at all — a bad plate looks exactly like a failed transformation |
| positive: control plasmid + these competent cells | the cells are competent |
| negative: same cells, no DNA | the plate is not just growing untransformed cells |

**The control strains and plasmids, by antibiotic**, from the control stocks box in the −80:

| | |
|---|---|
| `K1` | kanamycin |
| `S1` | spectinomycin |
| `E1` | erythromycin |
| `C1` | chloramphenicol |
| `A1` | carbenicillin |

**Without these, a plate with no colonies has four possible causes and no way to tell them
apart.** That is why they are injected rather than offered.

## 3. Ask about controls the experiment needs downstream

*"You may also need to discuss adding additional controls with the user when writing the
labsheet, things like retransforming the parent plasmid in preparation for later assays."*

A comparison that will be wanted three sheets later has to be set up *now*, in the same batch of
competent cells, or it is not a comparison. This is a question to ask, not a rule to apply.
