"""A fact written down on one sheet is referenced by the next, not asked for again.

JCA, 2026-09-12, looking at a blank Box and Well beside "the 10 µM working stock you made in
session 1": *"use a formula to pull that info from the previous page."*

**Asking twice for one fact is how the second answer comes back different**, and the second ask is
the one nobody fills in. The dilution session records where each working stock went; the PCR sheet
that uses it points at those cells and follows whatever the student typed.
"""
import importlib.util, json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
MOD = os.path.join(ROOT, "src", "labplanner", "render", "labpacket-to-xlsx.py")
spec = importlib.util.spec_from_file_location("lp2x", MOD)
lp = importlib.util.module_from_spec(spec); spec.loader.exec_module(lp)

CF = "PCR\tbo1\tbo2\tpSRC\tfrag1\nGoldenGate\tfrag1\tbackbone\tBsaI\tpTEST\n"
OLIGOS = "bo1\tACGTACGTACGTACGTACGT\t25nm\tSTD\nbo2\tTGCATGCATGCATGCATGCA\t25nm\tSTD\n"


def _packet():
    d = tempfile.mkdtemp(prefix="links-")
    open(os.path.join(d, "Construction of pTEST.txt"), "w").write(CF)
    open(os.path.join(d, "p_oligos.txt"), "w").write(OLIGOS)
    out = subprocess.run(["node", os.path.join(ROOT, "bin", "c6-packet"), d, "--clone-only"],
                         capture_output=True, text=True)
    assert out.returncode == 0, out.stderr[:400]
    return json.loads(out.stdout)


PACKET = _packet()
PCR = next(s for s in PACKET["sheets"] if "pcr" in s["metadata"]["operations"])


def test_the_pcr_sheet_points_at_the_dilution_sheet_rather_than_asking():
    rows = {r["what"]: r for r in PCR["inputs"]}
    for o in ("bo1", "bo2"):
        assert rows[o].get("link"), rows[o]
        assert rows[o]["link"]["box"].endswith(f".working.{o}.box"), rows[o]["link"]
        # Not also an ask: two yellow cells for one fact is the thing being removed.
        assert not rows[o].get("unlocated") and not rows[o].get("askWell"), rows[o]


def test_the_slug_it_points_at_is_one_the_dilution_sheet_actually_writes():
    """A reference to a slug nobody records is a blank cell and a silent lie about linkage."""
    d = next(s for s in PACKET["sheets"] if s.get("dilution"))
    slug = d["dilution"]["slug"]
    for r in PCR["inputs"]:
        if r.get("link"):
            assert r["link"]["box"].startswith(f"{slug}."), (r["link"], slug)


def test_the_reference_is_guarded_so_an_unfilled_cell_is_blank_and_not_zero():
    """A bare =E18 against an empty cell displays 0. A student reading "0" in a Box column either
    goes looking for box zero or decides the sheet is broken."""
    from openpyxl import Workbook
    wb = Workbook(); ws = wb.active; ws.title = "PCR"
    record = [("s1-dilution.working.bo1.box", "'Oligo dilutions'!E18"),
              ("s1-dilution.working.bo1.well", "'Oligo dilutions'!F18")]
    sheet = {"id": "s2-pcr", "inputs": [
        {"what": "bo1", "box": "", "well": "", "made": True,
         "link": {"box": "s1-dilution.working.bo1.box",
                  "well": "s1-dilution.working.bo1.well"},
         "note": "made in session 1"}]}
    lp.write_sources(ws, 1, sheet, record)
    got = [c.value for row in ws.iter_rows(values_only=False) for c in row if c.value]
    formulas = [v for v in got if str(v).startswith("=")]
    assert len(formulas) == 2, got
    for f in formulas:
        assert f.startswith("=IF(") and '="",""' in f, f


def test_an_unresolvable_link_leaves_the_cells_empty():
    """Rather than a #REF!, which on a printed labsheet reads as a system fault."""
    from openpyxl import Workbook
    wb = Workbook(); ws = wb.active; ws.title = "PCR"
    sheet = {"id": "s2-pcr", "inputs": [
        {"what": "bo1", "link": {"box": "nobody.writes.this.box",
                                 "well": "nobody.writes.this.well"}, "note": "x"}]}
    lp.write_sources(ws, 1, sheet, [])
    assert not [c.value for row in ws.iter_rows() for c in row
                if c.value and str(c.value).startswith("=")]


if __name__ == "__main__":
    fails = []
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try: fn(); print(f"  ok    {name}")
            except AssertionError as e:
                fails.append(name); print(f"  FAIL  {name}: {str(e)[:300]}")
    print(f"\n{'FAILED' if fails else 'passed'}: {len(fails)} failure(s)")
    sys.exit(1 if fails else 0)
