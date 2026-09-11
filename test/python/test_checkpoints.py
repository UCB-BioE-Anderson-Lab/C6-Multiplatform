"""Which way each checkpoint points, and which steps have none.

Two rules here are ABSENCES, and an absence is what a later edit restores by accident:

  * miniprep has no checkpoint — its product is a row in the workbook, not a thing to send
  * sequencing is an ANALYSIS checkpoint — the student is given data and sends back a reading

JCA, 2026-09-10: *"Maybe I just forward them the data. Let's not entangle the sequencing process
with the checkpoint thing. The students will get data via email and they will do their analysis
and email it with the routing tag."* and *"Miniprep has no checkpoint. Samples just get logged
on the sheet. When the full experiment is over, they send you back that sheet."*
"""
import importlib.util, json, os, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
MOD = os.path.join(HERE, "..", "..", "src", "labplanner", "render", "add-checkpoints.py")
spec = importlib.util.spec_from_file_location("addcp", MOD)
cp = importlib.util.module_from_spec(spec); spec.loader.exec_module(cp)

FORM = "https://docs.google.com/forms/d/e/1FAI/viewform"
COLLECTOR = "collector@example.edu"


def sheet(sid, op, link=False, extra=None):
    s = {"id": sid, "operation": op, "title": f"{op} for Experiment X", "blocks": []}
    if link: s["blocks"].append({"kind": "table", "rows": [[FORM]]})
    if extra: s.update(extra)
    return s


def build(sheets):
    src = tempfile.mktemp(suffix=".json"); out = tempfile.mktemp(suffix=".json")
    json.dump({"id": "X", "metadata": {"experiment": "X"}, "sheets": sheets}, open(src, "w"))
    cp.main(["add-checkpoints", src, out, "--collector", COLLECTOR, "--project", "proj"])
    return json.load(open(out))


def test_a_gel_is_what_the_student_made():
    p = build([sheet("gel", "Gel", link=True)])
    c = p["sheets"][0]["checkpoint"]
    assert c["type"] == "checkpoint.gel"
    assert "arrives" not in c, "nothing is handed to the student for a gel"


def test_sequencing_gets_an_analysis_checkpoint_with_no_marker():
    """The marker is a 'submit it here' link, and the sequencing tabs' link pointed at the
    folder where the DATA appears. Nobody was asked for a reading of it, so SLIP4-8 and SLIP5
    got no checkpoint at all under the marker rule."""
    p = build([sheet("sequencing", "Sanger Sequencing")])
    c = p["sheets"][0]["checkpoint"]
    assert c["type"] == "checkpoint.analysis", c


def test_an_analysis_checkpoint_says_where_the_data_comes_from():
    """It is the one checkpoint whose raw material the student did not make. Without this the
    instruction is one they wait on rather than act on."""
    p = build([sheet("sequencing", "Sanger Sequencing")])
    c = p["sheets"][0]["checkpoint"]
    assert "email" in c["arrives"], c
    assert "which clones are correct" in c["expects"]


def test_every_checkpoint_routes_the_same_way():
    """JCA: 'they will do their analysis and email it with the routing tag.' There is no
    checkpoint the student cannot see a routing code for, so no worksheet can omit one."""
    p = build([sheet("gel", "Gel", link=True), sheet("sequencing", "Sequencing"),
               sheet("assay", "Assay", link=True)])
    for sh in p["sheets"]:
        c = sh.get("checkpoint")
        if c: assert c.get("code"), sh["id"]


def test_only_one_sequencing_checkpoint_per_packet():
    p = build([sheet("sequencing", "Sequencing", link=True),
               sheet("seq_analysis", "Sequencing Analysis")])
    an = [s for s in p["sheets"] if s.get("checkpoint", {}).get("type") == "checkpoint.analysis"]
    assert len(an) == 1, [s["id"] for s in an]


def test_a_sheet_merely_called_analysis_is_not_the_sequencing_analysis():
    """SLIP5's `Analysis` tab is a note about confirming a clone's FUNCTION later. Matching
    'analys' alone hosted the sequencing checkpoint on it."""
    p = build([sheet("sequencing", "Sequencing"), sheet("analysis", "Functional Analysis")])
    host = [s["id"] for s in p["sheets"] if s.get("checkpoint")]
    assert host == ["sequencing"], host


def test_miniprep_gets_no_checkpoint():
    p = build([sheet("miniprep", "Miniprep"), sheet("gel", "Gel", link=True)])
    mp = next(s for s in p["sheets"] if s["id"] == "miniprep")
    assert "checkpoint" not in mp, mp.get("checkpoint")


def test_the_packet_closes_with_the_workbook_coming_back():
    p = build([sheet("miniprep", "Miniprep")])
    c = p["closing"]
    assert c["type"] == "return.workbook"
    assert c["to"] == COLLECTOR
    assert "inventory" in c["why"]


def test_the_collector_is_never_defaulted():
    src = tempfile.mktemp(suffix=".json"); out = tempfile.mktemp(suffix=".json")
    json.dump({"id": "X", "sheets": []}, open(src, "w"))
    try:
        cp.main(["add-checkpoints", src, out])
        raise AssertionError("ran with no --collector")
    except SystemExit as e:
        assert "collector" in str(e)


if __name__ == "__main__":
    import io, contextlib
    fails = []
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                with contextlib.redirect_stdout(io.StringIO()): fn()
                print(f"  ok    {name}")
            except AssertionError as e:
                fails.append(name); print(f"  FAIL  {name}: {str(e)[:200]}")
    print(f"\n{'FAILED' if fails else 'passed'}: {len(fails)} failure(s)")
    sys.exit(1 if fails else 0)
