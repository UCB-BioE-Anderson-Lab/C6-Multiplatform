# Packaging: how a session reaches the right capability

**PROPOSED 2026-09-21. Nothing here is implemented.** JCA, on finding `b144.flow` answering a
labsheet question: *"a tool called 'b144.flow' doesn't really communicate 'this is the skill on how
to make labsheets'. Really bad semantics… The design logic in labplanner is pretty far along. The
packaging is not. Rethink the packaging from first principles."*

**The principle this is built on**, JCA 2026-09-21: *"everything except checkpoint management is
part of C6. When you mount a c6 to a c11, c11 should see a skill that explains how to use it."*

**Half of that already works.** Mounting C6 into Pimar surfaces `skills/labsheets` at the top of
`c11 survey`, read out of C6's own store. The connector needs no `skill` field: skills are found by
walking the mounted store, which is derived rather than declared and is the right design. What does
not work is the other surface — `which` — and that is §4.1.

§4 splits the work by **who owns it**, because most of it is the kernel's and not this
repository's. §7 says what this spec deliberately does not touch.

---

## 1. The reproduction

```
$ c11 which "I do not know where to start with the labplanner"
   16.69  b144.flow      the one button for B144 safety — …
    0.39  cortex.sendall
    0.39  cortex.wait
```

That phrase is copied **verbatim** from the `phrases` array of `skills/labsheets`, the record
written specifically to answer it. It does not appear. `b144.flow` — a room-scoped safety
process — wins by 40×.

**That diagnosis was wrong, and §4.1 records how.** Skills are absent from the ranker BY DESIGN,
the design is documented in the kernel's own skill, and the fix this spec first proposed is
explicitly forbidden there. Cortex Operations 19 ran the findings rather than taking them and
caught it. The scores above are also historical: `c3d4577` in cortex dropped the offending phrase
from `b144.flow`, and that query now returns it at **0.79**.

## 2. What is broken — three symptoms, one cause

**2.1 The only surface that receives meta-questions cannot answer them.** A session asking "where
do I start with X" types it into `which`, because `which` is where questions go. `which` ranks
capabilities by what they DO; a scope question names no capability. Skills answer it and are
reachable only through `survey`, which nobody runs when they have a specific question.

**2.2 So generic vocabulary decides by default.** With no skill in the race, whichever record holds
"fit together", "flow", "the whole pipeline in one place" wins every domain's meta-question.
`b144.flow` holds them by accident of being written first, and its phrase *"I do not know how the
B144 tools fit together"* is a template: drop the domain word and it matches every domain.

**2.3 An id that names a place and a shape teaches nothing.** `b144` is a room — and rooms change,
which is the same class of error as naming a role after its holder. `flow` is a shape word. The
record's own `noun`/`verb` are `onboarding`/`show`, which are **correct**; only the id is wrong,
and the id is what a human reads in a result list.

**The cause is one thing:** a question type with no surface. 2.2 and 2.3 are what fills a vacuum.

## 3. Principles

1. **Retrieval is the packaging.** Whatever surface is actually used is the package, whatever the
   documents say. This toolkit has nine documents and a session still concluded out loud that it
   had none.
2. **Four question shapes, four surfaces — and this spec first named three because its author had
   used two.** *What do I press for X* → ranked (`which`). *What exactly is Y* → exact index
   (`ontology`). *What records mention these words* → `search`. *Where do I start with X* →
   `survey`, which prints skills first. **`search` was the one I missed**, and it answers the
   question I said nothing answered: `c11 search "labsheet tools fit together"` returns
   `skills/labsheets` as its single hit.
3. **A key held by everything is spent.** Any noun carried by both internals and entry points has
   stopped being a retrieval key. 163 generated records and 3 front doors share `labsheet`.
4. **Generic vocabulary is allocated, not grabbed.** Meta-phrasings are a shared resource; they
   belong to the layer that answers meta-questions, and to one record per domain or none.
5. **A name must survive its context.** Not a room, not a project code, not a shape.
6. **Anything describing a whole is derived from its parts, or it rots.** `experiment.author` was
   rewritten twice for exactly this, both times recorded in its own notes.

## 4. The work, by owner

### 4.1 ~~make skills reachable from `which`~~ — **DISSOLVED 2026-09-21. No claim survives.**

This section made three claims in succession and measurement killed all three. Kept in full, because
what is left is a method finding and it is the most useful thing in this document.

**Claim 1: "skills are absent from the ranker, and `which` should return them."** Wrong, and the fix
was already forbidden in writing. `skills/mounting`'s notes: *"A SKILL DOES NOT RANK IN THE PHRASE
SEARCH, AND THAT IS THE DESIGN RATHER THAN A GAP… pouring data records into it makes the buttons
less findable… **Do not 'fix' this by adding skills to the ranker** — the whole point of a front
door is that you do not have to search for it."* Skills are reached by `survey`, `ontology` and
`search`. `c11 search "labsheet tools fit together"` returns `skills/labsheets` as its single hit.
This spec was written by somebody who had used two of the four verbs.

**Claim 2: "a safety record answers labsheet questions."** True of the one phrasing this spec
measured, false of the set. `b144.flow` had taken a bare navigational frame — *"I do not know how
the B144 tools fit together"*, and later *"which verb owns which step"* in its description. Cortex
Operations 19 measured all five of `skills/labsheets`' phrases rather than the one handed over, and
fixed both (`c3d4577`, `31d9811`). Four of five stopped landing on it.

**Claim 3: "the last one is a kernel question, because the record that should win is a skill."**
Wrong, and wrong in the same direction twice. No skill was involved. The record that should win is
`cortex.labsheets` — a `function`, which ranks — and it was losing 12:1 on the word `press`, which
appears nowhere in it. Three phrases added (`bb5795d`):

```
what do I press to make labsheets
  before:  b144.flow 8.74      · cortex.selftest 0.74 · cortex.labsheets 0.71
  after:   cortex.labsheets 56.60 · b144.flow 2.47
```

Every B144 query unchanged or better. **Nothing from this section goes to the kernel.**

#### What survives: a domain noun is not enough

`labsheets` was in all eight of that record's phrases and it lost anyway. Every one of them was
written by somebody who already knew the verb's name — *"compile a labsheet from a construction
file"*, *"turn a characterization file into labsheets"*. **The person who needs a record most is the
one who does not know what it is called, and they ask for a button.** A record has to hold the words
its ASKERS use, not the words its author would.

That is the packaging rule this whole document was looking for, and §4.4/§4.5 do not contain it.

#### And the noise is the design working

Three of the five phrasings sit at 2.89–3.22 — the ranker having nothing to rank for a meta-question
and saying so quietly rather than confidently. *"I do not know where to start with the labplanner"*
is one of them and should be: it is an orientation question, the skill is its right answer, and
`search` finds it. That is the front door working as documented.

#### Method note, and it is why this section is kept rather than deleted

Three sessions concluded "skills are outside the ranker" from a symptom that was two records'
vocabulary in somebody else's repository. Each error had the same shape:

- **A warning in a record's `notes`, unread.** `skills/mounting` said do not do this. Earlier the
  same day, `annotateCircular`'s comment said reverse-strand coordinates come back mirrored, and
  seven plasmid maps shipped with every complement feature 1400 bp out. `notes` is where this system
  keeps its failures by convention, so a script that extracts structure skips exactly the field that
  says what goes wrong.
- **Measuring the example rather than the set.** One phrasing looked like a ranker defect; five
  showed it was vocabulary in two records. Neither session gets to keep this as advice: each was
  told it by the other, about the other's mistake, immediately before making its own.

### 4.2 KERNEL (cortex) — the `claims` sentence is false; the mechanism is real

**Half of this was wrong too.** Correct: no code in `engine/c11` reads `data.claims`, and a bogus
claim writes, shows and surveys in silence — verified independently by Cortex Operations 19, who
wrote `skills/bogusclaimtest` claiming a record that does not exist, watched it land, and deleted
it.

**Wrong: that it is unenforced.** `tests/test_skills.py` resolves every `claims` and `references`
entry and fails `cortex selftest` — it caught that bogus record immediately. And
`skills/mounting`'s notes already say so precisely: *"Write-time refusal of a dangling claim is
deferred with the rest of the coverage machinery; `tests/test_skills.py` checks it meanwhile."*

**So the defect is a documentation one, and narrow.** `c11.skill`'s notes say a dangling claim is
*"refused at write, like `conforms`"*. That sentence is false — the refusal is deferred and a test
covers it meanwhile. Either implement it or correct the sentence; it is a kernel record, so it is
the principal's call.

**On this repository's own `test/skill-claims.test.js`:** it overlaps `tests/test_skills.py` and is
still worth having. C6 is mounted BY installations and must be able to validate its own skills
without one — a world whose records are only checked by whoever mounts it is checked by nobody when
nobody has.

### 4.3 KERNEL (cortex) — rename `b144.flow`

`onboarding.flow` at minimum: the noun is already `onboarding`, and the id should agree with it.
Its three template phrases — *"I do not know how the B144 tools fit together"*, *"the whole safety
pipeline in one place"*, *"which verb chases what"* — should narrow to name safety, or move to a
skill for that scope, which is what they describe.

Until then it will keep winning every domain's meta-question.

### 4.4 THIS REPOSITORY — the naming rule, and a test — **BUILT 2026-09-21**

**The rule this spec first proposed was wrong, and testing it against the store before writing any
code is what showed that.** It said an id must equal `noun + '.' + verb`. Three of fourteen records
pass it, and the eleven it flagged are mostly BETTER than what it would have forced:
`labsheet.receive` reads better than `inventory.receive`, `cf.check` better than
`construction-file.check`. A rule that makes eleven ids worse to fix one is not the rule. It was
derived from a single bad example and never checked against the corpus — the same mistake as the
session that declared the toolkit undocumented.

What actually failed in `b144.flow` is narrower, and neither half is the `noun`/`verb`:

- **`b144` is a place.** Rooms change, and an id encoding where something happens stops being true
  when it moves — the same class of error as naming a role after its holder.
- **`flow` is a shape.** It says the record has stages, which is true of nearly everything.

So, implemented in `test/record-names.test.js`:

1. **An id's first segment must be a declared domain word**, listed in that file with a reason
   beside it. Adding one is a line somebody writes in a diff — `b144` could not be added without
   reading the sentence justifying it.
2. **An id's last segment must not be a shape word** — `flow`, `pipeline`, `system`, `manager`,
   `helper`, `util`, `misc`, `core`, `common` and the rest.
3. **Every hand-written record carries a `noun` and a `verb`**, whatever the id says. The id is for
   a human reading a result list; the fields are for the exact index. They may differ —
   `labsheet.receive` is filed under `inventory` and both are right — but neither may be absent, or
   the record is reachable by ranking alone.

Applying the shape-word rule to `b144.flow` rejects it, which is the check working.

### 4.5 THIS REPOSITORY — vocabulary allocation — **BUILT 2026-09-21**

No `function` or non-skill `datum` may carry a scope phrasing: *fit together*, *where do I start*,
*the whole X pipeline in one place*, *which verb owns/chases*, *what must I not do*, *how do the X
tools*. And at least one skill must, or nothing answers the question at all.

**It caught a live violation on its first run.** `experiment.author` carried the phrase *"how does
labplanner fit together"* — the record the spec is about, holding the vocabulary of the skill that
now replaces it. Removed, with the reason in its notes. It still describes the whole flow, which is
right; what it must not do is claim to BE the map.

## 5. What enforces what

| claim | enforcer | exists |
|---|---|---|
| a skill's claims resolve | `test/skill-claims.test.js` | **yes** |
| entry and branch documents exist | same | **yes** |
| no record claimed by two skills | same | **yes** |
| id prefix is a declared domain word | `test/record-names.test.js` | **yes** |
| id suffix is not a shape word | same | **yes** |
| every record has a noun and a verb | same | **yes** |
| no function holds meta-vocabulary | same | **yes** |
| ~~skills reachable from `which`~~ | **dissolved** — no defect existed; see §4.1 | n/a |
| a record holds the words its askers use | nothing — §4.1's surviving rule, unenforced | no |
| a skill's claims resolve, in cortex | `~/cortex/tests/test_skills.py`, in `cortex selftest` | **yes** |
| `claims` refused AT WRITE | nothing — and `c11.skill`'s notes wrongly say otherwise (§4.2) | no |

## 6. Rulings needed

1. ~~**§4.1**~~ **Dissolved on measurement.** Nothing goes to the kernel from it.
2. ~~The low-score threshold.~~ Moot.
3. ~~**Does `cortex.labsheets` get its own skill in cortex?**~~ **RULED 2026-09-21 — no.**
   *"Everything except checkpoint management is part of C6."* One skill, in C6, covering the whole
   labsheet job; checkpoint management is the single piece that is cortex's. `skills/labsheets`
   §scope has been narrowed to say exactly that, rather than pushing this lab's collector address
   and slug out of scope along with the checkpoints.
4. **§4.2: implement write-time `claims` refusal, or correct `c11.skill`'s notes to say the
   refusal is deferred and `tests/test_skills.py` covers it.** Both honest; leaving the false
   sentence is not.

## 7. Out of scope

- **Re-nouning the 356 generated records.** They are marked `generated/` already; the problem is
  that nothing weights the distinction, which is the ranker's and not a labelling defect. Changing
  163 nouns to fix a ranking problem would be the wrong repair in the wrong place.
- **Merging the `labsheet.*` family under one noun.** Each noun is correct for its own record
  (§4.4). The workflow they belong to is the skill's job.
- **The ranker's scoring maths.** Nothing here asks for better ranking — only for a surface that
  exists at all.
