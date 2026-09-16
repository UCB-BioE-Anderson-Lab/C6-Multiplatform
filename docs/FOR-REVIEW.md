# For review

**JCA ruled on all of §1 and §2 on 2026-09-13; every ruling is implemented and enforced by
`test/labplanner/rulings-2026-09-13.test.js`. His words are recorded under each item.** What is
left open is §5, which he asked to have explained rather than decided.

Written 2026-09-13 at the end of GATES 3b, 3c, PHASE 1, 4 and 5. JCA asked to batch the
discussion rather than gate each step: *"I couldn't follow what you were doing, but I think you are
going a good direction, so just keep going, and we'll audit and address things you flag for
discussion after you are done."*

Everything here is either a domain call I made that is properly his, a gap in an experiment file
that is his to close, or something I found broken that nobody knew about. Ordered by what a wrong
answer costs.

---

## 1 — Domain calls I made. Each is one function and one test to reverse.

### 1.1 A Zymo product is a 1.5 mL tube, not a PCR strip tube

Two rulings met and contradicted, and the model caught it the first time it ran on real work:

> *"Adding a z to a label is a convention for zymo."*
> *"A pcr tube is max 3 char."*

A zymo label is `z` + the PCR's own three characters — `zL3a` — which is four, on a cap that holds
three. For a day every one of them was being written onto a cap that does not hold it.

**I resolved it on the physical fact:** a Zymo cleanup elutes into a 1.5 mL tube, so the
three-character rule never applied and the prefix convention was right all along.
→ `planning/jobsToLabSheets.js § TUBE_FOR`

**RULED, 2026-09-13:** *"true. zymo is always a 1.5 mL. The columns only fit in such a tube."*
Confirmed as implemented — the column body is what settles it, which is a better reason than the
one I had.

### 1.2 Label length warns; it does not refuse

My first version refused to compile `pTEST_Mach1-A` — thirteen characters on a 1.5 mL tube. That
was wrong, and the ruling that says so is already on the record:

> *"We aren't redesigning construction files here… There are no rules about how DNAs are named
> anyway."*

A miniprep label is a construct name the **file** chose plus a clone letter. A compiler that will
not plan an experiment because its plasmid has a long name has stopped doing the job over
legibility. So length is said loudly — at the seam and in the sheet's own warnings — and the packet
is still produced. Undeclared columns and a side-label on a sideless tube stay fatal: those are the
compiler's own errors. → `models/labsheet.js § checkRow`

### 1.3 The retransform gets two control plates, not three

Reading *"the transformation, not the retransformation"* as putting the restreak on the cloning
transformation only.

**RULED, 2026-09-13 — and I had it wrong for a better reason than I gave:**

> *"The restreaking control is still relevant — to be sure the plates are good, I suppose. In the
> cheese case, the retransformation is into L. lactis, though, so an e. coli control isn't really
> relevant. What would be relevant would be to streak l. lactis control cells that had previously
> been transformed. That doesn't exist currently, but they should definitely be retransforming the
> control plasmid into l. lactis as a positive transformation control in parallel to the new
> constructs."*

The question the restreak answers — *can anything grow on this batch of plates* — is still live.
What is wrong is the organism: `E1` is *E. coli*, and streaking it onto an M17 erm plate meant for
*Lactococcus* tests nothing, because it would not grow either way.

So `CONTROL_STRAINS` is a second table keyed by host, empty by default. Where the lab has a
host-matched strain the third plate is drawn; where it does not, the sheet says the plate batch
went unchecked and why. And the way out costs one tube, which the sheet also says: **the positive
control plate IS this host carrying the control plasmid**, so banking a colony off it gives the lab
the strain it was missing, for every retransformation after this one.
→ `planning/injectTransformRecovery.js § CONTROL_STRAINS`, `design/retransform.js`

### 1.4 The eight sequence-verdict tokens live in C6

`Perfect`, `Perfect Partial`, `Silent Mutation`, `Missense Mutation`, `Nonsense Mutation`, `Indel`,
`Mixed Clone`, `Failed` — transcribed from the Lactis3-1 workbook's Seq Analysis tab. I read them
as ordinary molecular biology rather than one lab's convention, so every lab using C6 gets them.
→ `design/analysis.js § VERDICTS`

**RULED, 2026-09-13:** *"Those are appropriately in C6. Whether that ontology is sufficient is
another question, but what you did is good for now."* Left as is. Whether eight tokens cover every
verdict somebody needs is open, and not urgent.

### 1.5 A sequencing tube's cap is nine characters, one more than a miniprep's

`pBET8-AF` is eight and a longer construct name makes nine. These tubes leave the building, so the
limit is a real limit. → `models/labsheet.js § TUBE`

**RULED, 2026-09-13:**

> *"Maybe 6 cap on a name (a rule on CF drafting more) plus 2 more for the clone. That is all still
> writeable, it just takes two lines. Even a pBET12-4B3 is writeable. I think we've been too strict
> on names, but in general less characters is more legible than more characters."*

So the caps loosened and split into two numbers, because he has given two. `DNA_NAME_MAX = 6` is
the **aim**, stated at CF drafting; `DNA_NAME_LIMIT = 8` is *"about the limit"* (2026-09-12) and is
what the warning fires above. Collapsing them flagged `pGhost17` — a plasmid this lab has used for
years — and a warning that fires on names already in use is one people learn to skip.

A label is name + `-` + clone, and a clone can be a plate address (`4B3`), so a 1.5 mL cap is
8 + 1 + 3 = **12** and a sequencing tube is **13**. `pBET12-4B3` fits with room.

### 1.6 A labsheet may now be more than one page

`fitToHeight = 1` was scaling a 68-row tab to whatever percentage made it fit — at a bench, under
gloves — while the footer said "Page 1 of 1" and the pipeline printed a warning telling somebody to
*"cut what it says"*. That advice was wrong for the two sheets that are long **because** they carry
a protocol with no cheatsheet, which is content you asked for. Sheets now paginate, breaking
between sections.

Four of eleven Lactis3 sheets are two pages: Gel+cleanup+assembly (51 rows), Sequence analysis
(46), Picking and inoculation (48), Assay (68).

**RULED, 2026-09-13:** *"Yeah probably unavoidable. Maybe requires post processing to thin them
down, handle line breaks, whatever. But not really a huge issue."* Left as pagination. Thinning is
a later pass over the rendered sheet rather than a change to the session pairings.

### 1.7 Still open from GATE 1: is a 1.5 mL label six characters or eight?

You said two things that are in tension at the character count — *"a 1.5 mL is ~6 char"*, and
*"the convention for a single clone miniprep is to put the construction + '-' + clone identifier"*,
which makes `pBET8-A` seven. I took the six as the rule for the **DNA name** and the label as that
plus two. Flagged at GATE 1, never settled. → `models/labsheet.js § TUBE`

---

## 2 — Gaps in the experiment files. Yours, not mine to edit.

### 2.1 Lactis3 declares no culture volume for the E. coli minipreps

**RULED, 2026-09-13 — this was never a gap:** *"When picking for minipreps, it's always 4mL.
That's pretty standard."*

So it is a code-defined decision rather than a question on the page. `MINIPREP_CULTURE_ML = 4` in
`design/miniprep.js`, used when nothing upstream declares a volume and overridden when something
does. A labsheet that asks a question everybody already knows the answer to teaches people to skim
the ones that matter.

### 2.2 The three Google Docs

**RULED, 2026-09-13 — closed:**

> *"CF shorthand is essentially defined in C6 by the parser. So, that you already have effectively.
> Labsheet is not rigidly defined anywhere, and many historical labsheets are going to be
> inconsistent. We are setting a standard with this effort."*

Nothing to fetch. The CF grammar is `C6-Sim.js`'s parser plus `validate/constructionFile.js`, and
there is no labsheet standard to check against because this is the thing that sets one.

---

## 3 — Found broken, nobody knew. All fixed; listed because the shape recurs.

| what | how it survived |
|---|---|
| `generateLabPacket` returned an empty packet on line one and said nothing | every stage behind `typeof X === 'function'`; `jobsToLabSheets.js` was `export {}`; nothing called it |
| Two Cortex labsheet tests had never run | not wired into `bin/preflight.sh` |
| One of them asserted a phrase that has never existed in a packet | it was never run, so it could not fail |
| The Python test harness caught only `AssertionError` | a `KeyError` escaped the loop, skipped every test after it, and never printed its verdict line — output that greps as clean |
| `design/transform.js` hardcoded "the control stocks box" | one lab's freezer inside the generic toolkit; the unwired test was the thing that would have caught it |
| The renderer held three domain rules that the planner also held | two languages, free to disagree, only one side tested |
| A session validated only its **first** operation's table | the sequencing labels — the ones that leave the building — were the unchecked ones |
| `addSource` silently dropped every field it predated | written from the spec before `planSources` worked out the real states |

**The recurring shape is the one `CLAUDE.md` already names:** a claim about a mechanism that
nothing runs reads true for exactly as long as nobody runs it. Four of the eight above are that,
verbatim.

---

## 4 — My own errors this session, for the record

- Committed a 45 KB file literally named `--out`, twice. I passed a flag where
  `xlsx-to-html.py` wants a path and `git add -A` swept it in. Removed; the script now refuses a
  flag in either positional slot.
- Wrote a stray `Lactis3-labsheets.xlsx` into `UCB_iGEM_Cheese` while testing the gate. Deleted;
  that tree is clean.
- Used `git add -A` again in Cortex and swept in uncommitted work from earlier in the session. It
  was coherent work (`labsheets.py --html`), and I amended the message to name it rather than
  leaving a commit that did something it did not say.
- Made the label rule fatal before checking it against a ruling already on the record (§1.2).

---

## 5 — What is not done

JCA, 2026-09-13: *"I didnt understand that part of your audit."* Rewritten. Three things, and the
second is the one that needs a decision.

### 5.1 Only one experiment has ever been compiled

Lactis3, plus a synthetic fixture called pGOLD that exists to make the test suite diff-able. That
is the plan's own rule — *"No new experiments. Lactis3 is the only subject until GATE 6"* — and it
was the right rule while the designs were being written, because one experiment you can check by
eye beats five you cannot.

It is also the biggest remaining unknown. **Fourteen operation designs have been tested against
one experiment's worth of shapes.** The next real one will find things, and the sooner it does the
cheaper they are. Any experiment with a construction file and a characterization file will do.

### 5.2 The agentic half is built but nothing is answering the questions — THIS IS THE OPEN ONE

Gate 4 built the mechanism you described: some decisions are functions, some need a model that can
see the whole situation. Concretely there are now three parts, and the middle one is missing.

| | what exists |
|---|---|
| **ask** | `c6-decide <project>` prints every question the compiler will not answer by rule, each with the prompt to ask and the shape of a valid answer |
| **answer** | **nothing.** C6 ships no resolver on purpose. Cortex is the intended one, because the questions need the whole lab in view, and it does not do this yet |
| **use** | `--answers <file>` reads a JSON file back, so a compile is deterministic and the answer is in git |

Only **one** question is declared that way so far — the tube prefix (`L3` in `L3a`, `L3b`) —
because the plan said one worked example and no others until the gate passes. It is declared
because whether `L3` collides with somebody else's experiment is a fact about the lab, and no file
in one project directory can establish it.

**Two more are obvious candidates and are currently just refused.** They already print on the sheet
as STILL TO DECIDE, with no prompt and no schema behind them:

- *which oligo to sequence with* — your own words on why this is not a rule: *"It is very
  contextual as to what to do. Depends on copy number, history of sequencing similar things,
  whether you need full plasmid or just a little region, looking up what oligos are available…
  not trivial."*
- ~~*which box and well each miniprep goes into* — needs the freezer, not the experiment.~~
  **WITHDRAWN 2026-09-16 — this one is the wrong shape, and the lifecycle already answers it.**
  Raised by the Cortex session and relayed by JCA: *"`c6-issue` holds the wells and `c6-receive`
  resolves them from the returned workbook, so declaring it as a question answered in advance puts
  a planner's guess where a measurement currently goes."*

  Checked, and the code says the same thing in two places already. `planning/issue.js §
  spotsNeeded` keys on the **Box** alone — the box is the input to holding, the well is what
  `issue` chooses and what `resolve` corrects from what came back, where **the sheet wins**. And
  `injectVerification` has been printing the split on the page since it was written: *"which box
  these minipreps go into — `box=` on the Miniprep line settles it. The well is written at the −20
  and comes back on the sheet."*

  So the WELL must not be declared. It is not an unanswered question, it is a measurement, and
  answering it in advance is the exact failure the hold mechanism exists to prevent — JCA,
  2026-09-13: *"Just don't say things are in there that aren't there."*

  The BOX is a narrower question and still open: `box=` on the line settles it, and where nobody
  says, the sheet already carries an open decision. Whether choosing one by rule needs the freezer
  in view — and is therefore agentic — is arguable, and it is a different question from the one
  this bullet asked.

  **This is struck rather than deleted** because a survey that quietly loses its own findings
  cannot be checked against what was done about them — the same convention §8 of
  `LABPLANNER-API.md` follows.

**What I would like from you:** whether to declare *which oligo to sequence with* next, and whether
the answering step belongs in Cortex as a verb (`cortex labplan answer <project>`).

**The Cortex session has since declined the second half, and its reasoning is worth the record:**
there is no resolver today, no `labplan` verb, and the tube prefix has been answered by hand six
times this week. It reads this as a `LOG.md`-entry decision about Cortex's own shape rather than
one a peer session settles. Either way `--answers <file>` is the right seam, because it leaves the
answer in git.

### 5.3 Three sheets are long, and thinning them is a separate pass

Per §1.6 you have already said this is not urgent. Noting it so it is not mistaken for forgotten.

---

# 6 — For the Thursday pass, 2026-09-17

Added at the end of 2026-09-13. Everything above was written before the rule files existed; this
is what is worth an hour once they do, in the order I would spend it.

## 6.1 The rules themselves — an hour, and the only part that needs you

    node ~/Documents/GitHub/C6-Multiplatform/bin/c6-rules

Fourteen rule sets, 51 rules, 27 facts. Each rule is a `when`, a `then`, a `why`, and worked
examples that are **run rather than written** — so `250 bp → falls through to "ordinary product"`
is the code answering, not a sentence to be trusted.

**Read the `why` fields, not the code.** If a reason is wrong the rule is wrong, however well the
code matches it.

    node bin/c6-rules --inferred

**51 of the 78 reasons are mine rather than yours.** That list is where to look hardest, and it is
sorted by rule set. Nineteen are decisions about how a toolkit should behave — refuse rather than
default, never print "absent" where nothing was looked up — which are arguable on a page. The rest
describe the bench.

**Five wet-lab claims were checked on 2026-09-13 and five were wrong**: the amp/carb mechanism,
what a culture number counts, why 45 °C, how the culture stages differ, and how a stage is made.
`--wet` lists nothing now, but the base rate is the point: a reason that sounds like chemistry and
is not marked `stated` should be assumed wrong until somebody checks it.

## 6.2 The Tlib3 characterization file — mine, invented, and yours to argue with

`test/fixtures/tlib3/Characterization of pTlib3A.txt`

The construction file is a transcription of yours. **The characterization file is not** — I wrote
it, and it is a guess at the experiment: 30 clones, a miniprep, one forward read off `G00101`, and
an analysis expecting a terminator insert. If the real experiment reads differently, the fixture is
teaching the toolkit the wrong shape.

Also mine: `pTlib3A_gg` as the Golden Gate product name. Your file calls both the assembly and the
transformation `pTlib3A`, which the tab-separated dialect reads as a duplicate product. That may be
a gap in the dialect rather than in your file.

## 6.3 One layout decision I flagged and did not make

The Tlib3 PCR sheet is **77 rows over three pages**, because it needs Taq for the 231 bp library
amplicon and PrimeSTAR for the 3.7 kb backbone, and both protocols print. The code's own suggestion
says one sheet or two is a judgement — *"whichever reads better at the bench"*. It is one line to
split.

## 6.4 What is still not converted, and why

`jobsToLabSheets`, `cfToJobs`, `binReactions` and `expandClones` build structures rather than
choose between outcomes. Forcing those into rules would produce an interpreter nobody can read,
which is the failure this whole idea exists to avoid. Stated so that "are they all done" has a
written answer.

## 6.5 Two things in your inventories, for whenever you are in them

**Thirteen of the thirty-nine box files in `Pimar/inventory/Minus20` have classic-Mac line
endings.** The reader normalises them now, so nothing is broken — but they are older than every
tool that reads them.

**Sixty-one tubes record their strength with a mangled micro sign** — `100_m`, `10_m`, `100�M`.
Also read correctly now. Both are noted because they will keep being true of new files unless
something upstream changes.
