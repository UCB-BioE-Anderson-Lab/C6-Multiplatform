#!/usr/bin/env python3
"""Read a generated labsheet workbook back and show it as one scrollable page.

    xlsx-to-html.py <packet.xlsx> <out.html>

JCA, 2026-09-12: *"This is cumbersome to have to download your files and open and close them in
excel."*

**IT READS THE WORKBOOK, IT DOES NOT RE-RENDER THE PACKET.** There is already an HTML renderer
that draws a LabPacket — `labsheetHtml.js` — and using it here would be the mistake this
repository keeps finding: two renderers over one format, drifting apart, with the preview
quietly disagreeing with the thing that prints. The point of a preview is to answer *"what does
the file say"*, so the only trustworthy source is the file.

**FORMULAS ARE SHOWN AS FORMULAS.** openpyxl does not evaluate, and a preview that printed a
blank where `=IF('Oligo dilutions'!E18="","",…)` lives would hide the one thing worth checking
about it. They are rendered in a monospace tint so they read as machinery rather than as data.

WHAT IS DELIBERATELY NOT HERE: any judgement about whether the sheet is good. This is a window,
and a window that editorialises is a second opinion nobody asked for.
"""
import html
import importlib.util
import os
import re
import sys

from openpyxl import load_workbook

# THE RENDERER'S OWN CONSTANTS, IMPORTED RATHER THAN COPIED. The first version of this file had
# `FFF7D6` for the entry fill; the renderer uses `FFF6C8`, so every yellow cell in the preview was
# drawn as an ordinary one and the summary line read "0 cells to fill in" about a packet with
# dozens. A preview whose palette is a guess at the printer's palette is a preview of nothing.
_spec = importlib.util.spec_from_file_location(
    "lp2x", os.path.join(os.path.dirname(os.path.abspath(__file__)), "labpacket-to-xlsx.py"))
_lp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_lp)

ENTRY_RGB = str(_lp.ENTRY.fgColor.rgb)[-6:].upper()
HEAD_RGB = str(_lp.HEADFILL.fgColor.rgb)[-6:].upper()
ROWS_PER_PAGE = _lp.ROWS_PER_PAGE

# The fill the renderer uses for a cell somebody writes in. Read from the file rather than
# assumed, so a change to the palette shows up here instead of silently un-highlighting the
# entry cells.
def _is_entry(cell):
    f = cell.fill
    if not f or f.fill_type != "solid":
        return False
    rgb = getattr(f.fgColor, "rgb", None)
    return isinstance(rgb, str) and rgb.upper().endswith(ENTRY_RGB)


def _is_head(cell):
    f = cell.fill
    rgb = getattr(getattr(f, "fgColor", None), "rgb", None) if f else None
    return isinstance(rgb, str) and rgb.upper().endswith(HEAD_RGB)


# THE PALETTE IS THE WORKBOOK'S OWN. `labpacket-to-xlsx.py` fills headers #DCE6F1, entry cells
# #FFF7D6 and sets headings in #1F3864; a preview that invented its own colours would be a second
# opinion about what the printed page looks like. The neutrals are warmed toward the paper the
# sheet is printed on rather than left at a default grey.
FONTS = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
         'family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&'
         'family=Source+Serif+4:opsz,wght@8..60,600&display=swap">')

CSS = """
:root{
  --paper:#faf8f4; --ink:#1a1a17; --rule:#ddd8cc; --rule-soft:#ece7dc;
  --navy:#1f3864; --headfill:__HEAD__; --entry:__ENTRY__; --entry-edge:__ENTRY_EDGE__;
  --mono:#8a4b00; --mono-bg:#fdf3e6; --sub:#6d6a60; --flag:#9c0006;
  --sans:"IBM Plex Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  --serif:"Source Serif 4",Georgia,serif;
  --code:"IBM Plex Mono",ui-monospace,Menlo,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --paper:#191914; --ink:#ece8dd; --rule:#3b3a33; --rule-soft:#2a2924;
  --navy:#a8c2ee; --headfill:#232d3d; --entry:#3a3320; --entry-edge:#5a4d28;
  --mono:#e2a868; --mono-bg:#2a2016; --sub:#9b978b; --flag:#ef8079;
}}
:root[data-theme="dark"]{
  --paper:#191914; --ink:#ece8dd; --rule:#3b3a33; --rule-soft:#2a2924;
  --navy:#a8c2ee; --headfill:#232d3d; --entry:#3a3320; --entry-edge:#5a4d28;
  --mono:#e2a868; --mono-bg:#2a2016; --sub:#9b978b; --flag:#ef8079;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 var(--sans);
     font-variant-numeric:tabular-nums}
header{position:sticky;top:0;z-index:3;background:var(--paper);
       border-bottom:1px solid var(--rule);padding:14px 24px 0}
.top{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 18px;max-width:1180px}
h1{margin:0;font:600 22px/1.2 var(--serif);letter-spacing:-.01em}
.facts{display:flex;gap:16px;flex-wrap:wrap;color:var(--sub);font-size:12px;
       text-transform:uppercase;letter-spacing:.07em}
.facts b{color:var(--ink);font-weight:600}
nav{display:flex;gap:2px;overflow-x:auto;padding:12px 0 0;margin-top:8px}
nav a{flex:0 0 auto;display:flex;gap:7px;align-items:baseline;padding:6px 10px 9px;
      color:var(--sub);text-decoration:none;font-size:13px;white-space:nowrap;
      border-bottom:2px solid transparent}
nav a:hover,nav a:focus-visible{color:var(--ink);border-bottom-color:var(--navy);outline:none}
nav .n{font:500 11px/1 var(--code);color:var(--navy);opacity:.8}
main{padding:0 24px 80px;max-width:1180px}
section{padding-top:34px;scroll-margin-top:118px}
.sh{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
h2{margin:0;font:600 17px/1.3 var(--serif);color:var(--navy)}
.meta{color:var(--sub);font-size:12px;margin:3px 0 12px;
      text-transform:uppercase;letter-spacing:.06em}
.flag{color:var(--flag);font-weight:600}
.scroll{overflow-x:auto;border-top:1px solid var(--rule-soft)}
table{border-collapse:collapse;font-size:13.5px;min-width:100%}
td{border-bottom:1px solid var(--rule-soft);padding:5px 10px;vertical-align:top;
   white-space:pre-wrap;max-width:44em}
tr:hover td{background:color-mix(in srgb,var(--navy) 4%,transparent)}
td.b{font-weight:600}
td.h{background:var(--headfill);color:var(--navy);font-weight:600;font-size:12px;
     text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}
td.e{background:var(--entry);box-shadow:inset 0 0 0 1px var(--entry-edge);min-width:6em}
td.f{font:400 11.5px/1.5 var(--code);color:var(--mono);background:var(--mono-bg)}
td.n{border-bottom-color:transparent}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
"""


def _palette(css):
    """Substitute the workbook's own fills into the stylesheet.

    The first version wrote the hexes out twice — once for detection and once as the swatch — and
    they had already drifted by the time anybody looked. A preview whose yellow is not the
    workbook's yellow is showing a different page.
    """
    edge = "".join(f"{max(0, int(ENTRY_RGB[i:i + 2], 16) - 28):02x}" for i in (0, 2, 4))
    return (css.replace("__ENTRY__", f"#{ENTRY_RGB.lower()}")
               .replace("__ENTRY_EDGE__", f"#{edge}")
               .replace("__HEAD__", f"#{HEAD_RGB.lower()}"))


def render(path, out):
    wb = load_workbook(path)
    names = list(wb.sheetnames)
    # The packet's own title, which the first sheet puts in A1 as "<session> for Experiment <name>".
    a1 = str(wb[names[0]]["A1"].value or names[0])
    title = a1.split(" for Experiment ")[-1] if " for Experiment " in a1 else a1
    # SESSION NUMBERS ARE REAL AND THE OTHER TABS HAVE NONE. A labsheet packet IS a sequence —
    # one sitting after another — so numbering the sessions encodes something true. The closing
    # tab and the hidden machinery tab are not sittings, so they are not numbered.
    sessions = [n for n in names if wb[n].sheet_state == "visible"
                and " for Experiment " in str(wb[n]["A1"].value or "")]
    number = {n: i + 1 for i, n in enumerate(sessions)}
    long_tabs = [n for n in sessions if wb[n].max_row > ROWS_PER_PAGE]
    to_fill = sum(1 for n in names for row in wb[n].iter_rows() for c in row if _is_entry(c))

    parts = [f"<title>{html.escape(title)} Labsheets</title>", FONTS,
             f"<style>{_palette(CSS)}</style>",
             '<header><div class="top">',
             f"<h1>{html.escape(title)}</h1>",
             '<div class="facts">',
             f"<span><b>{len(sessions)}</b> sessions</span>",
             f"<span><b>{to_fill}</b> cells to fill in</span>",
             (f'<span class="flag"><b>{len(long_tabs)}</b> over one page</span>'
              if long_tabs else "<span>all fit one page</span>"),
             "</div></div><nav>"]
    # An id with a space in it is a link that does not work. Slugged once, used in both places.
    anchor = {n: re.sub(r"[^a-z0-9]+", "-", n.lower()).strip("-") or f"t{i}"
              for i, n in enumerate(names)}
    for n in names:
        num = f'<span class="n">{number[n]}</span>' if n in number else ""
        parts.append(f'<a href="#{anchor[n]}">{num}{html.escape(n)}</a>')
    parts.append("</nav></header><main>")

    for n in names:
        ws = wb[n]
        hidden = ws.sheet_state != "visible"
        parts.append(f'<section id="{anchor[n]}"><div class="sh">')
        if n in number:
            parts.append(f'<h2>Session {number[n]} · {html.escape(n)}</h2>')
        else:
            parts.append(f'<h2>{html.escape(n)}</h2>')
        parts.append("</div>")
        bits = [f"{ws.max_row} rows"]
        if hidden:
            bits.append("hidden tab, machinery")
        elif ws.max_row > ROWS_PER_PAGE:
            bits.append(f'<span class="flag">over one printed page '
                        f"({ws.max_row - ROWS_PER_PAGE} rows too many)</span>")
        parts.append(f'<p class="meta">{" · ".join(bits)}</p>')
        parts.append('<div class="scroll"><table>')
        for row in ws.iter_rows(min_row=1, max_row=ws.max_row):
            cells = []
            last = max((c.column for c in row if c.value not in (None, "")), default=0)
            if not last:
                continue
            for c in row[:last]:
                v = c.value
                cls = []
                if isinstance(v, str) and v.startswith("="):
                    cls.append("f")
                elif _is_head(c):
                    cls.append("h")
                elif _is_entry(c):
                    cls.append("e")
                elif getattr(c.font, "bold", False):
                    cls.append("b")
                if v in (None, "") and not _is_entry(c):
                    cls.append("n")
                text = "" if v in (None, "") else html.escape(str(v))
                cells.append(f'<td class="{" ".join(cls)}">{text}</td>')
            parts.append("<tr>" + "".join(cells) + "</tr>")
        parts.append("</table></div></section>")

    parts.append("</main>")
    with open(out, "w") as f:
        f.write("".join(parts))
    print(f"  wrote {out}: {len(names)} tab(s)")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit("  xlsx-to-html.py <in.xlsx> <out.html>")
    # BOTH ARGUMENTS ARE POSITIONAL, and a flag in either slot is a mistake, not a path. Passing
    # `--out preview.html` here wrote a 45 KB file literally named `--out` into the working
    # directory, and it was committed twice before anybody looked at `git status` closely.
    for a in sys.argv[1:3]:
        if a.startswith("-"):
            sys.exit(f"  xlsx-to-html.py takes two paths, not flags — got {a!r}\n"
                     f"  xlsx-to-html.py <in.xlsx> <out.html>")
    render(sys.argv[1], sys.argv[2])
