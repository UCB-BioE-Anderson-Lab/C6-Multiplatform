"""Defining the characterization sequence is a conversation; compiling it is not.

JCA, 2026-09-12: *"you pass it the construction and characterization files and inventory, and it
automates the rest. You would work with the user to define the characterization sequence, lock
that down in a file, then compile."*

**Those two halves are different kinds of work and the gate is where they meet.** What the plasmid
is FOR — which host, which antibiotic, which controls, which reporter, read at what wavelengths —
is not something a compiler may invent, and its output is a file somebody can read and argue with.
Compiling that file into labsheets is deterministic and asks nobody anything.

So a missing characterization file is not a missing input. It is a conversation that has not
happened, and `c6-labplan` stops rather than emitting a packet that ends at the transformation and
looks complete.
"""
import os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
LABPLAN = os.path.join(ROOT, "bin", "c6-labplan")

CF = "PCR\tbo1\tbo2\tpSRC\tfrag1\nGoldenGate\tfrag1\tbackbone\tBsaI\tpTEST\n" \
     "Transform\tpTEST\tMach1\tErm\t37\tpTEST_Mach1\n"
CHAR = "Retransform\tpTEST\thost=L.lactis antibiotic=Erm\tpTEST_lactis\n" \
       "Pick\tpTEST_lactis\tn=4\tpTEST_clones\n" \
       "Assay\tpTEST_clones\tprotocol=plate_reader_fluorescence\tresult\n"


def _dir(characterize=False):
    d = tempfile.mkdtemp(prefix="c6-gate-")
    open(os.path.join(d, "Construction of pTEST.txt"), "w").write(CF)
    if characterize:
        open(os.path.join(d, "Characterization of pTEST.txt"), "w").write(CHAR)
    return d


def _run(d, *extra):
    out = os.path.join(d, "out.xlsx")
    r = subprocess.run([LABPLAN, d, "--out", out, "--collector", "x@example.edu", *extra],
                       capture_output=True, text=True)
    return r, out


def test_it_stops_when_nobody_has_said_what_the_plasmid_is_for():
    r, out = _run(_dir())
    assert r.returncode == 3, r.returncode
    assert "no characterization file for: pTEST" in r.stderr, r.stderr[:400]
    assert not os.path.exists(out), "it wrote a workbook anyway"


def test_it_says_what_to_write_and_where():
    """A refusal that does not say what would satisfy it is an error message, not a gate."""
    r, _ = _run(_dir())
    assert "Characterization of pTEST.txt" in r.stderr, r.stderr[:400]
    assert "retransform" in r.stderr and "culture" in r.stderr, r.stderr[:400]


def test_clone_only_is_how_you_say_the_experiment_really_ends_there():
    r, out = _run(_dir(), "--clone-only")
    assert r.returncode == 0, r.stderr[:600]
    assert os.path.exists(out), r.stderr[:600]
    # Six sessions, not nine: the sequence fits the plan rather than being the default.
    assert "6. Sequence analysis" in r.stderr, r.stderr[:900]
    assert "Electroporation" not in r.stderr, r.stderr[:900]


def test_with_a_characterization_file_it_compiles_the_whole_nine():
    r, out = _run(_dir(characterize=True))
    assert r.returncode == 0, r.stderr[:600]
    assert os.path.exists(out), r.stderr[:600]
    for n in ("1. PCR", "5. Miniprep and sequencing", "7. Electroporation", "9. Assay"):
        assert n in r.stderr, (n, r.stderr[:1200])


def test_it_lists_the_decisions_it_would_not_make():
    """A labsheet showing a hole is right; a person reading nine sheets to find the holes is not."""
    r, _ = _run(_dir(characterize=True))
    assert "decision(s) this compiler will not make for you" in r.stderr, r.stderr[:1200]
    assert "which oligo to sequence with" in r.stderr, r.stderr[:1200]


def test_a_directory_with_no_construction_file_is_refused_differently():
    """Not the same failure: nothing has been designed, so there is nothing to characterize."""
    r, _ = _run(tempfile.mkdtemp(prefix="c6-gate-empty-"))
    assert r.returncode == 2, r.returncode
    assert "no construction file" in r.stderr, r.stderr[:400]


if __name__ == "__main__":
    fails = []
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try: fn(); print(f"  ok    {name}")
            except AssertionError as e:
                fails.append(name); print(f"  FAIL  {name}: {str(e)[:300]}")
    print(f"\n{'FAILED' if fails else 'passed'}: {len(fails)} failure(s)")
    sys.exit(1 if fails else 0)
