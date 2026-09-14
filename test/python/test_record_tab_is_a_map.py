"""The record tab is a map, and a map with a repeated key is not a map.

`render/read-returned.py` builds a dict from the tab's rows, so a slug written twice means one cell
can never be read back and another comes back under its name. **That is a wrong answer rather than a
missing one, and downstream the two are indistinguishable:** `c6-receive` reads a blank well as
*"never made"*, releases the hold and records nothing — exactly what it would do for a tube that
really was never made.

A block table with no heading above it slugs as `<sheet>.block`, so two of them on one sheet minted
the same key for the same row and column. Found 2026-09-13 by constructing the case; no real
experiment had hit it yet, which is the only reason it had not lost somebody's afternoon.
"""
import collections
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PY = "/opt/homebrew/opt/python@3.12/bin/python3.12"
RENDER = os.path.join(ROOT, "src", "labplanner", "render", "labpacket-to-xlsx.py")


def _render(packet):
    d = tempfile.mkdtemp(prefix="record-")
    src, out = os.path.join(d, "p.json"), os.path.join(d, "p.xlsx")
    open(src, "w").write(json.dumps(packet))
    r = subprocess.run([PY, RENDER, src, out], capture_output=True, text=True)
    return r, out


def _slugs(path):
    import openpyxl
    wb = openpyxl.load_workbook(path)
    tab = next(n for n in wb.sheetnames if "record" in n)
    return [(x[0].value, x[1].value) for x in wb[tab].iter_rows() if x[0].value]


def _two_unheaded_tables():
    return {"id": "dup", "metadata": {"experiment": "dup"}, "sheets": [{
        "id": "s1-pick", "title": "Picking", "metadata": {"operations": ["pick"]},
        "blocks": [
            {"kind": "table", "rows": [["what", "answer"], ["colonies", ""]], "header": True},
            {"kind": "table", "rows": [["what", "answer"], ["colour", ""]], "header": True},
        ]}]}


def test_two_unheaded_block_tables_do_not_share_a_slug():
    r, out = _render(_two_unheaded_tables())
    assert r.returncode == 0, (r.stdout + r.stderr)[-500:]
    rows = _slugs(out)
    c = collections.Counter(s for s, _ in rows)
    assert not [k for k, v in c.items() if v > 1], [k for k, v in c.items() if v > 1]


def test_each_still_points_at_its_own_cell():
    """Disambiguation is worthless if both slugs end up on the same formula."""
    _, out = _render(_two_unheaded_tables())
    cells = [v for s, v in _slugs(out) if ".block" in s]
    assert len(cells) == 2 and cells[0] != cells[1], cells


def test_two_tables_under_the_same_heading_do_not_share_a_slug():
    """Headings are prose somebody wrote, so two can repeat."""
    p = _two_unheaded_tables()
    p["sheets"][0]["blocks"] = [
        {"kind": "heading", "text": "What you saw"},
        {"kind": "table", "rows": [["what", "answer"], ["colonies", ""]], "header": True},
        {"kind": "heading", "text": "What you saw"},
        {"kind": "table", "rows": [["what", "answer"], ["colour", ""]], "header": True},
    ]
    r, out = _render(p)
    assert r.returncode == 0, (r.stdout + r.stderr)[-400:]
    c = collections.Counter(s for s, _ in _slugs(out))
    assert not [k for k, v in c.items() if v > 1]


def test_the_first_slug_is_unchanged_by_the_disambiguation():
    """A slug is a name Cortex's checkpoints and this lab's record tab both use. Renaming the
    FIRST occurrence to `_1` would have broken every existing one to fix a case that had not
    happened."""
    _, out = _render(_two_unheaded_tables())
    got = [s for s, _ in _slugs(out) if ".block" in s]
    assert got[0] == "s1-pick.block.sample.1.answer", got


def test_the_backstop_refuses_rather_than_shipping_an_ambiguous_map():
    """`block_slug` should make this unreachable. It is kept because the cost of being wrong is a
    student's afternoon recorded against the wrong question."""
    import importlib.util
    from openpyxl import Workbook
    spec = importlib.util.spec_from_file_location("render", RENDER)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    try:
        m.write_record_tab(Workbook(), [("a.b", "X!A1"), ("a.b", "X!A2")])
    except SystemExit as e:
        assert "same slug twice" in str(e), str(e)
        return
    assert False, "an ambiguous record tab was written"


def test_a_flag_where_a_path_belongs_is_refused():
    """Both paths are positional and every other command in this repo takes `--out`, so
    `labpacket-to-xlsx p.json --out book.xlsx` wrote a 45 KB workbook to a file called `--out`
    and reported success. Twice."""
    d = tempfile.mkdtemp(prefix="record-")
    src = os.path.join(d, "p.json")
    open(src, "w").write(json.dumps(_two_unheaded_tables()))
    r = subprocess.run([PY, RENDER, src, "--out", os.path.join(d, "b.xlsx")],
                       capture_output=True, text=True, cwd=d)
    assert r.returncode != 0, r.stdout
    assert "positional" in r.stdout + r.stderr
    assert not os.path.exists(os.path.join(d, "--out")), "it wrote a file called --out"


if __name__ == "__main__":
    fails = []
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn(); print(f"  ok    {name}")
            except AssertionError as e:
                fails.append(name); print(f"  FAIL  {name}: {str(e)[:300]}")
            except Exception as e:
                fails.append(name); print(f"  ERROR {name}: {type(e).__name__}: {str(e)[:300]}")
    print(f"\n{'FAILED' if fails else 'passed'}: {len(fails)} failure(s)")
    sys.exit(1 if fails else 0)
