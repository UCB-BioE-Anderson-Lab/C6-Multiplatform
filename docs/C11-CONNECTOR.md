# C6 as a C11 world

**This repository is a C11 world: a toolkit.** A C11 installation mounts it and gains everything
below as buttons it can search for, rank and run, without copying any of it. It is not an
installation itself, and it carries no paths to any particular machine, because it ships.

This file is for two readers: **somebody working inside C6** who wants the rest of their C11
installation from here, and **an installation mounting C6**. `c11-connector.json` at the root
names this file as the one to read first.

## Working inside C6

`CLAUDE.md` at the root routes a session to the installation that mounts this checkout and to
that installation's `C11.md`, which is the authority. In short:

- **Run that installation's `c11` by absolute path from here** (`<installation>/bin/c11 …`). A
  working directory inside a mounted world resolves to the installation that mounts it, so this
  works from C6's root and writes where it should.
- **To find anything, ask `which` by NEED, then run the button.** `c11 which "where is an
  oligo, its sequence and tubes"`, then `c11 show <id>` to see how it is called and `c11 run <id>`
  or `c11 show <view> --arg …` to use it.
- **A value is not a need.** An oligo name, a plasmid, a box id is found through the button that
  holds values of its kind: `oligo.find` or `oligo.snapshot.card` for an oligo, not
  `which "ca998"`. `which` given a bare value says so and lists those buttons.
- **From Python**, with the installation on `sys.path`: `from engine.c11 import api`, then
  `api.which(text)` (the same as `api.query`), `api.show(id, args)`, `api.run(id, argv)` and
  `api.read(id)`. Do not guess a name behind `hasattr`: a function that is not there then
  looks exactly like a search that found nothing.

Without any installation C6 is ordinary software: `npm test`, the `bin/c6-*` commands, and
`docs/LABPLANNER-API.md` for what each one does.

## Mounting it

Add this repository's path to the installation's `engine/c11-mounts.txt`, one path per line.
**The installation names a directory; this repository describes what is in it**, through
`c11-connector.json`: where the records live (`sharables/`), where the programs live (`bin/`), and
this file.

Mounted records are read and run, never edited from the installation. Writing a record under one
of these ids forks it into the installation's own store, where its version shadows this one.
That is the intended way to disagree with something here.

## What you get

**383 records in `sharables/`.** 18 are written by hand at the top level, 1 is a skill in
`sharables/skills/`, and 364 in `sharables/generated/` are generated from the JSDoc of the
library's exported functions by `bin/c6-sharables`, so the descriptions and the code cannot
drift apart: `npm test` fails when they do. `test/docs-match-code.test.js` fails when these
counts stop being true.

The hand-written ones are what most people reach for first:

| record | what it does |
|---|---|
| `cf.sim`, `cf.check`, `cf.plan` | simulate a construction file (`--maps` compares each product with its recorded map); check a project's construction files; turn one into bench steps |
| `oligo.eipcr` | design EIPCR primers for a target edit |
| `experiment.author` | author a labsheet or lab packet from a plan |
| `labsheet.compile`, `.decide`, `.issue`, `.receive`, `.holds`, `.scenarios` | the labsheet lifecycle |
| `dna.view` | draw a DNA: circular map, linear map, sequence, or a molecule ladder with ends and overhangs. Zoom is a link. Its producer is `dna.layout` (`bin/c6-dna`) |

The generated records cover the library underneath: sequence manipulation, oligo design and
annealing, the simulator, inventory, labsheet assembly, and the protocol definitions. Ask
`which` for what you want rather than reading the list.

## What this repository expects of an installation

**Nothing.** It does not read the installation's store and cannot reach back into it. The
dependency runs one way: this repository knows what a C11 record is, and C11 knows only that a
directory might carry a `c11-connector.json`.

## If something does not work

- **The installation reports no toolkit mounted.** The path in its mounts file is wrong, or
  points somewhere without `sharables/`. A mount that cannot be read is named, not skipped.
- **A button is found but will not run.** `bin/` needs this repository's Node dependencies:
  run `npm install` here once. `dna.view` also needs Python 3 for its render file.
- **The records look out of date.** Run `bin/c6-sharables`. They are derived from the JSDoc in
  `src/`, so the fix for a wrong description is the comment above the function.
