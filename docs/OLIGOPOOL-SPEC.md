# Oligo pools: describing a library so it can still be simulated

**PROPOSED 2026-09-20, not settled.** Nothing here has been ruled on and nothing here is
implemented. §8 lists what needs JCA's decision before any of it is built. Where this disagrees
with a later ruling, the ruling wins.

**The design below was reasoned to, not measured.** The facts about Tlib3 in §1 and the sizes in
§5.3 were each measured; the *design* in §4–§6 has never been run against anything. §7.4 is the
test that would make it a fact, and it has not been written. Read accordingly.

**JCA ruled on §8.2 and §8.3 on 2026-09-20.** Both are recorded in place and struck from the open
list. Three remain.

---

## 1. The problem

JCA, opening it:

> *"Tlib3 is an oligopool, and I'm not sure we have yet built out the infrastructure for it."*

There is not. `c11 ontology` is the exact index and it abstains on every noun tried —
`oligopool`, `opool`, `pool`, `library`, `subpool`: *"nothing is (oligopool, any verb)."*

`~/cortex/log/cocoon/2026-09-14-SPEC-wetlab-index.md` §8.6 reached the edge of this and stopped on
purpose, about the oPool order forms:

> There is no per-oligo name — the pool is the unit, and the members are anonymous variants of one
> designed library. Defaulting 25 nmol / STD onto a pool member would be wrong rather than merely
> unknown.

It concluded oPools need "either their own record kind or explicit exclusion" and put them out of
scope. This file is that record kind, proposed.

### 1.1 What Tlib3 actually is

`Pimar/experiments/TPcon6/Tlib3`. 180 members, chip-synthesised as one tube, 6 subpools of 30.
Every member has the shape:

```
G00101 | BsmBI/BsaI | sp1 | TERMINATOR | sp2 | MID | sp3 | BsaI/BsmBI | INDEX | ca998
const                 ---- per member ----     const  -^              per       const
                                                                      subpool
```

Verified over all 180 rows of `data/tlib3_constructs.tsv`:

| region | length | constant across all 180? |
|---|---|---|
| 5' head (through the BsaI overhang) | 42 nt | yes, exact |
| MID stuffer | 42 nt | yes, exact |
| join (BsaI/BsmBI, reverse) | 22 nt | yes, exact |
| 3' tail (ca998 site) | 22 nt | yes, exact |
| **slot** `cassette` (sp1+terminator+sp2) | 73–98 nt | varies per member |
| **slot** `tail` (sp3) | 19–22 nt | varies per member |
| **slot** `index` | 22 nt, fixed | varies **per subpool** — one value per set |
| whole member | 243–270 nt | |

Site census, every member: exactly 2 BsmBI and 2 BsaI, **all in the skeleton, none inside a slot,
none created at a slot/constant junction.** That is what licenses the abstraction for this library
and is exactly the check §6 requires in general.

### 1.2 Why the obvious answer does not generalise

`Pimar/.../Tlib3/bin/10_simulate_cfs.mjs` already simulates all 180 members × 2 routes by writing
one CF per member in memory. It is correct and it is the oracle in §7.4. JCA:

> *"The exhaustive sweep solution is plausible, but only because this library is relatively small.
> If we are trying to describe a generalized way of encoding a library and maintaining
> simulatability, then we would have to describe the oligopool as like a series of abstract
> things... for constant regions you state, for variable regions you define an insertion, and that
> insertion could be NNNNNNNNNNNNNNNNNNNN, or it could be a set of sequences."*

Enumeration is O(members). A degenerate library has no member count to enumerate.

### 1.3 The second reason to want it

> *"As a design artifact, having an abstract structure for a library would also be useful for
> specifying the library during its construction and validation — like establishing that all
> members of the library satisfy the spec."*

Today `05_build_constructs.py` builds members and `06_validate.py` checks them, with the spec
implicit in both. With a schema the members are generated *from* the spec and conformance is
definitional. The index-orthogonality fact in §1.4 is true today and **nothing re-checks it.**

### 1.4 What nothing checks today

The six subpool primers are mutually orthogonal — each binds its own index and no other, at full
length and at the 3'-terminal 12 nt. A clean diagonal, 30/30/30/30/30/30.

That was established by a throwaway script on 2026-09-20 and is recorded nowhere else. When Tlib4
adds a seventh subpool, nothing will re-run it. Under §4 the member count *is* the assertion: a
primer that caught two subpools reports 60 instead of 30, automatically and forever.

---

## 2. Why the sequence alphabet cannot carry this

The INSDC alphabet is `acgtu` plus the eleven IUPAC ambiguity codes `mrwsykvhdbn`. It gives
per-position ambiguity over subsets of {A,C,G,T} and nothing else.

| needed | IUPAC | |
|---|---|---|
| per-position degeneracy | yes | `N22` |
| variable length | **no** | `cassette` is 73–98 nt; an N-run is one length |
| enumerated alternatives | **no** | `N22` is 4²² options, not the 6 real ones |
| correlation between slots | **no** | nothing ties `index` to `cassette` |

Writing `index` as `N22` describes a library ~10¹¹ times larger than the real one.

**The semantics are inverted in principle — but not in C6.** IUPAC `N` means *"this position is
one of ACGT, unknown which"*; a slot means *"do not match here."* Against a wildcard-aware matcher
that difference is fatal: all six subpool primers would match an `N22` index, all six would resolve
at the abstract level, and the simulator would report six 180-member products.

**C6's matcher is exact, so this does not apply here** (checked 2026-09-20): a primer whose 3' end
lies inside an N-run throws *"Reverse oligo does not exactly anneal to the template."* An N-run
already behaves as a non-matching hole in the PCR path. §5.1's pass-1 semantics are C6's existing
behaviour rather than something to be built — the hazard above is real for any matcher that gains
IUPAC awareness later, and is recorded so that change is made deliberately.

What remains true is the table: the alphabet still cannot carry variable length, enumerated
alternatives, or correlation. Those need `slots`.

---

## 3. What C6 already has — this is not a foreign idea

**Most of §5.1 is already shipped.** See §3.1 first; it is the closest prior art and it was built
against Tlib3.

Four things, each checked 2026-09-20:

- **IUPAC codes are accepted.** `src/C6-Sim.js:191` and `src/C6-Seq.js:50`:
  `/^[ACGTRYSWKMBDHVNUacgtryswkmbdhvnu*]+$/`.

- **Degenerate-as-library already exists on the design side.**
  `src/labplanner/oligos/eipcr.js:11` — *"degenerate codes make a library, fixed bases make a
  single clone"* — with an `rc` that preserves IUPAC codes "so a library oligo survives the round
  trip", and `planning/choosePCRProgram.js` adjusting annealing temperature for degenerate oligos.

- **The right rule is already implemented at one junction.** `src/C6-Sim.js:884`:

  ```js
  const homologyRegion = currSeq.slice(currLen - HOMOLOGY_LENGTH);   // last 20 nt ONLY
  ...
  if (!/^[ATCG]+$/i.test(homologyRegion))
    throw new Error("The provided assembly contains degenerate base pairs, assembly failed.");
  ```

  JCA, correcting a careless reading of this on 2026-09-20:

  > *"that is a much more nuanced line of code. It does not throw out degeneracy data; it's
  > supposed to preserve it and pretty sure it does."*

  Correct. The guard is scoped to the 20 nt that establish the join. The product is built by plain
  concatenation of the fragment bodies, so degeneracy anywhere else rides through into the product
  untouched. **Degeneracy is cargo; it is refused only where it would make a structural decision
  ambiguous.** That is the whole rule of §6, already written for one operation.

  (Ordering detail: the check sits after the match loop, so a degenerate homology region that
  finds no literal match reports "not enough homologous regions" instead. The degeneracy error
  fires only when the run matched literally on both sides.)

So C6 has a notion of library in the oligo-design path and refuses library in the simulation path.
This spec connects the two.

### 3.1 The `stencil` — pass 1, already implemented, for one operation

`src/labplanner/planning/projectSequences.js` carries a `stencil` kind: a sequence holding an
N-run, declared in a workbook `sequences` tab with free text `span=138-152 n=30` in the fourth
column. JCA set its scope, 2026-09-13:

> *"the CF simulation code will need simple N's to work, and it would be a lot of work to change
> that. So, I wouldn't get fancy with this."*

So the sequence goes into `plasmids` with everything else and **`simCF` never learns the word**.
`src/labplanner/planning/pcrProductSize.js` then derives the whole product range by arithmetic from
a single simulation, because product length is linear in span length. Its own record, measured on
**Tlib3's arnold subpool**: N×138 → 225 bp, N×144 → 231, N×152 → 239, against real members of
225–239 with a mean of 231 — *"Exact at all three points, and not luck."*

**The N-run sits at the pool's mean span.** JCA's ruling at §8.3, given independently on 2026-09-20,
matches the convention already shipped here. That consistency is the reason to treat the stencil as
the foundation rather than as something to replace.

| the stencil has | this spec adds |
|---|---|
| one anonymous variable span | many **named** slots |
| an N-run and a declared span range | a **bin** per slot — a set, or an IUPAC pattern |
| — | **selection**: a subpool primer resolving against a slot's values (§5.2) |
| — | **occupancy** over the product space (§4.1) |
| — | assembly over bins, which creates occupancy (§4.1.1) |
| reporting only; `simCF` is untouched | `simCF` itself learns slots |

**The scope limit in JCA's 2026-09-13 ruling is the thing this spec asks to revisit**, and it should
be revisited explicitly rather than drifted past. The stencil stops where it does on purpose.

**Gap, noted 2026-09-20:** no stencil declaration for Tlib3 exists in any readable file in Pimar,
though `pcrProductSize.js` was measured against Tlib3. The workbook `sequences` tabs are `.xlsx` and
opaque to a text search, so this is "not found in anything readable", not "absent".

---

## 4. The model: slots on `Polynucleotide`

JCA:

> *"C6 operates on the polynucleotide object. So, enabling libraries to be described is essentially
> an expansion of Polynucleotide. Maybe it's an extension of it, or just added fields that could be
> in it. But effectively we'd need to define 'polynucleotide' instances that can pass through the
> simulator signatures, and then revise the simulators to all handle the library cases."*

`Polynucleotide` (`src/C6-Seq.js:121`) is a flat data class — `sequence, ext5, ext3,
isDoubleStranded, isRNA, isCircular, mod_ext5, mod_ext3`. Adding fields is additive, and **a plain
Polynucleotide becomes the zero-slot case rather than a separate type**, so every existing
simulator signature stays valid.

```js
poly.slots   = [ {name:'cassette', start:42,  end:140, lengths:[73,98]},
                 {name:'tail',     start:182, end:204, lengths:[19,22]},
                 {name:'index',    start:226, end:248, length:22, fill:'enum'} ];
poly.members = { correlated: true, source:'data/tlib3_constructs.tsv', rows:[...] };
```

`sequence` stays a **flat string** carrying an inert lowercase `n`-run in each slot. Not a segment
list: every existing `.slice()` and `.includes()` keeps working, returns the right answer in
constant regions, and hits `n`s in slots.

### 4.1 One combinatorial space, occupied densely or sparsely

**Superseded the two-kinds model 2026-09-20 on JCA's framing.** There are not two sorts of library.
The slots and their bins define a combinatorial space; a library is a *subset* of that space, and
the only thing that differs is how much of it is occupied.

> *"It isn't just oligopools that could be combinatorial at a part level. Like, we could be
> describing G00101.promoter.rbs.cds.terminator.ca998 where promoter was any of a bin, rbs any of a
> bin, etc. So, I think for both the oligopool and the combinatorial parts library, we are really
> describing the full combinatorial space, even though the oligopool describes a sparse region of
> it."*

| | slots x bins | occupied | density |
|---|---|---|---|
| **parts library** `G00101.promoter.rbs.cds.term.ca998` | 6 x 8 x 4 x 5 | every combination | dense, 100% |
| **Tlib3** | 180 x 180 x 6 = 194,400 | 180 | **0.0926%** (measured) |
| **degenerate slot** `N20` | 4^20 | every combination | dense |

So `occupancy` replaces the `correlated` flag, which was a clumsy statement of this same axis:

```js
poly.slots     = [ {name, start, end, lengths, bin} ]      // bin: a set, or an IUPAC pattern
poly.occupancy = 'dense'                                   // every point in the product space
               | {source:'...tsv', rows:[...]}             // an enumerated sparse subset
```

Refinement (§5) is **identical either way** — it expands a slot's bin and tests its values, and the
bin is the same object in both cases. Occupancy changes only two things: the member counts in
reports, and whether narrowing one slot narrows another. Under `dense` it does not; under an
enumeration it does, which is what makes §5.3's arity collapse valid for Tlib3.

### 4.1.1 Operations move occupancy in BOTH directions

**This is the case the first draft of this spec missed entirely**, and it only became visible once
parts libraries and oligopools were one model.

| | |
|---|---|
| **PCR with a slot-targeting primer** | *narrows* occupancy — selection. §5.3. |
| **assembly over several bins** | *multiplies* occupancy — it **creates** the combinatorial space |

`GoldenGate promBin rbsBin cdsBin termBin BsaI pLib` takes four pools in and returns one pool with
four slots, dense. The first draft only ever considered a pool as a PCR template flowing into an
assembly with an ordinary backbone; a pool as an *input* to assembly, and assembly as the operation
that brings a library into existence, were not in it.

The physical distinction matters to what the simulator must do: **Tlib3's sparsity arrives from the
synthesiser** — the chip made those 180 specific molecules — whereas **a parts library's density is
produced in the tube**, because every combination forms. So occupancy is not merely carried along
with a pool. For assembly it has to be *computed*.

### 4.2 The GenBank view

JCA:

> *"maybe use lower case nnnnnnnn to designate a region, and an annotation to define it as a
> variable region with a code linking the variables. Then, it would look like regular genbank to any
> tool, and the n's if the right size still well-represent the dna, though you'd need to do this
> more complicated thing to simulate what happens to it."*

This is isomorphic to §4 — `n`-run plus annotation on disk, `n`-run plus `slots` in memory — so the
round trip is trivial and neither side is the awkward one. Lowercase is the right choice: GenBank
sequence is case-insensitive and lowercase conventionally means soft-masked, so nothing chokes and
ApE renders it. The annotation carries the linking code, which is the part IUPAC fundamentally
cannot express.

**One caveat, now ruled on.** A fixed-length slot is represented exactly (`index` is 22 nt in all
180 members). A variable-length slot cannot be: any single `n`-run misstates length for most
members. **JCA ruled 2026-09-20 that the `n`-count is the average and the imprecision is
acceptable**, because the number feeds gel interpretation and PCR program choice and nothing else.
See §8.3. The standing constraint that follows: nothing may build an exact-length assertion on
`sequence.length` for a slotted Polynucleotide.

The pool object is the model; the `.gb` is a view of it. `c6.fromApeLibrary`/`toApeLibrary` already
exist, so the view is nearly free — and it keeps the artifact in the format a student already opens
without pretending the file is the specification.

---

## 5. Simulation: abstract first, refine on demand

JCA stated the algorithm:

> *"you don't simulate each individual sequence, but you simulate each slot... if it hits, then it
> doesn't need to examine the first bin further; the product can be constructed as the original
> oligopool with the last two bins modified to represent the pcr product ends. If we used a subpool
> oligo, the pcr wouldn't hit, so it tries the next grouping... Basically, it finds what's in the
> bin that does amplify, and constructs that as the product."*

### 5.1 Pass 1 — resolve against the skeleton. O(1) in library size.

Match with slots as **holes that never match**. A primer whose 3' end lands in constant sequence
resolves here, for every member at once, and no slot is ever expanded.

Demonstrated on Tlib3, 2026-09-20:

```
G00101       RESOLVES in constant 'head'
ca998        RESOLVES in constant 'tail'
arnold_R     no site in constants -> REFINE
...          (all six subpool primers)
```

So `PCR G00101 ca998 Tlib3 TL3` is answered without touching a member. One simulation whether the
library has 180 members or 10⁶.

### 5.2 Pass 2 — refine, counterexample-guided.

On failure, do **not** refine every slot: that is the cross product again. Re-match with holes
treated as wildcards to find which slot the match overlaps, and expand only that one. Cost is
O(values in the implicated slot) — 6 for Tlib3, never 180.

The discriminating rule is the **3' end**, not overlap generally. A primer whose 3' end sits in
constant sequence but whose 5' tail overhangs a slot binds regardless of slot content and needs no
refinement. (`pTP2_F`/`pTP2_R` are the ordinary case of this: 5' non-templated BsmBI tails.)

**Test every value in the bin. Never stop at the first hit.** This is the one place JCA's
statement of the algorithm has to be tightened. Short-circuiting costs nothing — you enumerate that
slot's values either way — and it silently destroys the assertion in §1.4: if `T3A_R` bound both
the arnold and diverse indices, first-hit-wins reports 30 members where the truth is 60.

### 5.3 The product is a pool, and refinement collapses arity.

```
Tlib3                      3 slots, 180 tuples, 243-270 nt
  --[G00101/ca998]-->      3 slots, 180 tuples, 243-270 nt   ends re-cut, arity unchanged
  --[G00101/T3A_R]-->      2 slots,  30 tuples, 221-248 nt   index frozen -> constant
```

**Measured, not asserted** (2026-09-20, all 180 members through `simCF` on both routes): subpool
amplicon is 221-248 nt, exactly 22 shorter than the whole-library amplicon for every member — the
`ca998` flank the subpool primer does not reach.

The plasmid is **3895-3922 nt on both routes and identical per member**, because BsmBI cuts inside
the amplicon and discards the index and `ca998` flank entirely. So the `index` slot is frozen by
refinement *and then physically removed by the assembly*: the product plasmid carries 2 slots
whichever route made it. Arity collapse is not only bookkeeping — here it is the chemistry.

A refined slot becomes constant in the product, so downstream steps get strictly cheaper and
refinement is monotone — a long CF gets easier, not harder. Reports become
`TL3A  30 members  221-248 bp` rather than a single length.

---

### 5.4 Refinement, as built

PCR implements §5.2 as of 2026-09-20. A primer that cannot anneal to the skeleton is offered to
`refineForPrimer`, which searches only the slots — never the member list — and returns every bin
value it binds. One value: the slot is frozen to it, membership narrows to the members carrying it,
and PCR retries on the narrowed pool. Refinement removes a slot each time, so the recursion is
bounded by slot count.

**Two throws rather than a guess**, both of them the cross-priming case §1.4 exists to catch: a
primer binding values of *two different slots*, and a primer binding *two values of one slot* —
which is a primer selecting two subpools, where reporting the first match would hide half the truth.

**Refinement rebuilds the surviving slots from the members that remain, and that is correctness
rather than precision.** A slot keeping the whole pool's bin after narrowing describes members no
longer in the pool: screening Tlib3's arnold subpool would test all 180 cassettes, and a BsmBI site
in any of the other 150 would throw for a member arnold does not contain. Length ranges narrow with
it — before this every subpool reported the whole pool's 220-248, where arnold is really 225-239.

## 6. The structural footprint — the generalisation of `C6-Sim.js:884`

Every operation has a region in which it makes a structural decision.

| operation | footprint — a slot here forces refinement or refusal | slot outside it |
|---|---|---|
| Gibson | terminal 20 nt at each junction (`HOMOLOGY_LENGTH`) | passes through |
| GoldenGate / Digest | recognition site + spacer + 4 nt overhang | passes through |
| PCR | primer annealing footprint; 3' end decisive | passes through, ends re-cut |
| Transform | none — nothing sequence-dependent | passes through |

**One rule.** `slot ∩ footprint ≠ ∅` → refine that slot and test every value. `slot ∩ footprint =
∅` → pass through untouched.

**What happens when refinement does not resolve is operation-specific** (ruled 2026-09-20, §8.5):

- **Golden Gate and Digest** — if *any* member fails, throw. Not a reduced pool, not a count, not a
  partition. A library that is 80% fine still throws, and that is the intended behaviour.
- **PCR** — a restriction site inside a slot is simply irrelevant; only the annealing footprint
  matters. A PCR that selects zero members is the existing no-product error (§8.2).

Line 884 is the Gibson row, already written.

Screening a slot's fillers must include junction context — `(last k−1 of preceding constant) +
filler + (first k−1 of following constant)`, k = longest recognition site — or a site created
*across* the join is invisible. For a degenerate slot you do not scan, you compute: in N20 every
6-cutter can occur, ~2×(20−6+1)/4096 ≈ 0.7% of members carrying a given BsmBI site. For a 10⁵
library that is ~700 broken members, and surfacing that number automatically is probably the most
useful single thing this buys for randomized libraries.

---

## 7. Implementation order

Split so it is shippable, and so that partial support is never silently wrong.

1. ~~**`slots` on `Polynucleotide`, defaulting null.**~~ **BUILT 2026-09-20.** `slots` and
   `occupancy`, both null on an ordinary DNA, set by name rather than through the already
   eight-argument constructor. All 1760 existing tests pass unchanged.
2. ~~**One shared `assertNoSlotInFootprint`.**~~ **BUILT 2026-09-20** — `src/library/slots.js`,
   with `hasSlots`, `slotsOverlapping`, `lengthRange`, and `test/library-slots.test.js` (13 tests).
   **Wired into PCR and Gibson 2026-09-20** (`test/library-footprints.test.js`, 7 tests):

   - **PCR needs no assertion on success.** Matching is exact and a slot carries N, so a successful
     anneal is *provably* outside every slot. What it needed was an honest failure: a subpool primer
     cannot anneal, and the bare message *"does not exactly anneal"* reads as a bad primer when the
     oligo is correct and the missing thing is refinement. The message now names the slots and says
     so. On an ordinary template it is unchanged — no library noise on a normal failure.
   - **Gibson** now refuses by slot name when one reaches into the terminal homology window, which
     is the same window its degeneracy throw has always guarded.

   **GoldenGate wired 2026-09-20** (`test/library-goldengate.test.js`, 6 tests), and it needed two
   guards rather than one:

   - the footprint proper — each recognition site through its cut, twice per input;
   - **bin screening**, because the skeleton's site count is a *floor, not the truth*. A slot holds
     N and N does not spell `GGTCTC`, so `indexOf` reports "exactly one site" for a pool in which
     some members carry two. `screenBinsForSite` checks each member with junction context, and by
     §8.5's ruling any hit throws.

   **A slot with no declared bin throws too**, with a different message: "no member carries a site"
   and "nobody said what the members are" are different findings and must not render the same.

   **Digest wired 2026-09-20**, in `cutOnce` so `digest` inherits it, plus bin screening for a
   reason specific to this operation: `digest` returns `fragselect` **by index**, so one extra site
   in one member produces one extra fragment and renumbers every fragment after it. `fragselect: 2`
   would then mean two different pieces of DNA for two members of the same pool.

   **Ligate needs no guard, and that is a finding rather than a gap.** It decides entirely on
   `ext5`/`ext3` and the `mod_*` fields, none of which are part of `sequence` — so a slot, which
   indexes into `sequence`, cannot overlap its decision region. Ligate is in Transform's class.
   Its *product* is a concatenation, which is propagation (§5.3), not a footprint.
3. **Teach operations one at a time.** PCR first — it is the one that does selection, and the one
   Tlib3 needs.
4. ~~**The agreement test.**~~ **BUILT AND PASSING 2026-09-20** —
   `Pimar/experiments/TPcon6/Tlib3/bin/13_agreement.mjs`, in `run_all.sh`. It runs the seven real
   construction files through the pool machinery and checks them against the member table:

   ```
   file       members     amplicon bound   true range   slack
   pTlib3     180/180     242-270          243-270      1 nt
   pTlib3A     30/30      224-239          225-239      1 nt
   pTlib3B     30/30      221-244          221-243      1 nt
   pTlib3C     30/30      221-245          222-245      1 nt
   pTlib3D     30/30      223-241          224-241      1 nt
   pTlib3U     30/30      222-237          223-237      1 nt
   pTlib3V     30/30      222-248          225-248      3 nt
   ```

   Member counts exact; every bound contains the true range; slack 1-3 nt. **Containment is the
   assertion that matters** — a bound that fails to contain the truth is not loose, it is wrong,
   and a labsheet built on it sends somebody to cut the wrong band out of a gel. Watched failing
   on both a tightened tolerance and a falsified count before being kept.

Step 2 goes in first and everywhere. Without it, partial library support is worse than none: the
taught operations are right, the untaught ones are confidently wrong, and nothing distinguishes
them from outside. An untaught operation is otherwise *silently* fine for cargo, because
concatenation preserves an `n`-run — which is exactly the failure mode that looks like success.

---

## 8. Open — JCA's calls, not mine

1. ~~**Both library kinds from day one, or defined-set first?**~~ **RESOLVED 2026-09-20 — the
   question was malformed.** There is one model with an occupancy parameter (§4.1), so "both" is
   not a scope increase, it is the same code. JCA on EIPCR: *"that is just introducing degeneracy
   codes via oligos, and C6 already handles all that appropriately."*

   What this opened instead is §4.1.1 — assembly over bins creates occupancy — which is new work
   the first draft did not contain and is **not yet specified beyond the statement that it must
   happen**.
2. ~~**A PCR on a pool that matches zero members: error, or an empty pool?**~~ **RULED
   2026-09-20 — error, and no new behaviour is needed.** JCA:

   > *"You are saying no member of the library got amplified and thus there is no PCR product? I
   > believe the no-product scenario throws an error on the pcr simulator, so that would still be
   > the behavior if it were a library; having no product is interpreted as a fabrication planning
   > error."*

   A library is not a special case of this. The existing no-product throw covers it.
3. ~~**Variable-length slots make `sequence.length` a plausible wrong number**~~ **RULED
   2026-09-20 — accept the imprecision; stuff the slot with the average count of `n`s.** JCA:

   > *"Presumably this will compute an average number of n's to stuff into the sequence, so size
   > would be based on averages. Yes, imprecise, but still useful for interpreting gels and
   > suggesting pcr programs, which is all the number is used for."*

   So the `n`-count is the mean member length for that slot, and the size it yields is approximate
   by construction. No declared-field ceremony, no forced routing through `slots`. The scope of the
   number is what makes this safe: gel interpretation and PCR program choice, neither of which
   needs exactness. **Nothing should build an exact-length assertion on it** — that is the one way
   this ruling could be misused.
4. ~~**Where does a pool live on disk?**~~ **RULED 2026-09-20 — it is a named DNA like any
   other, and the CF does not change.** JCA:

   > *"An oligopool, like an oligo, is a named dna. You have already seen it expressed in the Tlib3
   > CF. There is nothing else in there but the name of the dna entity. With CF, the sequence can be
   > in the file, or it can be injected on simulation. The parser currently does it by scanning
   > filenames to figure it out; you just add another file type to look for when doing that."*

   So: **no new CF keyword**, no `pool` declaration, nothing added to a construction file. The seven
   rewritten Tlib3 CFs already say `PCR G00101 T3A_R Tlib3 TL3A` and stay exactly as they are. The
   work is one more file type in `projectSequences.js`'s scan (§3.1), beside `*.seq/.gb/.gbk/.ape`
   and `*_oligos.txt`.

   **Open, and small:** does that extend the existing `stencil` kind to carry several named slots,
   or arrive as a new file type beside it? Two mechanisms for one idea is how they drift.
5. ~~**A site created at a slot/constant junction.**~~ **RULED 2026-09-20 — operation-specific,
   and Golden Gate throws on any failure.** JCA:

   > *"A restriction site at a slot boundary wouldn't affect a pcr simulation. It might affect a
   > golden gate one. If no member of the library survives digestion and give a gg product, then
   > there is an error. Some members of the library could fall out though, and the question is when
   > it is only a few members does this abort the simulation or be allowed to go through. I think
   > the safer thing is that if anything fails in golden gate, you throw the error."*

   Two things follow. **A site inside a slot is not a general problem** — it is a Golden Gate and
   Digest concern only, and PCR is indifferent to it, which §6's footprint table already says.
   And **partition is rejected**: any member failing Golden Gate throws, rather than the assembly
   proceeding with a reduced pool and a count. Strictly fail-closed, and stricter than the
   partition this spec previously recommended.

### 7.6 A library in is a library out

Built for PCR 2026-09-20 (`test/library-propagation.test.js`, 13 tests). The failure it prevents is
silent: without it an amplicon returns with the right *bases* and no metadata, the next step in the
construction file treats a pool as one molecule, and nothing anywhere says otherwise. **Losing the
metadata is worse than losing the sequence, because only one of them is visible.**

PCR's template is rotated and may be reverse-complemented first, so slots are carried through both
transforms before being cut to the amplicon and shifted past the forward oligo. Two refusals rather
than guesses: a slot **straddling the rotation point** would arrive as two disjoint pieces of one
variable region, and a slot **only partly retained** is a different library, not a smaller one — its
bin no longer describes it and its length range is wrong.

Verified against the real Tlib3 skeleton: the whole-library PCR returns a 254 nt amplicon carrying
all three slots at corrected offsets, each landing exactly on its N-run, occupancy intact at 180
members, and bins that still screen clean for BsmBI.

**`concatSlots` drops occupancy when two libraries are joined**, because that product is §4.1.1 and
is not implemented. Claiming either input's member count for the result would be a number that is
simply wrong.

**Gibson, GoldenGate and Ligate propagate too, as of 2026-09-20.** Each needed its own care:
GoldenGate's slots travel *with* their fragment through `sortAndValidateGoldenGateFragments`,
because the order inputs are written in is not the order they assemble in and offsets computed
before the sort land on the wrong fragment; Gibson carries them through its reverse-complement
branch and accumulates them across joins by setting them on the product it pushes back onto its own
worklist; Ligate treats the sticky end as padding between two bodies.

#### The chemistry performs the arity collapse by itself

End-to-end on the real Tlib3, 2026-09-20 — pool → PCR → GoldenGate with the pTP2 backbone:

```
TL3       254 nt   slots: cassette, tail, index   180 members   242-270 (outer)
bT       3762 nt   slots: none                        -         3762 (tight)
pTlib3   3906 nt   slots: cassette, tail          180 members   3894-3922 (outer)   circular
```

**The index slot is gone from the plasmid, and nothing was told to remove it.** BsmBI cuts inside
the amplicon and discards the index and the `ca998` flank, so `sliceSlots` drops a slot that fell
outside the retained fragment. §5.3 predicted arity collapse as a consequence of refinement; here it
arrives from the cut instead, which is a stronger result — the model tracks the chemistry without
being told about this case at all.

Real plasmids span 3895-3922; the bound says 3894-3922, one base wide for the reason in §7.5.

## 8b. Enumeration is a separate instrument — RULED 2026-09-20

> *"I don't think we ever fully enumerate anything during simulation. We always do one variable
> region at a time. But we could have a separate algorithm that inputs a library/oligopool and
> enumerates its members. That might be useful for debugging and convincing ourselves that we did
> this all right."*

So occupancy stays **symbolic inside the simulator, always**. Nothing in §5 or §6 materialises a
member list, and a 960-member parts library is a number rather than a structure. `enumerate(pool)`
is a separate capability, outside the simulation path.

**And it is more than a debugging aid: it is the validation instrument.** §7.4 uses Tlib3's
180-member sweep as an oracle because that sweep happens to exist. `enumerate(pool)` + per-member
simulation is that same oracle for *any* library, which is what lets the agreement test outlive
Tlib3. JCA's *"convincing ourselves that we did this all right"* is exactly §7.4's job.

**The one constraint it carries.** An enumerator must be bounded and must distinguish its
outcomes — a dense `N20` slot is 4²⁰ ≈ 10¹² members:

| case | behaviour |
|---|---|
| sparse, enumerated (Tlib3) | read the member list — 180 rows |
| dense over finite bins (6×8×4×5) | cross product — 960 members |
| dense over a degenerate pattern | **refuse, with the count**, or sample N at random |

"Too large to enumerate" and "this library has no members" must never render the same. The second
is the §8.2 error; the first is a fact about the request.

### 7.5 A sparse library's length range is an OUTER bound, not a measurement

Found while testing `lengthRange`, 2026-09-20, and kept because the test that would have hidden it
was the tempting one to write.

Summing each slot's extremes assumes the extremes **co-occur in some member**. That holds for a
dense library and fails for a sparse one:

```
slot-bound arithmetic : 242-270
the 180 real members  : 243-270
```

The single member with the shortest cassette (73 nt) carries a 21 nt tail, not the shortest (19),
so the (73,19) corner of the box is occupied by nothing. One base — harmless inside the number's
declared scope of gels and PCR programs (§8.3), and it is reported as `bound: 'outer'` rather than
presented as a measurement. A tight range for a sparse library needs the member list, which is
`enumerate(pool)` and deliberately outside the simulation path (§8b).

**Unknown occupancy is treated as sparse.** Assuming density would overstate, and this is the
cheap direction to be wrong in.

### 7.7 Reporting a pool's size as one number is the wrong answer

Caught 2026-09-20 by JCA, on output this session had just called a success:

```
TL3      254 bp          <- WRONG: a mean presented as a fact
pTlib3  3906 bp          <- WRONG: right for almost no member
```

The machinery was correct — slots propagated all the way to the plasmid, 180 members intact, the
index slot properly dropped by the cut. **`bin/c6-sim` printed `sequence.length` anyway**, which is
exactly the number §4.2 says is a plausible wrong one and exactly what `lengthRange`'s `bound` field
exists to prevent. The guard existed and the one place a person reads the number ignored it.

```
TL3      ~242-270 bp   library: 180 members, variable: cassette, tail, index
pTlib3  ~3894-3922 bp  library: 180 members, variable: cassette, tail
```

`~` marks an outer bound (§7.5). Real members span 243-270 and 3895-3922.

**`--primes` was worse, and had the more interesting fix.** It answers "does this sequencing primer
bind exactly once", and it finds sites on the *skeleton*, whose slots hold N and match nothing — so
a primer binding inside a variable region reads as `NOT PRESENT`, and one binding a second time in
some members reads as binding once. For a pool the skeleton cannot answer the only question the
flag exists for.

The first fix was to say so. The better fix, taken instead, is to **search the bins**: a primer site
hiding in a variable region is the same defect as a restriction site hiding there, and
`screenBinsForSite` already finds it. So the floor becomes a count —

```
TL3   forward at 1
      180 members, and no member carries this site inside "cassette" or "tail" or "index"
```

— and a primer that did bind internally reports `** ALSO binds inside "cassette" in 1/180 members
— 1 member(s) get a second site and an unusable read **`. A slot with no declared bin still says
FLOOR, because that is the one case where the answer is genuinely unknown.

## 9. What nothing checks, as of this writing

- §5.2 refinement for operations other than **PCR**. Gibson, GoldenGate and Digest still refuse
  rather than resolving a slot against its bin.
- §6 for **Digest and Ligate** — no footprint declared, so a slot in a recognition site or overhang
  is not caught. PCR, Gibson and GoldenGate are wired; these two are not.
- §4.1.1 — assembly over several bins, which MULTIPLIES occupancy. `concatSlots` refuses to guess
  and returns null occupancy when two libraries are joined, so the slots are right and the member
  count is absent rather than wrong.
- §7.4, the agreement test. The oracle is green (180/180) but nothing compares it to a skeleton run.
- §4.1.1, assembly over bins. Specified only as "it must happen".
- The index orthogonality of §1.4 — true today, established once by hand, re-checked by nothing.
- ~~`src/index.js:9` imports `./C6-LabPlanner.js`~~ **FIXED 2026-09-20** — repointed to
  `./labplanner/C6-LabPlanner.js`. The barrel had been broken since the move; `cf.check` and
  `cf.sim` survived because they import submodules directly, which is why it stayed invisible.
  Nothing tests that the barrel loads, which is why it broke silently and could again.

  With it fixed, Tlib3's sweep runs for the first time since: **180/180 on both routes**, sizes in
  §5.3. §7.4 is no longer blocked — the oracle exists and is green.

  `test/barrel-loads.test.js` now covers it, and was watched failing against the broken import
  before being kept. A re-export is exactly what a unit test never touches and a consumer hits
  immediately; 1759 tests were green the whole time it was broken.
