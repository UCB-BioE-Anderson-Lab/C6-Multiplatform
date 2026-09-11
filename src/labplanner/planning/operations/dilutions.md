# Dilutions

**JCA, 2026-09-10, in full:**

> *"Dilutions typically happen before PCR and sequencing. Start by pulling out all the oligos
> from pcr and sequencing steps. When looking for the oligos to use in PCR, you first search for
> a 10 uM stock. If that doesn't exist, you search for a 100uM stock. If that doesn't exist you
> say to buy it. So, you are going to either specify a location of an existing tube, or you are
> going to add a dilution labsheet saying to make it and where it should be put in the freezer,
> the state that location on the pcr labsheet. Assume, in the way it is written, that the user
> will create the 100 uM and 10 uM dilutions, and put them in the freezer, and then on another
> day retrieve them from the freezer to do the pcrs. So, you only have a dilution labsheet if
> there weren't ready-to-use oligos in the inventory. For sequencing, you look for a 2.66 uM
> oligo, not 10 uM. But it's a similar deal, if it doesn't exist you make it from the 100 uM."*

## The lookup, in order

Every oligo named by a PCR or a sequencing step, resolved against the inventory:

| want | found | then |
|---|---|---|
| the working stock | yes | **no dilution step.** Put its box and well on the labsheet that uses it |
| the working stock | no, but the 100 µM exists | a dilution step making the working stock, and a place to put it |
| both | no | **say to order it.** Not a dilution step — an order, with its own lead time |

**The working concentration is not the same for both uses:** PCR wants **10 µM**, sequencing
wants **2.66 µM**. Both are made from the 100 µM.

## Why this is a separate labsheet and not a paragraph at the top of the PCR sheet

*"Assume… that the user will create the 100 uM and 10 uM dilutions, and put them in the freezer,
and then on another day retrieve them from the freezer to do the pcrs."*

**Two days, two sheets.** The dilution sheet ends by putting tubes in the freezer at a stated
box and well; the PCR sheet begins by fetching them from that box and well. So the location is
not decoration — it is the join between two sessions, and it has to be decided when the dilution
sheet is written, not left for whoever is holding the tube.

## And no dilution labsheet at all is the common, correct outcome

*"you only have a dilution labsheet if there weren't ready-to-use oligos in the inventory."*

A packet with no Dilution sheet means every oligo was already at working concentration. That is
success, not an omission — do not emit an empty one to keep the shape familiar.

## Four outcomes, not three — and the fourth is a question

`planDilutions.js` does the lookup. The brief names three outcomes; running it on a real freezer
produced a fourth immediately, and it is not a degenerate case of any of the others:

| | |
|---|---|
| `ready` | at working strength. Put the box and well on the labsheet that uses it |
| `dilute` | the 100 µM exists. A dilution step, and a destination to choose |
| `order` | nowhere in the inventory. Not a labsheet — a purchase with a lead time |
| `ask` | **there, and neither usable nor dilutable by the rule** |

`G00101` is the live example: sequencing wants 2.66 µM, the freezer has it at **10 µM**, and
there is no 100 µM to dilute from. You could make 2.66 from the 10 — but that is not the stated
rule, and inventing it silently is how a labsheet acquires a step nobody agreed to.

## An empty inventory is refused, not searched

The first real run reported **"ORDER THESE (6)"** about six oligos sitting in a freezer drawer.
Nothing had malfunctioned: SynThera's inventory file opens with provenance comments, the tabular
parser read the first of them as its column header, and returned a valid *empty* inventory. Every
oligo was then correctly not found.

So `planDilutions` returns an `error` when the inventory has no samples at all, and the parser
now skips `#` lines before the header. **"Could not read the inventory" and "the inventory does
not have these" must never print the same thing.**

## What is still judgement

**Where the new tubes go.** The dilution sheet ends by putting a tube in the freezer and the PCR
sheet begins by fetching it, so the location is the join between two sessions — and choosing a
good one means looking at what the box already holds. Same judgement as `miniprep.md`.
`destination` is left `null` rather than filled with the next free well, so an unplaced tube
cannot be mistaken for a placed one.
