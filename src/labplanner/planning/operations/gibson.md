# Gibson

*"Similar deal with DNA premix."* — JCA, 2026-09-10

Identical to `goldengate.md` on the one point that needs deciding: **three or more DNAs going in
means a DNA premix** — 2–3 µL of each in one tube, then 2 µL of that into the reaction — because
the reaction volume cannot take that many separate additions and still hold its master mix.

Two DNAs go in directly.

Otherwise the construction file and the protocol module say everything: Gibson assembly master
mix, the incubation, the program.

## The simulation warns about single-fragment products

*"We should probably also be validating internal k-mers when we simulate gibson reactions in C6's
simCF --- there should be a warning when there is a possibility of a single-fragment reaction."*
— JCA, 2026-11-14

`gibson()` returns the assembly that was drawn. It is not the only reaction in the tube: T5
exonuclease exposes both ends of every fragment, and a fragment whose two ends share a **direct
repeat** can anneal to itself and circularise, eating both of its homology arms. That product
needs one fragment where the assembly needs two, so it is first order where the assembly is
second order, and **diluting the reaction selects for it**. A vector amplicon carries its own
marker, so every such event also plates.

So before simulating, `gibson()` scans each input fragment with `selfClosureRepeat()` and warns
on stderr, naming the repeat, where its two copies are, and the circle they give. It does not
throw: the drawn assembly is still correct, and what the warning says is that something else will
be on the plate beside it.

| | |
|---|---|
| how far in from each end it looks | SELF_CLOSURE_WINDOW = 60 |
| shortest repeat it reports | SELF_CLOSURE_MIN_K = 7 |

Both numbers come from pCBA11 (CBA-Ligase1, November 2026), where all four clones sequenced were
the backbone amplicon closed on a 7 bp repeat, `CGCACTG`, having lost 59 bp across the join. The
repeat was in all four ordered oligos, so it sat at both ends of the backbone, and the simulation
of the day said nothing. 6 bp is not the floor because in random sequence a shared 6-mer turns up
in most fragments at this window, and a warning that common is one nobody reads.

**Inverted repeats are ignored on purpose**: a strand annealing to itself gives a hairpin, not a
circle.

The fix at the bench is a design fix: shift the junction by a few bases so the two ends of the
fragment share no repeat.
