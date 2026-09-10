#!/usr/bin/env python3
"""Render a LabPacket into a working .xlsx — the sheet a student fills in and sends back.

    python3 labpacket-to-xlsx.py packet.json out.xlsx [--no-protocols]

JCA, 2026-09-10, on why a spreadsheet rather than a PDF:

> *"I think we should make excel files instead so we have calculation functions within… for
> things like adding water to make oligo dilutions. Maybe what happens here is you make these
> excel files and email them to students, they fill stuff in, maybe add notes to it, then send
> it back to you along with checkpoints, and you collect all this stuff in the repo as the
> record. So, the labsheet data structure is the plan, the finished excel file is the record."*

**That sentence is the architecture.** The JSON is the plan and is generated; this file is the
working document and comes back changed. They are different artefacts with different lifetimes,
and the repo keeps both — which is why nothing here writes back into the packet.

**THE CALCULATIONS ARE THE POINT, AND THEY ARE ORDINARY.** Not C6 simulation — the source
workbook does call `pcr()` and `assemble()` through the Apps Script relay, but those are a
different mechanism and they do not survive a download. What belongs here is the arithmetic a
student would otherwise do on paper and get wrong:

  resuspension   ddH2O µL = nmol × 10 for a 100 µM stock. The student reads the nmol off the
                 IDT tube — it is different every time — and the volume follows. Today that
                 column says "put in mols" and the water volume is computed nowhere.
  mastermix      per-reaction volume × reactions × excess.

Written as **live formulas referencing the cell the student types into**, so the number updates
as they work. A pre-computed value would be a printed PDF wearing a spreadsheet's clothes.

**WHY PYTHON, IN A JAVASCRIPT TOOLKIT.** The reader beside this is Python because .xlsx parsing
needs openpyxl; making the writer JavaScript would mean SheetJS or exceljs — a fourth
dependency — to produce a format the neighbouring file already handles. Both directions of one
conversion belong in one language. If C6 later gains a JS xlsx dependency for another reason,
this should move.
"""
import json, sys, os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

HEAD = Font(bold=True, size=10)
TITLE = Font(bold=True, size=13)
SUB = Font(italic=True, size=9, color="555555")
HEADFILL = PatternFill("solid", fgColor="EFEFEF")
# A cell the student writes in has to LOOK like one, or a spreadsheet is a PDF with gridlines.
ENTRY = PatternFill("solid", fgColor="FFF9D6")
BOX = Border(*[Side(style="thin", color="BBBBBB")] * 4)
WRAP = Alignment(wrap_text=True, vertical="top")


def put(ws, r, c, v, *, font=None, fill=None, border=True, wrap=False):
    cell = ws.cell(row=r, column=c, value=v)
    if font: cell.font = font
    if fill: cell.fill = fill
    if border: cell.border = BOX
    if wrap: cell.alignment = WRAP
    return cell


def write_table(ws, r, rows, entry_cols=()):
    """A table with its header. `entry_cols` are 0-based indices the student fills in."""
    if not rows: return r
    header = rows[0]
    for j, h in enumerate(header):
        put(ws, r, j + 1, h, font=HEAD, fill=HEADFILL)
    r += 1
    for row in rows[1:]:
        for j in range(len(header)):
            v = row[j] if j < len(row) else ""
            put(ws, r, j + 1, v, fill=ENTRY if (j in entry_cols and not v) else None)
        r += 1
    return r + 1


def dilution_block(ws, r, oligos):
    """The resuspension table, with the water volume as a live formula.

    This is the calculation the whole format is for. The student reads `nmol` off the tube —
    "typically around 25 but always different", per the labsheet — and the water follows:
    a 100 µM stock is 100 nmol/mL, so µL = nmol × 10.
    """
    put(ws, r, 1, "Resuspend IDT stocks", font=HEAD, border=False); r += 1
    put(ws, r, 1, "Type the nmol from the tube's side label. The water volume computes itself.",
        font=SUB, border=False); r += 1
    hdr = ["oligo", "nmol (from the tube)", "ddH2O to add (µL)", "final concentration", "Box", "Well"]
    for j, h in enumerate(hdr):
        put(ws, r, j + 1, h, font=HEAD, fill=HEADFILL)
    r += 1
    for o in oligos:
        put(ws, r, 1, o.get("construct") or o.get("label", ""))
        put(ws, r, 2, None, fill=ENTRY)                       # the student types this
        # nmol × 10 µL gives 100 µM. Guarded so an empty row shows nothing rather than 0,
        # because a zero volume looks like an instruction to add no water.
        put(ws, r, 3, f'=IF(B{r}="","",B{r}*10)')
        put(ws, r, 4, f'=IF(B{r}="","","100 uM")')
        put(ws, r, 5, o.get("Box", "")); put(ws, r, 6, o.get("Well", ""))
        r += 1
    return r + 1


def mastermix_block(ws, r, recipe, n_reactions):
    put(ws, r, 1, "Reaction", font=HEAD, border=False); r += 1
    put(ws, r, 1, "Per reaction, and scaled. Change the reaction count and the totals follow.",
        font=SUB, border=False); r += 1
    put(ws, r, 1, "reactions", font=HEAD, fill=HEADFILL)
    rc = put(ws, r, 2, n_reactions, fill=ENTRY)
    put(ws, r, 3, "excess", font=HEAD, fill=HEADFILL)
    xs = put(ws, r, 4, 1.1, fill=ENTRY)
    rcell, xcell = f"$B${r}", f"$D${r}"
    r += 2
    for j, h in enumerate(["µL each", "component", "total µL", "fridge"]):
        put(ws, r, j + 1, h, font=HEAD, fill=HEADFILL)
    r += 1
    for comp in recipe.get("components", []):
        put(ws, r, 1, comp.get("volume_uL"))
        put(ws, r, 2, comp.get("name", ""))
        put(ws, r, 3, f"=ROUND(A{r}*{rcell}*{xcell},1)")
        put(ws, r, 4, comp.get("code", ""))
        r += 1
    return r + 1


def sheet_to_ws(wb, sheet, include_protocols):
    name = (sheet.get("title", "sheet").split(" for ")[0] or "sheet")[:31]
    ws = wb.create_sheet(name)
    ws.column_dimensions["A"].width = 26
    for col in "BCDEF": ws.column_dimensions[col].width = 20
    ws.column_dimensions["G"].width = 40
    r = 1
    put(ws, r, 1, sheet.get("title", ""), font=TITLE, border=False); r += 2
    m = sheet.get("metadata", {})
    if m.get("module"):
        put(ws, r, 1, f"protocol: {m['module']}", font=SUB, border=False); r += 1
    if m.get("source_note"):
        put(ws, r, 1, f"source: {m['source_note']}", font=SUB, border=False); r += 1
    r += 1

    pre = sheet.get("preamble")
    if pre:
        put(ws, r, 1, pre.get("title", "Before you start"), font=HEAD, border=False); r += 1
        oligos = []
        for b in pre.get("blocks", []):
            if b.get("kind") == "table":
                for row in b.get("rows", [])[1:]:
                    if row and row[0] and row[0].startswith("o"):
                        oligos.append({"construct": row[0],
                                       "Box": row[1] if len(row) > 1 else "",
                                       "Well": row[2] if len(row) > 2 else ""})
        seen, uniq = set(), []
        for o in oligos:
            if o["construct"] not in seen:
                seen.add(o["construct"]); uniq.append(o)
        if uniq: r = dilution_block(ws, r, uniq)

    if sheet.get("inputs"):
        put(ws, r, 1, "Source", font=HEAD, border=False); r += 1
        rows = [list(sheet["inputs"][0].keys())] + [list(x.values()) for x in sheet["inputs"]]
        r = write_table(ws, r, rows)
    if sheet.get("samples"):
        put(ws, r, 1, "Samples", font=HEAD, border=False); r += 1
        rows = [list(sheet["samples"][0].keys())] + [list(x.values()) for x in sheet["samples"]]
        r = write_table(ws, r, rows)
    if sheet.get("recipe"):
        r = mastermix_block(ws, r, sheet["recipe"], len(sheet.get("samples") or []) or 1)

    for b in sheet.get("blocks", []):
        k = b.get("kind")
        if k in ("heading", "text"):
            put(ws, r, 1, b.get("text", ""), font=HEAD if k == "heading" else None,
                border=False, wrap=True); r += 1
        elif k == "step":
            put(ws, r, 1, b.get("text", ""), border=False, wrap=True); r += 1
        elif k in ("table", "grid"):
            rows = b.get("rows", [])
            # A capture table's blank trailing columns are where the record gets made.
            entry = set()
            if len(rows) > 1:
                for c in range(len(rows[0]) - 1, -1, -1):
                    if all(not str(x[c] if c < len(x) else "").strip() for x in rows[1:]):
                        entry.add(c)
                    else:
                        break
            r = write_table(ws, r, rows, entry_cols=entry)

    if sheet.get("notes"):
        put(ws, r, 1, "Notes", font=HEAD, border=False); r += 1
        for n in sheet["notes"]:
            put(ws, r, 1, n, border=False, wrap=True); r += 1
        r += 1

    cp = sheet.get("checkpoint")
    if cp:
        put(ws, r, 1, "CHECKPOINT", font=HEAD, border=False); r += 1
        put(ws, r, 1, "When this sheet is filled in, email this file back to "
                      "jca-cortex@berkeley.edu with this line in the message:",
            font=SUB, border=False, wrap=True); r += 1
        put(ws, r, 1, f"cortex::{cp.get('code','')}", font=Font(bold=True, size=12)); r += 1
        if cp.get("expects"):
            put(ws, r, 1, f"Expected: {cp['expects']}", font=SUB, border=False, wrap=True); r += 1
        r += 1

    put(ws, r, 1, "Your notes", font=HEAD, border=False); r += 1
    put(ws, r, 1, "Anything that happened that the plan did not say. This comes back with the "
                  "file and becomes part of the record.", font=SUB, border=False, wrap=True); r += 1
    for _ in range(4):
        c = put(ws, r, 1, None, fill=ENTRY)
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6); r += 1
    return ws


def main():
    src, out = sys.argv[1], sys.argv[2]
    include = "--no-protocols" not in sys.argv
    packet = json.load(open(src))
    wb = Workbook(); wb.remove(wb.active)
    for sheet in packet.get("sheets", []):
        sheet_to_ws(wb, sheet, include)
    wb.save(out)
    print(f"  wrote {out}: {len(packet.get('sheets', []))} sheet(s)")


if __name__ == "__main__":
    main()
