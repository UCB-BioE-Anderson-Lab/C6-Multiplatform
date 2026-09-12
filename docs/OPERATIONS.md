# The operations, translated directly from LabOP

## The name: these are OPERATIONS, and that was never in doubt

**They are not "LabOps".** JCA, 2026-09-11: *"If we aren't doing sbol, we most definitely should
not be calling these LabOps."*

The name was borrowed here for a day and is withdrawn. Two reasons, and the second is the one
that matters:

1. **The code already had a name for them.** `job.operation`, `planning/operations/*.md`,
   thirteen files. Nothing needed naming; a second word was invented on top of the first.
2. **"LabOps" reads as a claim of alignment with LabOP, and we are not adopting LabOP** — and it
   would be a claim about the wrong tier even if we were, since a LabOP *Primitive* is a bench
   motion and ours is a labsheet step. Borrowing a standard's name for a thing that is not that
   standard's thing is how two tables of antibiotics come to drift: the name asserts a
   correspondence that nothing checks.

**What we DO take from SBOL stays, and is separate.** `sbol.component`, `sbol.sequence`,
`sbol.subcomponent`, `sbol.implementation` are real, built and validating — those are SBOL's
concepts under SBOL's names, which is exactly the case where borrowing is right. LabOP is a
different standard from SBOL, and declining one is not declining the other.


**Verified against the LabOP primitive libraries on 2026-09-11**, not recalled —
`github.com/Bioprotocols/labop/tree/develop/labop/lib`. Every name and parameter below is read
from that source.

## The twist: LabOP's primitives are finer than a labsheet step

This is the thing to settle before any shorthand is written. LabOP's unit is a **bench motion**:

    Vortex(samples, duration)
    QuickSpin(location)
    Transfer(source, destination, amount, ...)

Our unit is a **step on a labsheet** — "Zymo", "Gel", "Miniprep" — each of which is a dozen of
those. So a direct translation does not give us our operations. It gives us what our operations are
*made of*.

**LabOP already has the word for our layer: a Protocol is a composition of Primitives.** So the
two tiers are its tiers, not an invention:

| tier | LabOP calls it | we call it | example |
|---|---|---|---|
| bench motion | Primitive | — (no name today) | `Vortex`, `QuickSpin`, `Transfer` |
| labsheet step | Protocol | operation | Zymo, Gel, Miniprep |

`planning/operations/*.md` and `protocols/modules/*.js` are already the second tier. What we have
never had is the first.

## The primitives, as published

**liquid_handling** — Provision, Dispense, Transfer, TransferInto, Dilute, DiluteToTargetOD,
SerialDilution, TransferByMap, PipetteMix, Vortex, Discard

**plate_handling** — Cover, Seal, Filter, EvaporativeSeal, AdhesiveSeal, ThermalSeal, Uncover,
Unseal, Incubate, Hold, HoldOnIce, Spin, QuickSpin

**culturing** — Transform(host, dna, amount, selection_medium, destination) → transformants ·
Culture(inoculum, replicates, growth_medium, volume, duration, orbital_shake_speed, temperature,
container) · CulturePlates(quantity, specification, replicates, growth_medium) → samples ·
PickColonies(colonies, quantity, replicates) → samples

**spectrophotometry** — MeasureAbsorbance(samples, wavelength, numFlashes, timepoints) →
measurements · MeasureFluorescence(samples, excitationWavelength, emissionWavelength,
emissionBandpassWidth, emissionLowpassCutoff, numFlashes, gain, timepoints) → measurements ·
MeasureFluorescenceSpectrum(samples, excitationWavelength, numFlashes, gain) → measurements

**pcr** — PCR(cycles, denaturation_temp, denaturation_time, annealing_temp, annealing_time,
extension_temp, extension_time)

*(`sample_arrays` not yet read.)*

## Four of ours map straight onto a primitive

| ours | LabOP primitive | note |
|---|---|---|
| pick | `PickColonies` | exact — and it already carries `quantity`, which `operations/pick.md` says is a conversation |
| transform | `Transform` | |
| retransform | `Transform` | **the same primitive with a different `host`.** At the Protocol tier they stay two operations, because what differs is the procedure and the purpose |
| assay (fluorescence) | `MeasureFluorescence` | `emissionBandpassWidth` and `gain` are parameters the Cheese workbook does not record |

## And one name collides while the scope does not

**LabOP's `PCR` is the thermocycler program only** — cycles and six temperatures and times.
Our PCR step is reaction setup *plus* cycling: a mastermix, six components, a table of samples.

So `PCR` in LabOP is a Primitive inside our PCR Protocol, not a translation of it. Using the name
for both would be the two-tables failure again, wearing a nicer badge.

## Ours that are Protocols with no single primitive behind them

gel · zymo · miniprep · sequencing · seq analysis · dilution

Each is a sequence of primitives — a Zymo is `Provision`, `Transfer`, `Spin`, `Discard`,
`Transfer`, `Spin` and so on. **This is where the existing `protocols/modules/*.js` already live**,
and they are the right granularity for a person; the primitives are the right granularity for a
machine.

## What this implies for the shorthand — OPEN

A PL types the Protocol tier and never the Primitive tier. So the shorthand names operations, and the
primitives are what an operation *expands to* when somebody wants to export to a robot:

    Zymo      g1 b1              -> zg1 zb1
    Pick      pBET8_Mach1  4     -> pBET8-A..D
    Measure   fluorescence  pBET8_lactis  ex 483  em 525  bandpass 30

**Undecided:** whether we write the primitive expansions at all. They buy machine execution and
interchange, and they cost a maintained second description of every protocol we already have in
prose. Nothing here needs a robot today.
