"""A labsheet carries the part nobody can look up, and each operation's part is its own.

JCA, 2026-09-12, looking at a rendered PCR sheet: *"there are no oligos or recipe in that pcr.
It has like none of the critical info, and is identical to the gel."*

He was right, and the plan was not the problem. `c6-plan` computed the oligo pair, the product
size, the thermocycler program and the full 50 µL recipe for every reaction; `c6-packet` projected
all nine sheets through ONE table — label, from, size, program — and passed the recipe to the
renderer under a key the renderer does not read. So `reaction_block` never fired once, and two
different operations rendered as the same page.

**The protocol is on a cheatsheet; the primer pair is not.** That is the whole rule for what a
labsheet must carry, and it is the rule these tests hold the pipeline to — end to end, from the
construction file on disk, because every layer here was individually correct.

THE SECOND FAILURE IS QUIETER AND WORSE. A protocol module is a function of its inputs, and
calling it with none does not fail — it returns a confident sentence about somebody else's
experiment. `heat_shock_transformation` with no values says *"plate on Amp"* on a sheet about
erythromycin; `plate_reader_fluorescence` opens *"Read 24 cultures"* about six. A default reads
exactly like an answer, so the page cannot show the difference and only the seam can.
"""
import importlib.util, json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
MOD = os.path.join(ROOT, "src", "labplanner", "render", "labpacket-to-xlsx.py")
spec = importlib.util.spec_from_file_location("lp2x", MOD)
lp = importlib.util.module_from_spec(spec); spec.loader.exec_module(lp)

CF = """PCR\tbf029\tbf030\tpJ01\tfrag1
PCR\tbf027\tbf028\tpTRKH3\tbackbone
GoldenGate\tfrag1\tbackbone\tBsaI\tpTEST
Transform\tpTEST\tMach1\tErm\t37\tpTEST_Mach1
"""

OLIGOS = """bf027\tccataGGTCTCaTACTcatgagaattacaacttatatc\t25nm\tSTD
bf028\tcagttGGTCTCtAAGCggagccgggccacctcgacctg\t25nm\tSTD
bf029\tccataGGTCTCaGCTTATTACCGCCTTTGAGTGAGC\t25nm\tSTD
bf030\tcagttGGTCTCtAGTAgtatcacgaggcagaatttcag\t25nm\tSTD
"""


RC = {"A": "T", "C": "G", "G": "C", "T": "A", "a": "t", "c": "g", "g": "c", "t": "a"}
rc = lambda s: "".join(RC[c] for c in reversed(s))

# THE TEMPLATES ARE BUILT FROM THE PRIMERS, so the PCR actually simulates and the planner can
# choose a chemistry from the product size. Without a product size there is no chemistry, no
# mastermix and no recipe — which is a real behaviour, tested separately below, and not the one
# these tests are about.
def _template(fwd_anneal, rev_anneal, filler):
    return fwd_anneal + ("ATGC" * (filler // 4)) + rc(rev_anneal)

PLASMIDS = [
    ("pJ01", _template("ATTACCGCCTTTGAGTGAGC", "gtatcacgaggcagaatttcag".upper(), 1300)),
    ("pTRKH3", _template("catgagaattacaacttatatc".upper(), "ggagccgggccacctcgacctg".upper(), 1600)),
]


INVENTORY = "\n".join([
    ">name\t\tTestBox",
    ">plate_type\tplastic_box",
    "",
    ">>label \tA\tB\tC\tD",
    "1\t10uM bf029\t10uM bf030\t100uM bf027\tpJ01",
    "",
    ">>concentration\tA\tB\tC\tD",
    "1\t10uM\t10uM\t100uM\tminiprep",
])


def _project(with_sequences=True, with_inventory=False):
    d = tempfile.mkdtemp(prefix="c6-packet-test-")
    open(os.path.join(d, "Construction of pTEST.txt"), "w").write(CF)
    open(os.path.join(d, "Lactis_oligos.txt"), "w").write(OLIGOS)
    if with_inventory:
        open(os.path.join(d, "inv.txt"), "w").write(INVENTORY)
    if with_sequences:
        with open(os.path.join(d, "test_sequences.tsv"), "w") as f:
            for n, s in PLASMIDS:
                f.write(f"{n}\t{s}\tplasmid\n")
    return d


def _packet(with_sequences=True, with_inventory=False):
    """The real pipeline, on a throwaway project: construction file -> c6-plan -> c6-packet."""
    d = _project(with_sequences, with_inventory)
    args = ["node", os.path.join(ROOT, "bin", "c6-packet"), d]
    if with_inventory:
        args += ["--inventory", os.path.join(d, "inv.txt")]
    out = subprocess.run(args, capture_output=True, text=True)
    assert out.returncode == 0, out.stderr[:400]
    return json.loads(out.stdout)


PACKET = _packet()
BY_ID = {s["id"]: s for s in PACKET["sheets"]}


def test_the_pcr_sheet_names_its_oligos():
    """The one thing a PCR sheet knows that the pcr cheatsheet cannot."""
    row = BY_ID["pcr"]["samples"][0]
    got = " ".join(str(v) for v in row.values())
    assert "bf029" in got and "bf030" in got, row


def test_the_pcr_sheet_carries_a_recipe_the_renderer_reads():
    """Under `recipe`, which is the key `reaction_block` reads. It was under `mastermix`."""
    r = BY_ID["pcr"].get("recipe")
    assert r and r.get("components"), BY_ID["pcr"].keys()
    names = " ".join(c["name"] for c in r["components"]).lower()
    for want in ("primestar", "buffer", "dntp"):
        assert want in names, names
    assert all(float(c["amount"]) > 0 for c in r["components"]), r["components"]


def test_the_pcr_and_gel_sheets_are_not_the_same_page():
    """They were, exactly — same columns, same values, one of them silently wrong about itself."""
    pcr, gel = BY_ID["pcr"]["samples"], BY_ID["gel"]["samples"]
    assert list(pcr[0].keys()) != list(gel[0].keys()), pcr[0].keys()


def test_a_tube_label_fits_on_a_tube():
    """The product name is not the label. `Pcon-amilGFP-Term` on a cap is not a thing."""
    for sid, sheet in BY_ID.items():
        assert not lp.check_labels(sheet), (sid, lp.check_labels(sheet))


def test_the_goldengate_sheet_names_its_enzyme():
    """A condition, not a material — and so in `NON_DNA`, which nothing downstream had read."""
    got = " ".join(str(v) for v in BY_ID["goldengate"]["samples"][0].values())
    assert "BsaI" in got, got


def test_every_transcluded_module_is_given_its_values():
    """Otherwise it prints its defaults, which are a sentence about no experiment at all."""
    missing = []
    for sid, sheet in BY_ID.items():
        mod = sheet.get("metadata", {}).get("module")
        if mod and not (sheet.get("protocol_values") or {}).get(mod):
            missing.append(f"{sid} -> {mod}")
    assert not missing, missing


def test_rendering_a_module_with_no_values_is_reported():
    """The enforcer for the rule above: the seam says so, because the page cannot."""
    lp.WARNINGS.clear(); lp._proto_cache.clear()
    lp.protocol_text(["heat_shock_transformation"], {})
    assert any("heat_shock_transformation" in w for w in lp.WARNINGS), lp.WARNINGS
    lp.WARNINGS.clear(); lp._proto_cache.clear()
    lp.protocol_text(["heat_shock_transformation"],
                     {"heat_shock_transformation": {"antibiotics": "Erm"}})
    assert not lp.WARNINGS, lp.WARNINGS


def test_the_transformation_module_is_told_the_real_antibiotic():
    """It defaults to Amp. The construction file says Erm, and the page said Amp."""
    v = BY_ID["transform"]["protocol_values"]["heat_shock_transformation"]
    assert str(v.get("antibiotics", "")).lower() == "erm", v
    assert v.get("plasmid") == "pTEST", v


def test_a_pcr_that_did_not_simulate_claims_no_chemistry():
    """The recipe follows the chemistry and the chemistry follows the product size.

    With no sequences to simulate against, the planner declines to choose — and the projection
    used to fall back to a fixed `primestar_pcr`, so the sheet named a chemistry nobody had
    picked, printed no recipe under it, and said nothing about either.
    """
    pcr = {s["id"]: s for s in _packet(with_sequences=False)["sheets"]}["pcr"]
    assert not pcr["metadata"].get("module"), pcr["metadata"]
    assert any("No reaction is written" in n for n in pcr["notes"]), pcr["notes"]


def test_every_material_says_where_it_comes_from():
    """JCA, 2026-09-12: *"It has no source info."*

    Two kinds of answer and they are not interchangeable. A thing made by an earlier step of this
    plan is fetched from the last session's tubes; a thing nothing here makes has to be in the
    freezer with a box and a well. `choosePrimerSource.js` and `chooseTemplateSample.js` were both
    EMPTY MODULES — names describing work that had been designed and never written, which is how
    the sheet came to have neither.
    """
    inv = {s["id"]: s for s in _packet(with_inventory=True)["sheets"]}
    pcr = {r["what"]: r for r in inv["pcr"]["inputs"]}
    assert pcr["bf029"]["where"].endswith("A1"), pcr["bf029"]
    assert "100" in pcr["bf027"]["note"] and "dilute" in pcr["bf027"]["note"], pcr["bf027"]
    assert pcr["bf028"]["where"] == "NOT IN THE INVENTORY", pcr["bf028"]
    assert pcr["pJ01"]["where"].endswith("D1"), pcr["pJ01"]
    # Made here, not fetched. Sending somebody to search a box for a PCR product that will not
    # exist until next session is worse than saying nothing, because they will go and look.
    gg = {r["what"]: r for r in inv["goldengate"]["inputs"]}
    assert gg["frag1"]["where"] == "made in this experiment", gg["frag1"]


def test_no_inventory_is_not_an_empty_freezer():
    """"We have not looked" and "it is not there" must never print the same thing."""
    pcr = {s["id"]: s for s in _packet()["sheets"]}["pcr"]
    wheres = {r["where"] for r in pcr["inputs"]}
    assert wheres == {"no inventory was read"}, wheres


def test_a_gel_is_not_told_to_fetch_the_pcr_s_oligos():
    """`injectGelJobs` pushes the very same job objects, so a gel's samples carry the PCR's
    oligos and template. True of the reaction, false of the gel, which consumes a tube of PCR
    product and is told so by its own Samples column."""
    inv = {s["id"]: s for s in _packet(with_inventory=True)["sheets"]}
    assert inv["gel"]["inputs"] == [], inv["gel"]["inputs"]
    assert inv["zymo"]["inputs"] == [], inv["zymo"]["inputs"]


if __name__ == "__main__":
    fails = []
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try: fn(); print(f"  ok    {name}")
            except AssertionError as e:
                fails.append(name); print(f"  FAIL  {name}: {str(e)[:300]}")
    print(f"\n{'FAILED' if fails else 'passed'}: {len(fails)} failure(s)")
    sys.exit(1 if fails else 0)
