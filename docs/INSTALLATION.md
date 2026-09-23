# Installing DNA into a host — where does that get declared?

**OPEN. This is a proposal, not a decision.** Written 2026-09-22, from a lecture slide that
turned out to be unbuildable. It answers `CHARACTERIZATION.md` § What is NOT settled, item 2,
and it reopens `retransform.md` § It is not a construction operation — both are flagged below.

## What prompted it

A CRISPR knockout, written as a construction file because that is the only file there is:

    PCR       aspC1  pTargRev  pTargetF   pcrpdt
    Digest    pcrpdt SpeI      1          spedig
    Ligate    spedig                      lig
    Transform lig    Mach1     Spec       pTarget-aspC1
    Transform pTarget-aspC1    Mach1/pCas Spec   Mach1 ΔaspC1

The last line is not a transformation. It is a transformation **plus** an induced λ-Red, plus
Cas9 cutting the chromosome, plus homologous repair off a donor that the file never mentions —
and the product is an organism, not a DNA. Run as written it produces an empty plate, because a
double-strand break in *E. coli* with nothing to repair from is lethal.

JCA, 2026-09-22: *"construction file is explicitly about building dnas in vitro. Cells are only
mentioned at the end as a String representing the strain in the transformation step… But as soon
as you pull that into CF, we are talking about what happens to dna in the genome of that cell.
Meaningfully simulating that behavior requires things beyond treating those cells as a stock
reagent."*

## What is already settled, and all of it points the same way

**A Step belongs to the molecule tier when the molecule comes out different** — `ONTOLOGY.md`.
Six operations, and `transform` is one of them because the host methylates the DNA and repairs
its nicks.

**The CF's `Transform` returns a DNA, not a strain.** From cloning-tutorials,
`planning/inventory_labsheets.md`: *"the final item on each line (e.g. `ggTp`, `ggAf`, `pLYC76`)
represents an output — a DNA product."* So `Transform ggTp Mach1 Amp 37 pLYC76` means *get this
into a cell, select, pick, miniprep, hand me back the plasmid.* The cell is scaffolding. **CF is
closed over DNA and `Transform` does not break it.** The line above breaks it, using the same
verb.

**An operation name carries what the step is FOR** — `retransform.md`: *"The two share a
protocol's worth of surface and differ in what the step is FOR, which is what an operation name
carries."* A retransformation looks identical at the bench and is a separate operation.

**And the tell is already written down.** `CHARACTERIZATION.md` § What is NOT settled, item 2:
*"Does `Assay` belong in this grammar at all? It has no product and no dependency edge — it
consumes a strain and yields a number. Every other operation here makes a thing."*

That is the whole argument, arrived at from the other end. The characterization file already
holds two material operations — `Retransform`, which returns a strain, and `Pick` — and one
informational one. It was sorted by **phase**: everything after the CF. Sort the same operations
by **product** instead and `Assay` stops being an outlier, because it is in a different file.

## The proposal: one file per product type

| file | every step produces | the question it answers |
|---|---|---|
| construction | a DNA | what molecule am I building, and does it assemble? |
| **installation** | a strain | what does the recipient end up carrying, and how did it get in? |
| characterization | data | what did it do? |

Same grammar in all three — verb, inputs, product. Same name resolution against the inventory.
Same consumer in labplanner. They differ only in the type of the last column, which is also the
rule for deciding where a new operation goes: **keep the cells → installation; keep a number →
characterization; keep a tube of DNA → construction.**

### On the name

JCA, 2026-09-22: *"'strain file' is grammatically inconsistent with 'construction file' and
'characterization file', the latter two imply actions rather than things."*

`derivation` was the first answer to that and it was wrong for a second reason the same
objection implies: **the other two files are named for the act, not the product.** Construction
is what you do. Characterization is what you do. A derivative is a thing.

So: **installation file**. JCA, 2026-09-22 — *"the process of constructing a strain from input
DNAs"*:

> *"The construction process happens in E. coli (or yeast) regardless of what ultimately you're
> going to do with it. Your target might be E. coli, but it also might be a yeast or human cell.
> And the procedures for modifying that organism could involve any number of procedures
> including electroporation, transfection of mammalian cells, injection of dna into an animal's
> bloodstream, microinjection, etc, and there may be necessary bespoke procedures required during
> that process to install the dna properly."*

**That is the file's reason to exist, and `derivation` was silent about it.** Construction's
operations are uniform — a `pcr` is a `pcr` in every lab and every organism. Installation's are
not: getting DNA into *E. coli*, into CHO, into a mouse are not variations on one motion, they
are different procedures with different failure modes, and a name that implies a protocol is
exactly what `goldengate` taught us to reach for.

**It also draws the boundary between the first two files sharply**, which `derivation` left to
inference. The CF's `Transform` into Mach1 is manufacturing: the host is a factory, and it is the
same factory whatever the experiment is about. Installation is when the DNA reaches the organism
the experiment IS about. That is the distinction `retransform.md` was reaching for with *"a
cloning strain"* versus *"the organism the experiment is actually about"* — and under this name a
`Retransform` is plainly an installation step rather than an argument.

*Considered and rejected:* `strain` (a thing, not an action), `derivation` (names the product
while its siblings name the act), `modification` and `engineering` (true of all three files),
`transformation` (collides with the step, and is only one of the delivery methods).

## What earns an operation a name

**Reason backwards from the labsheet, because that is what an operation compiles to.** JCA,
2026-09-22, on what one `Edit` actually costs a person:

> *"On day 1, you transform pCas (or restreak it if it's in the -80). Day 2, you pick a colony.
> Day 3, you grow with arabinose and comp cell prep and then electroporate… this sequence of
> procedures should be like 3 or 4 steps of a process, not one line of some other process."*

So an `Edit` is not a transformation labsheet with extra parameters. It is three or four lab
sessions across as many days, and the file has to have enough lines to carry them.

### The rule is already written, with a different object

JCA, 2026-09-22: *"With CF, you are describing what gets done to a dna. In IF, you are
describing what is done to a cell sample."*

That sentence decides membership, because `ONTOLOGY.md` has already made the same cut one tier
up: *"A Step belongs here when the molecule comes out different"* — and `zymo`, `gel`,
`miniprep`, `pick`, `sequencing` and `dilution` are operations rather than Steps *"because the
molecule comes out the same."*

**Swap the object and it decides this file with no new rule.** The cell comes out different → a
Step. The cell comes out the same → a labsheet operation.

| | | |
|---|---|---|
| growth on arabinose | λ-Red is present afterwards and was not before | **Step** |
| spin, wash, resuspend | the buffer changed; the cell is the same cell | operation |
| competent-cell prep | a precondition for the next step, reached however you like | operation |
| pick a colony | the cells come out the same, just clonal | operation |

JCA, 2026-09-22: *"you might use some counterion exchange column or something instead of washes
and spins. It isn't fundamental to the outcome of the biology to specify washes and spins. But
growth with arabinose is absolutely essential and necessary for predicting what will happen to
the genetic circuit inside the cells."*

**This supersedes the criterion an earlier draft of this document gave** — "an operation earns a
name when the simulator can check something about it." That is circular: the simulator checks
whatever it is told to check. *The cell comes out different* is grounded in the object being
modelled, and it is the rule the repo already uses.

It is also what keeps the file from drifting into a procedure language, which was the live
risk — JCA, 2026-09-22: *"We could grow it at a temperature, add things, have a specific broth,
have timings. Spin cells, resuspend cells, do named protocols. I think I am starting to drift
here from high-level spec abstraction to something more protocol-specific, and that is the wrong
thing to do here. This shorthand system is meant to be super simple. Something a phd level
person reads and has all they need to know to infer the rest."*

**And the drift is already absorbed one tier down.** `culture.md` takes vessel, volume, medium,
selection, temperature and controls, because those belong on a page somebody carries to a bench.
Note what changes, though: in a CF those are all labsheet detail, and here the *medium* can be a
Step when something in it induces. Arabinose is not a culture condition in this file. It is the
operation.

### One line, roughly one session

    Install  pCas          Mach1          Kan  30         Mach1/pCas
    Induce   Mach1/pCas    ara                             pCas*
    Edit     pCas*   pTarget-aspC1  donor  Spec            edited
    Cure     edited  pTarget  IPTG                         cured
    Cure     cured   pCas     42                           Mach1 ΔaspC1

Five lines, five sessions, and each product is a cell sample rather than a DNA. **An earlier
draft of this document wrote the same experiment as two lines**, `Induce` then `Edit`, which
compressed three days and the whole cleanup into one step — the failure this section exists to
prevent.

**The first line is usually not performed.** If `Mach1/pCas` is already in the freezer you
restreak it, and that is an inventory question rather than a file one: the file states what the
next step needs, and the planner decides make-or-fetch. This is already how a CF treats
`pLYC72` — fetched from Box33/B2, not rebuilt — so IF inherits the behaviour rather than needing
it.

**`Pick` stays an operation and is injected**, as it is after a cloning transformation. But the
phenotype question gets sharper here, not softer: what a correct colony looks like after an
`Edit` is a property of the edit, and `CHARACTERIZATION.md` § What is NOT settled item 5 is
already open on exactly that. An `Edit` may be the best evidence yet that `phenotype=` wants to
live on the step that makes the plate.

### Name the intent, not the author

JCA raised `Jiang`, with the right reservation attached: *"Perhaps though that becomes unhelpful
to the experimentalist as they just are supposed to memorize the procedure."*

The Golden Gate precedent answers it. **The verb names the intent; the arguments name the
reagents.** We do not write `Engler`, we write `goldengate` and pass `BsaI`. `Gibson` is the
exception that proves the rule — it works only because the whole field says Gibson, and nobody
says Jiang. A reader meeting it in a file learns nothing, and it breaks the day somebody swaps
the helper plasmid.

    Edit  Mach1/pCas*  pTarget-aspC1  donor  Spec  Mach1 ΔaspC1

`Mach1/pCas` in the host slot selects the system the way `BsaI` selects the Golden Gate flavour.

**On the memorisation worry specifically:** the shorthand was never teaching the protocol.
Nobody learns Golden Gate from a CF — the file says `goldengate` and labplanner emits the mix,
the cycling and the enzyme from `planning/operations/goldengate.md`. The name's job is to
**unambiguously select a protocol the planner can render**, not to let a reader reconstruct one.
That is a far easier bar, and it is the bar `goldengate` already clears.

## The verb set, and how each one leaves the cell different

Drawn from the operations the 140L Genome Editing lecture already teaches, which is a useful
check that this is not invented: every verb below is a slide that exists.

| verb | the cell afterwards | what a planner or simulator can then check |
|---|---|---|
| `Install` | carries a DNA it did not | the marker is on the DNA; the host is not already resistant |
| `Induce` | expressing something it was not | the inducer matches a promoter the host actually carries |
| `Edit` | a rewritten genome | protospacer is 20 nt with an NGG in the target; starts with A for J23119; arms flank and span the cut; **the edit destroys the protospacer or PAM**; guide does not target the helper |
| `Integrate` | a DNA at a defined site | attB and attP both present, correct pair, orientation |
| `Excise` | one segment lighter | FRT/lox orientation and spacing — which decides excision vs inversion |
| `Transduce` | a DNA delivered by phage | ~90 kb linkage limit; recipient is not P1-resistant (DH10B is) |
| `Conjugate` | a DNA delivered by mating | oriT on the plasmid, transfer machinery in the donor |
| `Cure` | one replicon lighter | replicon vs temperature, or incompatibility group |

Eight verbs, comparable to the CF's six, which is what keeps it inferable in one sitting.
Every row leaves the cell in a state the next row can depend on; nothing here is a means to an
end.

**The `Edit` check that matters most is the fifth one.** If the edit does not destroy the
protospacer or the PAM, Cas9 re-cuts the repaired product and the experiment yields nothing. For
a clean deletion this is automatic; for a point mutation it is not, and it is the first thing
people get wrong. It is invisible without a simulator, which is exactly the Golden Gate
palindrome argument.

### Induced cells get a name

    Induce  Mach1/pCas  ara                        pCas*
    Edit    pCas*  pTarget-aspC1  donor  Spec      Mach1 ΔaspC1

JCA, 2026-09-22: *"it is a bespoke procedure done fresh for this experiment, potentially at a
higher cell density after growth with arabinose."*

The density is a labsheet fact. The induction is not: λ-Red has to be **on before the break is
made**, forgetting the arabinose is the commonest way this fails, and at present it is
unrepresentable. Giving the induced cells a name is the same discipline that gives `spedig` one —
a real intermediate that can be wrong gets a handle.

**And naming the operation removes the need for a mixture syntax.** The guide plasmid and the
donor go into one cuvette, so written as a `Transform` they would need `pTarget+donor` and a new
delimiter. `Edit` has fixed argument slots, so they are separate columns, exactly as Golden Gate
takes its fragments.

## What this would cost c6-sim

A CF simulates to a sequence. An installation file would have to carry **a parent genome plus an
episome list**, and apply homologous recombination between a donor and that genome. Then it
emits the finished genome — which is the thing the course keeps asking for and cannot produce:
*work out the sequence of the finished genome and read it as the cell will read it.*

That is tractable but it is not free, and it is the real cost of this proposal.

## What is NOT settled

1. **Separate file, or a section of an experiment-level document?** Same open question as
   `CHARACTERIZATION.md` item 1, and it should be answered once for both rather than twice.

2. **Do `Retransform` and `Pick` move out of the characterization file?** By the product rule
   they are installation operations. That is a real migration with a validator
   (`validate/characterizationFile.js`) and a required `phenotype=` field attached to `Pick`, so
   it is not a rename. **This is the decision that makes the proposal expensive**, and the
   alternative — leave them where they are and accept that characterization is sorted by phase
   while the new file is sorted by product — is incoherent but cheap.

3. **`Transpose` is missing from the table above, deliberately.** Transposition returns a
   *population*, not a strain: the insertion site is random, so there is no genome to emit. If
   the installation file's contract is "every step produces a definite genome", transposition
   breaks it and needs a fourth product type — a library — which characterization then screens.
   The combinatorial-library and directed-evolution lectures land in the same place, so the
   shape is worth knowing now even if nothing is built for it.

4. **Does `Edit` stay one operation?** Base editing, CRISPRi and a nickase pair share the guide
   design rules and differ in what happens after the cut. Probably parameters, possibly
   siblings; there is not enough use yet to tell.

5. **This reopens `retransform.md`.** That file argues a retransformation is not a construction
   operation because *"nothing about the DNA changes when it is moved into another organism"* —
   and then corrects itself in the next paragraph, because the DNA does get methylated. Under the
   product rule the question dissolves: a `Retransform` produces a strain you keep, so it is an
   installation step, and the methylation argument stops having to carry the decision.

6. **`Excise` and `Cure` remove DNA rather than install it.** Flp taking a marker back out,
   42 °C clearing pCas, IPTG making pTarget cut itself — the last three beats of the CRISPR
   animation in the Genome Editing lecture. Reading them as cleanup after an installation works,
   and it is a stretch rather than a fit; curing a plasmid unrelated to any installation is a
   longer stretch, and serial passage is not an installation by any reading. Either the name
   tolerates some removal as part of installing cleanly, or those operations want a home that
   does not exist yet. Flagged rather than resolved, because it is the one place the name does
   not simply fit the verb set.
