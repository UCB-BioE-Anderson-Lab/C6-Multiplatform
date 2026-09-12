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
