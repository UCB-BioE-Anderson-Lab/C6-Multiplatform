# Per-operation instructions

**JCA, 2026-09-10:** *"From that analysis, you know what the list of labsheets are, and what
samples go into each one. The rest of this process is compartmentalized to specific operations.
So, you will want to have instruction documents about how to handle different types, and this is
presumably more mcp prompt/skill like than code, at least at the high level."*

So this directory is the second half of the planner, and it is deliberately **prose, not code**.
Stage one — `cfToJobs.js` then `binReactions.js` — answers *which labsheets exist and what goes
on each*, and that is exact: it comes from input/output relationships and nothing else. What
follows is per-operation, and most of it is judgement about a particular experiment.

## The line between the two, because it is the whole design

Something belongs in **code** when a wrong answer is wrong for everybody:

| in code | why |
|---|---|
| which steps may share a labsheet | reachability in the dependency graph — `binReactions.js` |
| what goes in a mastermix | the components every sample shares; set arithmetic |
| the extension time in a thermocycler program | product length from simulation, divided and rounded |
| expected band sizes on a gel | the simulated product |
| whether a transform needs a rescue step | the antibiotic named in the construction file |

Something belongs **here, as instructions** when the right answer depends on the experiment:

| judgement | what it turns on |
|---|---|
| tubes, strips, or a plate | where the templates already are, and what the rows should mean |
| how many colonies to pick | whether this is a clone or a library |
| which box and well new minipreps go in | what the inventory already holds |
| what to sequence, and with which oligo | copy number, region of interest, what has been sequenced before |
| which controls to add | what the experiment is for, and what comes after it |

**A rule that reaches a wrong answer the same way every time belongs in code.** A rule that needs
to look at this experiment belongs here — and several of these say *discuss it with the user*,
which is an instruction, not a gap.

## One more thing that is not a rule: how much goes on one sheet

Stage one says which steps **cannot** share a labsheet, because one makes what another consumes.
It does not say they **must** share one. JCA, 2026-09-10:

> *"You could choose to put all the pcrs in one labsheet, or split it over two labsheets based on
> different chemistries, different plasticware. There is no strict requirement that you have to
> consolidate to 1 labsheet. In the end, there is a lot of discretion as to how you communicate
> experiments. Sometimes more labsheets will be more clear to the experimentalist than one giant
> one."*

So a bin is the **largest** set that may share a sheet, not a set that has to. Splitting it — by
chemistry, by plasticware, or just because one page is easier to work from — is an editorial
choice and always available. Where the tools notice a natural seam they name it; none of them
refuses.

## A label is what somebody writes on a tube cap

**It is not the product name.** `seq_pGhost12-A` is a fine name for the record and hopeless on a
cap; `12` is the label, and the two live side by side on the sheet. cloning-tutorials keeps names
to 4–6 characters "to balance uniqueness with the ability to write it on a tube cap", and of
labsheet labels says: *"short, unique, and easy to recognize."*

**Short is not the same as truncated.** Generating labels by cutting the construct to three
characters gave `pGh` for both pGhost12-A and pGhost15, and `412` for both 412F and 412G — two
pairs of tubes nobody could tell apart. Derive them so they stay distinct: `12`, `15`, `68`,
`2F`, `2G`, `58`.

**The label follows the sample the whole way through** — the transformation plate, the PCR tube,
the Zymo tube (`z12`), the sequencing submission. A label that changes at each step is a label
that has to be cross-referenced at each step.

`labpacket-to-xlsx.py` warns on any label over 6 characters or used twice in one sheet.

## Transclude a protocol only when there is no cheatsheet for it

JCA, 2026-09-10: *"The protocol injection is actually excessive. Certainly leave it out for
miniprep, zymo, and other tasks where we have made the cheatsheets… It's the protocols that don't
have cheatsheets that need to be included on the labsheets."*

Eight protocols have a one-pager on the teaching site and the bench already has them:

    PCR · gel · Zymo · Golden Gate · transformation · picking · miniprep · cycle sequencing

Those are marked `cheatsheet` in `protocols/index.json`, and a labsheet prints one line — *"Qiagen
Miniprep — use the miniprep cheatsheet"* — instead of the protocol. **Reprinting them buries the
part of the sheet that is specific to this experiment, which is the only part nobody can look
up.** A SLIP6 sheet went from a page of miniprep steps to nine rows.

Everything else is transcluded in full, because there is nowhere else to read it: pouring plates,
LB agar, antibiotic stocks, TSS comp cells, starter cultures, plate-reader runs.

## How to use them

One file per operation. Read the one for the labsheet you are writing. They assume stage one has
already run, so the samples are decided; what is left is how to set that operation up well.

**Where a file says "ask", ask.** A planner that guesses a colony count for a library, or picks
a freezer slot without looking at the inventory, produces a labsheet that looks finished and
sends somebody to the bench with the wrong plan.
