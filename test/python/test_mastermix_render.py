"""The mastermix is printed, not calculated, and the numbers are right.

JCA, 2026-09-10: *"There doesn't need to be a calculator for a mastermix, just do the
calculations. The way this is normally presented is like: Master Mix: 233 uL ddH2O, 24 uL
buffer … Reaction: 30 uL ddH2O, 10 uL Master Mix."*

The version this replaced put the reaction count and the excess in editable cells with formulas
over them. It was both unwanted and **broken**: the formulas multiplied `volume_uL` while every
packet carries `amount`, so each total rendered as `0`. That is the failure worth a test — a
spreadsheet that computes the wrong number confidently is worse than a printed one, and a
student reading "0 uL ddH2O" either stops or pours nothing.
"""
import importlib.util, os, sys
from openpyxl import Workbook

HERE = os.path.dirname(os.path.abspath(__file__))
MOD = os.path.join(HERE, "..", "..", "src", "labplanner", "render", "labpacket-to-xlsx.py")
spec = importlib.util.spec_from_file_location("lp2x", MOD)
lp = importlib.util.module_from_spec(spec); spec.loader.exec_module(lp)

PRIMESTAR = {"components": [
    {"amount": 32.0, "unit": "uL", "name": "ddH2O (white)"},
    {"amount": 10.0, "unit": "uL", "name": "5X PrimeSTAR GXL Buffer (green)"},
    {"amount": 4.0, "unit": "uL", "name": "PrimeSTAR dNTP Mixture"},
    {"amount": 1.0, "unit": "uL", "name": "10uM primer 1"},
    {"amount": 1.0, "unit": "uL", "name": "10uM primer 2"},
    {"amount": 1.0, "unit": "uL", "name": "dil20x plasmid template"},
    {"amount": 1.0, "unit": "uL", "name": "PrimeSTAR GXL DNA Polymerase"}]}


def render(recipe, n):
    wb = Workbook(); ws = wb.active
    lp.reaction_block(ws, 1, recipe, n)
    out = []
    for row in ws.iter_rows(values_only=True):
        cells = [str(c) for c in row if c is not None and str(c).strip()]
        if cells: out.append(cells)
    return out


def flat(rows): return [" | ".join(r) for r in rows]


def test_no_zeros_anywhere():
    """The bug this file exists for."""
    for line in flat(render(PRIMESTAR, 6)):
        assert not line.startswith("0 uL"), line


def test_no_formulas_reach_the_page():
    """It is a printed protocol, not a calculator."""
    for line in flat(render(PRIMESTAR, 6)):
        assert "=" not in line, line


def test_the_mastermix_totals_are_count_times_excess():
    rows = flat(render(PRIMESTAR, 6))
    assert any(r.startswith("211.2 uL | ddH2O") for r in rows), rows   # 32 x 6 x 1.1
    assert any(r.startswith("66 uL | 5X PrimeSTAR") for r in rows), rows
    assert any(r.startswith("323.4 uL | total") for r in rows), rows   # 49 x 6.6


def test_the_reaction_is_mastermix_plus_what_varies():
    rows = flat(render(PRIMESTAR, 6))
    assert any(r == "49 uL | Master Mix" for r in rows), rows
    assert any(r.startswith("1 uL | dil20x plasmid template") for r in rows), rows
    # and the two add back to the full reaction
    assert any("50 uL" in r for r in rows), rows


def test_the_template_is_what_varies_by_default():
    """Nothing in a packet marks it, and it is the one that differs in nearly every labsheet."""
    rows = flat(render(PRIMESTAR, 6))
    i = next(i for i, r in enumerate(rows) if r.startswith("Reaction"))
    after = rows[i:]
    assert any("template" in r for r in after)
    assert not any("template" in r for r in rows[:i])


def test_an_explicit_varies_flag_wins():
    recipe = {"components": [
        {"amount": 40.0, "name": "water"},
        {"amount": 5.0, "name": "special primer", "varies": True},
        {"amount": 5.0, "name": "enzyme"}]}
    rows = flat(render(recipe, 6))
    i = next(i for i, r in enumerate(rows) if r.startswith("Reaction"))
    assert any("special primer" in r for r in rows[i:])
    assert any("45 uL | Master Mix" == r for r in rows[i:]), rows


def test_below_the_threshold_there_is_no_mastermix_at_all():
    rows = flat(render(PRIMESTAR, 2))
    assert not any("Master Mix" in r for r in rows), rows
    assert any(r.startswith("32 uL | ddH2O") for r in rows), rows


if __name__ == "__main__":
    fails = []
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try: fn(); print(f"  ok    {name}")
            except AssertionError as e:
                fails.append(name); print(f"  FAIL  {name}: {str(e)[:200]}")
    print(f"\n{'FAILED' if fails else 'passed'}: {len(fails)} failure(s)")
    sys.exit(1 if fails else 0)
