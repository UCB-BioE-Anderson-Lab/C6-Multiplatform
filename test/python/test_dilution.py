"""Dilution is a structured operation, and the two shapes a workbook writes it in mean the same.

JCA, 2026-09-10: *"Dilution should be one of the standard types defined in labsheet, with oligo
names and target concentrations. The compiler would look up the description and insert it. It
should be presented as the calculated type — so student puts in the nmol number, and it says
conc to make."*

The failure being guarded is the one that produced the complaint: a Dilution tab rendering as a
list of prose, because the converter only recognised one of the two shapes and silently kept the
other as text. Both shapes are tested here from literal rows, so neither can quietly stop
working.
"""
import importlib.util, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MOD = os.path.join(HERE, "..", "..", "src", "labplanner", "render", "xlsx-to-labpacket.py")
spec = importlib.util.spec_from_file_location("x2lp", MOD)
x2lp = importlib.util.module_from_spec(spec); spec.loader.exec_module(x2lp)

# SLIP5's shape: a heading naming the target, then `oligo <name> <description>` rows.
PROSE = [
    ["Dilution for Experiment SLIP5"],
    ["Resuspend and make 10 uM dilutions of:"],
    ["oligo", "oGho23", "Removal of BsaI site from end of R6K"],
    ["oligo", "oGho24", "Silent removal of BsmBI site at end of repE"],
]

# SLIP4-7's shape: a conditional walk with a table at each branch, including a header row whose
# first cell is blank — the row that used to be read as an oligo called "nmol".
TABLE = [
    ["Dilution for Experiment SLIP4-7"],
    ["Check for working stocks"],
    ["You will need 10 uM stocks; look for the samples below:"],
    ["", "Construct", "Box", "Well", "Concentration"],
    ["", "oGho17", "SLIP4_reagents", "D2", "10 uM"],
    ["", "oGho18", "SLIP4_reagents", "D3", "10 uM"],
    ["Check for IDT stocks"],
    ["See if these 100 uM stocks exist and contain liquid:"],
    ["", "nmol", "ddH2O to Add", "Box", "Well", "Final Concentration"],
]


def test_prose_shape():
    d = x2lp.dilution_of(PROSE, {})
    assert d["target_uM"] == 10.0, d
    assert [t["oligo"] for t in d["targets"]] == ["oGho23", "oGho24"]
    assert d["targets"][0]["description"].startswith("Removal of BsaI")


def test_table_shape_with_box_and_well():
    d = x2lp.dilution_of(TABLE, {})
    assert [t["oligo"] for t in d["targets"]] == ["oGho17", "oGho18"], d["targets"]
    assert d["targets"][0]["box"] == "SLIP4_reagents"
    assert d["targets"][0]["well"] == "D2"


def test_a_header_row_is_never_an_oligo():
    """`| nmol | ddH2O to Add | Box | Well |` produced an oligo named `nmol` whose box was
    `ddH2O to Add`. It would have printed on the page, and nobody reading one tab would see it."""
    d = x2lp.dilution_of(TABLE, {})
    names = [t["oligo"] for t in d["targets"]]
    assert "nmol" not in names, names
    assert not any(t["box"] == "ddH2O to Add" for t in d["targets"])


def test_target_and_stock_are_told_apart():
    """10 uM is what we are MAKING; 100 uM is what we make it FROM. Swapping them would put
    a tenfold error into every volume on the page."""
    d = x2lp.dilution_of(TABLE, {})
    assert (d["target_uM"], d["stock_uM"]) == (10.0, 100.0), d


def test_the_compiler_inserts_a_description_it_was_not_given():
    d = x2lp.dilution_of(TABLE, {"oGho17": "Forward p15A without B"})
    assert d["targets"][0]["description"] == "Forward p15A without B"


def test_a_tab_naming_no_oligos_returns_nothing_rather_than_an_empty_plan():
    """An empty dilution renders as a page with two empty tables — a plan that looks made and
    says nothing. None makes the caller keep the prose and say so."""
    assert x2lp.dilution_of([["Dilution for Experiment X"], ["Nothing to do"]], {}) is None


if __name__ == "__main__":
    fails = []
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn(); print(f"  ok    {name}")
            except AssertionError as e:
                fails.append(name); print(f"  FAIL  {name}: {str(e)[:200]}")
    print(f"\n{'FAILED' if fails else 'passed'}: {len(fails)} failure(s)")
    sys.exit(1 if fails else 0)
