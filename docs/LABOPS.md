# The LabOps, translated directly from LabOP

**Verified against the LabOP primitive libraries on 2026-09-11**, not recalled —
`github.com/Bioprotocols/labop/tree/develop/labop/lib`. Every name and parameter below is read
from that source.

## The twist: LabOP's primitives are finer than a labsheet step

This is the thing to settle before any shorthand is written. LabOP's unit is a **bench motion**:

    Vortex(samples, duration)
    QuickSpin(location)
    Transfer(source, destination, amount, ...)

Our unit is a **step on a labsheet** — "Zymo", "Gel", "Miniprep" — each of which is a dozen of
those. So a direct translation does not give us our LabOps. It gives us what our LabOps are
*made of*.

**LabOP already has the word for our layer: a Protocol is a composition of Primitives.** So the
two tiers are its tiers, not an invention:

| tier | LabOP calls it | we call it | example |
|---|---|---|---|
| bench motion | Primitive | — (no name today) | `Vortex`, `QuickSpin`, `Transfer` |
| labsheet step | Protocol | LabOp | Zymo, Gel, Miniprep |

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

A PL types the Protocol tier and never the Primitive tier. So the shorthand names LabOps, and the
primitives are what a LabOp *expands to* when somebody wants to export to a robot:

    Zymo      g1 b1              -> zg1 zb1
    Pick      pBET8_Mach1  4     -> pBET8-A..D
    Measure   fluorescence  pBET8_lactis  ex 483  em 525  bandpass 30

**Undecided:** whether we write the primitive expansions at all. They buy machine execution and
interchange, and they cost a maintained second description of every protocol we already have in
prose. Nothing here needs a robot today.
