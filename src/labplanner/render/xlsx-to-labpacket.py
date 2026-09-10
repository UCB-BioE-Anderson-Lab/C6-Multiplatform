"""Convert one labsheet workbook into a LabPacket JSON instance.

Fitted to the grammar in C6/docs/LABSHEET-TRANSLATION.md, from a labsheet that worked. The
three kinds of tab are all carried: operation tabs become inputs/samples/recipe/notes, and the
rest becomes an ordered `blocks[]` that preserves what was on the page in the order it was on it.

FAITHFUL, NOT CLEVER. Where a tab does something this does not model — a conditional branch, a
plate layout — the content is kept as a block of the right kind and NOT reinterpreted. Losing
it would be worse, and pretending to understand it would be worse still.
"""
import openpyxl, json, os, re, sys

def cells(ws):
    out=[]
    for r in ws.iter_rows(values_only=True):
        c=[("" if x is None else str(x).strip()) for x in r]
        while c and not c[-1]: c.pop()
        out.append(c)
    return out

# A section marker may carry content on the same line — Zymo's is
# `source: Enzyme freezer pcr rack "to Zymo"`. Requiring a bare marker dropped that tab's
# whole samples table, and with it `elution_volume`, which appears nowhere else.
SECTION = re.compile(r"^(source|sources|samples|reaction|notes)\s*:\s*(.*)$", re.I)
STEPNUM = re.compile(r"^(\d+)\)?[.)]?$")

def convert_tab(ws, name):
    rows = [r for r in cells(ws) if any(r)]
    if not rows: return None
    sheet = {"id": None, "title": rows[0][0], "operation": rows[0][0].split()[0],
             "metadata": {}, "inputs": [], "samples": [], "outputs": [],
             "recipe": None, "notes": [], "blocks": []}
    i, section = 1, None
    pending_header = None
    while i < len(rows):
        c = rows[i]; first = c[0]
        low = first.lower()
        if low.startswith("protocol:"):
            sheet["metadata"]["module"] = (first.split(":",1)[1].strip() or (c[1] if len(c)>1 else "")); i+=1; continue
        if low.startswith("program:"):
            sheet["metadata"]["program"] = (first.split(":",1)[1].strip() or (c[1] if len(c)>1 else "")); i+=1; continue
        if low.startswith("thermocycler"):
            sheet["metadata"]["thermocycler"] = True; i+=1; continue
        m = SECTION.match(first)
        if m:
            section = m.group(1).lower(); pending_header=None
            trailing = (m.group(2) or "").strip()
            if trailing:
                # e.g. `source: Enzyme freezer pcr rack "to Zymo"` — a location, not a table.
                sheet["metadata"].setdefault(section + "_note", trailing)
                section = None
            i+=1; continue
        if section in ("source","sources","samples") :
            # header row then data rows until blank/section
            if pending_header is None:
                pending_header = [x for x in c if x] or c
                i+=1; continue
            if len(c) == 1:
                # A single-cell row inside a table is the next heading, not a one-column
                # sample. Without this, "Protocol" became a sample whose reaction was
                # "Protocol" — a fabricated row in somebody's experimental record.
                section = None; pending_header = None; continue
            row = dict(zip(pending_header, c[:len(pending_header)]))
            if any(row.values()):
                sheet["inputs" if section.startswith("source") else "samples"].append(row)
            i+=1; continue
        if section == "reaction":
            if len(c)>=2 and re.match(r"^[\d.]+$", c[0]):
                comp = {"volume_uL": float(c[0]),
                        "name": next((x for x in c[1:] if x and x.lower()!="ul"), ""),
                        "code": c[-1] if c[-1].endswith("____") else ""}
                sheet["recipe"] = sheet["recipe"] or {"components": []}
                sheet["recipe"]["components"].append(comp); i+=1; continue
            section=None; continue
        if section == "notes":
            if c[0] == "*": sheet["notes"].append(" ".join(x for x in c[1:] if x))
            elif sheet["notes"]: sheet["notes"][-1] += " " + " ".join(x for x in c if x)
            i+=1; continue
        # ---- unstructured: kinds B and C -------------------------------------------------
        sm = STEPNUM.match(first)
        if sm:
            sheet["blocks"].append({"kind":"step","text":" ".join(x for x in c[1:] if x)}); i+=1; continue
        if not first and len(c)>1:
            # an indented table: gather consecutive indented rows
            tbl=[]
            while i < len(rows) and not rows[i][0] and len(rows[i])>1:
                tbl.append(rows[i][1:]); i+=1
            if tbl:
                kind = "grid" if all(len(t)>3 for t in tbl) and len(tbl)>2 and not tbl[0][0] else "table"
                sheet["blocks"].append({"kind":kind,"rows":tbl})
            continue
        if len(c)==1:
            kind = "heading" if len(first)<48 and not first.endswith(".") else "text"
            sheet["blocks"].append({"kind":kind,"text":first}); i+=1; continue
        sheet["blocks"].append({"kind":"text","text":" ".join(x for x in c if x)}); i+=1
    for s in sheet["samples"]:
        p = s.get("product")
        if p: sheet["outputs"].append({"construct": p, "label": s.get("label","")})
    sheet["id"] = f"{name.lower().replace(' ','_')}"
    return sheet

def main(src, out, steps):
    wb = openpyxl.load_workbook(src, data_only=True)
    packet = {"id": os.path.basename(src).replace(".xlsx",""),
              "metadata": {"title": None, "experiment": None,
                           "source": os.path.basename(src)}, "sheets": []}
    for t in steps:
        if t not in wb.sheetnames: continue
        s = convert_tab(wb[t], t)
        if s: packet["sheets"].append(s)
    if packet["sheets"]:
        title = packet["sheets"][0]["title"]
        packet["metadata"]["experiment"] = title.split("Experiment",1)[-1].strip() if "Experiment" in title else ""
        packet["metadata"]["title"] = f"LabSheets — {packet['metadata']['experiment']}"
    json.dump(packet, open(out,"w"), indent=2)
    print(f"  wrote {out}: {len(packet['sheets'])} sheet(s)")
    for s in packet["sheets"]:
        print(f"     {s['title'][:44]:46} inputs={len(s['inputs'])} samples={len(s['samples'])} "
              f"recipe={len(s['recipe']['components']) if s['recipe'] else 0} notes={len(s['notes'])} blocks={len(s['blocks'])}")

STEPS=["Dilutions","PCR","Gel","Zymo","GoldenGate","Transform1","Pick","Miniprep",
       "PCR to Seq","Sequencing","Transform2","Pick2","Replicate","Assay"]
main(sys.argv[1], sys.argv[2], STEPS)
