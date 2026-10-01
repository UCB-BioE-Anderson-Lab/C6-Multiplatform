"""The DNA view draws what it is given, and draws absence as absence.

Three things are checked, each against the failure it exists for:

1. THE VIEW COMPUTES NOTHING (C11 § 7.7). The kernel says "Enforced by: NOTHING" for that rule,
   so it is enforced here, for this view, by reading `views/dna_view.py`'s syntax tree: no
   arithmetic, no counting or rounding builtins, no imports beyond `html` and `urllib.parse`,
   and no file, process or network access. A coordinate nudged with `+ 4` in the view would be a
   second answer to where something is drawn, and this fails on it.

2. ABSENCE LOOKS DIFFERENT (§ 7.5, § 7.6). An unreadable file renders a refusal and no SVG. "No
   features annotated" and "this input cannot carry annotation" are different sentences, and both
   appear above the drawing, where a reader looks first.

3. THE PAYLOAD SCHEMA REFUSES A LIE (§ 7.8). Every payload the producer prints fits
   `dna.drawing`, and a payload that says `drawn` with no drawing, or `unreadable` with one, does
   not.

The payloads come from running `bin/c6-dna`, not from stored JSON, so a test cannot pass against
a payload the producer no longer prints.
"""
import ast
import importlib.util
import json
import os
import subprocess
import sys

import jsonschema

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
VIEW = os.path.join(ROOT, "views", "dna_view.py")
spec = importlib.util.spec_from_file_location("dna_view", VIEW)
view = importlib.util.module_from_spec(spec)
spec.loader.exec_module(view)
SCHEMA = json.load(open(os.path.join(ROOT, "sharables", "dna.drawing.json")))["definition"]
RECORD = json.load(open(os.path.join(ROOT, "sharables", "dna.view.json")))
F = "test/fixtures/dna/"


def produce(*args):
    out = subprocess.run(["node", os.path.join(ROOT, "bin", "c6-dna"), *args], cwd=ROOT,
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


CASES = {
    "circular map": ["--file", F + "pUC19.annotated.gb", "--mark", "MCS=396..452"],
    "no features annotated": ["--file", F + "pUC19.gb"],
    "linear map": ["--file", F + "pUC19.annotated.gb", "--region", "1..1300", "--level", "linear"],
    "sequence": ["--file", F + "pUC19.annotated.gb", "--region", "360..500"],
    "molecule in a plasmid": ["--file", F + "pUC19.annotated.gb", "--region", "375..420"],
    "cut fragment": ["--sequence", "GGTCTCAATGC", "--ext5", "AATT", "--mod5", "phos5", "--ext3", "-TG"],
    "single strand": ["--sequence", "TAATACGACTCACTATAGGG", "--strands", "single"],
    "rna": ["--sequence", "GGGAGAUCUAGC", "--polymer", "rna"],
    "fasta": ["--file", F + "T7promoter.fasta"],
    "unreadable": ["--file", F + "not-genbank.gb"],
    "missing file": ["--file", F + "nothing-here.gb"],
    "bad region": ["--file", F + "pUC19.annotated.gb", "--region", "1..9999"],
}

ARITHMETIC = (ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow)
COMPUTING_BUILTINS = {"sum", "len", "min", "max", "round", "abs", "int", "float", "divmod", "sorted", "range"}
FORBIDDEN_CALLS = {"open", "eval", "exec", "__import__", "compile", "input"}
ALLOWED_IMPORTS = {"html", "urllib.parse"}


def purity_problems(source):
    problems = []
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            mods = [a.name for a in node.names] if isinstance(node, ast.Import) else [node.module]
            problems += [f"line {node.lineno}: imports {m}" for m in mods if m not in ALLOWED_IMPORTS]
        elif isinstance(node, (ast.BinOp, ast.AugAssign)) and isinstance(node.op, ARITHMETIC):
            problems.append(f"line {node.lineno}: arithmetic ({type(node.op).__name__})")
        elif isinstance(node, (ast.BinOp, ast.AugAssign)) and isinstance(node.op, ast.Add):
            sides = [node.left, node.right] if isinstance(node, ast.BinOp) else [node.value]
            if any(isinstance(s, ast.Constant) and isinstance(s.value, (int, float)) for s in sides):
                problems.append(f"line {node.lineno}: adds a number")
        elif isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub) and not isinstance(node.operand, ast.Constant):
            problems.append(f"line {node.lineno}: negates a value")
        elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            if node.func.id in COMPUTING_BUILTINS:
                problems.append(f"line {node.lineno}: calls {node.func.id}()")
            if node.func.id in FORBIDDEN_CALLS:
                problems.append(f"line {node.lineno}: calls {node.func.id}()")
    return problems


def test_view_computes_nothing():
    problems = purity_problems(open(VIEW).read())
    assert not problems, "the view must only draw what it is given:\n  " + "\n  ".join(problems)


def test_the_purity_check_can_fail():
    # A check that has never been seen to fail is not a check. Each of these is one line a
    # well-meaning edit might add to the view.
    for bad in ["x = p['x'] + 4", "w = d['width'] / 2", "n = len(rows)", "import os",
                "data = open('f').read()", "y = -p['y']"]:
        assert purity_problems(bad), f"purity check missed: {bad}"


def test_view_id_is_the_records():
    assert view.VIEW_ID == RECORD["id"], "links on the page would ask for a view that is not this one"


def test_every_payload_fits_the_schema_and_renders():
    for name, args in CASES.items():
        p = produce(*args)
        jsonschema.validate(p, SCHEMA)
        html = view.render({"dna": p})
        assert html.startswith("<!doctype html>"), name


def test_unreadable_is_a_refusal_with_no_drawing():
    for name in ("unreadable", "missing file"):
        html = view.render({"dna": produce(*CASES[name])})
        assert "Could not read this" in html, name
        assert "<svg" not in html, f"{name}: drew something for a file it could not read"


def test_bad_request_says_why_and_draws_nothing():
    html = view.render({"dna": produce(*CASES["bad region"])})
    assert "Cannot draw that" in html and "outside 1..2686" in html and "<svg" not in html


def test_two_kinds_of_featureless_read_differently_and_above_the_drawing():
    none = view.render({"dna": produce(*CASES["no features annotated"])})
    bare = view.render({"dna": produce(*CASES["fasta"])})
    assert "No features annotated" in none and "No features annotated" not in bare
    assert "cannot carry annotation" in bare and "cannot carry annotation" not in none
    for html, phrase in ((none, "No features annotated"), (bare, "cannot carry annotation")):
        assert html.index(phrase) < html.index("<svg"), "the absence must be said before the map"


def test_molecule_draws_what_the_record_says_is_at_each_end():
    html = view.render({"dna": produce(*CASES["cut fragment"])})
    assert ">P</text>" in html, "the 5' phosphate C6 recorded is not drawn"
    assert "end chemistry not stated in this record" in html, "an empty mod must be drawn as not stated"
    assert "4-nt overhang" in html and "2-nt overhang" in html


def test_links_ask_the_producer_again():
    html = view.render({"dna": produce(*CASES["sequence"])})
    assert 'href="?id=dna.view&amp;file=test%2Ffixtures%2Fdna%2FpUC19.annotated.gb&amp;region=' in html
    assert "<script" not in html, "zoom is a link, not a script"


def test_schema_refuses_a_payload_that_lies():
    good = produce(*CASES["circular map"])
    unread = produce(*CASES["unreadable"])
    lies = {
        "drawn, but nothing to draw": {**good, "drawing": None},
        "unreadable, but drawn anyway": {**unread, "drawing": good["drawing"], "molecule": good["molecule"]},
        "unreadable, with no reason": {**unread, "problem": None},
        "a status nobody defined": {**good, "status": "partly"},
    }
    for name, payload in lies.items():
        try:
            jsonschema.validate(payload, SCHEMA)
        except jsonschema.ValidationError:
            continue
        raise AssertionError(f"the schema accepted: {name}")


if __name__ == "__main__":
    tests = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_")]
    failed = 0
    for n, f in tests:
        try:
            f()
            print(f"    ok   {n}")
        except Exception as e:  # report every failure, not only AssertionError
            failed += 1
            print(f"    FAIL {n}: {type(e).__name__}: {e}")
    print(f"  {len(tests) - failed}/{len(tests)} passed")
    sys.exit(1 if failed else 0)
