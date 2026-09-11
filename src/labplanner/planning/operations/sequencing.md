# Sequencing

**This one is a conversation, and the file says so rather than pretending otherwise.**

*"I'd say discuss this with the user. It is very contextual as to what to do. Depends on copy
number, history of sequencing similar things, whether you need full plasmid or just a little
region, looking up what oligos are available to sequence that are nearby the region you care
about. not trivial."* — JCA, 2026-09-10

## What the conversation is about

| turns on | why it changes the answer |
|---|---|
| **copy number** | a low-copy plasmid or a BAC may not give enough miniprep DNA for a Sanger read; that pushes toward amplifying the region first, or toward full-plasmid sequencing |
| **what has been sequenced before** | a construct whose backbone was confirmed last month needs the new junction read, not the whole thing |
| **full plasmid, or a region** | different cost, different turnaround, different submission |
| **which oligos are already available near the region** | an existing oligo that reads into the region costs nothing; a new one is an order and a wait |

That last one is a real lookup and worth doing before asking: search the project's oligos for one
that anneals within reading distance of the region of interest, on the right strand. `c6-sim
<cf> --primes <oligo>` answers it directly — it reports where the oligo sits in the product,
which way it reads, **and whether it has more than one site**, which is the failure a labsheet
cannot otherwise catch: two sites give an unreadable trace.

## Worked example, for calibration

SynThera's `sGho1` reads 479 bp to the engineered junction in pGhost15 and has exactly one site
in every library construct. That is why one oligo serves all six — which was checked, not
assumed. → `UCB_iGEM_SynThera/SLIP4/SIMULATION-NOTES.md`

## The dilution is different here

Sequencing wants a **2.66 µM** working stock, not the 10 µM that PCR wants. → `dilutions.md`

## Where it gets submitted is NOT C6's business

The submission route is the lab's own and arrives as `--sequencing-url`, exactly as the collector
address does. JCA, 2026-09-10: *"That is my lab specific route for submitting sequencing, so that
does not go onto C6."* This toolkit knows a sequencing step has a route; it must never know what
anybody's route is. → `cortex c11 which "where do we submit sequencing"`

**Sanger only.** *"and that is only for sanger."* Full-plasmid sequencing is a different vendor
and a different route, so a full-plasmid sheet gets no link — sending somebody to submit a whole
plasmid through the form for reads is worse than sending them nowhere.

## The checkpoint

`checkpoint.analysis`, on every packet that sequences. The data reaches the student by forwarded
email and what comes back is their reading of it — *"The students will get data via email and
they will do their analysis and email it with the routing tag."* It routes like every other
checkpoint. → `UCB_iGEM_SynThera/CHECKPOINTS.md`
