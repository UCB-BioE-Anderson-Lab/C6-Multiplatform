# Every decision the labsheet toolkit makes, and where it lives

**Written 2026-09-12 as an audit, not a design.** JCA:

> *"I keep finding errors in your labsheets... I think what we need is a labsheet toolkit. And it
> needs to be very logical what it does. It has algorithms like 'choose pcr program' that encode
> strictly logical decisions, and it has ones like 'come up with 8 pcr sample names according to
> these conventions' which are like agentic prompts that instruct to return a datastructure. So,
> you have all these testable (and frankly, reviewable by me) algorithms that make micro decisions,
> and there is a labsheet datastructure that houses it all... I'm not sure if we've gone off the
> rails because we have bypassed the labsheet generation code we wrote, or we never really wrote
> it."*

## The answer: both, and the second caused the first

`generateLabPacket` in `C6-LabPlanner.js` is the intended single entry point — seven stages, CFs
and an inventory in, a LabPacket out. **It returns an empty packet and always has.** Its first act
is:

```js
const canPlan = typeof CfToJobs.extractJobsFromCFs === 'function'
             && typeof JobsToLabSheets.jobsToLabSheets === 'function';
if (!canPlan) { Models.sortSheets(packet); return packet; }
```

`jobsToLabSheets.js` is `export {}`. It has never been anything else. So the guard is false, the
function returns immediately, and the eleven stages below it have never run once.

**And every stage is behind the same kind of guard**, `typeof X === 'function'`, so a missing stage
is skipped in silence. Four of eleven are missing, and two of those exist under another name:

| stage the pipeline calls | what the module exports |
|---|---|
| `chooseTemplateSample.applyTemplateSelection` | `chooseTemplateSample` |
| `choosePrimerSource.applyPrimerSelection` | `choosePrimerSource`, `whereOf` |
| `binPCRRuns.binPCRRuns` | *(nothing — `export {}`)* |
| `jobsToLabSheets.jobsToLabSheets` | *(nothing — `export {}`)* |

The other seven exist and work. They are called by `bin/c6-plan`, which drives the stages itself
rather than going through `generateLabPacket`.

**So the shape was designed, the datastructure was built, the bridge was never written, and
nothing said so.** `models/labsheet.js` exports six constructors; outside its own unit test, the
only caller is the dead function above. What actually reaches the .xlsx is a second path —
`c6-plan` → `c6-packet` → `design/*.js` → `labpacket-to-xlsx.py` — that emits plain objects shaped
like a LabSheet without being one.

**That is why the errors keep coming one at a time.** A decision that lives in a closure inside
`design/pcr.js` is not a thing anybody can review, test, or disagree with before it reaches paper;
it is only visible once it is wrong on a printed page. Twelve of the last fourteen corrections
were of exactly that kind.

## What is already a named, callable, reviewable decision

These are functions with names, called from outside, most with tests. They are the part of the
toolkit that already exists in the intended shape.

| decision | function | kind |
|---|---|---|
| which thermocycler program | `choosePCRProgram.primestarProgram` | logical |
| how big is the product | `pcrProductSize.annotatePCRProductSizes` | logical (simulation) |
| what goes in the mastermix | `makeMastermixPlan.makeMastermixPlan` | logical (set arithmetic) |
| which steps may share a labsheet | `binReactions.binReactions` | logical (antichains) |
| which steps share a *sitting* | `sessions.groupIntoSessions` + `sequences/` | remembered data |
| is this oligo ready, dilutable, or absent | `planDilutions.planDilutions` | logical |
| where does this material come from | `planSources.planSources` | logical |
| which tube of this construct | `chooseTemplateSample.chooseTemplateSample` | logical (ranked) |
| which tube of this oligo | `choosePrimerSource.choosePrimerSource` | logical (ranked) |
| does this transform need an outgrowth | `injectTransformRecovery.applyTransformRecoveryNotes` | logical |
| which controls does it need | same | logical |
| gel after PCR, cleanup after gel | `injectGel`, `injectCleanup` | policy, declared |
| pick/miniprep/sequence/read after a transform | `injectVerification.injectVerificationJobs` | policy, declared |
| make the antibiotic stock | `injectAntibioticStock` | logical (inventory) |
| make the working oligo stocks | `injectDilution` | logical (inventory) |
| what the experiment's label prefix is | `design/index.labelPrefix` | logical |
| the next label | `design/index.labeller` | logical |

## What is NOT yet a named decision — it is inline in a design module

Each of these is a real micro-decision that produces something on paper, currently written as an
expression inside `design/<operation>.js` and reachable only by calling the whole design. Every one
of the recent corrections landed in this column.

| decision | where it hides | JCA corrected it on |
|---|---|---|
| what a sample row's columns ARE, per operation | each `columns()` | 09-12 (tube→label, product→construct) |
| what to call a tube | `columns()` via `ctx.label()` | 09-12, twice |
| when a label derives (`zL3a`) vs takes a letter | `zymo.js`, `sequencing.js` | 09-12 |
| what a clone is called (`pBET8-A`) | `injectVerification.cloneOf` | 09-12 |
| what a read is called (`pBET8-AF`) | `injectVerification.readSuffix` | 09-12 |
| which input is shown by tube and which by name | `design/index.from` | 09-12 |
| how many plates a transformation needs | `transform.columns` + `injectTransformRecovery` | 09-12 |
| what each control is FOR, in words | `injectTransformRecovery` | 09-12 |
| which protocol module an operation transcludes | each `module` | 09-12 (sequencing) |
| what values that module is rendered with | each `values()` | 09-12 (`reads` vs `samples`) |
| which conditions appear as columns vs below | each `shownAsColumn` | — |
| what the sheet says in prose | each `notes()` | 09-12 (miniprep) |

**None of these has a test of its own.** They are covered only where a whole-pipeline test happens
to walk through them.

## What the toolkit should be

JCA's description, restated as the four things and what each already has:

1. **Micro-decision algorithms** — named, individually callable, individually tested, reviewable
   in isolation. **17 exist, ~12 do not.** The missing ones are the label and naming conventions
   and the per-operation column shapes.
2. **A labsheet datastructure that houses it all** — `models/labsheet.js` exists and is
   constructed by nothing. The ontology it should carry is the inventory's: `label`, `side-label`,
   `construct`, `concentration`, `clone`, `culture`, `type`. Today `c6-packet` emits objects with
   those keys by convention rather than by construction, which is why `tube` and `product` could
   appear as headers for two weeks without anything objecting.
3. **Labsheet → .xlsx** — `labpacket-to-xlsx.py`, 1000 lines, and it is NOT mostly a static
   template: it makes layout decisions (which columns become entry cells, when a row is a formula,
   how a source block reads) that belong upstream in the datastructure.
4. **Cortex's injections** — checkpoints and lab-specific content. **This one is done**, split out
   2026-09-12 and enforced by `cortex/tests/test_labsheet_split.py`.

## The smallest first step

Make `jobsToLabSheets` real, and make the guards fatal. A stage that is missing must say so rather
than be skipped: `typeof X === 'function'` is the pattern that let an entire planner be dead for
weeks while its tests passed. Then move one design's decisions out into named functions and see
whether the shape holds before moving the rest.

---

# PCR program and polymerase

**The rules themselves are in `src/labplanner/rules/pcrProgram.rules.js`, and `c6-rules pcr` prints
them.** This section is the provenance: who settled what, and when. It is kept apart deliberately —
JCA, 2026-09-13, on the rule file:

> *"I notice you have tons of quotes from me. Those belong in like a log of decision notes, not in
> the data. In the end, this should be a clean list of well-written rules, purely domain logic,
> expressed clearly in words and in code."*

So a rule's `why` states the chemistry, and who said so is here.

## The whole of it, JCA 2026-09-10

> *"simulate the cf, look at the pcr product, get its size. Divide by 1000 and round up. That
> number is x. Insert that number into 'PGxK55' is typically what you want, where 55 is the
> annealing temperature. When doing degenerate oligos (not all bases in the oligos are in [ATCG]),
> I will typically use a 45 degree anneal instead, so PGxK45. For really short sequences, like
> <250 bp, I would recommend a Taq reaction instead of primestar. PG is primestar. program '45'
> and '55' are the taq ones. The recipe is different for taq too -- different enzyme and buffer,
> same dntps."*

All of it is exact and none of it is judgement, which is why these are rules and not decisions.
Every rule in the file is one sentence of that paragraph:

| rule | the sentence it comes from |
|---|---|
| `ordinary product` | *"Divide by 1000 and round up… insert that number into PGxK55"* |
| `short product` | *"For really short sequences, like <250 bp, I would recommend a Taq reaction… The recipe is different for taq too"* |
| the `anneal` fact | *"When doing degenerate oligos… I will typically use a 45 degree anneal instead"* |

## What the toolkit added, and why

**`long product` is not in the quote.** *"Divide by 1000 and round up"* gives the kb figure; the
decision chart in `cloning-tutorials` says which programs are actually loaded. A 3 kb product
rounds to 3 and there is no PG3K — it runs on PG4K. A 14 kb product does not run on PG15K55 at all.
The first implementation emitted both of those names.

**`no product size` is not in the quote either**, and it is the rule that refuses. The extension
time IS the number, so a product that would not simulate gets no program rather than a plausible
default — added after a 6.5 kb amplicon was nearly run on a 1 kb program.

**Unknown degeneracy is a third state.** Reading an empty oligo list as "not degenerate" anneals a
library at 55 °C, silently. The fact is `null`, not `false`, and the sheet says the temperature was
assumed.

## How a rule set is written

**The rule file is the source and the table is a rendering of it** — `c6-rules` prints `when`,
`then`, `why` and the worked examples, and `--json` exports the same as data. Nothing parses data
back in, so there is no format to keep correct.

**The worked examples are run, not written.** Each rule carries a few inputs; the printer puts them
through the rules and shows the real outcome, so the table states where a boundary actually falls
rather than where the prose claims. `bp=250` printing *"falls through to ordinary product"* is the
code answering, not a sentence to be trusted.

**A rule decides data and says prose, separately.** `decide` returns a chemistry and a program;
`says` returns the sentence the labsheet prints. Keeping them in one function made every `decide`
half string-building, which is most of what made the first draft hard to read.

---

# The outgrowth after a transformation

**Corrected 2026-09-13.** The rule was right and its reason was invented. The file had said:

> *Carb and amp select for a β-lactamase that acts OUTSIDE the cell, so a cell that has taken up
> the plasmid is protected by its neighbours' enzyme long before it has expressed its own.*

That is not the mechanism. JCA:

> *"That's not the reasons... all the other antibiotics affect translation, and thus if you plate
> right away it never gets going on the newly-added gene, and the cells just die. With carb/amp, it
> affects cell wall biosynthesis, which doesn't matter for at least 2 hrs or so since the cells are
> just waking up from being frozen when you do this to them. So, by the time they are ready to make
> cell wall, they've already been translating for a while, and have become resistant."*

So the real asymmetry is **what the antibiotic attacks, against what the cell is doing yet**:

- **Erythromycin, kanamycin, chloramphenicol, spectinomycin, tetracycline** all hit the ribosome.
  Plate straight away and the cell can never translate the resistance gene that has just entered
  it — the thing it needs in order to do that is the thing being blocked. Deadlock, and the plate
  is blank.
- **Amp and carb** hit cell wall biosynthesis, which a cell thawing out of a heat shock is not
  doing for a couple of hours. By the time it needs to build wall it has been translating for a
  while and is already resistant. **The outgrowth still happens; it happens on the plate.**

## And the plates are made here, not bought

Also corrected. The file had said carb plates are bought, which is why the batch is not in
question. JCA: *"we don't buy the plates, we make them. There are igem steward roles for making
them, but we only stock carb plates, not the other antibiotics."*

So the distinction is **stocked against poured-for-this-experiment**. Carb plates come off a stack
poured in bulk under a steward role, so the batch has been made the same way many times. Every
other antibiotic plate is poured for the experiment that needs it, which is what makes the plate an
untested variable and why the three-plate set rides with it.

**That this tracks the outgrowth question exactly is a coincidence of which plates this lab
stocks, not a law.** A lab that stocked erythromycin plates would still need the outgrowth and
would not need the plate control, so they are two facts in the rule file rather than one.

## Why `// source:` exists

This error survived because a `why` that sounds like chemistry reads as knowledge. Every rule and
fact now carries a `// source:` line saying whether its reason was **stated** by the lab, with a
date, or **inferred** by whoever wrote the rule. `c6-rules --inferred` lists the second kind, which
is where an external review should start: as of 2026-09-13 that is 22 of 33.

---

# The annealing temperature for a degenerate oligo

**Settled 2026-09-13.** JCA, on why 45 °C rather than 55 when any oligo carries a degenerate base:

> *"the reason for that when you have degenerate bases is to help avoid biased annealing"*

That corrects two things at once, and the second is the more interesting.

**It is not about weakness, it is about spread.** The file had said a degenerate pool binds more
weakly and would fail at 55 °C. A degenerate oligo is a mixture, and against any given template its
members do not all anneal equally well. At 55 °C the best-matching members anneal and amplify; the
rest do not. The reaction does not fail — it succeeds, and returns a product skewed toward whatever
subset happened to match. The library that comes out is not the library that went in.

Dropping to 45 °C lets the whole pool anneal, so the product represents the pool. **The point is
evenness across the members, not getting a band.**

So the `degenerate` fact is now about the spread of affinities rather than about weak binding, and
the `anneal` fact states bias as the reason.

## What this closes

`c6-rules --wet` now lists nothing. Every reason in every rule set is either stated by the lab with
a date, or is a decision about how the toolkit behaves — refuse rather than default, never print
"absent" where nothing was looked up — which is arguable on a page rather than checkable at a
bench.

Three wet-lab claims were flagged on 2026-09-13 and all three were wrong or incomplete:

| claim | what was wrong |
|---|---|
| amp/carb needs no outgrowth | invented a secreted-enzyme mechanism; the real one is that a thawing cell is not building wall yet |
| a later `culture` number is preferred | called it usage; it is purification — each number is a retransformation and a fresh colony |
| 45 °C for a degenerate pool | called it weak binding and failure; it is uneven binding and bias |

**Every one of them sounded like chemistry and was written by somebody who does not do chemistry.**
That is the case for the `// source:` field, and for reading the two kinds apart before asking
anybody else to review.
