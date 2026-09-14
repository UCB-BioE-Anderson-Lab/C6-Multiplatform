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

| **issue record** | which wells were held for which tubes, and under whose name. `issue.json`, written by `c6-issue`, read by `c6-receive`. It is the only thing that survives between the two acts. | `c6-issue` |
| **returned workbook** | the same file, filled in by hand at the bench. The wells are what the inventory learns from. | a student |

**This paragraph used to say the seventh noun existed only on paper** — *"nothing yet updates the
inventory from it. That is the loop's missing closing half."* That was true when this doc was
written and stopped being true the same day: `c6-issue` and `c6-receive` close it, and §3.1 is the
lifecycle they implement. A doc asserting that a capability is missing is the same defect as one
asserting a mechanism that is dead, and it fails the same way — quietly, to a reader who believes
it.

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

### 3.1 — and then what happens to it

**Compiling has no consequences, and that is the point.** An experiment gets revised — a different
oligo, one more clone, a whole branch abandoned — and every revision recompiles. If compiling
reserved freezer space, a morning's thinking would leave a trail of holds nobody placed
deliberately and nobody knows to release. JCA, 2026-09-13:

> *"That will distinguish a planning phase, where the experiment may be revised many times and
> should not have consequences, to one where an official plan has been said and the process
> initiated."*

So there are three phases and only the last two touch anything:

| phase | command | the inventory | the checkpoints |
|---|---|---|---|
| **planning** | `c6-packet` / `c6-labplan`, as often as anybody likes | untouched | not live |
| **issued** | `c6-issue <dir> --inventory <dir> --write` | wells **held** | promises declared |
| *(bench work)* | the student fills in the shaded cells | — | — |
| **returned** | `c6-receive <book> --issue <f> --inventory <dir> --write` | holds **resolved**, tubes recorded | promises dropped |

```
    X-labsheets.xlsx
        │
        │  c6-issue                 ← a deliberate act by a person
        ▼
    issue.json  { assignments[], proposed[] }   +   holds.tsv
        │
        │  (the bench)
        ▼
    X-labsheets.xlsx, filled in
        │
        │  c6-receive               ← the only place the inventory learns anything true
        ▼
    box files, appended    ·    holds.tsv, rewritten
```

Three rules hold this together, each of which was a bug first:

- **A hold is not an occupancy.** A hold says *keep this free*; a sample record says *a tube is
  here*. They live in separate maps and separate files, because writing a predicted tube into the
  inventory is exactly the thing the mechanism exists to prevent. JCA: *"Just don't say things are
  in there that aren't there."*
- **On return, the sheet wins.** A hold says where the tube was expected; the returned sheet says
  where it went, and they differ often — the student was standing at the freezer and we were not.
  The held well is let go either way, so an abandoned experiment leaves no trace in the freezer.
- **A hold nobody ever looks at is the failure mode.** An abandoned experiment never comes back to
  release its holds and nothing else will, so `c6-holds --inventory <dir>` lists what is standing
  and for how long. It has no `--release`: deciding an experiment is dead is a judgement, and what
  the command gives you is the list to make it from.
- **Both commands print by default and write only when told.** A tool that modifies a shared
  inventory as a side effect of being run is one somebody runs to see what it says and then has to
  undo.

### 3.2 Every command in `bin/`, and what it is for

**The whole list, because a button nameable from nowhere is one a session finds by luck.** Four of
these were in no document at all until this table was written, and `c6-issue` and `c6-receive` —
half the lifecycle above — were in none either. `test/docs-match-code.test.js` now fails when a new
`bin/c6-*` is not named here, so the next one cannot go missing the same way.

| command | what it does |
|---|---|
| `c6-check` | reads every construction file in a project and reports what is wrong with it. No plan, no sheets. |
| `c6-sim` | simulates one construction file against the project's sequences: every product, and where an oligo anneals. |
| `c6-plan` | construction + characterization + inventory → a plan. Which sessions exist, in what order. |
| `c6-packet` | the plan as labsheets: `{ sheets: LabSheet[] }`, ready to render. |
| `c6-labplan` | the whole way through — plan, packet, workbook — in one call. The usual entry point. |
| `c6-decide` | prints every question the compiler will not answer by rule, each with its prompt and the shape of a valid answer. → §6 |
| `c6-issue` | holds the wells this packet needs and writes `issue.json`. The act that starts the experiment. → §3.1 |
| `c6-receive` | reads the filled-in workbook, records where the tubes actually went, and lets the holds go. |
| `c6-holds` | what the freezer is keeping free, by whom, and for how long. Reads and prints; releasing one is a person's judgement. |
| `c6-rules` | the domain logic as a table — every rule as *when · then · why*, in the order they are tried. → §10 |
| `c6-protocol` | renders protocol modules as text, for a caller that is not JavaScript. |
| `c6-call` | runs one exported function by path and name. It is what a sharable's `entry` line uses. |
| `c6-sharables` | regenerates `sharables/generated/` from the JSDoc. `--check` fails on drift; `--undocumented` lists what has no record. |
| `c6-golden` | a deterministic text dump of a compiled packet, for diffing. The test harness's eyes. |

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

268 records in `sharables/generated/`, one per exported function that carries a JSDoc comment,
generated by `bin/c6-sharables` from the comment itself and checked for drift by `npm test`. They
are what C11 indexes so a session can find a capability without reading the source.

**59 exported functions have no record** (`c6-sharables --undocumented` lists them), because the
generator refuses to invent a description
from a function name — *"a wrong description is worse than an inventory that is missing one."* Most
of those are re-exports whose real doc lives at the original. Three were not, and were found while
writing this doc: `planExperiment` — stage one of the whole pipeline — plus `addSample` and
`applyTransformRecoveryNotes` had JSDoc blocks that opened with `@param` and no sentence, so there
was nothing to index and the most load-bearing function in the library was invisible to `c11
which`. Fixed; the count above includes them.

**Two types: `function` (234) and `datum` (34).** A `datum` is an exported constant that carries a
comment of its own — a rule rather than a mechanism. It has no `entry`, because there is nothing to
run; you read it. A record carries:

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

**The lab's conventions ARE the constants**, and until 2026-09-13 they were the only things in the
library with no record at all. `bin/c6-sharables` walked exported functions only, by a decision a
previous session wrote down: *"A CONSTANT IS NOT A CAPABILITY… they were then reported as
undocumented, which is a to-do list nobody should act on."* Half right — an undocumented constant
is noise, and a documented one is the most likely thing somebody wants to look up. A session asking
*how long may a label be* got fifteen records mentioning "label" and not one of them was the
answer.

Now indexed, and this is most of what a readthrough should argue with:

| | |
|---|---|
| `TUBE` | 3 characters on a PCR cap, 12 on a 1.5 mL, 13 on a sequencing tube |
| `DNA_NAME_MAX` / `DNA_NAME_LIMIT` | 6 is the aim, 8 is about the limit |
| `CLONE_MAX` | 3 — a plate address like `4B3` |
| `MASTERMIX_THRESHOLD` | 4 reactions |
| `DEFAULT_EXCESS` | 10% over |
| `BLOCK_FROM` / `BLOCK` | 5 colonies; a 24-well is 4 × 6 |
| `CLONE_PICKS` | how many colonies a cloning transformation gets picked for |
| `NO_RESCUE` | β-lactams skip the outgrowth; everything else does not |
| `VERDICTS` | the eight sequencing verdicts |
| `CLEANUP_AFTER` / `GEL_AFTER` / `VERIFY_AFTER` | which steps get injected after what |
| `PER_CLONE` | which steps fan out per colony |
| `WORKING_UM` / `STOCK_UM` | 10 µM in hand, 100 µM in the freezer |
| `DERIVED_PREFIX` | `z` for zymo, `d` for digest |
| `READ_SUFFIXES` | `F` and `R` |
| `CONTROL_STOCKS` / `CONTROL_STRAINS` | empty in C6 — the lab supplies them |

**One problem remains and is not fixed:** 89 of the labplanner records carry the noun `labsheet`,
which is too coarse to rank on. Asking *what decides a PCR program* competes against 88 siblings.
The nouns want splitting — `label`, `control`, `session`, `oligo`, `vessel` — and that is a change
to `bin/c6-sharables`'s noun table, not to any of these files.

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
| **issuing and receiving** | how to hold a well, how to resolve one, and that the sheet beats the plan | that issuing also declares promises, and that the record tab is called `cortex-record` |
| **the closing return** | `c6-receive`, which appends what the sheet said to the box files | `cortex labsheets receive`, which additionally drops the promises the issue declared |

---

## 8. What this survey turned up

Read for the doc, not fixed yet:

**Three of these have since been fixed and are struck rather than deleted**, because a survey that
silently loses its own findings cannot be checked against what was done about them: the orphaned
`planning/binPCRRuns.js` was deleted; the duplicate `injectDilutionJobs` in `planDilutions.js` is
gone, leaving the one in `injectDilution.js`; and `eipcr.js` moved out of `design/` to
`oligos/eipcr.js`, where designing oligos is what the folder is for.

Still open:
- **17 of 25 protocol modules have no cheatsheet**, so they transclude in full. That is correct —
  and it is why two sheets run to a second page.
- **`design/` carries `submits` but only sequencing sets it.** It is a one-member enumeration
  today, which is honest but worth knowing before a second member arrives.
- **Three load-bearing functions had no sharable** and now do — see §5. The cause is worth
  remembering: a JSDoc block that opens with `@param` has no description, and the generator drops
  it silently rather than guessing one.

---

## 9. A library template: the stencil

**Added 2026-09-13, from Pimar's Tlib3.** A construction file may name a template that is not one
sequence but an oligopool. JCA:

> *"Tlib3 as a term is not really an oligo, it's an oligopool. It's a different schema type. But it
> is a valid alternate type for the template input of a CF."*

The correct model is to simulate every member and carry the mixture forward. The **stencil** is the
cheap form of it, and he set the bound himself: *"the CF simulation code will need simple N's to
work, and it would be a lot of work to change that. So, I wouldn't get fancy with this."*

So a stencil is **one row in `<project>_sequences.tsv`**, and the simulator learns nothing:

```
Tlib3   ATTACC…GCTTA NNN…(×144)…NNN TACTAG…GATAC   stencil   span=138-152 n=30
```

- the **conserved frame** is real sequence, so the primers anneal exactly where they do on every
  member — Tlib3's arnold subpool is 43 bp of 5' frame and 66 bp of 3' frame, and both `G00101`
  and `T3A_R` land inside them;
- the **variable span** is a plain run of `N` at the pool's *mean* length. `DNA` already accepts
  full IUPAC, so this parses today and files as a plasmid;
- `span=` and `n=` say what is true of the pool, beside the string rather than inside it — a
  notation like `N{138,152}` would need a parser and `simCF` would refuse it.

**One simulation gives the whole range, because the flanks are constant.** Product length is linear
in span length, so the endpoints fall out by arithmetic. Measured against all thirty real members
of the arnold subpool:

| stencil | product | real pool |
|---|---|---|
| N × 138 | 225 bp | min = 225 |
| N × 144 | 231 bp | mean = 231 |
| N × 152 | 239 bp | max = 239 |

Exact at all three points, and not luck. The sheet then says `231 bp mean (225-239, n=30)` and the
program is chosen from the mean — because *"it is meaningless to cite a single number"* about a
pool, and equally meaningless to ask a student to invent one.

**The N's are real ambiguity and they propagate.** `simCF` carries them through Golden Gate into
the assembled plasmid, which is correct — a library plasmid genuinely has a variable region. But
anything that later reads that sequence must treat those positions as *unknown*, not as absent: a
restriction-site scan across the span can honestly report "no site can be asserted here", never
"no site".

**What this does NOT do**, stated rather than glossed: the PCR still emits one product name, so no
mixture is carried downstream. A stencil is a representative, not the pool. Simulating members
individually is cheap — 0.07 ms each, so Tlib3's thirty cost 2 ms and a 100,000-member pool would
cost 7 seconds — and the real cost only appears where two pools are assembled together, which
multiplies. That is unbuilt and undecided.


---

## 10. Reading the domain logic without reading the code

**Added 2026-09-13.** JCA:

> *"we are in the details of the domain logic, and the only way to really know for sure we got it
> is for me to look at many examples. Alternatively, I try and understand your code and read it.
> But you've got a lot of syntax mixed in with the domain logic, that will make it hard to
> follow."*

Reading a labsheet proves one case. Reading the source proves all of them and costs an hour.

**Reformatting would not have fixed it, and the numbers say why.** `choosePCRProgram.js` was 106
lines of which **46 were already domain prose** — the reasoning was all present. It was interleaved
with `job.program = …`, `continue` and null-guards, so reading out *what the rules are* meant
filtering every third line. The rules were never hard; finding them was.

So a rule set is a list of objects in `src/labplanner/rules/*.rules.js`:

```js
{
  name:    'short product',
  when:    'the product is under 250 bp',
  then:    'Taq, and the program is the annealing temperature alone',
  why:     'JCA: "For really short sequences… I would recommend a Taq reaction instead of
            primestar. The recipe is different for taq too." So it is a CHEMISTRY change…',
  applies: ({ bp }) => bp != null && bp < SHORT_BP,
  decide:  ({ bp, anneal }) => ({ chemistry: 'taq', program: String(anneal), note: … }),
}
```

`c6-rules` prints the `when · then · why` of every rule, in order. **The table is not a copy of the
code — it is that list, rendered**, and `annotatePCRPrograms` is now an adapter that reads the
oligos, asks `choose()`, and writes the answer onto the job. A table that disagrees with behaviour
is impossible rather than merely unlikely.

### Facts and rules are different things

A rule set has two halves, and separating them was not tidiness — it caught two live defects in the
first translation:

- **Facts** are read off the job and decide nothing. `degenerate` is a fact, and its third state
  matters: `null` when we do not hold every oligo's sequence, which is **not** `false`.
- **Rules** are tried in order and the first that applies wins. That order is part of the domain —
  `long product` sits above `ordinary product` because both apply over 8 kb — and it is visible in
  the printed table, where an `if/else` chain made a reader unwind it.

The first draft made "sequences unknown" a *rule*, which stopped the chain and gave a 3.7 kb
product no program at all where the toolkit gives it `PG4K55`. The second draft dropped the
annealing note entirely, because it lived below the `if/else` and read as an afterthought rather
than as the other half of the degeneracy fact — so a fact may also `say` something, appended to
whatever the matching rule said. **Both were invisible in the original shape and obvious in a
table**, which is the argument for doing this to the rest.

### What is converted, and what is not

`pcrProgram` only. It was chosen because it is pure domain, self-contained, and one JCA had already
read output from. Whether the remaining rule-bearing modules follow is a decision about how much of
the toolkit should be legible this way, not something to do because the first one worked.
