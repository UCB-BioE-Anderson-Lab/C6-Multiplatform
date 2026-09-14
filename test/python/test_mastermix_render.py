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
import sys
import re
import os
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


# **THE RENDERER STOPPED CALCULATING AND THIS HELPER DID NOT NOTICE.** `reaction_block` used to be
# `(ws, r, recipe, n)` and worked the mastermix out itself; GATE 5 moved that decision to
# `makeMastermixPlan` and the renderer became `(ws, r, sheet)` — it draws what it is handed.
#
# This helper still called the old signature, so every test here raised a TypeError. The runner
# caught only AssertionError, so the crash escaped the loop, `run.sh` printed no failure, and the
# summary line never appeared. The file had been dead for as long as nobody read stderr.
#
# So the helper now builds the plan the way the planner does, and the tests below check that the
# renderer draws it faithfully — which is what they were always about.
MASTERMIX_THRESHOLD = 4
EXCESS = 1.1


def plan_for(recipe, n):
    """What `makeMastermixPlan` would return for this recipe and count."""
    comps = recipe["components"]
    amount = lambda c: float(c.get("amount", c.get("uL", 0)) or 0)
    if n < MASTERMIX_THRESHOLD:
        return {"mastermix": False, "reactions": n, "perReaction": comps,
                "why": f"{n} reaction(s) — under {MASTERMIX_THRESHOLD}, so set them up "
                       "individually."}
    # WHAT VARIES: an explicit flag, or the template by default — nothing in a packet marks it and
    # it is the one that differs in nearly every labsheet.
    varies = [c for c in comps if c.get("varies") or (
        not any(x.get("varies") for x in comps) and "template" in c.get("name", "").lower())]
    shared = [c for c in comps if c not in varies]
    return {"mastermix": True, "reactions": n, "excess": EXCESS,
            "shared": [{**c, "totalUL": round(amount(c) * n * EXCESS, 1)} for c in shared],
            "perTube": varies,
            "mastermixPerReactionUL": round(sum(amount(c) for c in shared), 1)}


def render(recipe, n):
    wb = Workbook(); ws = wb.active
    lp.reaction_block(ws, 1, {"recipe": recipe, "mastermix": plan_for(recipe, n)})
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


def test_sanger_and_full_plasmid_are_told_apart():
    """The submission link is the lab's Sanger route and Sanger only.

    JCA, 2026-09-10: *"and that is only for sanger."* Full-plasmid sequencing is a different
    vendor and a different route; putting this link on a full-plasmid sheet would send somebody to
    submit a whole plasmid through the form for reads.

    **THE SHEET DECLARES IT NOW, AND THIS TEST USED TO GUESS ALONG WITH THE CODE.** `is_sanger`
    was `json.dumps(sheet).lower()` and a search for "sanger", "sequenc", "full plasmid" and
    "analys" anywhere in the document — a guess over free text, which had already been wrong in the
    direction that matters: SLIP5's step is titled plainly "Sequencing" and does full-plasmid
    sequencing, so a title test put the lab's Sanger link on a page that must not carry it.

    GATE 5 replaced it with a `submits` flag the design sets. This test still handed it titles, so
    it asserted a contract the renderer had stopped implementing — and the TypeError above it hid
    that for as long as the file was dead.
    """
    assert lp.is_sanger({"submits": "sanger", "title": "Sequencing for Experiment X"})

    # A TITLE IS NOT EVIDENCE, which is the whole of the change. A sheet called "Sanger
    # Sequencing" that does not declare a submission does not submit one.
    assert not lp.is_sanger({"title": "Sanger Sequencing for Experiment X",
                             "operation": "Sanger Sequencing"})
    assert not lp.is_sanger({"title": "Full Plasmid Sequencing for Experiment X"})
    assert not lp.is_sanger({"submits": "full-plasmid", "title": "Sequencing for SLIP5"})
    assert not lp.is_sanger({})


def test_the_url_is_never_built_in():
    """C6 renders whatever route it is handed and knows none. The next lab's is different."""
    src = open(MOD).read()
    assert "script.google.com" not in src
    assert "--sequencing-url" in src


if __name__ == "__main__":
    fails = []
    # **A TEST DEFINED AFTER THIS BLOCK IS NOT RUN, AND THE FILE STILL PRINTS "passed".** Six new
    # tests were appended to this file on 2026-09-13 below the runner; `globals()` had not seen them
    # yet, so the suite collected the old five, reported green, and the new ones had never executed.
    # That is the shape `CLAUDE.md` keeps naming — *"a test nothing runs is the same failure one
    # layer down"* — and a hand-rolled runner cannot see it from the inside without being asked to.
    _src = open(os.path.abspath(__file__), encoding="utf-8").read()
    _declared = set(re.findall(r"^def (test_\w+)", _src, re.M))
    _collected = {n for n in globals() if n.startswith("test_") and callable(globals()[n])}
    if _declared - _collected:
        print(f"  MISSED  {len(_declared - _collected)} test(s) defined below the runner and never "
              f"run: {', '.join(sorted(_declared - _collected))}")
        sys.exit(1)
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try: fn(); print(f"  ok    {name}")
            except AssertionError as e:
                fails.append(name); print(f"  FAIL  {name}: {str(e)[:200]}")
            # **CATCH EVERYTHING, NOT ONLY AssertionError.** A TypeError from a stale call signature
            # escaped this loop and killed the run: `run.sh` printed no failure, the summary line
            # never appeared, and the file had been broken for as long as nobody read stderr. The
            # same hole was found and fixed in Cortex's suite on 2026-09-13; this is the other half.
            except Exception as e:
                fails.append(name)
                print(f"  ERROR {name}: {type(e).__name__}: {str(e)[:200]}")
    print(f"\n{'FAILED' if fails else 'passed'}: {len(fails)} failure(s)")
    sys.exit(1 if fails else 0)
