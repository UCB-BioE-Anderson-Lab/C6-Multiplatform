# For review

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

**If a zymo in this lab does go back into a strip tube, the two rules genuinely cannot both hold
and one of them has to give.**

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
transformation only. The DNA is already known good by then, so "is this batch of plates any good"
was answered upstream. One line if you want it on both.

### 1.4 The eight sequence-verdict tokens live in C6

`Perfect`, `Perfect Partial`, `Silent Mutation`, `Missense Mutation`, `Nonsense Mutation`, `Indel`,
`Mixed Clone`, `Failed` — transcribed from the Lactis3-1 workbook's Seq Analysis tab. I read them
as ordinary molecular biology rather than one lab's convention, so every lab using C6 gets them.
Say the word and they move to Cortex. → `design/analysis.js § VERDICTS`

### 1.5 A sequencing tube's cap is nine characters, one more than a miniprep's

`pBET8-AF` is eight and a longer construct name makes nine: DNA name (6) + `-` + clone + read.
These tubes leave the building, so the limit is a real limit. → `models/labsheet.js § TUBE`

### 1.6 A labsheet may now be more than one page

`fitToHeight = 1` was scaling a 68-row tab to whatever percentage made it fit — at a bench, under
gloves — while the footer said "Page 1 of 1" and the pipeline printed a warning telling somebody to
*"cut what it says"*. That advice was wrong for the two sheets that are long **because** they carry
a protocol with no cheatsheet, which is content you asked for. Sheets now paginate, breaking
between sections.

Four of eleven Lactis3 sheets are two pages: Gel+cleanup+assembly (51 rows), Sequence analysis
(46), Picking and inoculation (48), Assay (68). **If you would rather these split into more
sessions, that is a change to `planning/sequences/` and I should make it there.**

### 1.7 Still open from GATE 1: is a 1.5 mL label six characters or eight?

You said two things that are in tension at the character count — *"a 1.5 mL is ~6 char"*, and
*"the convention for a single clone miniprep is to put the construction + '-' + clone identifier"*,
which makes `pBET8-A` seven. I took the six as the rule for the **DNA name** and the label as that
plus two. Flagged at GATE 1, never settled. → `models/labsheet.js § TUBE`

---

## 2 — Gaps in the experiment files. Yours, not mine to edit.

### 2.1 Lactis3 declares no culture volume for the E. coli minipreps

`Construction/Characterization of pBET8` goes Pick → Miniprep with no culture step, so nothing says
how much to pellet. `qiagen_miniprep` would otherwise print its default, "Pellet 4 mL". The sheet
now tells the student outright that nobody said. `volume=` on the Pick line settles it.

### 2.2 The three Google Docs

*LabSheet Models*, *Example LabSheets*, and `cf_shorthand_specification.md`. Exports would let the
designs be checked against what the lab actually writes rather than against my reading of it.

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

- **GATE 6.** Lactis3 is still the only real subject, by the plan's own rule.
- **`labelPrefix` is the only declared agentic decision.** The plan said one worked example and no
  others until the gate passes, so that is deliberate. The obvious next ones are the two the
  compiler currently refuses outright: *which oligo to sequence with* and *which box and well each
  miniprep goes into* — both already carried onto the sheet as open decisions, neither yet declared
  with a prompt and a schema.
- **No agent answers anything yet.** `c6-decide` prints the questions and `--answers` reads them
  back; Cortex does not yet run the middle step. That is a Cortex-side verb, not a C6 one.
