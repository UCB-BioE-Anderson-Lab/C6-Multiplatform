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

The criterion is JCA's own, from the Golden Gate precedent, 2026-09-22:

> *"In CF, we don't define BsaI/Ligase, we define golden gate because the behavior of that
> reaction is one pot and thus not simple to describe without some context. Moreover, there are
> design issues like palindromes that are specific to the purpose of that procedure that are
> checked by the simulator."*

So: **an operation earns a name when the simulator can check something about it that no other
operation would check.** Everything else is a labsheet detail.

That criterion is load-bearing, because the obvious failure mode here is generalising into a
procedure language. JCA, 2026-09-22: *"We could grow it at a temperature, add things, have a
specific broth, have timings. Spin cells, resuspend cells, do named protocols. I think I am
starting to drift here from high-level spec abstraction to something more protocol-specific, and
that is the wrong thing to do here. This shorthand system is meant to be super simple. Something
a phd level person reads and has all they need to know to infer the rest."*

**The drift is already handled one tier down and does not need handling here.** `culture.md`
takes vessel, volume, medium, selection, temperature and controls, and it takes them because
they belong on a page somebody carries to a bench. Growing at 30 °C has no design error to
catch. A protospacer with no PAM does.

**Confirmation from the existing format:** the CF already carries a temperature —
`Transform ggTp Mach1 Amp 37 pLYC76` — and only there, because 30 vs 37 is checkable against a
ts replicon. Temperature got into the design layer exactly where it does design work.

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

## The verb set, and what each one lets the simulator check

Drawn from the operations the 140L Genome Editing lecture already teaches, which is a useful
check that this is not invented: every verb below is a slide that exists.

| verb | product | checkable design rules |
|---|---|---|
| `Induce` | a strain in a state | the inducer matches a promoter the host actually carries |
| `Edit` | a strain | protospacer is 20 nt with an NGG in the target; starts with A for J23119; arms flank and span the cut; **the edit destroys the protospacer or PAM**; guide does not target the helper |
| `Integrate` | a strain | attB and attP both present, correct pair, orientation |
| `Excise` | a strain | FRT/lox orientation and spacing — which decides excision vs inversion |
| `Transduce` | a strain | ~90 kb linkage limit; recipient is not P1-resistant (DH10B is) |
| `Conjugate` | a strain | oriT on the plasmid, transfer machinery in the donor |
| `Cure` | a strain | replicon vs temperature, or incompatibility group |

Seven verbs, comparable to the CF's six, which is what keeps it inferable in one sitting.

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
