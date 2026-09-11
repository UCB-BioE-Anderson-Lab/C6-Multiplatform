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
import json, re, sys, os, zipfile
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

HEAD = Font(bold=True, size=12, color="1F3864")
TITLE = Font(bold=True, size=16, color="1F3864")
# NOTHING UNDER 12. JCA, 2026-09-10: *"the text you are using is too small. Nothing under 10
# please. Ideally 12. I'm kinda blind."* Small type in a lab is not a style preference — the
# person reading this is standing up, in gloves, under overhead light, and the cost of a
# misread volume is a wasted afternoon. 9pt italic secondary text was the worst of it.
SUB = Font(italic=True, size=12, color="444444")
BODY = Font(size=12)
LABEL = Font(bold=True, size=12)
HEADFILL = PatternFill("solid", fgColor="DCE6F1")
# A cell the student writes in has to LOOK like one, or a spreadsheet is a PDF with gridlines.
ENTRY = PatternFill("solid", fgColor="FFF6C8")
BOX = Border(*[Side(style="thin", color="BBBBBB")] * 4)
WRAP = Alignment(wrap_text=True, vertical="top")


# Prose rows, per sheet, so their heights can be set once the column widths are known.
_PROSE = {}

def prose(ws, r, text, *, font=None, height=None):
    """A line of prose across the sheet. Notes and steps are sentences, not cells.

    Written merged rather than left in column A: a 60-word safety note wrapped inside a
    16-character column becomes a twelve-line tower that pushes the actual work off the screen,
    which is what the first version did.

    EXCEL NEVER AUTO-FITS A MERGED ROW, so the height has to be right when it is written. The
    first version guessed from an assumed 95 characters per line — but `autosize` sets the real
    column widths afterwards, so the guess was against a width that did not exist yet, and long
    sentences came out clipped to one and a half visible lines with the rest hidden under the
    row below. The height is now set in `fit_prose`, once the widths are known.
    """
    c = ws.cell(row=r, column=1, value=text)
    c.font = font or BODY
    c.alignment = Alignment(wrap_text=True, vertical="top")
    ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
    if height:
        ws.row_dimensions[r].height = height
    elif text:
        _PROSE.setdefault(ws.title, []).append((r, str(text), (font or BODY).size or 12))
    return c


def fit_prose(ws):
    """Set every prose row's height from the width it actually got."""
    width = sum((ws.column_dimensions[get_column_letter(i)].width or 10) for i in range(1, 7))
    for r, text, size in _PROSE.get(ws.title, []):
        # ~1 character per width unit, and a line of `size` pt needs about size*1.3 points.
        per_line = max(20, int(width) - 2)
        lines = max(1, -(-len(text) // per_line))
        ws.row_dimensions[r].height = max(15, round(lines * size * 1.35, 1))


def autosize(ws):
    """Column widths from the content actually in them.

    Fixed widths were the first attempt and could not work: the dilution table puts an oligo
    name in column A and a number in B, the mastermix does the reverse, and one set of widths
    truncates whichever table it was not tuned for. The first version cut
    "5X PrimeSTAR GXL Buffer (green)" to "…Buffer (" — a reagent name somebody reads off the
    screen with a pipette in hand.

    Merged prose is EXCLUDED: a 200-character safety note spans A:F, and counting it toward
    column A would make one column wider than the screen and push every table off it.
    """
    merged = set()
    for rng in ws.merged_cells.ranges:
        for row in ws[rng.coord]:
            for cell in row:
                merged.add(cell.coordinate)
    widths = {}
    for row in ws.iter_rows():
        for cell in row:
            if cell.value is None or cell.coordinate in merged:
                continue
            v = str(cell.value)
            if v.startswith("="):
                v = "0" * 8                      # a formula shows its result, not its text
            widths[cell.column_letter] = max(widths.get(cell.column_letter, 0), len(v))
    for col, w in widths.items():
        ws.column_dimensions[col].width = min(max(w + 3, 10), 46)


def put(ws, r, c, v, *, font=None, fill=None, border=True, wrap=False):
    cell = ws.cell(row=r, column=c, value=v)
    cell.font = font or BODY
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


def dilution_sheet(ws, r, d):
    """A Dilution step rendered as the calculation it is.

    JCA, 2026-09-10: *"It should be presented as the calculated type — so student puts in the
    nmol number, and it says conc to make."*

    THE STUDENT TYPES EXACTLY ONE NUMBER PER OLIGO — the nmol printed on the side of the IDT
    tube, which is different on every tube. Everything else is a formula over that cell, so it
    moves as they work and there is no arithmetic to get wrong at the bench:

        ddH2O for the stock   nmol x 1000 / stock_uM   uL     (nmol x 10 at 100 uM)
        working stock         target/stock of the final volume, the rest water

    The concentrations come from the plan, not from constants here, because an experiment that
    wants 5 uM working stocks should say so in its labsheet and get a correct page.
    """
    stock, target = float(d.get("stock_uM") or 100), float(d.get("target_uM") or 10)
    WORKING_UL = 100.0        # a convenient working-stock volume; the split scales from it

    put(ws, r, 1, "1. Resuspend the IDT tubes", font=HEAD, border=False); r += 1
    prose(ws, r, f"Read the nmol off the side label of each tube and type it in the yellow cell. "
                 f"It is different on every tube. The water volume and the concentration compute "
                 f"themselves — you do not need to work anything out.", font=SUB); r += 1
    hdr = ["oligo", "what it is for", "nmol (from the tube)", "ddH2O to add (uL)",
           "gives you", "Box", "Well"]
    for j, h in enumerate(hdr): put(ws, r, j + 1, h, font=HEAD, fill=HEADFILL)
    r += 1
    first = r
    for t in d.get("targets", []):
        put(ws, r, 1, t.get("oligo", ""), font=LABEL)
        put(ws, r, 2, t.get("description", ""), wrap=True)
        put(ws, r, 3, None, fill=ENTRY)                      # the one cell they type in
        # nmol / (uM) * 1000 = uL. Guarded so a blank row shows nothing: a zero volume reads
        # as an instruction to add no water.
        put(ws, r, 4, f'=IF(C{r}="","",ROUND(C{r}*1000/{stock:g},0))')
        put(ws, r, 5, f'=IF(C{r}="","","{stock:g} uM stock")')
        put(ws, r, 6, t.get("box", "")); put(ws, r, 7, t.get("well", ""))
        r += 1
    r += 1

    put(ws, r, 1, f"2. Make the {target:g} uM working stocks", font=HEAD, border=False); r += 1
    prose(ws, r, f"These are what the PCR actually uses. Nothing to type — the volumes below "
                 f"make {WORKING_UL:g} uL of {target:g} uM from the {stock:g} uM stock you just "
                 f"made.", font=SUB); r += 1
    hdr2 = ["oligo", f"uL of {stock:g} uM stock", "uL ddH2O", "final volume", "final concentration"]
    for j, h in enumerate(hdr2): put(ws, r, j + 1, h, font=HEAD, fill=HEADFILL)
    r += 1
    take = round(WORKING_UL * target / stock, 1)
    for t in d.get("targets", []):
        put(ws, r, 1, t.get("oligo", ""), font=LABEL)
        put(ws, r, 2, take)
        put(ws, r, 3, round(WORKING_UL - take, 1))
        put(ws, r, 4, WORKING_UL)
        put(ws, r, 5, f"{target:g} uM")
        r += 1
    r += 1
    prose(ws, r, f"Label every tube with the oligo name and the concentration. A {stock:g} uM "
                 f"tube and a {target:g} uM tube look identical.", font=SUB); r += 2
    return r


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


# Below this many samples you do not make a mastermix, you just set the reaction up.
# JCA, 2026-09-10, seeing a scaled total against a single PCR: *"is that for a mastermix? This
# isn't relevant to setting up just 1 pcr. When there are >=4 samples, that's when you consider
# doing a mastermix."*
#
# The first version scaled unconditionally, so one reaction showed a "total µL" of 35.2 — a
# number with no meaning at the bench, since you would pipette the 32. Showing arithmetic where
# none is wanted is not a neutral extra: it implies a step that is not there, and the original
# workbook shows the plain recipe for exactly this reason.
MASTERMIX_THRESHOLD = 4


# TRANSCLUSION: `{module_id}` IN A TEXT BLOCK MEANS "PUT THE PROTOCOL HERE".
#
# It was being written to the cell verbatim, so labsheets carried lines reading
# `{picking_colonies_into_block}` — which reads as a rendering bug and leaves the student without
# the protocol they were promised. JCA, 2026-09-10: *"the transcluded link (that isn't being
# transcluded)."*
#
# The library is JavaScript because each module is a FUNCTION of its inputs, not a static page, so
# the text comes from `bin/c6-protocol`. A module that cannot be found is SAID so on the page: a
# labsheet with a hole in it should show the hole, not a pair of curly braces.
import subprocess

PROTO = re.compile(r"^\{([a-z0-9_]+)\}$")
_proto_cache = {}

def protocol_text(ids, values=None):
    """Rendered protocol text, PARAMETERISED BY THE SHEET THAT TRANSCLUDES IT.

    A protocol module is a function of its inputs, and rendering it with defaults is worse than
    not rendering it: `cycle_sequencing` with no values reads "Submit 8 reads with primer
    G00101" — confidently wrong on a sheet that submits four reads with sGho1, and it sits right
    under the correct instruction. So the sheet says what it is doing, in `protocol_values`, and
    a cache key that ignored those values would serve the first sheet's numbers to the second.
    """
    values = values or {}
    key = lambda i: f"{i}|{json.dumps(values.get(i, {}), sort_keys=True)}"
    want = [i for i in ids if key(i) not in _proto_cache]
    if want:
        here = os.path.dirname(os.path.abspath(__file__))
        exe = os.path.join(here, "..", "..", "..", "bin", "c6-protocol")
        try:
            args = [exe] + want + ["--values", json.dumps({i: values.get(i, {}) for i in want})]
            out = subprocess.run(args, capture_output=True, text=True, timeout=30)
            got = json.loads(out.stdout or "{}")
            for i in want: _proto_cache[key(i)] = got.get(i, {"missing": True})
        except Exception as e:
            for i in want: _proto_cache[key(i)] = {"error": str(e)[:80]}
    return {i: _proto_cache.get(key(i), {"missing": True}) for i in ids}


def write_protocol(ws, r, pid, info):
    """One protocol, written into the sheet as the steps it is."""
    if info.get("missing"):
        put(ws, r, 1, f"PROTOCOL MISSING: this sheet names \u201c{pid}\u201d and the library has no "
                      f"such module. Find it before anyone works from this page.",
            font=Font(bold=True, size=12, color="9C0006"), border=False)
        return r + 2
    if info.get("error"):
        put(ws, r, 1, f"PROTOCOL {pid} COULD NOT BE RENDERED: {info['error']}",
            font=Font(bold=True, size=12, color="9C0006"), border=False)
        return r + 2
    put(ws, r, 1, info.get("name", pid), font=HEAD, border=False); r += 1
    if info.get("description"):
        prose(ws, r, info["description"], font=SUB); r += 1
    for line in str(info.get("template", "")).split("\n"):
        line = line.rstrip()
        if not line.strip(): continue
        # The templates are markdown; strip the emphasis that would otherwise print as asterisks.
        txt = re.sub(r"\*\*(.+?)\*\*", r"\1", line)
        txt = re.sub(r"\*(.+?)\*", r"\1", txt).replace("`", "")
        # Emphasis that spans a line break leaves an orphan marker behind, because the templates
        # are wrapped prose and this is going line by line. Strip what is left rather than
        # printing "**20-50 bp" on a page somebody reads in gloves.
        txt = txt.replace("**", "")
        txt = re.sub(r"(?<![A-Za-z0-9])\*(?![A-Za-z0-9])", "", txt).strip()
        if PROTO.match(txt.strip()):        # a protocol that includes another one
            continue
        prose(ws, r, txt, font=BODY); r += 1
    return r + 1


# WHERE SANGER GETS SUBMITTED IS THE LAB'S BUSINESS, NOT THIS TOOLKIT'S.
#
# JCA, 2026-09-10: *"That is my lab specific route for submitting sequencing, so that does not go
# onto C6."* So the URL arrives as `--sequencing-url`, exactly as the collector address does. C6
# knows that a sequencing step has a submission route; it must not know what anybody's route is,
# because the next lab's is different and a toolkit carrying this one would be carrying a
# stranger's address.
#
# SANGER ONLY. *"and that is only for sanger."* Full-plasmid sequencing is a different vendor and
# a different route, so a full-plasmid sheet must not carry this link — putting it there would
# send somebody to submit a whole plasmid through the form for reads.
def is_sanger(sheet):
    """Is this a Sanger step, or something else that happens to be called 'Sequencing'?

    READ THE WHOLE SHEET, NOT THE TITLE. SLIP5's step is titled plainly "Sequencing for
    Experiment SLIP5" and its first line is "Full plasmid sequencing of best clone" — so a
    title-only test put the lab's Sanger submission link on a full-plasmid step, which is exactly
    the wrong place to send somebody. The words that settle it are in the body.
    """
    hay = json.dumps(sheet).lower()
    if "full plasmid" in hay or "full_plasmid" in hay or "fullplasmid" in hay:
        return False
    head = f"{sheet.get('title', '')} {sheet.get('operation', '')} {sheet.get('id', '')}".lower()
    if "analys" in head:
        return False
    return "sanger" in head or "sequenc" in head


# A LABEL IS WHAT SOMEBODY WRITES ON A TUBE CAP, so it has to fit on one.
#
# cloning-tutorials, planning/project_setup.md: names are kept to "4-6 characters to balance
# uniqueness with the ability to write it on a tube cap", and inventory_labsheets.md says of
# labsheet labels: *"Use label names that fit on the PCR tube caps — short, unique, and easy to
# recognize."* JCA, 2026-09-10, on a Zymo sheet reading `zseq_pGhost12-A`: *"You need to revisit
# the rules about labels. these are too long to write on a tube."*
#
# THE LABEL IS NOT THE PRODUCT NAME. `seq_pGhost12-A` is a fine name for the record and hopeless
# on a cap; `12` is the label and the two live side by side. The same trap produced a worse bug
# in the same sheet: labels generated by truncating the construct to three characters gave `pGh`
# twice and `412` twice, so two pairs of tubes were indistinguishable.
LABEL_MAX = 6

def check_labels(sheet):
    """Warnings about labels somebody has to write by hand. Never fatal — it is a labsheet."""
    out, seen = [], {}
    for s in sheet.get("samples", []) or []:
        lab = str(s.get("label", "") or "").strip()
        if not lab: continue
        if len(lab) > LABEL_MAX:
            out.append(f"label {lab!r} is {len(lab)} characters — too long for a tube cap")
        if lab in seen:
            out.append(f"label {lab!r} is used twice in one sheet — those tubes are indistinguishable")
        seen[lab] = True
    return out


def reaction_block(ws, r, recipe, n_reactions, excess=1.1):
    """The reaction, written the way a bench protocol writes it.

    JCA, 2026-09-10: *"There doesn't need to be a calculator for a mastermix, just do the
    calculations. The way this is normally presented is like: Master Mix: 233 uL ddH2O, 24 uL
    buffer … Reaction: 30 uL ddH2O, 10 uL Master Mix."*

    So: numbers, already worked out. The first version put the count and the excess in editable
    cells with formulas over them, which was both unwanted and broken — the formulas multiplied
    `volume_uL` while the packets carry `amount`, so every total rendered as 0. A spreadsheet
    that computes the wrong number confidently is worse than a printed one, and a student reading
    "0 uL ddH2O" either stops or pours nothing.

    WHAT GOES IN THE MIX is everything that does not differ between the tubes. A component says so
    with `varies`; failing that, a template is assumed to vary, because it is the one that does in
    nearly every labsheet here.
    """
    comps = recipe.get("components", [])
    amount = lambda c: float(c.get("amount", c.get("volume_uL", 0)) or 0)
    varies = lambda c: bool(c.get("varies")) or "template" in str(c.get("name", "")).lower()

    if n_reactions < MASTERMIX_THRESHOLD:
        put(ws, r, 1, "Reaction", font=HEAD, border=False); r += 1
        prose(ws, r, f"{n_reactions} sample{'' if n_reactions == 1 else 's'} — set the reaction "
                     f"up directly. A mastermix is worth it from {MASTERMIX_THRESHOLD}.",
              font=SUB); r += 1
        for c in comps:
            put(ws, r, 1, f"{amount(c):g} uL", font=LABEL)
            put(ws, r, 2, c.get("name", ""))
            put(ws, r, 3, c.get("code", ""))
            r += 1
        return r + 1

    shared = [c for c in comps if not varies(c)]
    per_tube = [c for c in comps if varies(c)]
    factor = n_reactions * excess
    mix_per_reaction = round(sum(amount(c) for c in shared), 1)

    put(ws, r, 1, "Master Mix", font=HEAD, border=False)
    put(ws, r, 2, f"for {n_reactions} reactions, {round((excess - 1) * 100)}% excess",
        font=SUB, border=False); r += 1
    for c in shared:
        put(ws, r, 1, f"{round(amount(c) * factor, 1):g} uL", font=LABEL)
        put(ws, r, 2, c.get("name", ""))
        put(ws, r, 3, c.get("code", ""))
        r += 1
    put(ws, r, 1, f"{round(sum(amount(c) for c in shared) * factor, 1):g} uL", font=LABEL)
    put(ws, r, 2, "total", font=SUB)
    r += 2

    put(ws, r, 1, "Reaction", font=HEAD, border=False)
    put(ws, r, 2, f"per tube, {round(sum(amount(c) for c in comps)):g} uL",
        font=SUB, border=False); r += 1
    put(ws, r, 1, f"{mix_per_reaction:g} uL", font=LABEL)
    put(ws, r, 2, "Master Mix")
    r += 1
    for c in per_tube:
        put(ws, r, 1, f"{amount(c):g} uL", font=LABEL)
        put(ws, r, 2, c.get("name", ""))
        put(ws, r, 3, c.get("code", ""))
        r += 1
    return r + 1


def sheet_to_ws(wb, sheet, include_protocols, collector, sequencing_url=None):
    name = (sheet.get("title", "sheet").split(" for ")[0] or "sheet")[:31]
    ws = wb.create_sheet(name)
    ws.sheet_view.showGridLines = False
    r = 1
    prose(ws, r, sheet.get("title", ""), font=TITLE, height=22)
    for col in range(1, 7):
        ws.cell(row=r, column=col).fill = PatternFill("solid", fgColor="E8EEF4")
    r += 2
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

    if sheet.get("dilution"):
        r = dilution_sheet(ws, r, sheet["dilution"])

    if sheet.get("inputs"):
        put(ws, r, 1, "Source", font=HEAD, border=False); r += 1
        rows = [list(sheet["inputs"][0].keys())] + [list(x.values()) for x in sheet["inputs"]]
        r = write_table(ws, r, rows)
    if sheet.get("samples"):
        put(ws, r, 1, "Samples", font=HEAD, border=False); r += 1
        rows = [list(sheet["samples"][0].keys())] + [list(x.values()) for x in sheet["samples"]]
        r = write_table(ws, r, rows)
    if sheet.get("recipe"):
        r = reaction_block(ws, r, sheet["recipe"], len(sheet.get("samples") or []) or 1)

    # Fetch every protocol this sheet transcludes in one call, before drawing anything.
    wanted = [m.group(1) for b in sheet.get("blocks", []) if b.get("kind") == "text"
              for m in [PROTO.match(str(b.get("text", "")).strip())] if m]
    protos = protocol_text(wanted, sheet.get("protocol_values")) if wanted else {}

    for b in sheet.get("blocks", []):
        k = b.get("kind")
        if k in ("heading", "text"):
            hit = PROTO.match(str(b.get("text", "")).strip()) if k == "text" else None
            if hit:
                r = write_protocol(ws, r, hit.group(1), protos.get(hit.group(1), {"missing": True}))
                continue
            prose(ws, r, b.get("text", ""), font=HEAD if k == "heading" else None); r += 1
        elif k == "step":
            prose(ws, r, b.get("text", "")); r += 1
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
            prose(ws, r, n); r += 1
        r += 1

    if sequencing_url and is_sanger(sheet):
        put(ws, r, 1, "Submit it here", font=HEAD, border=False); r += 1
        prose(ws, r, "The lab's Sanger submission form. Sign in with your Berkeley account.",
              font=SUB); r += 1
        c = put(ws, r, 1, sequencing_url, font=Font(size=12, color="1F3864", underline="single"))
        c.hyperlink = sequencing_url
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
        r += 2

    cp = sheet.get("checkpoint")
    if cp:
        # LABELLED ROWS, not a paragraph. The first version was a heading, one long sentence
        # and a bare slug — Chris read it and said "I don't understand the checkpoint". A
        # student meeting `cortex::` for the first time has no idea what it is or why, and a
        # student who cannot follow the instruction does not send the data.
        # Where the raw material comes from, when it is not something the student made. Every
        # checkpoint routes the same way — the student sends a message carrying the cortex::
        # line — so this is a lead-in, not a different instruction.
        if cp.get("arrives"):
            put(ws, r, 1, cp["arrives"], font=SUB, border=False); r += 1
        put(ws, r, 1, "CHECKPOINT", font=Font(bold=True, size=13, color="1F3864"), border=False)
        put(ws, r, 2, "send this in before carrying on", font=SUB, border=False)
        r += 1
        rows = (("What to send", cp.get("expects") or cp.get("delivers") or "this sheet"),
                ("Email it to", collector),
                ("Put this line in the message", f"cortex::{cp.get('code','')}"))
        for label, value in rows:
            put(ws, r, 1, label, font=LABEL, fill=HEADFILL)
            is_code = str(value).startswith("cortex::")
            put(ws, r, 2, value,
                font=Font(bold=True, size=13, name="Menlo") if is_code else BODY,
                fill=ENTRY if is_code else None, wrap=not is_code)
            r += 1
        prose(ws, r, "That line is how the lab's system knows which experiment and which step "
                     "your message belongs to. Copy it exactly.", font=SUB); r += 1
        r += 1

    put(ws, r, 1, "Your notes", font=HEAD, border=False); r += 1
    prose(ws, r, "Anything that happened that the plan did not say. This comes back with the "
                 "file and becomes part of the record.", font=SUB); r += 1
    for _ in range(4):
        c = put(ws, r, 1, None, fill=ENTRY)
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6); r += 1
    autosize(ws)
    fit_prose(ws)
    ws.freeze_panes = "A3"
    return ws


# A REBUILD THAT CHANGES NOTHING MUST CHANGE NO BYTES.
#
# These worksheets are generated files living beside hand-edited ones in a git repository, and
# .xlsx carries the time of writing in two places: a `<dcterms:created>` / `<dcterms:modified>`
# pair in docProps/core.xml, and the modification time stamped on every member of the zip. So a
# rebuild that produced identical content still produced five modified files. A diff that is
# always dirty is a diff nobody reads, which is exactly how a real change slips through
# unnoticed.
#
# Setting `wb.properties` is not enough — openpyxl writes `modified` at save time regardless —
# so the file is normalised after it is written.
EPOCH = (2000, 1, 1, 0, 0, 0)
_STAMP = re.compile(rb"(<dcterms:(?:created|modified)[^>]*>)[^<]*(</dcterms:)")

def deterministic(path):
    with zipfile.ZipFile(path) as z:
        members = [(i.filename, z.read(i.filename)) for i in z.infolist()]
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in members:
            if name == "docProps/core.xml":
                data = _STAMP.sub(rb"\g<1>2000-01-01T00:00:00Z\g<2>", data)
            info = zipfile.ZipInfo(name, date_time=EPOCH)
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data)


def closing_ws(wb, c):
    """The last tab: send the whole workbook back.

    JCA, 2026-09-10: *"When the full experiment is over, they send you back that sheet, so you
    can update the inventory with the new samples at the end."*

    ITS OWN TAB, at the end, and not a line at the bottom of the last step. A student finishes
    on whichever step their experiment actually ended on — a failed assembly stops at Pick — so
    an instruction tacked onto the nominal last sheet is one many of them never reach. A tab
    called "Send it back" is visible from the tab bar on day one.
    """
    ws = wb.create_sheet("Send it back")
    r = 1
    put(ws, r, 1, "When the experiment is over", font=TITLE, border=False); r += 2
    prose(ws, r, "Save this workbook and email it back. Everything you typed into it — the "
                 "samples you made, their boxes and wells, your notes — is the record of what "
                 "happened, and it is the only copy.", font=BODY, height=34); r += 2
    for label, value in (("Email it to", c.get("to", "")),
                         ("Attach", "this workbook, saved"),
                         ("Put this line in the message", f"cortex::{c.get('code','')}")):
        put(ws, r, 1, label, font=LABEL, fill=HEADFILL)
        is_code = str(value).startswith("cortex::")
        put(ws, r, 2, value, font=Font(bold=True, size=13, name="Menlo") if is_code else BODY,
            fill=ENTRY if is_code else None, wrap=not is_code)
        r += 1
    r += 1
    prose(ws, r, c.get("why", ""), font=SUB); r += 2
    prose(ws, r, "Send it even if the experiment did not work. A failed assembly with its "
                 "plate counts written down is a result; a workbook nobody sent back is not.",
          font=SUB, height=30)
    autosize(ws)
    fit_prose(ws)
    return ws


def main():
    src, out = sys.argv[1], sys.argv[2]
    include = "--no-protocols" not in sys.argv
    # WHERE CHECKPOINTS ARE SENT IS NOT C6'S TO KNOW. It is one particular lab's address, and
    # this toolkit must be usable by somebody else's. Passed in; the caller reads it from its
    # own configuration — for Cortex that is engine/principal.py's `mailbox.spa`, a file Cortex
    # is deliberately not allowed to write.
    sequencing_url = None
    for i, a in enumerate(sys.argv):
        if a == "--sequencing-url" and i + 1 < len(sys.argv):
            sequencing_url = sys.argv[i + 1]
    collector = None
    for i, a in enumerate(sys.argv):
        if a == "--collector" and i + 1 < len(sys.argv):
            collector = sys.argv[i + 1]
    if not collector:
        # Refuses rather than defaulting. A plausible-looking wrong address on a student's
        # instruction sheet sends their data somewhere nobody is reading.
        sys.exit("  labpacket-to-xlsx: --collector <address> is required; where a checkpoint "
                 "is sent is configuration, not a default this toolkit may invent")
    packet = json.load(open(src))
    wb = Workbook(); wb.remove(wb.active)
    for sheet in packet.get("sheets", []):
        # A step the workbook switched off is in the packet for the record, not for the
        # bench. Printing it would put a reaction on the page that this experiment does not do.
        if sheet.get("applies") is False:
            print(f"  skipping {sheet['id']}: marked as not part of this experiment")
            continue
        for w in check_labels(sheet):
            print(f"  ! {sheet.get('id', '?')}: {w}")
        sheet_to_ws(wb, sheet, include, collector, sequencing_url)
    if packet.get("closing"):
        closing_ws(wb, packet["closing"])

    wb.save(out)
    deterministic(out)
    print(f"  wrote {out}: {len(packet.get('sheets', []))} sheet(s)")


if __name__ == "__main__":
    main()
