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

## What code does here, and what it cannot

The lookup is exact and belongs in `planDilutions.js`: names in, inventory queried, one of the
three outcomes per oligo. **Choosing where the new tubes go is not** — it is the same judgement
as `miniprep.md`, and it needs to look at what the box already holds.
