"""The DNA view: one molecule, drawn at the level of detail its payload was laid out for. A VIEW.

`render(payload) -> str`. The payload is `{"dna": <a value that fits dna.drawing>}`, produced by
`bin/c6-dna` and checked by `show` before this runs (C11 § 7.13, § 7.14).

THIS MODULE DRAWS AND DOES NOTHING ELSE. It reads nothing, writes nothing, runs nothing, and does
no arithmetic (§ 7.7): every coordinate, position, length and label arrives in the payload, and
this file only turns them into SVG and HTML. `test/python/test_dna_view.py` checks that by reading
this file's syntax tree, so a `+ 1` slipped in here fails a test rather than quietly becoming a
second answer to "where is this feature".

Zoom, pan, level and "jump to feature" are plain links. Each carries the producer's complete
arguments for that request, so following one asks the producer again. There is no script.

Absence is drawn (§ 7.5, § 7.6): a file that could not be read, a request that made no sense,
features the file does not have, and features the format cannot carry each look different, and
none of them looks like an empty map.
"""
from html import escape
from urllib.parse import urlencode

VIEW_ID = "dna.view"

STYLE = """
:root { --fg:#1f1f1d; --muted:#6b6a65; --line:#d8d6cf; --bg:#fbfaf7; --panel:#ffffff;
        --strand:#3b4a5c; --phos:#d08a2e; --sugar:#f4efe4; --base:#ffffff; --bond:#8a8780;
        --mark:#f6d365; --warn-bg:#fdecea; --warn-fg:#8a1c12; --note-bg:#eef3f8; --accent:#2f6fb0; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
        --fg:#ecebe6; --muted:#a3a29b; --line:#3a3936; --bg:#1c1c1b; --panel:#242423;
        --strand:#b9c7d8; --phos:#e0a24c; --sugar:#33302a; --base:#2a2a28; --bond:#8f8c85;
        --mark:#7a6420; --warn-bg:#3a1f1c; --warn-fg:#f2b8b0; --note-bg:#1f2a36; --accent:#7fb2e5; } }
:root[data-theme="dark"] { --fg:#ecebe6; --muted:#a3a29b; --line:#3a3936; --bg:#1c1c1b; --panel:#242423;
        --strand:#b9c7d8; --phos:#e0a24c; --sugar:#33302a; --base:#2a2a28; --bond:#8f8c85;
        --mark:#7a6420; --warn-bg:#3a1f1c; --warn-fg:#f2b8b0; --note-bg:#1f2a36; --accent:#7fb2e5; }
* { box-sizing:border-box; }
body { background:var(--bg); color:var(--fg); font:15px/1.55 -apple-system,system-ui,sans-serif;
       margin:0; padding:24px 16px; }
main { max-width:1080px; margin:0 auto; }
h1 { font-size:22px; font-weight:600; margin:0 0 2px; }
h2 { font-size:15px; font-weight:600; margin:28px 0 8px; }
.sub { color:var(--muted); margin:0 0 4px; }
.facts { display:flex; flex-wrap:wrap; gap:6px 18px; margin:8px 0 16px; font-size:14px; }
.facts span b { font-weight:600; }
.bar { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin:0 0 12px; }
.seg { display:inline-flex; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
.seg a, .seg span { padding:5px 12px; font-size:13px; text-decoration:none; color:var(--fg);
                    border-right:1px solid var(--line); }
.seg > :last-child { border-right:0; }
.seg .on { background:var(--fg); color:var(--bg); }
.seg .off { color:var(--muted); opacity:.55; }
.btn { padding:5px 12px; font-size:13px; border:1px solid var(--line); border-radius:8px;
       text-decoration:none; color:var(--fg); background:var(--panel); }
.btn:hover, .seg a:hover { border-color:var(--accent); color:var(--accent); }
.region { font-size:13px; color:var(--muted); margin-left:auto; }
.canvas { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:8px;
          overflow-x:auto; }
.canvas svg { display:block; margin:0 auto; max-width:100%; height:auto; }
.canvas.wide svg { max-width:none; }
.absent { border:1px solid var(--line); border-radius:12px; padding:18px 20px; background:var(--panel); }
.absent.error { background:var(--warn-bg); color:var(--warn-fg); border-color:transparent; }
.absent h2 { margin:0 0 6px; }
.note { background:var(--note-bg); border-radius:8px; padding:8px 12px; font-size:14px; margin:8px 0; }
table { border-collapse:collapse; width:100%; font-size:14px; }
th, td { text-align:left; padding:6px 10px; border-bottom:1px solid var(--line); }
th { color:var(--muted); font-weight:500; }
.sw { display:inline-block; width:12px; height:12px; border-radius:3px; vertical-align:-1px;
      margin-right:6px; border:1px solid rgba(0,0,0,.15); }
.tablewrap { overflow-x:auto; }
.legend { font-size:13px; color:var(--muted); margin:8px 2px 0; }
svg text { font-family:-apple-system,system-ui,sans-serif; fill:var(--fg); }
svg .mono { font-family:ui-monospace,Menlo,monospace; }
svg .muted { fill:var(--muted); }
svg .feat-label { font-size:11px; }
svg .flabel { fill:#1f1f1d; }
svg a:hover polygon { stroke:var(--accent); stroke-width:2; }
"""


def href(args):
    """A link that asks the producer again with `args`. Formatting, not computing."""
    return "?" + urlencode({"id": VIEW_ID, **(args or {})})


def pts(points):
    return " ".join(f"{p[0]},{p[1]}" for p in points)


def link(args, inner):
    return f'<a href="{escape(href(args))}">{inner}</a>' if args else inner


# ------------------------------------------------------------------------------------------------
# Drawings, one per level
# ------------------------------------------------------------------------------------------------

def feature_shape(f):
    poly = (f'<polygon points="{pts(f["points"])}" fill="{escape(f["color"])}" '
            f'stroke="rgba(0,0,0,.35)" stroke-width="0.8"><title>{escape(f["name"])}</title></polygon>')
    return link(f.get("args"), poly)


def arrow_with_label(f):
    lab = f["label"]
    cls = "feat-label flabel" if lab["inside"] else "feat-label"
    text = (f'<text x="{lab["x"]}" y="{lab["y"]}" text-anchor="middle" class="{cls}">'
            f'{escape(lab["text"])}</text>')
    return feature_shape(f) + text


def svg_open(d, title):
    return (f'<svg viewBox="0 0 {d["width"]} {d["height"]}" width="{d["width"]}" '
            f'role="img" aria-label="{escape(title)}" xmlns="http://www.w3.org/2000/svg">')


def draw_circular(d, title):
    out = [svg_open(d, title)]
    for m in d["marks"]:
        out.append(f'<polygon points="{pts(m["points"])}" fill="var(--mark)" opacity=".8"/>')
        if m["label"]:
            out.append(f'<text x="{m["lx"]}" y="{m["ly"]}" text-anchor="middle" font-size="12" '
                       f'font-weight="600">{escape(m["label"])}</text>')
    for r in d["rings"]:
        out.append(f'<circle cx="{r["cx"]}" cy="{r["cy"]}" r="{r["r"]}" fill="none" '
                   f'stroke="var(--strand)" stroke-width="1.6"/>')
    o = d["origin"]
    out.append(f'<line x1="{o["x1"]}" y1="{o["y1"]}" x2="{o["x2"]}" y2="{o["y2"]}" stroke="var(--fg)" stroke-width="2"/>'
               f'<text x="{o["lx"]}" y="{o["ly"]}" text-anchor="middle" font-size="11" font-weight="600">{o["label"]}</text>')
    for t in d["ticks"]:
        out.append(f'<line x1="{t["x1"]}" y1="{t["y1"]}" x2="{t["x2"]}" y2="{t["y2"]}" stroke="var(--muted)"/>'
                   f'<text x="{t["lx"]}" y="{t["ly"]}" text-anchor="{t["anchor"]}" font-size="11" '
                   f'class="muted" dominant-baseline="middle">{escape(t["label"])}</text>')
    for f in d["features"]:
        out.append(feature_shape(f))
    for lab in d["labels"]:
        ld = lab["leader"]
        out.append(f'<line x1="{ld["x1"]}" y1="{ld["y1"]}" x2="{ld["x2"]}" y2="{ld["y2"]}" '
                   f'stroke="var(--muted)" stroke-width="0.7"/>'
                   f'<text x="{lab["x"]}" y="{lab["y"]}" text-anchor="{lab["anchor"]}" font-size="12">'
                   f'{escape(lab["text"])}</text>')
    c = d["centre"]
    out.append(f'<text x="{c["x"]}" y="{c["y"]}" text-anchor="middle" font-size="18" font-weight="600">'
               f'{escape(c["lines"][0])}</text>')
    out.append(f'<text x="{c["x"]}" y="{c["y"]}" dy="22" text-anchor="middle" font-size="13" class="muted">'
               f'{escape(c["lines"][1])}</text>')
    out.append("</svg>")
    return "".join(out)


def end_mark(e):
    if e["kind"] == "terminus":
        anchor = "end" if e["side"] == "left" else "start"
        dx = "-6" if e["side"] == "left" else "6"
        return (f'<text x="{e["x"]}" y="{e["y"]}" dx="{dx}" dy="4" text-anchor="{anchor}" '
                f'font-size="12" font-weight="600">{e["text"]}</text>')
    anchor = "end" if e["side"] == "left" else "start"
    dx = "-6" if e["side"] == "left" else "6"
    return (f'<text x="{e["x"]}" y="{e["y"]}" dx="{dx}" dy="4" text-anchor="{anchor}" '
            f'font-size="14" class="muted">{e["text"]}<title>the molecule continues</title></text>')


def draw_linear(d, title):
    out = [svg_open(d, title)]
    for m in d["marks"]:
        out.append(f'<rect x="{m["x"]}" y="{m["y"]}" width="{m["w"]}" height="{m["h"]}" fill="var(--mark)" opacity=".55"/>')
        if m["label"]:
            out.append(f'<text x="{m["x"]}" y="{m["ly"]}" font-size="12" font-weight="600">{escape(m["label"])}</text>')
    for b in d["backbone"]:
        out.append(f'<line x1="{b["x1"]}" y1="{b["y"]}" x2="{b["x2"]}" y2="{b["y"]}" stroke="var(--strand)" stroke-width="2"/>')
    for e in d["ends"]:
        out.append(end_mark(e))
    r = d["ruler"]
    out.append(f'<line x1="{r["x1"]}" y1="{r["y"]}" x2="{r["x2"]}" y2="{r["y"]}" stroke="var(--muted)"/>')
    for t in d["ticks"]:
        out.append(f'<line x1="{t["x"]}" y1="{t["y1"]}" x2="{t["x"]}" y2="{t["y2"]}" stroke="var(--muted)"/>'
                   f'<text x="{t["x"]}" y="{t["ly"]}" text-anchor="middle" font-size="11" class="muted">{escape(t["label"])}</text>')
    for f in d["features"]:
        out.append(arrow_with_label(f))
    out.append("</svg>")
    return "".join(out)


def draw_sequence(d, title):
    out = [svg_open(d, title)]
    for row in d["rows"]:
        for m in row["marks"]:
            out.append(f'<rect x="{m["x"]}" y="{m["y"]}" width="{m["w"]}" height="{m["h"]}" rx="3" fill="var(--mark)" opacity=".7"/>')
        for f in row["features"]:
            out.append(arrow_with_label(f))
        out.append(f'<text x="{d["label_x"]}" y="{row["label_y"]}" text-anchor="end" font-size="12" class="muted mono">'
                   f'{escape(row["left_label"])}</text>')
        out.append(f'<text x="{row["right_x"]}" y="{row["label_y"]}" font-size="12" class="muted mono">'
                   f'{escape(row["right_label"])}</text>')
        for strand in (row["top"], row["bottom"]):
            if strand:
                out.append(f'<text x="{strand["x"]}" y="{strand["y"]}" textLength="{strand["width"]}" '
                           f'lengthAdjust="spacing" font-size="14" class="mono" xml:space="preserve">'
                           f'{escape(strand["text"])}</text>')
    out.append("</svg>")
    return "".join(out)


def draw_end(e):
    dash = ' stroke-dasharray="3 3"' if e["kind"] == "continues" else ""
    line = (f'<line x1="{e["x1"]}" y1="{e["y"]}" x2="{e["x2"]}" y2="{e["y"]}" stroke="var(--strand)" '
            f'stroke-width="2"{dash}/>')
    if e["kind"] == "continues":
        return line + (f'<text x="{e["tx"]}" y="{e["ty"]}" text-anchor="{e["anchor"]}" font-size="12" '
                       f'class="muted">{escape(e["text"])}<title>the molecule continues</title></text>')
    if e["kind"] == "phosphate":
        group = (f'<circle cx="{e["gx"]}" cy="{e["gy"]}" r="8" fill="var(--phos)"/>'
                 f'<text x="{e["gx"]}" y="{e["gy"]}" dy="4" text-anchor="middle" font-size="10" '
                 f'font-weight="700" class="flabel">P</text>')
    elif e["kind"] == "hydroxyl":
        group = (f'<text x="{e["gx"]}" y="{e["gy"]}" dy="4" text-anchor="{e["anchor"]}" font-size="11" '
                 f'font-weight="600">OH</text>')
    elif e["kind"] == "not_stated":
        group = (f'<circle cx="{e["gx"]}" cy="{e["gy"]}" r="8" fill="none" stroke="var(--muted)" '
                 f'stroke-dasharray="2 2"/><text x="{e["gx"]}" y="{e["gy"]}" dy="4" text-anchor="middle" '
                 f'font-size="11" class="muted">?</text>')
    else:
        group = (f'<text x="{e["gx"]}" y="{e["gy"]}" dy="4" text-anchor="{e["anchor"]}" font-size="11" '
                 f'font-weight="600" fill="var(--accent)">{escape(e["chem"])}</text>')
    line = line if e["kind"] in ("phosphate", "not_stated") else ""
    prime = (f'<text x="{e["px"]}" y="{e["py"]}" text-anchor="{e["anchor"]}" font-size="12" '
             f'font-weight="600">{e["prime"]}</text>')
    return f'<g><title>{escape(e["title"])}</title>{line}{group}{prime}</g>'


def draw_molecule(d, title):
    out = [svg_open(d, title)]
    for o in d["overhangs"]:
        out.append(f'<rect x="{o["x"]}" y="{o["y"]}" width="{o["w"]}" height="{o["h"]}" rx="6" fill="none" '
                   f'stroke="var(--muted)" stroke-dasharray="4 3"><title>{escape(o["label"])}</title></rect>')
    for m in d["marks"]:
        out.append(f'<rect x="{m["x"]}" y="{m["y"]}" width="{m["w"]}" height="{m["h"]}" rx="6" fill="var(--mark)" opacity=".55"/>')
        if m["label"]:
            out.append(f'<text x="{m["x"]}" y="{m["ly"]}" font-size="12" font-weight="600">{escape(m["label"])}</text>')
    for t in d["ruler"]:
        out.append(f'<text x="{t["x"]}" y="{t["y"]}" text-anchor="middle" font-size="11" class="muted">{escape(t["label"])}</text>')
    for f in d["features"]:
        out.append(arrow_with_label(f))
    for p in d["pairs"]:
        out.append(f'<line x1="{p["x"]}" y1="{p["y1"]}" x2="{p["x"]}" y2="{p["y2"]}" stroke="var(--bond)" '
                   f'stroke-width="1.2" stroke-dasharray="2.5 2.5"/>')
    for s in d["strands"]:
        out.append(f'<text x="{s["label_x"]}" y="{s["label_y"]}" text-anchor="end" font-size="11" class="muted">'
                   f'{s["direction"]}</text>')
        for b in s["backbone"]:
            out.append(f'<line x1="{b["x1"]}" y1="{b["y1"]}" x2="{b["x2"]}" y2="{b["y2"]}" stroke="var(--strand)" stroke-width="2"/>')
        for e in s["ends"]:
            out.append(draw_end(e))
        for n in s["nucleotides"]:
            g, b = n["glyco"], n["base"]
            out.append(f'<line x1="{g["x1"]}" y1="{g["y1"]}" x2="{g["x2"]}" y2="{g["y2"]}" stroke="var(--strand)" stroke-width="1.4"/>'
                       f'<polygon points="{pts(n["sugar"])}" fill="var(--sugar)" stroke="var(--strand)" stroke-width="1.4">'
                       f'<title>{escape(d["sugar_name"])}</title></polygon>'
                       f'<rect x="{b["x"]}" y="{b["y"]}" width="{b["w"]}" height="{b["h"]}" rx="4" fill="var(--base)" '
                       f'stroke="var(--strand)" stroke-width="1"/>'
                       f'<text x="{b["tx"]}" y="{b["ty"]}" text-anchor="middle" font-size="13" font-weight="600" class="mono">'
                       f'{escape(b["letter"])}</text>')
        for p in s["phosphates"]:
            out.append(f'<circle cx="{p["x"]}" cy="{p["y"]}" r="5" fill="var(--phos)"><title>phosphate</title></circle>')
    out.append("</svg>")
    return "".join(out)


DRAW = {"circular": draw_circular, "linear": draw_linear, "sequence": draw_sequence, "molecule": draw_molecule}

LEGEND = {
    "circular": "Arcs are features, pointing the way they read. Click one to zoom to it. The tick at the top is position 1.",
    "linear": "Forward features sit above the backbone and reverse ones below. Click a feature to zoom to it; … means the molecule goes on.",
    "molecule": "Orange circles are phosphates; pentagons are {sugar}; dashes between bases are hydrogen bonds (2 for A·T, 3 for G·C). "
                "Each end shows what this record says is there: P (5′ phosphate), OH (hydroxyl), or ? where the record does not say. "
                "A dashed box is a single-stranded overhang.",
}


# ------------------------------------------------------------------------------------------------
# The page
# ------------------------------------------------------------------------------------------------

def facts(m):
    rows = [f'<span><b>{escape(m["length_label"])}</b></span>', f'<span>{escape(m["topology"])}</span>',
            f'<span>{escape(m["strands"])}-stranded {escape(m["polymer"])}</span>']
    if m["ends"]:
        for side, label in (("left", "Left end"), ("right", "Right end")):
            e = m["ends"][side]
            rows.append(f'<span>{label}: {escape(e["overhang"])}, {escape(e["chemistry"])}</span>')
    return '<div class="facts">' + "".join(rows) + "</div>"


def controls(p):
    seg = []
    for lv in p["levels"]:
        if lv["current"]:
            seg.append(f'<span class="on">{escape(lv["label"])}</span>')
        elif lv["available"]:
            seg.append(f'<a href="{escape(href(lv["args"]))}">{escape(lv["label"])}</a>')
        else:
            seg.append(f'<span class="off" title="not available for this span">{escape(lv["label"])}</span>')
    nav = "".join(f'<a class="btn" href="{escape(href(n["args"]))}">{escape(n["label"])}</a>' for n in p["nav"])
    region = f'<span class="region">{escape(p["region"]["label"])}</span>'
    return f'<div class="bar"><span class="seg">{"".join(seg)}</span>{nav}{region}</div>'


ABSENCE = {
    "not_carried": ('<div class="note">This input cannot carry annotation: it is a bare sequence, so '
                    'whether anything is annotated is unknown, not "none".</div>'),
    "none_annotated": ('<div class="note">No features annotated. The file could carry them, and has none '
                       '(apart from its <code>source</code> line).</div>'),
}


def absence_note(status):
    """Said above the drawing too: a map with no features must not pass for a map of nothing."""
    return ABSENCE.get(status, "")


def features_section(p):
    fs = p["features"]
    if fs["status"] in ABSENCE:
        body = ABSENCE[fs["status"]]
    else:
        rows = []
        for f in fs["items"]:
            name = escape(f["name"])
            name = f'<a href="{escape(href(f["args"]))}">{name}</a>' if f["args"] else name
            rows.append(f'<tr><td><span class="sw" style="background:{escape(f["color"])}" '
                        f'title="{escape(f["color_why"])}"></span>{name}</td><td>{escape(f["type"])}</td>'
                        f'<td>{escape(f["location_label"])}</td><td>{escape(f["strand_label"])}</td>'
                        f'<td>{escape(f["length_label"])}</td></tr>')
        body = ('<div class="tablewrap"><table><thead><tr><th>Feature</th><th>Type</th><th>Location</th>'
                '<th>Strand</th><th>Length</th></tr></thead><tbody>' + "".join(rows) + "</tbody></table></div>")
    skipped = ""
    if fs["skipped"]:
        items = "".join(f'<li>{escape(s["name"])} at <code>{escape(s["location"])}</code>: {escape(s["why"])}</li>'
                        for s in fs["skipped"])
        skipped = f'<div class="note"><b>Annotations in the file that could not be placed:</b><ul>{items}</ul></div>'
    return f'<h2>Features</h2>{body}{skipped}'


def marks_section(p):
    if not p["marks"]:
        return ""
    items = "".join(f'<li><a href="{escape(href(m["args"]))}">{escape(m["label"] or m["location_label"])}</a>'
                    f' at {escape(m["location_label"])}</li>' for m in p["marks"])
    return f'<h2>Pointed at</h2><ul>{items}</ul>'


def source_line(p):
    s = p["source"]
    if s["kind"] == "file":
        return f'from <code>{escape(s["path"])}</code>'
    return "from arguments" if s["kind"] == "arguments" else "from a C6 Polynucleotide"


def page(title, body):
    return (f'<!doctype html><html><head><meta charset="utf-8">'
            f'<meta name="viewport" content="width=device-width,initial-scale=1">'
            f'<title>{escape(title)}</title><style>{STYLE}</style></head>'
            f'<body><main>{body}</main></body></html>')


def render(payload):
    p = payload["dna"]
    head = (f'<h1>{escape(p["name"])}</h1><p class="sub">{escape(p["description"])}'
            f'{" · " if p["description"] else ""}{source_line(p)}</p>')

    if p["status"] == "unreadable":
        return page(p["name"], head + (
            '<div class="absent error"><h2>Could not read this</h2>'
            f'<p>{escape(p["problem"])}</p><p>Nothing is drawn, because there is nothing read to draw. '
            'This is not an empty molecule.</p></div>'))

    info = facts(p["molecule"])
    if p["status"] == "bad_request":
        nav = "".join(f'<a class="btn" href="{escape(href(n["args"]))}">{escape(n["label"])}</a>' for n in p["nav"])
        return page(p["name"], head + info + (
            '<div class="absent error"><h2>Cannot draw that</h2>'
            f'<p>{escape(p["problem"])}</p><div class="bar">{nav}</div></div>') + features_section(p))

    d = p["drawing"]
    title = f'{p["name"]}, {p["region"]["label"]}'
    wide = " wide" if d["kind"] in ("sequence", "molecule") else ""
    legend = LEGEND.get(d["kind"], "").replace("{sugar}", d.get("sugar_name", ""))
    if d["kind"] == "sequence":
        legend = (f'{d["strand_note"]}. The drawn stretch starts at {d["ends"]["left"]} and ends at '
                  f'{d["ends"]["right"]} (… means the molecule goes on).')
    notes = "".join(f'<div class="note">{escape(n)}</div>' for n in p["notes"])
    return page(title, head + info + controls(p) + absence_note(p["features"]["status"])
                + f'<div class="canvas{wide}">{DRAW[d["kind"]](d, title)}</div>'
                + f'<p class="legend">{escape(legend)}</p>' + notes
                + marks_section(p) + features_section(p))
