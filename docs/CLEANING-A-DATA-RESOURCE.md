# Cleaning up a messy wetlab data resource

**This is a PROMPT, not an algorithm.** JCA 2026-09-14: *"This clearly is a messy process
requiring lots of 'how do you want to handle this one' questions, so it is prompt-like, not
algorithm-like. But we will be doing it many times."*

So this document is the procedure and the accumulated defect catalogue. The detectors are code;
every resolution is a question for the person whose data it is.

---

## The shape: a new folder beside the old one

**Write a clean copy. Never edit in place.** JCA: *"you write a new version of the original folder
that has everything formatted perfectly (genbanks, oligos, plasmids, etc.) and then the user can
delete the original version."*

    <repo>/            the original, untouched
    <repo>-clean/      every file rewritten to a canonical form

Three reasons this beats editing in place, and the third is the one that matters:

1. **Reviewable as a whole.** A diff of 200 scattered edits is unreadable; two trees side by side
   are not.
2. **Revertible by doing nothing.** The user deletes the copy, or deletes the original. There is
   no undo to get right.
3. **It forces the canonical form to be written down.** Editing in place fixes only what somebody
   noticed. Rewriting every file means every file is stated to be correct, and the ones that
   cannot be rewritten are the findings.

*Small, targeted repairs in a git repo — a brace, four renames — are a different act and may
still be done in place, because git already provides 2 and 3. The clean-copy rule is for a
resource being brought into a canonical state, not for a one-line fix.*

## The loop

1. **Detect.** Run every detector below across the resource. This is code and must find
   everything it can without asking anything.
2. **Classify.** Separate what is MECHANICAL (one right answer, no judgement) from what NEEDS THE
   OWNER. Get this wrong in the safe direction: when unsure, ask.
3. **Ask in one batch.** Not one interruption per defect. A resource with 36 collisions is one
   conversation, not 36.
4. **Write the clean copy**, applying the mechanical fixes and the owner's answers.
5. **Re-detect against the copy.** **The job is finished when the detectors report nothing, not
   when the edits are written.** Anything still reported is either a defect that was missed or an
   answer that did not take.

## The defect catalogue

Everything below was found in real repositories. Each entry is *what it looks like*, *how it is
detected*, and *who decides*.

### Encoding and file-level

| defect | detection | decides |
|---|---|---|
| **UTF-16 text file** | byte-order mark at offset 0 | mechanical — decode and rewrite as UTF-8 |
| **stray character in a name** | a name that is not `[A-Za-z0-9_.+-]+` | owner, usually obvious |
| **misnamed file** | contents do not match what the name claims | owner |
| **vendored trees** | `.venv`, `node_modules`, `site-packages`, `__pycache__`, `dist`, `build` | mechanical — never scanned, never copied |

**UTF-16 is the one that costs data silently.** `nisK and nisR seq oligos.txt` in the Cheese repo
is UTF-16LE with CRLF, out of a Windows editor. Read as UTF-8 every one of its six oligos is
rejected as "not an oligo row" — the null bytes break the sequence pattern — so the file yields
nothing at all. No error, no empty file. A first pass reported 54 oligos where there were 60.

### Oligo files

| defect | detection | decides |
|---|---|---|
| **mixed dialects in one file** | per-row column shape | mechanical — decide per ROW, never per file |
| **missing scale / purification** | fewer than four columns | mechanical, with the fill recorded as `assumed` |
| **name reused for a different sequence** | group by name, compare sequences | **owner** |
| **one sequence under two names** | group by sequence, compare names | **owner** |
| **oligo pools read as oligos** | `*_order_IDT.xlsx` | mechanical — refuse; a pool is one mixed tube |

**Dialect is per row, and three files prove it.** `Oligos-pBET2.txt` has `bet007` and `bet008`
with scale and purification, then `ce007` and `ce008` with neither, four lines apart. A per-file
sniff is the obvious design and writes a scale onto rows sitting beside rows that state one —
the worst case, because the file itself is evidence the value was not recorded.

### GenBank maps

| defect | detection | decides |
|---|---|---|
| **malformed location** | `complement(119..124}` — a brace for a paren | mechanical |
| **origin-spanning feature** | `complement(9854..298)` where start > end | **not a defect** — it wraps on a circular plasmid |
| **feature under 10 bp** | length | mechanical — not a feature, it matches everywhere |
| **name reused for a different sequence** | group by name | **owner** |
| **generic bucket names** | one name over many sequences | **owner** — numbering buries provenance |

**The origin-spanning row is in this table because it is the trap.** It looks exactly like corrupt
data and is perfectly valid: six of Cheese's features were thrown away as unreadable, including
`slp`, the S-layer protein that `pTRKH3-slpGFP` is named after. A cleanup that "repairs" these
destroys real annotations.

**Generic names are the expensive case.** A real feature library carried `spacer` over **183
different sequences** and `terminator` over 59 — a uniform designed set with one type, one colour
and a tight length band, so nothing but the sequence distinguishes them. Numbering them is
mechanical and lossy: if the set came from a published library, the real names exist somewhere and
numbering buries them. **Ask before numbering.**

### Reference safety — before any rename

**A rename that misses a reference turns a visible collision into an invisible dangling pointer,
which is strictly worse than the collision.** So the reference scan runs first, and it must state
its own blind spots.

| format | reachable |
|---|---|
| text, `.seq`, `.ape`, `.gb`, `.gbk`, `.str`, `.csv`, `.tsv`, `.md`, `.json` | read directly |
| `.docx`, `.xlsx`, `.xls`, `.pptx` | **yes** — zipped XML |
| `.pdf` | **yes** — `pdftotext`; check for scanned images, which yield nothing |
| images | **no.** The stated blind spot |

In the Cheese repo that leaves exactly one PNG unsearchable out of 86 files. An early claim that
"29 of 86 cannot be searched" was a list of extensions nobody had tried.

## What the detectors must never do

- **Never resolve a name collision.** Not by newest mtime, not by repository precedence, not by
  sequence length, not by which appears in more files. Report every variant with its sources.
- **Never write a guess indistinguishably from a fact.** A filled-in scale is marked `assumed`.
- **Never drop a row it did not understand.** Return it with a reason. Every defect in this
  catalogue was found by something returning what it could not read, and two of them were found
  on a detector's first run against real data.
- **Never treat "nothing found" as "nothing there."** An unmounted resource is not a clean one.
