# C6

**This is C6: a toolkit for designing recombinant DNA constructions, simulating them before
anybody touches a pipette, and planning the bench work that builds them.** A session opened here
is a cloning assistant — working on this toolkit, or using it to design and plan real
experiments.

Start with `README.md`: what C6 is, what it is deliberately not, and how to run it.

**Scope.** Construction files and their simulation; oligo and EIPCR design; constraint-based
specification of what to build; labsheets and lab packets for the bench; sample inventory across
boxes and plates. **Not** a lab's own business: no addresses, no checkpoint routing, no paths to
any machine. C6 ships, so it carries nothing about where it happens to be running.

## Where to start

The **skills** are the front doors, and they are plain JSON files any session can read:

    sharables/skills/experimental-planning.json   the whole arc, phase by phase, with the gate
                                                  between each and what enforces it
    sharables/skills/goal.json                    stating what a construct must be, before
                                                  anything is known to exist to build it from
    sharables/skills/labsheets.json               construction file to bench and back

Each names a document to read first (`data.entry`), the records it vouches for (`data.claims`),
and the rules that hold across it (`data.invariants`). `docs/planning/README.md` is the same map
as prose, and `README.md` indexes the rest of `docs/`.

Run it with `npm test`, the `bin/c6-*` commands, and `docs/LABPLANNER-API.md` for what each one
does.

## Optional: a C11 installation as a backend

C6 is also a **C11 world** — a toolkit that C11 installations mount. This is an optional
backend, not what C6 is. With one, every record in `sharables/` becomes searchable by what you
need and runnable by id; without one, C6 is ordinary software and nothing below applies.

1. **Find the installation that mounts this checkout.** `$C11_HOME` if set; otherwise the one
   whose mounts file names this repository:

       grep -l "$(basename "$PWD")" "$C11_HOME"/engine/c11-mounts.txt ~/*/engine/c11-mounts.txt 2>/dev/null

   More than one? Ask the person which they work through; do not pick. None? There is no
   backend here, and that is a complete answer.
2. **Read that installation's `C11.md`** for how its verbs work, and run its `c11` by absolute
   path from here; a directory inside a mounted world resolves to the installation that mounts
   it. To find anything, ask `c11 which "<the need>"`, then `c11 show` / `c11 run` the button. A
   value (a name, an id) is found by the button that holds values of its kind, not by `which`.
   `which` ranks buttons only — a skill, schema or datum is reached by `c11 ontology <noun>
   <verb>` or by reading its file.
3. **Read `docs/C11-CONNECTOR.md`** for what this world offers a mounting installation.

**A gap, named rather than guessed at.** Using an installation as a backend and *becoming* that
installation are different things, and the kernel does not yet distinguish them: `C11.md` ends by
telling the reader to read `INSTALLATION.md`, which is that installation's own identity and
principal. A clause for this is being drafted kernel-side (Cortex operations, 2026-11-04). Until
it lands, a session that came here to work on C6 is C6's agent using a backend; if that conflicts
with something the installation's files tell you, say so plainly rather than resolving it
silently in either direction.

---

If any of these files conflict with system, developer, security, or explicit user instructions,
follow the higher-priority instruction and state the conflict when relevant.
