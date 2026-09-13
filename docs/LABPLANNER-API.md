# LabPlanner, in domain terms

What has been built, at the level of *what it is* rather than *how it is coded*. Written
2026-09-13 for a readthrough, at JCA's request: *"make a big picture doc which explains in domain
terms, kinda at the api level, what you've written. What are the sharables you have written? What
are their types? How do they wire together? What is algorithmic and what is agentic?"*

Everything here was read off the code on the day, not recalled. Counts are from
`bin/c6-sharables` and the design registry.

---

## 1. What the thing does, in one paragraph

You write two short text files about a plasmid — how it is **built** and what happens to it
**afterwards** — and point the toolkit at the folder. It works out every bench session somebody
has to sit down and do, in dependency order, and produces one printable page per session with
everything on it that a person cannot look up: which tubes to fetch and where they are, what goes
in each reaction, what to write on every cap, which controls and what each control would prove,
and the questions the lab wants answered when the work is done. It refuses to guess at anything it
cannot derive, and says so on the page.

---

## 2. The nouns

Six kinds of thing move through this. Everything else is machinery.

| noun | what it is | who writes it |
|---|---|---|
| **construction file** | how a plasmid is built. One step per line, tab-separated, ending in a transformation whose product is the DNA's name. `Construction of pBET8.txt` | a person |
| **characterization file** | what happens to it afterwards — picking, minipreps, sequencing, the verdict, and then the assay it was built for. Same grammar, different verbs. `Characterization of pBET8.txt` | a person |
| **inventory** | what is in the freezers: box, well, construct, concentration, clone. One file per box is normal. | the lab, continuously |
| **plan** | which bench sessions exist, in what order, with what on each. Nothing printable yet. | `c6-plan` |
| **labsheet** / **packet** | one person, one work session, one page. A packet is the ordered set. | `c6-packet` |
| **workbook** | the packet as `.xlsx`, one tab per sheet, with the cells a student fills in shaded. It goes to the bench and comes back filled in. | `labpacket-to-xlsx.py` |

**A seventh exists on paper and is not built: the returned workbook.** `read-returned.py` and
`xlsx-to-labpacket.py` read one back, but nothing yet updates the inventory from it. That is the
loop's missing closing half.

---

## 3. The pipeline

Two library stages and a renderer. Everything else is a command line over them.

```
  Construction of X.txt ─┐
  Characterization of X.txt ─┤
  inventory/ ─┘
        │
        │  planExperiment()          ← stage 1: what work exists
        ▼
      plan  { sheets[], problems[], dilutions }
        │
        │  jobsToLabSheets()         ← stage 2: what each page says
        ▼
     packet  { sheets: LabSheet[] }
        │
        │  (cortex injects checkpoints here — §7)
        │
        │  labpacket-to-xlsx.py      ← renderer: draws, decides nothing
        ▼
    X-labsheets.xlsx
```

### Stage 1 — `planExperiment()` · *what work exists*

Text in, a plan out. Pure: no disk, no flags, no printing. Eleven steps, in this order and for
these reasons:

1. **`extractJobsFromCFs`** — lines become *jobs*: an operation, its DNA inputs, its oligos, its
   conditions. Dependency edges come from names: a step consuming `frag1` runs after the one that
   produces it. Clone fan-out happens here too (`expandClones`) — one pick of four colonies becomes
   four minipreps and eight sequencing reactions, with the letters assigned.
2. **`annotatePCRProductSizes`** — simulates each PCR against the project's sequences to get a
   product length.
3. **`annotatePCRPrograms`** — picks the thermocycler program *from* that length. Arithmetic.
4. **`applyTransformRecoveryNotes`** — decides whether a transformation needs an outgrowth before
   plating (it does, unless the marker is amp/carb) and attaches the three control plates.
5. **`applyRetransformControls`** — the same question for an electroporation into an assay host,
   which has different controls. → §6.
6. **`binReactions`** — groups jobs that can share one sheet, and sorts by dependency depth. This
   is where the *order of the experiment* is decided.
7. **injectors** — the steps a construction file does not contain and a labsheet must:
   `injectGel` (run a gel after a PCR), `injectCleanup` (clean it up after that),
   `injectVerification` (pick → miniprep → sequence → read the traces, when a characterization
   file has not said it explicitly).
8. **`attachMastermixPlans`** — whether a mastermix is worth setting up, which components are
   common to every tube, and the scaled volumes.
9. **`planDilutions`** — which oligos need a 10 µM working stock made from the 100 µM tube.
10. **`planSources`** — for every material: was it made by an earlier step of this plan, or does it
    come out of a freezer, and if so which box and well.
11. **`injectDilution` / `injectAntibioticStock`** — the sessions that have to happen before
    anything else: making working stocks, and weighing out the antibiotic.

### Stage 2 — `jobsToLabSheets()` · *what each page says*

The plan in, `LabSheet` objects out. It makes no decision about *content*: it walks the sessions,
asks each operation's **design** for its table, its protocol and its prose, and assembles the page.
What it does own is the packet's own business — session grouping (`sessions.js`), which materials
are fetched rather than made, section order, and the seam's warnings.

**Every sheet is built through `models/labsheet.js` and nothing else may construct one.** That
model refuses: a row whose columns do not match what the sheet declared, two tubes under one label,
a side-label on a tube that has no side. It warns about a label too long for the cap it goes on —
warns rather than refuses, because the name came from the file and that is the author's to choose.

### Renderer — `labpacket-to-xlsx.py`

Draws. As of GATE 5 it holds no domain rule: no label limit, no mastermix threshold, no guess about
which sheets submit to a sequencing service. It paginates, it shades the cells somebody fills in,
it transcludes protocol text, and it refuses a malformed checkpoint.

---

## 4. The design registry — the part worth reading

**One module per operation, fourteen of them**, in `src/labplanner/design/`. This is where the
domain lives, and it is the answer to *"the rest of the details for a labsheet are pretty
deterministic… with a specific design algorithm per labsheet type."*

`pcr` · `gel` · `zymo` · `goldengate` · `transform` · `retransform` · `pick` · `culture` ·
`assay` · `miniprep` · `sequencing` · `analysis` · `dilution` · `stock`

Every one answers the same twelve questions and nothing else:

| field | the question it answers |
|---|---|
| `operation`, `title` | what this is called on the page |
| `columns(sample, ctx)` | **the samples table** — one row per thing somebody labels. A transformation is one job and three plates, so a design may return several rows for one job. |
| `conditions` | what prints under *For this experiment*. **Declared, not subtracted** — so bookkeeping the planner adds later cannot leak onto the page. |
| `module` | which protocol to transclude, or `null`. May be a function: an assay reads `protocol=` from the file. |
| `values(ctx)` | what that protocol is rendered *with*. Omitted, `heat_shock_transformation` prints "plate on Amp" over an erythromycin sheet. |
| `recipe(ctx)` | what goes in one tube |
| `blocks(ctx)` | extra tables — the control plates, the well map, the verdict vocabulary |
| `notes(ctx)` | prose. The things that are procedure rather than a column. |
| `destination` | where the finished tubes go (the *to gel* box) |
| `fetches` | whether this operation fetches anything at all. False only for `analysis`, whose inputs are trace files that arrive by email. |
| `submits` | whether anything here leaves the building |

Plus one fact held outside the design, in `TUBE_FOR`: **which tube each operation writes on**, and
therefore how many characters a label may be. A PCR strip cap takes 3; a 1.5 mL takes 12 (a
6–8 character name, a hyphen, and a clone designation up to `4B3`); a sequencing tube takes 13.

---

## 5. What the sharables are

217 records in `sharables/generated/`, one per exported function that carries a JSDoc comment,
generated by `bin/c6-sharables` from the comment itself and checked for drift by `npm test`. They
are what C11 indexes so a session can find a capability without reading the source.

**45 exported functions have no record**, because the generator refuses to invent a description
from a function name — *"a wrong description is worse than an inventory that is missing one."* Most
of those are re-exports whose real doc lives at the original. Three were not, and were found while
writing this doc: `planExperiment` — stage one of the whole pipeline — plus `addSample` and
`applyTransformRecoveryNotes` had JSDoc blocks that opened with `@param` and no sentence, so there
was nothing to index and the most load-bearing function in the library was invisible to `c11
which`. Fixed; the count above includes them.

**Every one is `type: "function"`.** There is no other type in the store. A record carries:

```
  id          generated/plan.jobstolabsheets
  type        function
  description the JSDoc's first sentence
  phrases     how somebody might ask for it          ← what the ranker matches
  noun/verb   labsheet / jobstolabsheets             ← what the ontology indexes
  requires    the file, and the signature
  entry       c6-call src/labplanner/planning/jobsToLabSheets.js jobsToLabSheets
  notes       the parameters, from the @param tags
```

By namespace:

| namespace | n | what it covers |
|---|---|---|
| `plan` | 62 | the planning stages and their helpers — naming, vessels, sessions, sources, injectors, decisions |
| `inv` | 46 | inventory: reading boxes, merging files, finding a construct |
| `protocol` | 25 | the protocol library's own accessors |
| `model` | 24 | constructing and validating a labsheet, packet, recipe, mastermix |
| `seq` | 15 | sequence handling |
| `design` | 13 | the design registry and the oligo-design helpers |
| `oligo`, `sim`, `gene` | 25 | C6's older halves — primer design, simulation |
| `validate` | 6 | construction and characterization file checking |
| `server`, `render`, `labplanner` | 7 | entry points |

**Two honest problems with this, which a readthrough should decide on:**

1. **The type system is flat.** Everything is a `function`, so nothing distinguishes *a decision
   you can call* from *a datum you can read* (`TUBE`, `VERDICTS`, `CONTROL_STOCKS`, `RECIPES`) from
   *an entry point*. 89 of the labplanner records carry the noun `labsheet`, which is too coarse to
   rank on — asking for "what decides a PCR program" competes against 88 other `labsheet` records.
2. **Constants are not recorded at all.** `bin/c6-sharables` only walks exported *functions*, so
   `TUBE`, `DNA_NAME_MAX`, `MASTERMIX_THRESHOLD`, `BLOCK_FROM` and the rest — the numbers that
   encode the lab's conventions and are the most likely things to want to look up or change — are
   invisible to the index.

---

## 6. Algorithmic, agentic, and refused

Three categories, and the counts are small enough to list.

### Algorithmic — a function, with a test

Effectively all of it. The ones worth naming, because each encodes a rule somebody could disagree
with:

| decision | the rule |
|---|---|
| **which PCR program** | from the simulated product length: <1 kb short program, then a step per kb. Degenerate primers lower the annealing temperature. |
| **which chemistry** | also from the length; a PCR that would not simulate gets *no* chemistry rather than a default. |
| **whether a transformation needs outgrowth** | yes, unless the marker is amp or carb — those act on the cell wall and do not need the gene expressed first. |
| **which control plates** | three for a cloning transformation (positive, negative, restreak); two for an electroporation, plus a finding about the third (§ below). |
| **tubes or a block** | five or more colonies goes in a block; under that, tubes. |
| **the well layout** | fills down the columns — the axis a multichannel travels. |
| **clone designations** | `A`, `B`, `C` for single clones; plate addresses (`4B3`) for libraries. |
| **derived labels** | a zymo of `L3a` is `zL3a`; a digest is `dL3a`. Prefix, not suffix. |
| **label length** | by the tube it is written on, not one number for everything. |
| **whether a mastermix is worth it** | four reactions or more, and only components every tube shares. |
| **which oligos need diluting** | anything at 100 µM that a PCR wants at 10. |
| **where a material comes from** | made by an earlier step, or in a box, or in a box whose wells are untracked, or unlocated. Four different answers, and they print differently. |
| **session grouping** | from a named sequence in `planning/sequences/` — the gel, the cleanup and the assembly are one sitting. |
| **miniprep culture volume** | 4 mL, unless something upstream declared otherwise. |

### Agentic — declared, answered outside, written back

**One, so far, by design.** The plan said one worked example and no others until the gate passes.

**`labelPrefix`** — the two characters standing for the experiment on every tube it makes (`L3` in
`L3a`, `L3b`). It cannot be a rule because `Lactis3` and `Lymph3` both give `L3`, and whether that
collides is a fact about the **lab**, which no file in one project directory can establish.

The contract every agentic decision declares:

```
  id           stable name
  question     one sentence
  prompt(ctx)  what the model is told — built here, not at the call site, so
               the question asked is the question this repo reviewed
  schema(ctx)  the shape of a valid answer. A FUNCTION of the situation: the
               prefix may be three characters unless the experiment runs PCRs.
  check(v,ctx) the mechanical half — length, shape — which is the half a model
               is worst at. An answer is checked, not trusted.
  fallback(ctx) the rule to use meanwhile, or null to refuse outright
```

**The compile never calls a model.** That is the load-bearing choice and it is not about cost: a
compile that asks one mid-run produces different sheets on different days for reasons nobody
recorded. Three separate steps instead:

```
  c6-decide <project>      prints every open question with its prompt and schema
  (out of band)            a person, or Cortex, which holds the whole lab
  --answers <file>         JSON, next to the experiment, in git
```

### Refused — no rule, no answer, so the page carries the question

These print as **STILL TO DECIDE** on the sheet and are gathered in one list at the end of a run.
On Lactis3 today there are three:

- the tube prefix was taken from the folder name and **not checked against the rest of the lab**
- **where four oligo stocks live** — the inventory does not record them, so the sheet asks and the
  returned workbook is what updates it
- **nothing checks whether the erm plates are any good** — that needs an *L. lactis* strain already
  carrying the marker and none is on file. An *E. coli* control streaked onto a *Lactococcus* plate
  answers nothing.

Two more refusals exist in the code and do not fire on Lactis3 because its characterization file
answers them: **which oligo to sequence with**, and **which box and well each miniprep goes into**.
Both are candidates to become declared decisions.

---

## 7. Where Cortex attaches

C6 compiles a labsheet for any lab. Cortex adds what *this* lab wants, and the boundary is
enforced by `cortex/tests/test_labsheet_split.py`, which compiles an experiment with C6 alone and
reads the workbook back looking for this lab's vocabulary in it.

| extension point | C6 knows | Cortex supplies |
|---|---|---|
| **checkpoints** | that a sheet *can* carry one, and the four fields it must have | which steps deserve one, the routing code, the address |
| **control stocks** | that a home-poured plate needs three controls and what each proves | that the erm control is `E1`, in the −80 control stocks box |
| **control strains** | that a restreak must be the same organism as the thing tested | nothing yet — the table is empty, and the sheet says so |
| **the closing return** | — | that the workbook comes back at the end and updates the inventory |

---

## 8. What this survey turned up

Read for the doc, not fixed yet:

- **`planning/binPCRRuns.js` is `export {}`** and nothing imports it. It was reachable only through
  the `Planning` bag that PHASE 1 deleted, so it is now fully orphaned.
- **Two different functions are called `injectDilutionJobs`**, in `planDilutions.js` and
  `injectDilution.js`, with different signatures. Only the second is used.
- **`design/eipcr.js` is not a labsheet design.** It designs oligos for site-directed mutagenesis
  and sits in `design/` beside the fourteen operation designs without being one or being in the
  registry. A reader opening that folder will be misled.
- **17 of 25 protocol modules have no cheatsheet**, so they transclude in full. That is correct —
  and it is why two sheets run to a second page.
- **`design/` carries `submits` but only sequencing sets it.** It is a one-member enumeration
  today, which is honest but worth knowing before a second member arrives.
- **Three load-bearing functions had no sharable** and now do — see §5. The cause is worth
  remembering: a JSDoc block that opens with `@param` has no description, and the generator drops
  it silently rather than guessing one.
