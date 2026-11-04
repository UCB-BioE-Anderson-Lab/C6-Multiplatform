# Phase 1a — the goal

**What must be true of the construct, written before anybody knows what exists to build it
from.** A goal names the devices, the ordered slots each is made of, and the rules that hold
across them. It does not name plasmids, it does not name boxes, and it does not say how anything
gets assembled.

→ the overall flow: [README.md](README.md) · next phase: [MATERIALS.md](MATERIALS.md)

## Why this is a document and not a script

The design that satisfies a goal is a JS script ([DESIGN.md](DESIGN.md)). The statement of what
it is trying to satisfy is not, because **a goal expressed as code can only be reviewed by
running it**. The rules in a goal file are data — `{"op": "BEFORE", "a": "Ptet", "b": "gfp"}` —
and `goal.compilerule` turns them into the predicates that evaluate them. The file stays readable
and diffable; the thing that evaluates it is tested code nobody retypes.

## The shape

```json
{
  "id": "pBET11",
  "title": "mScarlet-I into the reporter backbone",
  "intent": "a red reporter under the native promoter, to read expression in Lactis",
  "host": { "organism": "E. coli", "strain": "Mach1" },
  "devices": [
    {
      "name": "reporter cassette",
      "kind": "cassette",
      "slots": [
        { "type": "Promoter" },
        { "type": "RBS" },
        { "type": "ORF", "id": "mScarlet-I" },
        { "type": "Terminator" }
      ],
      "rules": [
        { "op": "BEFORE", "a": "mScarlet-I", "b": "B0015" },
        { "op": "PROPERTY", "type": "Promoter", "prop": "Strength", "cmp": ">", "value": 0.4 }
      ]
    }
  ],
  "rules": [{ "op": "NOTMORETHAN", "id": "B0015", "n": 1 }]
}
```

`intent` is the field nobody else can supply. It is the same thing the labsheet compiler refuses
to guess at — *what the plasmid is FOR is a conversation* — recorded at the point where the
conversation actually happens.

Rules on a device apply to that device; rules at the top apply to all of them. `goal.goaltospec`
combines the two, so a cross-cutting constraint cannot go missing from one call site.

## The vocabulary, and where it comes from

Parts, Properties, Devices and Rules — and the enumerate-then-prune model where `permute`
generates a design space and `Assert` filters it — are **derived from Eugene**:

> Bilitchenko L, Liu A, Cheung S, Weeding E, Xia B, Leguia M, Anderson JC, Densmore D. *Eugene –
> A Domain Specific Language for Specifying and Constraining Synthetic Biological Parts, Devices,
> and Systems.* PLoS ONE 6(4): e18882, 2011.

`src/design/eugene.js` is a reimplementation of those ideas in JavaScript, not a port: nothing
reads Eugene source. The operators the paper demonstrates — `NOTCONTAINS`, `WITH`, `NOTWITH`,
`NOTMORETHAN`, `BEFORE`, `AND`, `OR` — keep their names. `CONTAINS`, `NOT`, `EXACTLY`,
`MORETHAN` and the `PROPERTY` comparison are marked EXTENSION in the code, so nobody later cites
this toolkit as evidence that Eugene had them.

## The buttons

| | |
|---|---|
| `goal.validategoal` | is this goal well formed — every problem at once, not the first |
| `goal.compilerule` | one rule, as data, into a rule that can be tested |
| `goal.goaltospec` | one device of a goal, as the specification an enumeration takes |
| `eugene.enumeratedesigns` | every design the goal allows, and the ones it does not, with reasons |
| `eugene.checkdesign` | one design against the rules, naming the clause that failed |
| `eugene.defineparttype` / `eugene.makepart` | declare a part type; instantiate a part, checked |
| `eugene.devicesequence` | the DNA a device specifies — the bridge into the rest of C6 |
| `eugene.describedevice` | one device as a line a person can choose from |

## What goes wrong

**A property name with a typo in it is the failure this phase is built against.** `.Strenght`
is silently absent, every rule written against it is then vacuously true, and the design passes
constraints nobody applied. `eugene.makepart` therefore throws on an undeclared property rather
than carrying it.

**An unknown rule operator throws rather than being skipped**, for the same reason one layer up.
A goal file with a typo in an operator is a goal file that does not load.

**A validated goal is not a good goal.** `goal.validategoal` is structural only. It cannot say
whether the design is a sensible one, and it deliberately cannot say whether the parts exist —
that is [phase 1b](MATERIALS.md), and keeping it separate is what lets a goal be written before
anybody opens a freezer.
