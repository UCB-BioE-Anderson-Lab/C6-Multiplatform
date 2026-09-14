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
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.pagebreak import Break

HEAD = Font(bold=True, size=12, color="1F3864")
TITLE = Font(bold=True, size=16, color="1F3864")
# NOTHING UNDER 12. JCA, 2026-09-10: *"the text you are using is too small. Nothing under 10
# please. Ideally 12. I'm kinda blind."* Small type in a lab is not a style preference — the
# person reading this is standing up, in gloves, under overhead light, and the cost of a
# misread volume is a wasted afternoon. 9pt italic secondary text was the worst of it.
SUB = Font(italic=True, size=12, color="444444")
SMALL = Font(italic=True, size=10, color="777777")
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


def sources_of(sheet):
    """What this sheet fetches before starting.

    **`sources`, WHICH IS WHAT THE MODEL CALLS IT** — `models/labsheet.js` and the heading the
    student reads both say Source. The packet said `inputs` for as long as it was built by hand in
    a bin script, so the field is still read under that name: a workbook read back by
    `xlsx-to-labpacket.py` carries the old spelling, and so does any packet.json on disk.
    """
    return sheet.get("sources") or sheet.get("inputs") or []


def write_table(ws, r, rows, entry_cols=(), header=True, record=None, slug=None):
    """A table with its header. `entry_cols` are 0-based indices the student fills in.

    `header=False` for a two-column list of conditions, which has no column names to give — the
    left cell IS the name. It used to be sent with a blank header row so this function had
    something to consume, and that rendered as an empty shaded strip above the first condition.
    """
    if not rows: return r
    if not header:
        width = max(len(x) for x in rows)
        for row in rows:
            for j in range(width):
                put(ws, r, j + 1, row[j] if j < len(row) else "",
                    font=HEAD if j == 0 else None)
            r += 1
        return r + 1
    header = rows[0]
    for j, h in enumerate(header):
        put(ws, r, j + 1, h, font=HEAD, fill=HEADFILL)
    r += 1
    # EVERY CELL A STUDENT FILLS IN NEEDS A SLUG, and the Samples table's did not have one.
    #
    # The record tab is how a returned workbook is read back — `render/read-returned.py` resolves
    # each slug's formula and hands the values out by name. Every other entry cell on the page was
    # registered: the source block's wells, the dilution table, the asks. The Samples table was
    # not, so the one cell the whole return path depends on — the well a miniprep actually went
    # into — came back as nothing at all, and an inventory updated from it would learn nothing
    # while reporting success.
    #
    # `<sheet-id>.sample.<n>.<column>` is the shape `rows_of` already expects.
    for i, row in enumerate(rows[1:]):
        for j in range(len(header)):
            v = row[j] if j < len(row) else ""
            blank = j in entry_cols and not v
            cell = put(ws, r, j + 1, v, fill=ENTRY if blank else None)
            if blank and record is not None and slug:
                name = re.sub(r"[^a-z0-9]+", "_", str(header[j]).strip().lower()).strip("_")
                record.append((f"{slug}.sample.{i + 1}.{name}",
                               f"'{ws.title}'!{cell.coordinate}"))
        r += 1
    return r + 1


def block_slug(sheet, heading):
    """A stable, readable slug for a block table, from the heading it sits under."""
    sid = sheet.get("id") or "sheet"
    part = re.sub(r"[^a-z0-9]+", "_", str(heading or "block").lower()).strip("_")
    # Drop the leading articles so `The single clone you are most confident about` reads as
    # `single_clone_you_are_most_confident_about` rather than starting with "the".
    part = re.sub(r"^(the|a|an)_", "", part)
    return f"{sid}.{part}"


def write_asks(ws, r, asks, record):
    """The fields this experiment wants back, as labelled entry cells. -> new row

    **A LABSHEET IS A QUESTION, AND THE QUESTIONS ARE PER-EXPERIMENT.** Everything else on the
    page tells a student what to do; this is the part that asks them what happened. The set
    lives in the packet, not in this file, because what is worth knowing is a fact about the
    experiment: a colony count is the whole story in one protocol and noise in another.

    The bar each field had to clear, and it is deliberately high — every one of these costs a
    person at the bench a minute and costs the record nothing if nobody fills it in:
      free at the bench   a number they are already looking at, not a new measurement
      changes the advice  if the answer cannot alter what we would tell the next team, it is
                          decoration

    Each field is ALSO written into the hidden record tab as `slug | =Sheet!Cell`, so
    that what comes back can be read by slug rather than by hunting for a label. Two ways in on
    purpose: if a student's editor drops the formulas, the labels are still on the page and a
    person can still read it. A record format with one reader breaks silently.
    """
    if not asks: return r
    put(ws, r, 1, "What to record", font=HEAD, fill=HEADFILL, border=False)
    r += 1
    for a in asks:
        # A TABLE ASK — several rows of the same shape, which is what new samples are. JCA,
        # 2026-09-11: *"the labsheet collects the information about where the minipreps were put
        # in a data entry box."* A miniprep makes four tubes and each needs a construct, a clone
        # letter, a box and a well; four single fields would be sixteen slugs written by hand.
        #
        # Each cell gets its own slug, indexed by row, so the returned workbook yields rows
        # rather than a blob: `miniprep.sample.2.well` is a thing a reader can ask for.
        if a.get("kind") == "table":
            cols = a.get("columns") or []
            nrows = int(a.get("rows") or 4)
            put(ws, r, 1, a.get("label", a["slug"]), font=LABEL, border=False); r += 1
            for j, c in enumerate(cols):
                put(ws, r, j + 1, c, font=HEAD, fill=HEADFILL)
            r += 1
            for i in range(nrows):
                for j, c in enumerate(cols):
                    cell = put(ws, r, j + 1, "", fill=ENTRY)
                    slug = re.sub(r"[^a-z0-9]+", "_", c.strip().lower()).strip("_")
                    record.append((f"{a['slug']}.{i + 1}.{slug}",
                                   f"'{ws.title}'!{cell.coordinate}"))
                r += 1
            r += 1
            continue
        put(ws, r, 1, a.get("label", a["slug"]), wrap=True)
        cell = put(ws, r, 2, "", fill=ENTRY)
        # A choice field gets a dropdown rather than free text — not to be tidy, but because
        # "faint" and "weak" and "kinda" are the same observation typed three ways, and a
        # column nobody can count is a column nobody reads.
        if a.get("choices"):
            dv = DataValidation(type="list", formula1='"' + ",".join(a["choices"]) + '"',
                                allow_blank=True, showDropDown=False)
            ws.add_data_validation(dv)
            dv.add(cell)
            put(ws, r, 3, "  " + " / ".join(a["choices"]), font=SMALL, border=False)
        record.append((a["slug"], f"'{ws.title}'!{cell.coordinate}"))
        r += 1
    return r + 1


# A page a student prints and carries to the bench. Portrait, one page wide, because a labsheet
# that breaks across two sheets of paper is read as two unrelated pages and the second one gets
# left on the printer.
#
# ROWS_PER_PAGE is what actually fits at 12pt with these margins — measured, not assumed, by
# printing one. Prose rows wrap and count for more than one line, so this is a floor and the
# warning is deliberately pessimistic: being told a page is tight costs a glance, and finding
# out at the bench costs the session.
ROWS_PER_PAGE = 44


def section_rows(ws, last_row):
    """Every row that starts a section, read back off the finished sheet.

    Derived rather than threaded: a heading is a bold 12pt navy cell in column A, and there are a
    dozen places that write one. Passing a list through all of them would give twelve chances to
    forget, and the one that forgot would put a page break through the middle of its table.
    """
    navy = HEAD.color.rgb[-6:]
    shaded = HEADFILL.fgColor.rgb[-6:]
    out = []
    for row in range(2, (last_row or 1) + 1):
        c = ws.cell(row=row, column=1)
        f, fill = c.font, c.fill
        if not (c.value and f and f.bold and f.color and str(f.color.rgb)[-6:] == navy):
            continue
        # A TABLE'S COLUMN HEADER WEARS THE SAME FONT and is not a section start. Breaking above
        # one strands the section's title on the previous page, above nothing.
        if fill is not None and fill.fgColor is not None \
                and str(fill.fgColor.rgb)[-6:] == shaded:
            continue
        out.append(row)
    return out


def page_breaks(last_row, sections):
    """Rows to break after, so no page runs long and no table is cut in half.

    Greedy from the top: take the last section start that still fits on the current page. A
    section longer than a page on its own is let through — a break inside a transcluded protocol
    would be arbitrary, and the alternative is a page break mid-table.
    """
    if not last_row or last_row <= ROWS_PER_PAGE:
        return []
    starts = sorted(r for r in sections if 1 < r <= last_row)
    breaks, top = [], 1
    while last_row - top + 1 > ROWS_PER_PAGE:
        fits = [r for r in starts if top < r <= top + ROWS_PER_PAGE]
        if not fits:
            nxt = [r for r in starts if r > top + ROWS_PER_PAGE]
            if not nxt:
                break
            fits = [nxt[0]]
        top = fits[-1]
        breaks.append(top - 1)
    return breaks


def set_print(ws, last_row, last_col, sections=()):
    """Portrait, full width, as many pages as the content needs, broken between sections.

    **`fitToHeight = 1` WAS A PROMISE THE SETUP COULD NOT KEEP.** It scaled a 68-row assay tab to
    whatever percentage made it fit — which at a bench, under gloves, is a page nobody can read —
    while the footer said "Page 1 of 1" and the pipeline printed a warning telling somebody to
    "cut what it says". Two of the sheets that overflow are long because they transclude a
    protocol that has no cheatsheet, which is exactly the content JCA asked to be included.

    So a sheet is as many pages as it takes, and the breaks land between sections rather than
    through the middle of a table. `sections` is the row each heading starts on.
    """
    ws.page_setup.orientation = "portrait"
    ws.page_setup.paperSize = ws.PAPERSIZE_LETTER
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins.left = ws.page_margins.right = 0.4
    ws.page_margins.top = ws.page_margins.bottom = 0.5
    ws.page_margins.header = ws.page_margins.footer = 0.2
    if last_row and last_col:
        ws.print_area = f"A1:{get_column_letter(last_col)}{last_row}"
    for row in page_breaks(last_row, sections):
        ws.row_breaks.append(Break(id=row))
    # The tab's own name in the footer. A stack of printed pages on a bench loses which
    # experiment it belongs to within about a minute otherwise.
    ws.oddFooter.left.text = ws.title
    ws.oddFooter.right.text = "Page &P of &N"
    ws.oddFooter.left.size = ws.oddFooter.right.size = 8



def _linked(ws, r, link, record):
    """Box and Well as live references to where the student already wrote them.

    JCA, 2026-09-12, on a blank Box and Well beside "the 10 µM working stock you made in session
    1": *"use a formula to pull that info from the previous page."*

    **Asking twice for one fact is how the second answer comes back different**, and the second
    ask is the one nobody fills in. The earlier sheet recorded those two cells under slugs; this
    resolves the slugs to `='Sheet'!Cell` and the value follows whatever they typed.

    THE SHEET IT POINTS AT MUST ALREADY BE DRAWN, and it always is: sessions are rendered in the
    order they run, and a material can only have been made by an earlier one. Where a slug is
    missing the cells are left empty rather than filled with a broken reference — a `#REF!` on a
    printed labsheet reads as a system fault and stops somebody working.
    """
    where = {slug: ref for slug, ref in record}
    for j, key in enumerate(("box", "well")):
        ref = where.get(link.get(key, ""))
        if ref:
            # GUARDED, BECAUSE A BARE REFERENCE TO AN EMPTY CELL SHOWS 0. The dilution sheet's own
            # formulas carry the same guard for the same reason — a student reading "0" in a Box
            # column either goes looking for box zero or decides the sheet is broken. Until they
            # fill the earlier page in, this stays blank, which is the truth.
            put(ws, r, 2 + j, f'=IF({ref}="","",{ref})', font=SUB)
    return r


def write_sources(ws, r, sheet, record):
    """Where each material comes from — and, where nobody knows, a place to write it down.

    JCA, 2026-09-12, about four oligos and two plasmids the inventory does not have: *"The bf
    oligos exist… it should ask them to type in the box and well of where they find the bf oligos,
    and when they return the labsheet you can extract that information."*

    **"NOT IN THE INVENTORY" IS A FACT ABOUT THE DOCUMENT, NOT ABOUT THE FREEZER.** pJ01 is in the
    Pink Training box and in the −80 control stocks; the inventory file records neither box. A
    labsheet that only prints the absence makes every worker repeat the same search and throws the
    answer away each time. Two yellow cells and a slug turn that search into the inventory update
    it should have been.

    A located material is printed. Asking for what the file already knows is how a form teaches
    people to skip its questions.
    """
    put(ws, r, 1, "Source", font=HEAD, border=False); r += 1

    # WHICH CLONE, ASKED ONCE AND THEN COMPUTED FROM. JCA, 2026-09-12: *"It is unknown when we
    # write the labsheet which clone is being taken into this... they will type in which clone(s)
    # they are applying it to, so the spreadsheet should give a place for them to put in this info,
    # and then you can refer to the full actual clone name (pBET8-A) calculated from the supplied
    # clone designation."*
    #
    # So the sheet asks for the letter and every reference to that construct becomes a live
    # formula. Asking for the whole name instead would be asking somebody to retype `pBET8-` and
    # get it wrong; printing one of the candidates would be choosing for them.
    clone_cell = {}
    for x in sources_of(sheet):
        base = x.get("askClone")
        if not base or base in clone_cell:
            continue
        put(ws, r, 1, f"Which clone of {base} are you using?", font=LABEL, border=False)
        cell = put(ws, r, 2, "", fill=ENTRY)
        put(ws, r, 3, "the one that passed sequencing — just the letter", font=SMALL,
            border=False)
        record.append((f"{sheet.get('id') or ws.title}.clone.{base}",
                       f"'{ws.title}'!{cell.coordinate}"))
        clone_cell[base] = cell.coordinate
        r += 1
    if clone_cell:
        r += 1

    unknown = [x for x in sources_of(sheet) if x.get("unlocated") or x.get("askWell")]
    for j, h in enumerate(["what", "Box", "Well", "note"]):
        put(ws, r, j + 1, h, font=HEAD, fill=HEADFILL)
    r += 1
    sid = sheet.get("id") or ws.title
    for x in sources_of(sheet):
        base = x.get("askClone")
        if base and base in clone_cell:
            # `="pBET8-"&B9` — blank until they answer, rather than showing a dangling dash.
            c = clone_cell[base]
            put(ws, r, 1, f'=IF({c}="","","{base}-"&{c})', font=LABEL)
        else:
            put(ws, r, 1, x.get("what", ""), font=LABEL)
        # Three states, and collapsing any two of them loses something somebody needs: nobody
        # knows where it is; the box is known and the well moves; both are on record.
        if x.get("unlocated"):
            for j, name in enumerate(("box", "well")):
                cell = put(ws, r, 2 + j, "", fill=ENTRY)
                record.append((f"{sid}.source.{x.get('what','')}.{name}",
                               f"'{ws.title}'!{cell.coordinate}"))
        elif x.get("askWell"):
            put(ws, r, 2, x.get("box", ""), font=LABEL)
            cell = put(ws, r, 3, "", fill=ENTRY)
            record.append((f"{sid}.source.{x.get('what','')}.well",
                           f"'{ws.title}'!{cell.coordinate}"))
        elif x.get("link"):
            # A LIVE REFERENCE, NOT A COPY. The location was written down on an earlier sheet,
            # and pulling it forward means one answer in two places rather than two answers.
            _linked(ws, r, x["link"], record)
        else:
            put(ws, r, 2, x.get("box", ""))
            put(ws, r, 3, x.get("well", ""))
        put(ws, r, 4, x.get("note", ""), wrap=True)
        r += 1
    if unknown:
        prose(ws, r, "Write in the yellow cells where you actually found these. A named box with "
                     "an empty well means the tube is in that box and moves around inside it; two "
                     "empty cells mean the inventory does not have it at all, which is a gap in "
                     "the document rather than proof it is missing. This sheet is what closes "
                     "both.", font=SUB)
        r += 1
    return r + 1


# WHOSE LAB THIS IS, AND THE DEFAULT IS NOBODY'S.
#
# JCA, 2026-09-12: *"There are things that labplanner does automatically, and then there are
# things that are cortex specific you do for my lab. the checkpoints, as well as a training box vs
# control stocks are very lab specific add-ins... what belongs in C6 would be the generalized one
# that compiles cf and characterization f to a labsheet... After that comes lab specific
# information injection by cortex."*
#
# The renderer draws whatever the packet says and knows nobody's conventions. Three strings were
# the Anderson lab's, sitting in this file as literals: the hidden tab was called `cortex-record`,
# every routing line began `cortex::`, and the collector address was demanded of every packet
# whether or not it had anything to send. Each is now a flag, and each defaults to the neutral
# thing — which is how the next lab gets a workbook with no stranger's vocabulary in it.
RECORD_TAB = "record"
SLUG_PREFIX = ""


def write_record_tab(wb, record, tab=None):
    """The hidden slug->cell map. One row per field, value by formula.

    Hidden because it is machinery and a student who edits it breaks their own submission; not
    protected, because a locked sheet in a file people open in four different applications
    causes more support questions than it prevents.
    """
    if not record: return
    ws = wb.create_sheet(tab or RECORD_TAB)
    ws.sheet_state = "hidden"
    ws["A1"] = "slug"; ws["B1"] = "value"
    ws["A1"].font = HEAD; ws["B1"].font = HEAD
    ws["D1"] = ("Machinery. This tab mirrors the fields you filled in so the lab's system can "
                "read them without guessing. Nothing to do here.")
    for i, (slug, ref) in enumerate(record, start=2):
        ws.cell(row=i, column=1, value=slug)
        ws.cell(row=i, column=2, value=f"={ref}")
    ws.column_dimensions["A"].width = 30
    ws.column_dimensions["B"].width = 22


def dilution_sheet(ws, r, d, record=None):
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

    record = record if record is not None else []
    resuspend = bool(d.get("resuspend"))
    sid = d.get("slug") or "dilution"

    # STEP ONE IS NOT ALWAYS A RESUSPENSION, AND CALLING IT ONE IS AN INSTRUCTION TO OPEN A TUBE
    # THAT IS ALREADY LIQUID. JCA, 2026-09-12: *"The bf oligos exist, and I recommend we start
    # this experiment from 100 uM --> 10 uM dilutions. So, it should ask them to type in the box
    # and well of where they find the bf oligos."* An oligo that already has a 100 µM stock needs
    # finding, not resuspending; a fresh IDT tube needs resuspending. The plan says which.
    if resuspend:
        put(ws, r, 1, "1. Resuspend the IDT tubes", font=HEAD, border=False); r += 1
        prose(ws, r, "Read the nmol off the side label of each tube and type it in the yellow "
                     "cell. It is different on every tube. The water volume and the concentration "
                     "compute themselves — you do not need to work anything out.", font=SUB); r += 1
        hdr = ["oligo", "what it is for", "nmol (from the tube)", "ddH2O to add (uL)",
               "gives you", "Box", "Well"]
        for j, h in enumerate(hdr): put(ws, r, j + 1, h, font=HEAD, fill=HEADFILL)
        r += 1
        for t in d.get("targets", []):
            put(ws, r, 1, t.get("oligo", ""), font=LABEL)
            put(ws, r, 2, t.get("description", ""), wrap=True)
            put(ws, r, 3, None, fill=ENTRY)                  # the one cell they type in
            # nmol / (uM) * 1000 = uL. Guarded so a blank row shows nothing: a zero volume reads
            # as an instruction to add no water.
            put(ws, r, 4, f'=IF(C{r}="","",ROUND(C{r}*1000/{stock:g},0))')
            put(ws, r, 5, f'=IF(C{r}="","","{stock:g} uM stock")')
            r = _where_cells(ws, r, t, record, f"{sid}.stock.{t.get('oligo','')}", 6)
        r += 1
    else:
        put(ws, r, 1, f"1. Find the {stock:g} uM stocks", font=HEAD, border=False); r += 1
        prose(ws, r, f"These already exist. Write down the box and well you actually took each "
                     f"one from — that is how the inventory learns where they are, and the next "
                     f"person does not repeat this search.", font=SUB); r += 1
        hdr = ["oligo", "what it is for", "Box", "Well"]
        for j, h in enumerate(hdr): put(ws, r, j + 1, h, font=HEAD, fill=HEADFILL)
        r += 1
        for t in d.get("targets", []):
            put(ws, r, 1, t.get("oligo", ""), font=LABEL)
            put(ws, r, 2, t.get("description", ""), wrap=True)
            r = _where_cells(ws, r, t, record, f"{sid}.stock.{t.get('oligo','')}", 3)
        r += 1

    put(ws, r, 1, f"2. Make the {target:g} uM working stocks", font=HEAD, border=False); r += 1
    prose(ws, r, f"These are what the PCR actually uses. Nothing to work out — the volumes below "
                 f"make {WORKING_UL:g} uL of {target:g} uM from the {stock:g} uM stock.",
          font=SUB); r += 1
    hdr2 = ["oligo", f"uL of {stock:g} uM stock", "uL ddH2O", "final volume", "Box", "Well"]
    for j, h in enumerate(hdr2): put(ws, r, j + 1, h, font=HEAD, fill=HEADFILL)
    r += 1
    take = round(WORKING_UL * target / stock, 1)
    for t in d.get("targets", []):
        put(ws, r, 1, t.get("oligo", ""), font=LABEL)
        put(ws, r, 2, take)
        put(ws, r, 3, round(WORKING_UL - take, 1))
        put(ws, r, 4, WORKING_UL)
        # THE TUBE YOU JUST MADE HAS TO GO SOMEWHERE, and where is never known in advance — see
        # `planDilutions`, which leaves the destination null rather than let an unplaced tube be
        # mistaken for a placed one. So it is always asked, and always recorded.
        for j, col in enumerate(("box", "well")):
            cell = put(ws, r, 5 + j, "", fill=ENTRY)
            record.append((f"{sid}.working.{t.get('oligo','')}.{col}",
                           f"'{ws.title}'!{cell.coordinate}"))
        r += 1
    r += 1
    prose(ws, r, f"Label every tube with the oligo name and the concentration. A {stock:g} uM "
                 f"tube and a {target:g} uM tube look identical.", font=SUB); r += 2
    return r


def _where_cells(ws, r, t, record, slug, col):
    """Box and well for one row: printed when the inventory knows, asked when it does not.

    ASKING FOR WHAT THE FILE ALREADY KNOWS IS HOW A FORM TEACHES PEOPLE TO SKIP ITS QUESTIONS.
    So a located tube is printed and an unlocated one is two yellow cells with slugs behind them,
    and the returned workbook is what updates the inventory.
    """
    if t.get("located"):
        put(ws, r, col, t.get("box", ""))
        put(ws, r, col + 1, t.get("well", ""))
    else:
        for j, name in enumerate(("box", "well")):
            cell = put(ws, r, col + j, "", fill=ENTRY)
            record.append((f"{slug}.{name}", f"'{ws.title}'!{cell.coordinate}"))
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


# Below this many samples you do not make a mastermix, you just set the reaction up.
# JCA, 2026-09-10, seeing a scaled total against a single PCR: *"is that for a mastermix? This
# isn't relevant to setting up just 1 pcr. When there are >=4 samples, that's when you consider
# doing a mastermix."*
#
# The first version scaled unconditionally, so one reaction showed a "total µL" of 35.2 — a
# number with no meaning at the bench, since you would pipette the 32. Showing arithmetic where
# none is wanted is not a neutral extra: it implies a step that is not there, and the original
# workbook shows the plain recipe for exactly this reason.
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
WARNINGS = []
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
    out = {i: _proto_cache.get(key(i), {"missing": True}) for i in ids}
    # A MODULE RENDERED WITH ITS DEFAULTS IS NOT A RENDERED MODULE. Say so where it happens: the
    # page cannot show the difference — a default reads exactly like an answer — so the only place
    # the mismatch can surface is here, at the seam, where somebody is watching the pipeline run.
    for i, info in out.items():
        declared = set(info.get("inputs") or [])
        given = values.get(i) or {}
        # A CHEATSHEET MODULE IS NOT EXEMPT, though it was briefly made so on the theory that its
        # template is never printed. Its DESCRIPTION is printed and is computed from the values:
        # `heat_shock_transformation` with none says "plate on Amp" and with them says "plate on
        # Erm", one line under a cheatsheet heading, on a sheet about erythromycin.
        if declared and not given:
            WARNINGS.append(f"{i}: transcluded with no values, so its numbers and names are the "
                            f"module's defaults ({', '.join(info['inputs'][:4])}…) and may be "
                            f"about no experiment at all")
        # A KEY THE MODULE DOES NOT DECLARE IS NOT A TYPO, IT IS A DEFAULT NOBODY NOTICED. It is
        # dropped in silence, the module keeps its own value, AND the check above sees a non-empty
        # `values` and stays quiet — so passing `reads` where the module says `samples` left
        # "Submit 8 reads" on a sheet listing four, with every guard green.
        unknown = [k for k in given if k not in declared]
        if unknown:
            WARNINGS.append(f"{i}: given {', '.join(sorted(unknown))}, which this module does not "
                            f"declare — ignored. It takes {', '.join(sorted(declared))}.")
    return out


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
    # A PROTOCOL WITH A CHEATSHEET IS NOT REPRINTED. JCA, 2026-09-10: *"The protocol injection is
    # actually excessive... It's the protocols that don't have cheatsheets that need to be
    # included on the labsheets."* The eight common ones — PCR, gel, Zymo, Golden Gate,
    # transformation, picking, miniprep, cycle sequencing — are one-pagers the bench already has.
    # Reprinting them buries the part of the sheet that is specific to this experiment, which is
    # the only part nobody can look up.
    if info.get("cheatsheet"):
        put(ws, r, 1, f"{info.get('name', pid)} — use the {info['cheatsheet']} cheatsheet",
            font=HEAD, border=False); r += 1
        if info.get("description"):
            prose(ws, r, info["description"], font=SUB); r += 1
        return r + 1

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
    """Does this sheet submit reactions to the Sanger service?

    **THE SHEET SAYS SO.** `design/sequencing.js` names the protocol module it transcludes, and
    `cycle_sequencing` IS the Sanger submission — the design knows, and a `submits` flag travels on
    the sheet. GATE 5: the renderer draws what it is given.

    What this used to be: `json.dumps(sheet).lower()` and a search for the words "sanger",
    "sequenc", "full plasmid" and "analys" anywhere in it. That is not a check, it is a guess over
    the whole document, and it had already been wrong once in the direction that matters — SLIP5's
    step is titled plainly "Sequencing" and does full-plasmid sequencing, so a title test put the
    lab's Sanger link on a page that must not carry it. Substring rules over free text acquire a
    new exception every time somebody writes a sentence.

    THE GUESS IS NOT KEPT AS A FALLBACK. Keeping it "for old packets" would leave the heuristic in
    the file and in play, which is how it survived being wrong the first time; a packet is an
    intermediate artefact regenerated by every compile, so the cost of dropping it is recompiling.
    A sheet that does not say it submits, does not.
    """
    return sheet.get("submits") == "sanger"


# THE LABEL RULES LIVE IN `models/labsheet.js`, NOT HERE.
#
# This file used to carry its own `LABEL_MAX = 3`, its own list of label-ish column names and its
# own duplicate check — a second implementation of a domain rule, in a second language, free to
# disagree with the first. It could only warn, and it read a `labelMax` each design carried, which
# for miniprep and sequencing was 24: not a tube, just the check turned off.
#
# The model now refuses a duplicate outright and records a length complaint on the sheet as it is
# built, against the cap of the tube kind that sheet writes on. What is left for the renderer is
# printing what the sheet already objected to.
#
# JCA, 2026-09-10, on a Zymo sheet reading `zseq_pGhost12-A`: *"You need to revisit the rules about
# labels. these are too long to write on a tube."* The rules are revisable in one place now.


def reaction_block(ws, r, sheet):
    """The reaction, written the way a bench protocol writes it.

    JCA, 2026-09-10: *"There doesn't need to be a calculator for a mastermix, just do the
    calculations. The way this is normally presented is like: Master Mix: 233 uL ddH2O, 24 uL
    buffer … Reaction: 30 uL ddH2O, 10 uL Master Mix."*

    So: numbers, already worked out. The first version put the count and the excess in editable
    cells with formulas over them, which was both unwanted and broken — the formulas multiplied
    `volume_uL` while the packets carry `amount`, so every total rendered as 0. A spreadsheet that
    computes the wrong number confidently is worse than a printed one, and a student reading
    "0 uL ddH2O" either stops or pours nothing.

    **AND THE NUMBERS ARE NOT WORKED OUT HERE.** `planning/makeMastermixPlan.js` already decides
    whether a mastermix is worth it, which components are shared, what the totals are and why —
    and this function used to redo every one of those from the raw recipe, with its own copy of
    the threshold, its own 10% excess, and its own guess that anything named "template" varies.
    Two implementations of one domain rule, in two languages, free to disagree; the planner's one
    is the one with the tests and the reasons. GATE 5: the renderer draws what it is given.
    """
    plan = sheet.get("mastermix")
    recipe = sheet.get("recipe") or {}
    amount = lambda c: float(c.get("amount", c.get("uL", c.get("volume_uL", 0))) or 0)
    # `name` from a design's recipe, `label` from the mastermix plan — the plan's components come
    # from `makeMastermixPlan`'s own vocabulary, where `key` is the machine name and `label` is
    # what a person reads off a bottle ("5X PrimeSTAR GXL Buffer (green)").
    name = lambda c: c.get("name") or c.get("label") or c.get("key", "")

    # NO PLAN MEANS NO MASTERMIX DECISION WAS MADE — a Golden Gate or a digest, whose recipe comes
    # from its design rather than from `makeMastermixPlan`. Print the reaction and stop; inventing
    # a threshold for it here is what this change removes.
    if not plan:
        put(ws, r, 1, "Reaction", font=HEAD, border=False); r += 1
        for c in recipe.get("components", []):
            put(ws, r, 1, f"{amount(c):g} uL", font=LABEL)
            put(ws, r, 2, name(c))
            put(ws, r, 3, c.get("code", ""))
            r += 1
        return r + 1

    if not plan.get("mastermix"):
        put(ws, r, 1, "Reaction", font=HEAD, border=False); r += 1
        # THE PLANNER'S OWN SENTENCE, not a rephrasing of it. It knows how many reactions and
        # where the threshold is, and it says so in one place.
        prose(ws, r, plan.get("why", ""), font=SUB); r += 1
        for c in plan.get("perReaction", recipe.get("components", [])):
            put(ws, r, 1, f"{amount(c):g} uL", font=LABEL)
            put(ws, r, 2, name(c))
            put(ws, r, 3, c.get("code", ""))
            r += 1
        return r + 1

    shared = plan.get("shared", [])
    per_tube = plan.get("perTube", [])
    excess = float(plan.get("excess", 1.1))
    total = round(sum(float(c.get("totalUL", 0) or 0) for c in shared), 1)

    put(ws, r, 1, "Master Mix", font=HEAD, border=False)
    put(ws, r, 2, f"for {plan.get('reactions', 0)} reactions, "
                  f"{round((excess - 1) * 100)}% excess", font=SUB, border=False); r += 1
    for c in shared:
        put(ws, r, 1, f"{float(c.get('totalUL', 0) or 0):g} uL", font=LABEL)
        put(ws, r, 2, name(c))
        put(ws, r, 3, c.get("code", ""))
        r += 1
    put(ws, r, 1, f"{total:g} uL", font=LABEL)
    put(ws, r, 2, "total", font=SUB)
    r += 2

    per_reaction = float(plan.get("mastermixPerReactionUL", 0) or 0)
    one_tube = round(per_reaction + sum(amount(c) for c in per_tube))
    put(ws, r, 1, "Reaction", font=HEAD, border=False)
    put(ws, r, 2, f"per tube, {one_tube:g} uL", font=SUB, border=False); r += 1
    put(ws, r, 1, f"{per_reaction:g} uL", font=LABEL)
    put(ws, r, 2, "Master Mix")
    r += 1
    for c in per_tube:
        put(ws, r, 1, f"{amount(c):g} uL", font=LABEL)
        put(ws, r, 2, name(c))
        put(ws, r, 3, c.get("code", ""))
        r += 1
    # WHY THESE AND NOT OTHERS, said once. Which components a mastermix can carry is a fact about
    # the samples — a component varies unless every sample takes the same value for it — and it is
    # not deducible from the two lists on the page.
    if plan.get("why"):
        prose(ws, r, plan["why"], font=SUB); r += 1
    return r + 1


# Excel forbids these in a worksheet title and openpyxl raises rather than coercing. The
# operation name comes from whatever the source workbook called the tab, so this is data, not a
# fixed set: "Zymo/Assembly" crashed the renderer outright the first time a workbook outside
# SLIP used a slash. A tab that cannot be named is a packet that cannot be produced, and the
# student gets nothing — so sanitise, and keep the readable form in the sheet's own heading,
# which is where a person actually reads it.
_BAD_TITLE = str.maketrans({c: "-" for c in "/\\*?:[]"})


# Collected across every sheet as they render, written once at the end. A module-level list
# rather than a threaded parameter because `sheet_to_ws` already carries five and the sixth
# would be the one nobody passes.
RECORD = []


def sheet_to_ws(wb, sheet, include_protocols, collector, sequencing_url=None,
                prefix=None):
    name = (sheet.get("title", "sheet").split(" for ")[0] or "sheet").translate(_BAD_TITLE)[:31]
    ws = wb.create_sheet(name)
    ws.sheet_view.showGridLines = False
    r = 1
    prose(ws, r, sheet.get("title", ""), font=TITLE, height=22)
    for col in range(1, 7):
        ws.cell(row=r, column=col).fill = PatternFill("solid", fgColor="E8EEF4")
    r += 2

    # WHO DID THIS, AND WHEN. Asked at the top of every sheet, and it is the only place a person
    # enters the model at all. JCA, 2026-09-11: *"they definitely don't name the student, but the
    # student will give their name when they fill it out, so ultimately that is information we
    # would collect."*
    #
    # So a labsheet is issued anonymously and comes back attributed, which is the right way
    # round: the same sheet can go to two students, and neither the plan nor the planner has to
    # know who before the work happens. Two fields, at the top, before anything else — a name
    # written after the bench work is a name somebody has to remember.
    put(ws, r, 1, "Your name", font=LABEL)
    nm = put(ws, r, 2, "", fill=ENTRY)
    put(ws, r, 4, "Date", font=LABEL)
    dt = put(ws, r, 5, "", fill=ENTRY)
    # NAMESPACED BY SHEET, because a packet may carry several sessions and a labsheet is one
    # person's. Two sessions of the same packet can be two different students, so a bare
    # `worker.name` would be one slug with several answers and the record tab would silently
    # keep whichever was written last.
    sid = sheet.get("id") or ws.title
    RECORD.append((f"{sid}.worker.name", f"'{ws.title}'!{nm.coordinate}"))
    RECORD.append((f"{sid}.worker.date", f"'{ws.title}'!{dt.coordinate}"))
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
        r = dilution_sheet(ws, r, sheet["dilution"], RECORD)

    # WHERE THE FINISHED TUBES GO, stated before the work rather than after it — somebody reads
    # the top of a sheet to find out what they are about to do, and "these end up in the to-gel
    # box" is part of that.
    if sheet.get("destination"):
        put(ws, r, 1, "When you are done", font=LABEL, border=False)
        put(ws, r, 2, f"put the tubes in {sheet['destination']}", border=False)
        r += 2

    if sources_of(sheet):
        r = write_sources(ws, r, sheet, RECORD)
    if sheet.get("samples"):
        put(ws, r, 1, "Samples", font=HEAD, border=False); r += 1
        rows = [list(sheet["samples"][0].keys())] + [list(x.values()) for x in sheet["samples"]]
        # Blank trailing columns are where the record gets made — the same detection the block
        # tables use, and now registered so what is written in them can be read back.
        entry = set()
        for c in range(len(rows[0]) - 1, -1, -1):
            if all(not str(x[c] if c < len(x) else "").strip() for x in rows[1:]):
                entry.add(c)
            else:
                break
        r = write_table(ws, r, rows, entry_cols=entry, record=RECORD,
                        slug=sheet.get("id") or ws.title)
    if sheet.get("recipe") or sheet.get("mastermix"):
        r = reaction_block(ws, r, sheet)

    # Fetch every protocol this sheet transcludes in one call, before drawing anything.
    wanted = [m.group(1) for b in sheet.get("blocks", []) if b.get("kind") == "text"
              for m in [PROTO.match(str(b.get("text", "")).strip())] if m]
    protos = protocol_text(wanted, sheet.get("protocol_values")) if wanted else {}

    last_heading = None
    for b in sheet.get("blocks", []):
        k = b.get("kind")
        if k == "heading":
            last_heading = b.get("text", "")
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
            if b.get("header", True) and len(rows) > 1:
                for c in range(len(rows[0]) - 1, -1, -1):
                    if all(not str(x[c] if c < len(x) else "").strip() for x in rows[1:]):
                        entry.add(c)
                    else:
                        break
            # A BLOCK TABLE'S ENTRY CELLS ARE REGISTERED TOO. Only the Samples table was, so the
            # analysis sheet's "The single clone you are most confident about" — the most
            # consequential answer in the whole experiment, and the one its own note says every
            # later session depends on — was asked for and could never be read back.
            #
            # Keyed by the block's heading so the slugs say what they are:
            # `s8-analysis.single_clone_you_are_most_confident_about.1.clone`.
            r = write_table(ws, r, rows, entry_cols=entry,
                            header=b.get("header", True),
                            record=RECORD, slug=block_slug(sheet, last_heading))

    # A DECISION THE COMPILER REFUSED TO MAKE IS SHOWN, NOT SWALLOWED. These live in their own
    # list on the sheet — `models/labsheet.js § addOpenDecision` — so `c6-labplan` can gather
    # every one in a run rather than grepping prose for a prefix, which is what it used to do.
    # On paper they are still notes, because that is where somebody reads them.
    notes = list(sheet.get("notes") or []) \
        + [f"STILL TO DECIDE: {o}" for o in (sheet.get("open") or [])]
    if notes:
        put(ws, r, 1, "Notes", font=HEAD, border=False); r += 1
        for n in notes:
            prose(ws, r, n); r += 1
        r += 1

    # EVERY SHEET WITH FIELDS, not only the ones that also have a checkpoint. Three of the six
    # steps this experiment asks about — the E. coli transformation count, the best clone, the
    # electroporation counts — send nothing in at the time and are recorded in the workbook
    # alone. Rendering these inside the checkpoint branch silently dropped exactly those, which
    # are the cheapest fields on the page and among the most informative.
    #
    # Before the checkpoint, deliberately: a student reads down, and "here is what to write
    # down" has to arrive before "now send it". Reversed, the send instruction reads as the end
    # of the step and the fields get filled in afterwards, if at all.
    r = write_asks(ws, r, sheet.get("asks"), RECORD)

    if sequencing_url and is_sanger(sheet):
        put(ws, r, 1, "Submit it here", font=HEAD, border=False); r += 1
        prose(ws, r, "The lab's Sanger submission form. Sign in with your Berkeley account.",
              font=SUB); r += 1
        c = put(ws, r, 1, sequencing_url, font=Font(size=12, color="1F3864", underline="single"))
        c.hyperlink = sequencing_url
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6)
        r += 2

    # THE SAME FOUR FIELDS `models/labsheet.js § setCheckpoint` REQUIRES. A checkpoint arrives from
    # outside this toolkit — the host institution decides which steps deserve one — so it is checked
    # on the way in rather than trusted. Half of one draws a heading and a routing code with nothing
    # saying what to send, which is worse than none.
    cp = sheet.get("checkpoint")
    if cp:
        short = [k for k in ("type", "code", "delivers", "expects") if not str(cp.get(k, "")).strip()]
        if short:
            WARNINGS.append(f"{sheet.get('id', '?')}: checkpoint is missing {', '.join(short)} — "
                            f"not drawn, because a routing code with no instruction is worse than "
                            f"no checkpoint")
            cp = None
    if cp:
        # LABELLED ROWS, not a paragraph. The first version was a heading, one long sentence
        # and a bare slug — Chris read it and said "I don't understand the checkpoint". A
        # student meeting a routing slug for the first time has no idea what it is or why, and a
        # student who cannot follow the instruction does not send the data.
        # Where the raw material comes from, when it is not something the student made. Every
        # checkpoint routes the same way — the student sends a message carrying the routing
        # line — so this is a lead-in, not a different instruction.
        if cp.get("arrives"):
            put(ws, r, 1, cp["arrives"], font=SUB, border=False); r += 1
        put(ws, r, 1, "CHECKPOINT", font=Font(bold=True, size=13, color="1F3864"), border=False)
        put(ws, r, 2, "send this in before carrying on", font=SUB, border=False)
        r += 1
        rows = (("What to send", cp.get("expects") or cp.get("delivers") or "this sheet"),
                ("Email it to", collector),
                ("Put this line in the message",
                 f"{prefix if prefix is not None else SLUG_PREFIX}{cp.get('code','')}"))
        for label, value in rows:
            put(ws, r, 1, label, font=LABEL, fill=HEADFILL)
            is_code = bool(prefix) and str(value).startswith(prefix)
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
    # **"BECOMES PART OF THE RECORD" WAS A PROMISE THE FILE COULD NOT KEEP.** These four lines had
    # no slug on any sheet, so `read-returned.py` could not see them: a student's account of what
    # actually happened — the part no plan anticipated and the part most worth having — was
    # written into a workbook and reachable by nobody.
    sid = sheet.get("id") or ws.title
    for i in range(4):
        c = put(ws, r, 1, None, fill=ENTRY)
        RECORD.append((f"{sid}.notes.{i + 1}", f"'{ws.title}'!{c.coordinate}"))
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=6); r += 1
    autosize(ws)
    fit_prose(ws)
    ws.freeze_panes = "A3"
    set_print(ws, r, ws.max_column, section_rows(ws, r))
    # HOW MANY PAGES, WHICH IS A FACT. It used to be a warning saying the tab "will not fit" and
    # telling somebody to cut content — advice that was wrong for the two sheets that are long
    # because they carry a protocol with no cheatsheet. Three pages is not an error; three pages
    # squashed onto one is.
    pages = len(page_breaks(r, section_rows(ws, r))) + 1
    if pages > 1:
        print(f"  · {ws.title}: {r} rows, {pages} pages — breaks between sections")
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


def closing_ws(wb, c, prefix=None):
    """The last tab: what you made, where it is, and what it measured — then send it back.

    JCA, 2026-09-10: *"Have the last page be a table they fill out with the clone ID, the box its
    in, the well of box, and the final number for the loss rate. Include the instruction to email
    the spreadsheet to cortex when done."*

    THE TABLE IS THE POINT AND THE EMAIL IS THE ROUTE. Everything the experiment produced that
    outlives it is on this page: a clone, a location, and the number. The inventory is updated
    from these rows, so a row without a box and well is a tube nobody can find again.

    ITS OWN TAB, at the end, and not a line at the bottom of the last step. A student finishes on
    whichever step their experiment actually ended on — a failed assembly stops at Pick — so an
    instruction tacked onto the nominal last sheet is one many of them never reach.
    """
    ws = wb.create_sheet("Send it back")
    r = 1
    put(ws, r, 1, "What you made, and what it measured", font=TITLE, border=False); r += 2
    prose(ws, r, "One row per clone you are keeping. The lab inventory is updated from these "
                 "rows, so a clone with no box and well is one nobody can find again.",
          font=BODY); r += 2

    hdr = ["clone ID", "box", "well", "loss rate"]
    for j, h in enumerate(hdr): put(ws, r, j + 1, h, font=HEAD, fill=HEADFILL)
    r += 1
    for _ in range(12):
        for j in range(len(hdr)): put(ws, r, j + 1, None, fill=ENTRY)
        r += 1
    r += 1

    put(ws, r, 1, "When the experiment is over", font=HEAD, border=False); r += 1
    prose(ws, r, "Save this workbook and email it back. Everything you typed into it — the "
                 "samples you made, their boxes and wells, your notes — is the record of what "
                 "happened, and it is the only copy.", font=BODY); r += 2
    for label, value in (("Email it to", c.get("to", "")),
                         ("Attach", "this workbook, saved"),
                         ("Put this line in the message",
                          f"{prefix if prefix is not None else SLUG_PREFIX}{c.get('code','')}")):
        put(ws, r, 1, label, font=LABEL, fill=HEADFILL)
        is_code = bool(prefix) and str(value).startswith(prefix)
        put(ws, r, 2, value, font=Font(bold=True, size=13, name="Menlo") if is_code else BODY,
            fill=ENTRY if is_code else None, wrap=not is_code)
        r += 1
    r += 1
    prose(ws, r, c.get("why", ""), font=SUB); r += 2
    prose(ws, r, "Send it even if the experiment did not work. A failed assembly with its "
                 "plate counts written down is a result; a workbook nobody sent back is not.",
          font=SUB)
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
    record_tab = RECORD_TAB
    prefix = SLUG_PREFIX
    for i, a in enumerate(sys.argv):
        if a == "--collector" and i + 1 < len(sys.argv):
            collector = sys.argv[i + 1]
        elif a == "--record-tab" and i + 1 < len(sys.argv):
            record_tab = sys.argv[i + 1]
        elif a == "--slug-prefix" and i + 1 < len(sys.argv):
            prefix = sys.argv[i + 1]
    packet = json.load(open(src))
    # THE ADDRESS IS REQUIRED WHEN, AND ONLY WHEN, THERE IS SOMETHING TO SEND. It refuses rather
    # than defaulting, because a plausible-looking wrong address on a student's instruction sheet
    # sends their data somewhere nobody is reading — but demanding it of a packet with no
    # checkpoints made every caller carry a lab's address to render a page that never mentions it.
    needs_address = any(sh.get("checkpoint") for sh in packet.get("sheets", [])) \
                    or bool(packet.get("closing"))
    if needs_address and not collector:
        sys.exit("  labpacket-to-xlsx: this packet has checkpoints, so --collector <address> is "
                 "required; where a checkpoint is sent is configuration, not a default this "
                 "toolkit may invent")
    wb = Workbook(); wb.remove(wb.active)
    for sheet in packet.get("sheets", []):
        # A step the workbook switched off is in the packet for the record, not for the
        # bench. Printing it would put a reaction on the page that this experiment does not do.
        if sheet.get("applies") is False:
            print(f"  skipping {sheet['id']}: marked as not part of this experiment")
            continue
        for w in sheet.get("warnings", []) or []:
            print(f"  ! {sheet.get('id', '?')}: {w}")
        sheet_to_ws(wb, sheet, include, collector, sequencing_url, prefix)
    if packet.get("closing"):
        closing_ws(wb, packet["closing"], prefix)
    write_record_tab(wb, RECORD, record_tab)

    wb.save(out)
    deterministic(out)
    for w in WARNINGS:
        print(f"  ! {w}")
    print(f"  wrote {out}: {len(packet.get('sheets', []))} sheet(s)")


if __name__ == "__main__":
    main()
