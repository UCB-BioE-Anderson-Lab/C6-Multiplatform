"""Turn a labsheet's existing data-return step into a routed checkpoint.

    add-checkpoints.py <packet.json> <out.json> --collector <address>
                       [--project <name>] [--prefix <slug>]

**THE CHECKPOINTS ALREADY EXIST. NOTHING HERE INVENTS ONE.** Every labsheet that expects
something back from the bench already says so, and says it in the same way: a step whose
instruction is *"submit this at <a Google Forms / Drive / Sheets URL>"*. That instruction is the
checkpoint — it names the evidence, the step it verifies, and when it is due by where it sits in
the packet. JCA, 2026-09-10: *"Those are the old checkpoints. The content of the checkpoints
should be the same, but the instructions will change on how to deliver them. We aren't doing
Google services — we are telling them now to email the pic to jca-cortex with a
command/routing slug phrase."*

So this is a **change of delivery route, not a change of content**, and the URL is the marker
that finds them. Guessing which steps "ought to" have a checkpoint would invent obligations the
labsheet never had; reading the URLs finds exactly the ones it did.

**THE COLLECTOR ADDRESS IS NEVER DEFAULTED.** JCA, 2026-09-10: *"That email should not be
hard-coded, instead you should have a global cortex variable, like principal, that is your email
address."* Same rule as both renderers: no `--collector`, no output. A wrong address on a
printed labsheet sends a semester of data somewhere nobody is reading.

**WHERE A LINK IS FOUND BUT THE OPERATION IS UNKNOWN**, the checkpoint is typed
`checkpoint.evidence` and its `expects` is taken from the labsheet's own wording rather than
from the table below. A made-up description of what a student should send is worse than a vague
one, because it looks authoritative and is not checkable against anything.
"""
import json, re, sys

GOOGLE = re.compile(r"https?://(?:docs|drive|forms)\.google\.com/\S+|https?://forms\.gle/\S+", re.I)

# What each operation asks the bench for. Keyed on the first word of the tab's operation, which
# is what the labsheet itself calls the step.
KINDS = {
    "gel":          ("checkpoint.gel", "the gel image",
                     "a photo of the gel, the lane labels, and your reading of it"),
    "pick":         ("checkpoint.plate", "the plate photos",
                     "a photo of each plate, and the colony counts"),
    "pick2":        ("checkpoint.plate", "the plate photos",
                     "a photo of each plate, and the colony counts"),
    "transform":    ("checkpoint.plate", "the plate photos",
                     "a photo of each plate, and the colony counts"),
    "transform1":   ("checkpoint.plate", "the plate photos",
                     "a photo of each plate, and the colony counts"),
    "transform2":   ("checkpoint.plate", "the plate photos",
                     "a photo of each plate, and the colony counts"),
    "sanger":       ("checkpoint.sequencing", "the sequencing files",
                     "the .ab1 or .seq files, and which construct each belongs to"),
    "sequencing":   ("checkpoint.sequencing", "the sequencing files",
                     "the .ab1 or .seq files, and which construct each belongs to"),
    "seq":          ("checkpoint.sequencing", "your read of the sequencing",
                     "which clones are correct, and what the wrong ones turned out to be"),
    "assay":        ("checkpoint.counts", "the filled-in table",
                     "one row per sample/replicate/antibiotic, with Green, Red and White counts"),
    "replicate":    ("checkpoint.plate", "the plate photos",
                     "a photo of each plate, and the colony counts"),
    "miniprep":     ("checkpoint.yield", "the concentrations",
                     "the nanodrop reading for each miniprep, and which construct each is"),
}

def slug(*parts):
    s = "_".join(str(p) for p in parts if p)
    return re.sub(r"_+", "_", re.sub(r"[^a-z0-9]+", "_", s.lower())).strip("_")

def _has_link(block):
    return bool(GOOGLE.search(json.dumps(block)))

def _wording(sheet):
    """What this labsheet says it wants back, in its own words — the sentence before the URL."""
    best = None
    for b in sheet.get("blocks", []):
        for row in ([b["text"]] if "text" in b else [c for r in b.get("rows", []) for c in r]):
            t = str(row).strip()
            if not t or GOOGLE.search(t): continue
            if re.search(r"\b(fill|submit|upload|photo|picture|image|count|copy|paste|table|report)\b", t, re.I):
                best = t
    return best

def checkpoint_for(sheet, prefix):
    if not any(_has_link(b) for b in sheet.get("blocks", [])): return None
    op = (sheet.get("operation") or sheet.get("id") or "").strip().lower()
    key = op if op in KINDS else op.split()[0] if op.split() and op.split()[0] in KINDS else None
    if key:
        kind, delivers, expects = KINDS[key]
    else:
        # Honest gap, not a guess. The labsheet's own sentence is the only trustworthy source.
        kind, delivers = "checkpoint.evidence", "what this step produced"
        expects = _wording(sheet) or "what this step produced — the labsheet does not say more precisely"
    return {"type": kind, "code": slug(prefix, sheet.get("id")),
            "verifies": sheet.get("operation") or sheet.get("id"),
            "delivers": delivers, "expects": expects}

def reroute(sheet, cp, collector):
    """Replace the Google delivery instruction with the email route. Everything else stays."""
    kept, removed, dropped = [], 0, []
    for b in sheet.get("blocks", []):
        if _has_link(b):
            removed += 1
            # SAY WHAT WENT. A block is dropped whole, so any prose sitting beside the URL goes
            # with it. Usually that prose is *about* the Google folder and should go; sometimes
            # it is a real instruction that merely shared a cell block. Printing it is the
            # difference between a decision and a silent loss.
            for row in ([b["text"]] if "text" in b else [c for r in b.get("rows", []) for c in r]):
                t = str(row).strip()
                if t and not GOOGLE.search(t): dropped.append(t)
            continue
        kept.append(b)
    # NO PROSE REPLACEMENT. The first version appended "Send the gel image to <address> with
    # the line cortex::… in the message", which read fine in the JSON and printed TWICE on the
    # page — once here and once in the renderers' CHECKPOINT box, in different words. Two
    # instructions for one action is how a student ends up doing neither. The `checkpoint`
    # object is the single home for it; the renderers draw it.
    sheet["blocks"] = kept
    for t in dropped:
        print(f"        dropped with the link: {t[:88]}")
    return removed

def main(argv):
    src, out = argv[1], argv[2]
    collector = prefix = project = None
    for i, a in enumerate(argv):
        if a == "--collector" and i + 1 < len(argv): collector = argv[i + 1]
        if a == "--prefix" and i + 1 < len(argv): prefix = argv[i + 1]
        if a == "--project" and i + 1 < len(argv): project = argv[i + 1]
    if not collector:
        sys.exit("  add-checkpoints: --collector is required and is never defaulted.\n"
                 "  It is the address a semester of data gets mailed to. Read it from the\n"
                 "  principal's mailbox rather than typing one in.")
    packet = json.load(open(src))
    if not prefix:
        # A routing code is read by ONE mailbox serving every project, so the experiment alone
        # is not unique — two projects both have a SLIP4. `--project` is what separates them,
        # and its absence is worth saying rather than quietly producing a collidable code.
        prefix = slug(project, packet.get("metadata", {}).get("experiment") or packet.get("id"))
        if not project:
            print("  NOTE: no --project, so codes are scoped to the experiment only. Two "
                  "projects with the same experiment name would collide.")
    n = links = 0
    for sheet in packet.get("sheets", []):
        cp = checkpoint_for(sheet, prefix)
        if not cp: continue
        sheet["checkpoint"] = cp
        links += reroute(sheet, cp, collector)
        n += 1
        print(f"     {sheet['id']:<14} {cp['type']:<22} cortex::{cp['code']}")
    left = len(GOOGLE.findall(json.dumps(packet)))
    json.dump(packet, open(out, "w"), indent=2)
    print(f"  wrote {out}: {n} checkpoint(s), {links} Google delivery block(s) replaced")
    # Absence must be loud. A packet that still carries a Google URL after this ran has a
    # delivery route nobody is watching, and it would print onto the labsheet looking official.
    if left:
        print(f"  WARNING: {left} Google URL(s) still in the packet — not in a block this "
              f"replaced. Find them before printing.")
        sys.exit(1)
    if n == 0:
        print("  NOTE: no checkpoints found. Either this packet returns nothing to the lab, "
              "or its delivery step does not use a Google URL. Check before assuming the former.")

main(sys.argv)
