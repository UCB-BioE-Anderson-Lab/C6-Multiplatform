# design/ — one algorithm per labsheet type

JCA, 2026-09-12, after a run of separate errors in separate sheets:

> *"I think once the list of labsheets is established, the rest of the details for a labsheet are
> pretty deterministic. The errors you are showing me imply that you are doing too much
> improvisation… With a specific design algorithm per labsheet type, that should be pretty
> generalizable and expandable."*

That is the diagnosis and the design. The errors were not one bug: the PCR sheet had no oligos
and no recipe, the transformation named the wrong antibiotic, the picking sheet claimed six
plates, the assay opened by reading twenty-four cultures. **Different bugs on different sheets is
what improvisation looks like from outside.** They came from one projection in a CLI that treated
all nine operations as one shape and then patched the differences in by hand.

So the pipeline is now in two halves, and the seam is the point:

| | what it decides | where |
|---|---|---|
| **planning** | WHICH labsheets there are, in what order, with which samples on each | `planning/` |
| **design** | what goes ON one labsheet, given its operation | here |

Planning is a graph problem and stays one body of code. Design is per operation, because a gel
and an assay have nothing in common except the paper.

## Adding an operation

One file, exporting one object. Nothing else in the pipeline changes — `index.js` finds it, and
an operation with no design gets `_default.js`, which says only what is true of any step.

```js
export default {
  operation: 'pcr',
  title: 'PCR',
  module: 'primestar_pcr',              // the protocol transcluded, or a function of the context
  shownAsColumn: ['enzyme'],            // conditions in the table, so not repeated below it
  columns(sample, ctx) { … },           // ONE ROW of the Samples table, as an ordered object
  values(ctx) { … },                    // the module's inputs — see below, this is the load-bearing one
  recipe(ctx) { … },                    // a reaction to print, or null
  notes(ctx) { … },                     // lines below the sheet
};
```

`ctx` carries `{ sheet, samples, mastermix, producer, experiment, tube }` — `producer(name)`
returns the conditions of whatever step makes that name, which is how a pick sheet learns the
antibiotic from the plate it picks from.

## `values` is not optional

A protocol module is a FUNCTION OF ITS INPUTS, and calling it with none does not fail — it
returns a confident sentence about somebody else's experiment. `heat_shock_transformation` with
no values says *"plate on Amp"*; `plate_reader_fluorescence` opens *"Read 24 cultures"*. A default
reads exactly like an answer, so the page cannot show the difference. `c6-protocol` reports the
inputs each module declares and the renderer warns when it was handed none — but the warning is
the backstop, not the mechanism. The mechanism is this function.

## What belongs on a labsheet

Everything the cheatsheet cannot tell you, and nothing it can. The protocol is pinned to the
bench; the primer pair is not.
