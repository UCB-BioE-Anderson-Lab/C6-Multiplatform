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
import sys
import re
import os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
LABPLAN = os.path.join(ROOT, "bin", "c6-labplan")

# BOTH PIECES ARE AMPLIFIED, AND THE PROJECT CARRIES THEIR SEQUENCES.
#
# The backbone used to arrive from nowhere and no sequence file existed, so `simCF` — which
# simulates a construction file as ONE unit — could not finish, and neither PCR got a product
# length. That was invisible until 2026-09-16, when JCA read a sheet whose program column said
# "follows from the size" and ruled that such a sheet must not be written: *"it should be resolved
# somehow rather than return labsheets."* `c6-labplan` now refuses, and this fixture was refused
# with it — correctly, and for a reason that has nothing to do with what these tests are about.
#
# So the fixture carries sequences. The subject here is the CHARACTERIZATION GATE, and a fixture
# that cannot compile for an unrelated reason tests the gate by accident.
CF = "PCR\tbo1\tbo2\tpSRC\tfrag1\nPCR\tbo3\tbo4\tpSRC2\tbackbone\n" \
     "GoldenGate\tfrag1\tbackbone\tBsaI\tpTEST\n" \
     "Transform\tpTEST\tMach1\tErm\t37\tpTEST_Mach1\n"
SEQUENCES = "# Synthetic templates so the gate fixture's PCRs simulate and get a program.\npSRC\tCTATCACACGGGTTGCGCGTGGGTTCGCCCCTAAGTAGGCAATTGATAAGGATAGTATATAATGCAGACAAAGGACTCTTACCAGGATAGAGAAGGGACCGGAGGCGCCGATATCGGACGTTATTCTGTGGAGTTAGTCACGACCTAGGGACGGTACGTCGAGATAACCAGGCTTACAGGAGCTATACCATTATAGTTGTTATCTAACAGACCAATTCCAGCATAACCTCGGAGCGCCGCCCTCACGGGAGTCGCGCGTCAGGTATTACGTATGCTGCATAGTGGCCCCAGGAGGACTGCTTCCCCGCCAAATGTCGATTGCATCAGCCTCGGGCTGTTTACTCCGAACCGGGTTCGCTATTCTGTAGACATGCAGAGTCGGATGTCAGCGCGATCCCGGATGATAAAACCTCATGTTACTGTTCCCGGGCCCGGCCGGCGTGACGGTCGTTGTAAGGACACTCAAATACTGCCAAATGAGCAAGGTCGCGTATATAATCAGAACCTCCGGTGCGACGTTCATAACAGAATGTTCCTTCCGTATAGTGCCTCCCAAGGTCTTTTTGTTCTACTAGGGCCTGACTACCGGACATAGACCGCTTAAAGCTGGGGCACGAACTATCATTAGGTGAATTGATTATTAACCAGGACCTGGAGTGCTCGTTAAGTGGCAGTTTAGGGCGGGCGCGAGAATAGACCAGGAACAGATATTATGCCCGACTTGCCACACCACCTTATGGTCGCCGGATACCGCAATATGTCGAAAGGTCAAGCTCTTAGGATGATACAGGGTGTCGCACGTAAGATAGCCATAACAGGGGTCATCCTCGGCATTGGTGTCTGGTACCCAAAGATGTTTTTGCAAGTCTCGTTATCATTTGCTCATAAACGTCCATGAGAAGGTGCTGAGCCCAGGCGGGCCGCCTAGTCCACCGCATAGGATTAATTCAATATGCCGACGACACTCCCCAAAATTTAGACAATTGGTGTCCGCCTGTGAAATCACTGCCCTTGACGTCTCGCCGGTGAGACGCTCCCGATGATGTTCAGCCCGCCGGTTGCTCTCTACCTTTCGTGCCCACTGTAGCGTCAATGCAGAGTCCGATTAATGGAGAGCTCGGGAGTGTTAATATCAACTAATCCTATCAGCCGTAGAAAGCTCGAGCGGTGGTGAATATCGGGGCGGAGCAACCAGACAAAGCCAAGCCGTAGCTACTCACGAGTTAGGTTAGGTACGCGGGGGAGCAACATGGGCACTACCAAACTACCGTTGACCCTGTACCACACATGGTCTAGTTAGTACGGTGAGCATGGTATCTGACTCCTTACGGCATTGTCGGGCTGAGCTGCGCGGTTAGTATGCCCTAGCTATTTTCACCTATCAACAAACGGACGTGAAGATCAAACGGCCAATCTTCGAACGGCACTTCTAAGCAACCTCTGACACAGACTTTAAATATTCTATAGGGCCTTCTCGGTGTGGTGCCGATGATGGGCTCGTGGTACCTAACAGCCTGTGCGTGACCGGACCCAGCTATCTATCTATGTGTAGAGATACTATTGTAGAAAGATCGACCACCTCTAAAAGTACTCGCGCTCCCGTCCGTCATCACCGCCGGCCGCGTAGCGTGGATGGCTTGCCGCCACTAAAGTCATCTCATCCTGCGGGTCAGACATCATCATTAGATACGGCAGAGCACACTCTATATTAAAAAACAGTGTCCCCACAGAGCAGCGGTCAAGCAGTTCACACAAAACATCCTTGGCC\tplasmid\t\npSRC2\tTGAATTAAATCATAGATGGATACTAACCAAGACATTGTAAGCATGTCCAGTCGGTTTCGCAGGCCACATGTGTCCTACGAGACACAGCACTCCGCATGCGTCGTTTGTGATTCGAGGAGGTTCCCTGAGCATACGTAGACCTAACTAAGCACGTCTGTCCTCAGCTGGCAGTTAGGACCACCCGATAACGACGTGCTCGCATTGCCAACTCCGTTACCCGGAGGGAATAGTATTGAAATGGATCTCCGGGTTTACTCATGATAGTCCGCAGCTCTTCCCTGAGGTTAATTAAACTCATGATCACTAGCAGCCATCGCTACGCATAAAGAGCAGCAGTCTCCCCCATGACACTCAGCCTACTATCAAAGTACGTGGCTAAATTATTCCTAAGGCACATTCAAATTAGTTCCGCTCCAGATTGAAAGTTGTCGCATTGGTAACGGTGGGTTATTCTGTCCGTATGAGTCAGTTCGAGCGACGAGATACAACGGACCCCCTAGATCTCTATTTCGGTCTTACCCGTCCAATGCCTGGAATCTGCTACATTCCCTGAGGGGCGAGAAATGTCATATCAACCTTTCGATAGCTTACGCAAACCATGTCGTGTAGATACTACAACATGTAGCTATGCAGAATCTACGATACTGTATGCGCAGCCTAAGAAGTCGGTGATGGGAGATTTAGTGGCCTCCAATTTAGGACAGCGGGCTTCGTTTATGTATCCTTGTTTATGACTCGCTGTGCCGAAAACGGACTGTGGCCGTGCATCAACGTGGGGAATGTGTAGATGATTAAAGGATCTGGGTCAGTTATGTGCGCGGTCTAATAGAATAAATCTTCCAATCAACGTACGGGGTTATGTAAAGCGATATTACCCACACTCGGGGCCGATATAGATTGCTCGCGCATAGGACTGGCCCGTCAGTTTTACATTTTACGGAAATCTCGGCCTCAGGGGCAGGCTTCATAAGAGTCCACAGGTACATACGACGCACGTCATACTGCTTCATGCCCTCTCTGGGTGATCGTTTATTGAAACCTTACTAAGAGGATGAGGAGAGCAGGACTGCACTCTTTTTTTCGGATGGTGAAGGGTGGCACTCCGGGAAGTTTATGCGTTATGATCCGGAAGTGTACGTCATTAGTCCGCTACATAAATGACAGACTTTTGCACGGCATCCCCCTCAGCAGACCGGGAATCCGTTTGTCCAGGCTTTAGGTCACCAGAACGTACCATCGAGCATGGAGAAAGTTTTACCGGCCTAAGCCGCTCTCACATTCGGTGCATCAAAGTTCAATGTACGTCTGACCGGTCGACCGTTGGCTCCAATGTGAACCCGCGTTTGCCGGGGGGCTGCCGGCTCCAGATAGGAATAACTGCACCGTTGATGATTTAATCATTGAACGATTCCTTATGCTGTGACACAGGGAAGGATCTCTTGCGCACAAGGACATTAGGTCCCAATCATCTTGGAAAACGAAAAGGTTGATAGGTGGTATCCTAATATGCGTGGCCCTGGAATTATCGCGACGAGCCCGCCTTGCTAGAGTTTATGTCCTAAAATAGCGACCATCCTGAGGCCCTCTGCTGTCAAAATCACCCCTTGTACTAAATCCTATATCCGCCACTTTACATGCCTTTACGTCTTGGACGGTGATTGAAGATCTACACCGGACATACTCGAAATTAGTCCTTCAGGCAACGTATCACCCAAGCTAGCTCGATCTCTTATTATGATTGGAAGTCAAAGCCTTAGAGGACGTCCACGGCTAAGTATTAATTTTGAGGGACCCATACTAATGGCCGAGCGGCCGAACTGCTAGAAACTCTTCTACTTTGACGCAGTATCCTTGTCACACTTCAGATCGATGCCCGAGCTAGCTTTGGGGGAAGGATAGCGACCTCGGTGTGCGGTTGTGATATGCGGAAGCTTTTCTGAGCCCAAATGAAGGGGGGTCGTGGCGAATTAATCTCGCGACTCGCGCTACACCACCATGCGCGAAAGCGAGACGGAGAGCTCAGGTAATATGAGCAATCTCCGCTTCTGCGGCCCACTAGGTACTTCAG\tplasmid\t\n"
OLIGOS = 'bo1\tccataGGTCTCaGCTTTTCCCCGCCAAATGTCGATTGC\t25nm\tSTD\nbo2\tcagttGGTCTCtAGTACCTATAGAATATTTAAAGTCTG\t25nm\tSTD\nbo3\tccataGGTCTCaTACTTCACTAGCAGCCATCGCTACGC\t25nm\tSTD\nbo4\tcagttGGTCTCtAAGCGTGGACGTCCTCTAAGGCTTTG\t25nm\tSTD\n'
CHAR = "Retransform\tpTEST\thost=L.lactis antibiotic=Erm\tpTEST_lactis\n" \
       "Pick\tpTEST_lactis\tn=4\tpTEST_clones\n" \
       "Assay\tpTEST_clones\tprotocol=plate_reader_fluorescence\tresult\n"


def _dir(characterize=False):
    d = tempfile.mkdtemp(prefix="c6-gate-")
    open(os.path.join(d, "Construction of pTEST.txt"), "w").write(CF)
    open(os.path.join(d, "gate_sequences.tsv"), "w").write(SEQUENCES)
    open(os.path.join(d, "gate_oligos.txt"), "w").write(OLIGOS)
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
    # Seven sessions, not ten: the sequence fits the plan rather than being the default. The
    # experiment ends at the verified plasmid, so nothing after the sequence analysis appears.
    assert "8. Sequence analysis" in r.stderr, r.stderr[:1200]
    assert "Electroporation" not in r.stderr, r.stderr[:1200]


def test_with_a_characterization_file_it_compiles_the_whole_nine():
    r, out = _run(_dir(characterize=True))
    assert r.returncode == 0, r.stderr[:600]
    assert os.path.exists(out), r.stderr[:600]
    for n in ("1. Antibiotic stocks", "2. Oligo dilutions", "3. PCR",
              "7. Miniprep and sequencing", "9. Electroporation", "11. Assay"):
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
            # CATCH EVERYTHING, NOT ONLY AssertionError. A KeyError raised by one test used to
            # escape this loop, so every test after it never ran AND the summary line never
            # printed — leaving output that greps as clean. One renamed field hid a whole file.
            try: fn(); print(f"  ok    {name}")
            except AssertionError as e:
                fails.append(name); print(f"  FAIL  {name}: {str(e)[:300]}")
            except Exception as e:
                fails.append(name)
                print(f"  ERROR {name}: {type(e).__name__}: {str(e)[:300]}")
    print(f"\n{'FAILED' if fails else 'passed'}: {len(fails)} failure(s)")
    sys.exit(1 if fails else 0)
