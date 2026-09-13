# Miniprep

Straightforward except for one thing, and that one thing is not mechanical.

*"this is straightforward, but need to specify and reserve a place to put the samples in an
existing box or a new box. You have the llm do this, and make calls on the inventory to find a
good spot."* — JCA, 2026-09-10

## A hold is fine. Saying a tube is there is not.

**RULED 2026-09-13, in two steps, and the second step is the sharp one.** This section used to say
the sheet must name both box and well before anybody is holding a tube — *"reserve it, do not just
suggest it"* — against the collision of two sheets written the same afternoon.

JCA first:

> *"I think that happens after the students send back the labsheet. That is when you learn about
> the real locations of things. What we have now is a tentative plan. The inventory we store should
> reflect reality, not a prediction of future reality. Cause sometimes labsheets get aborted, or
> just take years to finish. You don't want the inventory to be out of sync with reality."*

then, correcting an over-reading of that:

> *"It might be good to put a hold on spots in the inventory — I think that is fine. Just don't say
> things are in there that aren't there."*

**The line is between a hold and an occupancy record, and they are different assertions.** A hold
says *keep this spot free*; it claims nothing about what is in the freezer and is wrong only in the
cheap direction — a held well nobody fills is a wasted well. An occupancy record says *this tube is
here*, and that one is acted on: somebody goes and looks. An experiment that is abandoned, or that
takes three years, turns a predicted occupancy into a lie and leaves the inventory disagreeing with
the −20.

### What happens today

- **The box is printed.** Which box a set of minipreps belongs in is a standing decision, made when
  the experiment was planned, and it depends on nothing happening at the bench. Where nothing has
  named one, that is an open decision and the sheet says so.
- **The well is asked.** An entry cell, filled in at the freezer, when the tube exists.
- **The inventory is not written at all** by the compile, and the presence is recorded from the
  returned workbook.

### The hold is sanctioned and not built

`src/inventory/inventory.js` has no third state: `isOccupied(inv, loc)` is binary, so there is
nowhere to put *held but empty*. Building it means a real field on a location and every reader
learning to tell the two apart — worth doing, and a wider change than a labsheet design should
make on its own. Until then the collision is handled where it becomes real, by the person at the
freezer who can see the box.

## No checkpoint

*"Miniprep has no checkpoint. Samples just get logged on the sheet. When the full experiment is
over, they send you back that sheet, so you can update the inventory with the new samples at the
end."*

The rows the student fills in here are what the inventory is updated from — which is why the
packet ends with the whole workbook coming back (`return.workbook`), and why asking separately
for miniprep results would be asking twice for one fact.
