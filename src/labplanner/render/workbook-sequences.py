"""Extract the sequences a labsheet workbook keeps inside itself.

    workbook-sequences.py <out_sequences.tsv> <workbook.xlsx> [more.xlsx ...]

**WHY THIS EXISTS.** A construction file names its inputs; a resolver looks for them on disk in
`.seq` maps and `_oligos.txt` ordering sheets. That finds most of them and misses a class
entirely: sequences that were only ever typed into a labsheet. In SynThera, `G00101` and
`s101R` — the universal sequencing pair used by every experiment — are in NO `_oligos.txt` at
all. They live in each workbook's `sequences` tab and nowhere else.

The failure is silent and it points the wrong way: every other oligo resolves, these two do not,
and the tool reports a *correct* construction file as having missing inputs.

**THE OUTPUT IS DERIVED AND SAYS SO.** One row per sequence with the workbook it came from, in
`name <tab> sequence <tab> kind <tab> source`. It is not an ordering sheet and must never be
mistaken for one — an `_oligos.txt` records what was actually ordered from IDT, with scale and
purification, and inventing one of those from a labsheet would put fictitious orders into the
project's record.
"""
import openpyxl, os, re, sys

DNA = re.compile(r"^[ACGTRYSWKMBDHVNacgtryswkmbdhvn]+$")

def rows_of(ws):
    for r in ws.iter_rows(values_only=True):
        yield [("" if x is None else str(x).strip()) for x in r]

def harvest(path):
    """Every (name, sequence, kind) this workbook states, from any tab that states one.

    Not just the `sequences` tab: SLIP5 keeps its oligos and whole plasmids inline in
    `construction`, beside the operations that use them. Scanning by SHAPE — a short label
    next to a long run of unambiguous bases — finds both without needing to know which tabs a
    given workbook happens to use."""
    out = []
    wb = openpyxl.load_workbook(path, data_only=True)
    for ws in wb.worksheets:
        # `calculations` is the workbook's scratch pad — cells named `pcr1_forward_oligo_seq`,
        # `expected_read` and so on, holding whatever this particular workbook is working on.
        # They are per-workbook values that reuse the same label, so harvesting them produced
        # eight name conflicts that were not conflicts about anything real, and would have
        # buried a genuine one. A scratch cell is not a named reagent.
        if ws.title.strip().lower() in ("calculations",): continue
        for cells in rows_of(ws):
            vals = [c for c in cells if c]
            if len(vals) < 2: continue
            # find the first cell that is DNA, and take the label immediately before it
            for i, c in enumerate(vals):
                if len(c) >= 12 and DNA.match(c):
                    name = vals[i-1] if i else ""
                    kind = "plasmid" if len(c) > 200 else "oligo"
                    if i >= 2 and vals[i-2].lower() in ("oligo", "plasmid"): kind = vals[i-2].lower()
                    if name and not DNA.match(name) and len(name) < 40:
                        out.append((name, c, kind, os.path.basename(path), ws.title))
                    break
    return out

def main(argv):
    out, books = argv[1], argv[2:]
    if not books: sys.exit("  workbook-sequences: give at least one .xlsx")
    seen, rows, conflicts = {}, [], []
    for b in books:
        for name, seq, kind, src, tab in harvest(b):
            prev = seen.get(name)
            if prev and prev[0].upper() != seq.upper():
                # NOT RESOLVED HERE. Two workbooks disagreeing about one name is a finding
                # about the project; picking a winner would bury it.
                conflicts.append((name, prev[1], f"{src}:{tab}")); continue
            if prev: continue
            seen[name] = (seq, f"{src}:{tab}")
            rows.append((name, seq, kind, f"{src}:{tab}"))
    with open(out, "w") as f:
        f.write("# DERIVED by workbook-sequences.py — do not edit, and do not mistake this for\n")
        f.write("# an ordering sheet. Rebuilt from the workbooks named in the source column.\n")
        f.write("#name\tsequence\tkind\tsource\n")
        for r in rows: f.write("\t".join(r) + "\n")
    print(f"  wrote {out}: {len(rows)} sequence(s) from {len(books)} workbook(s)")
    if conflicts:
        print(f"  {len(conflicts)} NAME CONFLICT(S) — two workbooks give one name different sequences:")
        for n, a, b in conflicts: print(f"     {n}: kept {a}, also defined in {b}")
        sys.exit(1)

main(sys.argv)
