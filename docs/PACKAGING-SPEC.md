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

Not a tuning problem. `skills/labsheets` returns zero hits for the literal word `labsheets`:
**skills are absent from the ranker's index entirely.**

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
2. **Three question shapes, three surfaces.** *What do I press for X* → ranked (`which`). *What
   exactly is Y* → exact index (`ontology`). *Where do I start with X* → **currently nothing.**
3. **A key held by everything is spent.** Any noun carried by both internals and entry points has
   stopped being a retrieval key. 163 generated records and 3 front doors share `labsheet`.
4. **Generic vocabulary is allocated, not grabbed.** Meta-phrasings are a shared resource; they
   belong to the layer that answers meta-questions, and to one record per domain or none.
5. **A name must survive its context.** Not a room, not a project code, not a shape.
6. **Anything describing a whole is derived from its parts, or it rots.** `experiment.author` was
   rewritten twice for exactly this, both times recorded in its own notes.

## 4. The work, by owner

### 4.1 KERNEL (cortex) — make a mounted world's skill reachable from `which`

The load-bearing change. Everything else is cosmetic without it.

A mounted world is supposed to explain itself, and it half does: `survey` already shows a mounted
skill as an ENTRY POINT. But a session that has a question does not run `survey` — it runs `which`,
and `which` cannot return a skill at all. So the explanation exists, travels correctly with the
mount, and is invisible at the moment somebody needs it.

`which` gains a **SCOPES block, separate from the ranking** — not interleaved, not scored against
capabilities:

```
$ c11 which "I do not know where to start with the labplanner"

  SCOPES — a skill covers this whole area. Read one before pressing anything.
    skills/labsheets    Turning an experiment's construction and characterization files into
                        the labsheets somebody carries to a bench…
                        read first: docs/LABPLANNER.md   ·   c11 show skills/labsheets

   16.69  b144.flow     …
```

- **Matched on** a skill's `phrases` and `scope`, by the same scorer.
- **Separate on purpose.** A skill outranking `cf.check` on *"check my construction files"* would
  be a regression: they answer different questions. The block offers a scope without displacing a
  task answer.
- **Absence is stated.** No skill matched and none exists in the store → say so once, as `survey`
  already does: *"nothing has declared an entry point yet, so search is the only way in."*
- **A skill is never `run`.** Pressing one reads. The block says `show`, never `run`.

**Open:** whether a low top-score should make the block louder (a top hit under ~1.0 means nothing
did what was asked, which is exactly when a scope question is likely). Recommended, but it is a
threshold and thresholds are the principal's.

### 4.2 KERNEL (cortex) — enforce `claims`

`c11.skill`'s notes say a claim naming a missing record is *"refused at write, like `conforms`"*.
**No code in `engine/c11` reads `data.claims`.** Verified 2026-09-21: a bogus claim writes, shows
and surveys in silence.

This is the kernel's own named failure — a true-sounding sentence with nothing under it — inside
the kernel's own schema. Either implement it at write, or delete the sentence. The third option,
leaving it, is the one the kernel exists to prevent.

C6 enforces it for its own skills in `test/skill-claims.test.js`; that covers one world.

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
| skills are reachable from `which` | §4.1, kernel | no |
| `claims` refused at write | §4.2, kernel — **currently a claim with nothing under it** | no |

## 6. Rulings needed

1. **§4.1 separate block vs ranked-together.** This spec argues separate. Ranked-together is
   simpler and risks a skill displacing the right task answer.
2. **The low-score threshold in §4.1**, if any.
3. ~~**Does `cortex.labsheets` get its own skill in cortex?**~~ **RULED 2026-09-21 — no.**
   *"Everything except checkpoint management is part of C6."* One skill, in C6, covering the whole
   labsheet job; checkpoint management is the single piece that is cortex's. `skills/labsheets`
   §scope has been narrowed to say exactly that, rather than pushing this lab's collector address
   and slug out of scope along with the checkpoints.
4. **§4.2: implement `claims` or delete the sentence.** Both are honest; leaving it is not.

## 7. Out of scope

- **Re-nouning the 356 generated records.** They are marked `generated/` already; the problem is
  that nothing weights the distinction, which is the ranker's and not a labelling defect. Changing
  163 nouns to fix a ranking problem would be the wrong repair in the wrong place.
- **Merging the `labsheet.*` family under one noun.** Each noun is correct for its own record
  (§4.4). The workflow they belong to is the skill's job.
- **The ranker's scoring maths.** Nothing here asks for better ranking — only for a surface that
  exists at all.
