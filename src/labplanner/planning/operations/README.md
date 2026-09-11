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

## How to use them

One file per operation. Read the one for the labsheet you are writing. They assume stage one has
already run, so the samples are decided; what is left is how to set that operation up well.

**Where a file says "ask", ask.** A planner that guesses a colony count for a library, or picks
a freezer slot without looking at the inventory, produces a labsheet that looks finished and
sends somebody to the bench with the wrong plan.
