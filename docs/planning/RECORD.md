# Phase 5 — the record

**The sheet came back.** What actually happened at the bench gets read off the returned workbook,
the freezer learns where the tubes really went, the data is filed, and what was concluded is
written down where the next person will find it.

→ the overall flow: [README.md](README.md) · previous: [characterization](../CHARACTERIZATION.md)

## What exists

| | |
|---|---|
| `labsheet.receive` | read a filled-in workbook back by slug, release the holds, append to the box files |
| `labsheet.holds` | what freezer space is still held, and for what |
| `render/read-returned.py` | resolve each slug's formula rather than trusting a cached value |

**THE SHEET WINS.** A hold says where a tube was expected; the returned sheet says where it went,
and they disagree often — the student was at the freezer and we were not. The held well is let go
either way, and a tube nobody made records nothing, so an abandoned experiment leaves no trace.

## What is NOT built

- **Filing the data.** Plate-reader runs, gel images and sequencing traces come back as files and
  are put somewhere by hand. Nothing in C6 says where they go or checks that they arrived.
- **Comparing the result to the goal.** The construct was specified in phase 1a, simulated in
  phase 2 and built in phase 3; whether the thing in the tube is what the goal asked for is
  answered today by a person reading a trace. `cf.sim --maps` compares a design to its map, not a
  result to its design.
- **Writing conclusions back.** The notes a session makes about what worked live in chat windows
  that close.

The gate at the end of this phase — *the experiment is recorded* — is enforced by `NOTHING`
beyond the inventory half.

## What is NOT C6's at all

**Checkpoint management.** JCA, 2026-09-21: *"everything except checkpoint management is part of
C6."* A checkpoint is a lab's own gate on a student's work: which step needs a result before the
next may start, who is chased, and by what route. That is the installation's: it wraps
`c6-labplan` with its own checkpoints and routing, and C6 must never learn a lab's addresses.

What C6 owns here is the mechanism a checkpoint rides on: the slug, the record tab, the reader
that resolves it. What it must not own is who gets mailed.
