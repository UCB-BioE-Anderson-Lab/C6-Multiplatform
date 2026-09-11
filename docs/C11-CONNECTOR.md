# Using this repository as a C11 content world

**This repository is a content world.** A C11 installation can mount it and gain everything
below as capabilities it can search for, rank and run — without copying any of it, and without
the installation knowing anything about how this repository is laid out.

## How to mount it

Add this repository's path to your installation's mounts file, one path per line:

    ~/cortex/engine/c11-mounts.txt          (or wherever your installation keeps it)

        ~/Documents/GitHub/C6-Multiplatform

That is the whole of it, and it is deliberately the only thing your installation records. **Your
installation names a directory; this repository describes what is in it** — through
`c11-connector.json` at the root here, which names where the records live (`sharables/`), where
the programs live (`bin/`) and which file to read to work with them (this one).

Nothing here is written by a mounting installation. Mounted records are read and run, never
edited: writing a record under one of these ids forks it into your own store, where your version
shadows this one. That is the intended way to disagree with something here.

## What you get

**171 records in `sharables/`.** Six are written by hand and describe the command-line tools;
the remaining 165 in `sharables/generated/` are generated from the JSDoc of the library's own
exported functions by `bin/c6-sharables`, so the descriptions and the code cannot drift apart —
`npm test` fails when they do.

The tools, which are what most installations reach for first:

| record | what it does |
|---|---|
| `cf.sim` | simulate a construction file — resolve every named part, run each step, report the product |
| `cf.check` | check every construction file in a project folder against what the repository holds |
| `cf.plan` | turn a construction file into an ordered plan of bench steps |
| `oligo.eipcr` | design EIPCR primers for a target edit |
| `experiment.author` | author a labsheet or lab packet from a plan |

The generated records cover the library underneath: sequence manipulation, oligo design and
annealing, inventory across boxes and plates, labsheet assembly, and the protocol definitions.
Search for what you want rather than reading the list — that is what the records are for.

## What this repository expects of you

**Nothing.** It has no opinion about which installation mounts it, does not read your store, and
cannot reach back into it. The dependency runs one way: this repository knows what a C11 record
is, and C11 knows only that a directory might carry a `c11-connector.json`.

## If something does not work

- **The installation reports no toolkit mounted.** The path in the mounts file is wrong, or
  points somewhere without a `sharables/` directory. A mount that cannot be read is named rather
  than skipped, so the message will say which line it could not use.
- **A capability is found but will not run.** The programs in `bin/` need this repository's
  Node dependencies — run `npm install` here once.
- **The records look out of date.** Regenerate them: `bin/c6-sharables`. They are derived from
  the JSDoc in `src/`, so the fix for a wrong description is to correct the comment above the
  function and regenerate.
