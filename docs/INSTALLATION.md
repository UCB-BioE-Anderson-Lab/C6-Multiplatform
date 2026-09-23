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
2026-09-22, on what one genome edit actually costs a person:

> *"On day 1, you transform pCas (or restreak it if it's in the -80). Day 2, you pick a colony.
> Day 3, you grow with arabinose and comp cell prep and then electroporate… this sequence of
> procedures should be like 3 or 4 steps of a process, not one line of some other process."*

So a genome edit is not one transformation labsheet with extra parameters. It is three or four lab
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

    Transform  Mach1        pCas                     Kan  30     Mach1/pCas
    Induce     Mach1/pCas   ara                                  pCas*
    Transform  pCas*        pTarget-aspC1  donor     Spec        edited
    Outgrow    edited       IPTG                                 cured
    Outgrow    cured        42°C                                 Mach1 ΔaspC1

Five lines, five sessions, and every product is a cell sample rather than a DNA. **An earlier
draft of this document wrote the same experiment as two lines**, which compressed three days and
the whole cleanup into one step — the failure this section exists to prevent. (It also used verbs
that named outcomes; § Name the action, not the outcome.)

**The first line is usually not performed.** If `Mach1/pCas` is already in the freezer you
restreak it, and that is an inventory question rather than a file one: the file states what the
next step needs, and the planner decides make-or-fetch. This is already how a CF treats
`pLYC72` — fetched from Box33/B2, not rebuilt — so IF inherits the behaviour rather than needing
it.

**`Pick` stays an operation and is injected**, as it is after a cloning transformation. But the
phenotype question gets sharper here, not softer: what a correct colony looks like after an
edit is a property of the edit, and `CHARACTERIZATION.md` § What is NOT settled item 5 is already
open on exactly that. This may be the best evidence yet that `phenotype=` wants to live on the
step that makes the plate.

### Name the action, not the outcome

**The first draft of this section got this backwards, and it is worth recording why**, because
the wrong answer is the tempting one. It proposed `Edit`, `Integrate`, `Excise` and `Cure` — and
every one of those is a thing that *happens*, not a thing you *do*.

JCA, 2026-09-22: *"we are talking about things that you do to the cells, just like you do a pcr
to a cell. Curing isn't really what you're doing. There may be many procedures that result in
curing that don't require regrowth. Maybe you add a chemical and the plasmid self-destructs
without outgrowth. It's not on point."*

**The CF makes the test obvious.** `PCR GB5F GB5R pLYC72 back72` does not say *amplify the
backbone*; it says what was mixed, and the simulator works out what comes off. A verb naming the
outcome **asserts the answer**. A verb naming the action makes something derive it, which is the
entire reason a simulator exists.

`Cure` fails that three times over — one action, three routes to the same result:

    Outgrow  edited  42°C                pCas lost off its ts origin
    Outgrow  edited  IPTG                pTarget cut by the guide pCas carries against pMB1
    Outgrow  edited  (no selection)      lost by segregation

Same verb, different conditions, loss derived rather than declared. A chemical that makes a
plasmid self-destruct without regrowth needs no verb either — it is whatever action delivers the
chemical.

**`Edit` fails it the same way.** What a person does is transform a guide and a donor into
induced cells and grow them. Cas9 cutting and λ-Red repairing is what the *cell* does, and if a
simulator cannot work that out from the DNAs and the host, then naming the step `Edit` has not
helped — it has hidden the gap.

### The two families that survive

**Delivery** — `Transform`, plus siblings for recipients that cannot be transformed: `Transfect`,
`Mate`, `Infect`, `Inject`, `Microinject`. Genuinely different actions, different failure modes,
different sheets — and **this is where the delivery heterogeneity that justifies the file
actually lives.** Better than one verb with a method parameter, for the same reason `goldengate`
beats `ligate enzyme=BsaI`.

**Growth** — `Outgrow`, `Induce`. Recovery after a delivery, induction, and every flavour of
curing.

The worked sequence, which is JCA's:

    Transform   Mach1        pCas                     Kan  30     Mach1/pCas
    Induce      Mach1/pCas   ara                                  pCas*
    Transform   pCas*        pTarget-aspC1  donor     Spec        edited
    Outgrow     edited       IPTG                                 cured
    Outgrow     cured        42°C                                 Mach1 ΔaspC1

### Open: is `Induce` just `Outgrow` with something in the broth?

By the rule above it is the same action, distinguished only by the medium — and a reader seeing
arabinose infers induction without being told, which is the bar this shorthand is held to. Kept
separate here because it marks intent and because the field says induce, but it is the one place
the vocabulary has two verbs where the rule permits one.

### On naming after a paper

JCA raised `Jiang`, with the right reservation attached: *"Perhaps though that becomes unhelpful
to the experimentalist as they just are supposed to memorize the procedure."* Moot under action
verbs, because there is no single step for it to name: the Jiang method is three actions and a
result. Recorded so it is not re-proposed.

## What each action leaves behind

The membership rule is *the cell comes out different*, and these are the actions that do that.
The third column is **not a property of the verb** — it is what a simulator should derive once it
knows the host, the DNAs and the conditions.

| action | the cell afterwards | derived, not declared |
|---|---|---|
| `Transform` | carries DNA it did not | whether anything survives selection at all |
| `Transfect` · `Mate` · `Infect` · `Inject` | the same, by a route the recipient allows | competence; for `Mate`, oriT and machinery in the donor; for `Infect`, the ~90 kb P1 limit and whether the recipient is P1-resistant, as DH10B is |
| `Outgrow` | expressing what it just received, and altered by whatever the conditions did | which replicons survived the temperature, the inducer, or the absence of selection |
| `Induce` | expressing something it already carried | the inducer matches a promoter the host actually has |

Four actions and a delivery family, against the CF's six — which is what keeps it inferable in
one sitting. **Every outcome the first draft named as a verb is now a consequence something has
to work out**: an edit, an integration, an excision, a cure.

### Induced cells still get a name

JCA, 2026-09-22: *"it is a bespoke procedure done fresh for this experiment, potentially at a
higher cell density after growth with arabinose."*

The density is a labsheet fact. The induction is not: λ-Red has to be **on before the break is
made**, forgetting the arabinose is the commonest way this fails, and it needs a line of its own
so the cells going into the next delivery are a named sample. Same discipline that gives `spedig`
a name — a real intermediate that can be wrong gets a handle.

### Reopened by this: the two-DNA question

Naming the action brings back what naming the outcome had hidden. The guide and the donor go into
one cuvette:

    Transform  pCas*  pTarget-aspC1  donor  Spec   edited

`Edit` had fixed slots, so they were separate columns. `Transform` takes a cell sample and **one
or more** DNAs, so a parser needs to know where the DNA list ends and the selection begins —
by token type, or by a delimiter. Unresolved, and a grammar question rather than an ontology one.

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

3. **Transposition returns a population, not a strain.** The action is an ordinary `Transform`,
   so it needs no verb — but the insertion site is random, so there is no genome to emit and the
   contract "every step produces a definite cell sample" does not hold. It needs a fourth product
   type, a library, which characterization then screens. The combinatorial-library and
   directed-evolution lectures land in the same place, so the shape is worth knowing now even if
   nothing is built for it.

4. **How much can a simulator actually derive?** Action verbs move every outcome into the
   simulation — an edit, an integration, a cure — which is correct and is also a much larger job
   than the outcome verbs implied. If it cannot be derived, an action-verb file records the
   experiment faithfully and predicts nothing, which is still better than a file that asserts a
   result nobody checked. But it should be said out loud rather than discovered.

5. **This reopens `retransform.md`.** That file argues a retransformation is not a construction
   operation because *"nothing about the DNA changes when it is moved into another organism"* —
   and then corrects itself in the next paragraph, because the DNA does get methylated. Under the
   product rule the question dissolves: a `Retransform` produces a strain you keep, so it is an
   installation step, and the methylation argument stops having to carry the decision.

6. **Does the file's name still cover everything in it, now that the verbs are actions?**
   The removals that worried an earlier draft — Flp excision, curing pCas — are no longer verbs,
   they are `Outgrow` under stated conditions, and an outgrowth is plainly part of installing
   something cleanly. So the objection is much weaker than it was. What survives it: a serial
   passage, or an outgrowth whose only purpose is to lose a plasmid nothing installed. Those are
   still actions on a cell sample and still not installation in any natural reading.
