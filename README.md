# C6-Multiplatform

**Cross-platform toolkit for synthetic biology and molecular biology operations**

[![npm version](https://img.shields.io/npm/v/c6-sim.svg?style=flat)](https://www.npmjs.com/package/c6-sim)  
[![jsDelivr hits](https://data.jsdelivr.com/v1/package/npm/c6-sim/badge)](https://www.jsdelivr.com/package/npm/c6-sim)

---

## Overview

C6 is a JavaScript toolkit for simulating recombinant DNA workflows. It supports both browser-based and Node.js-based execution environments, enabling use in web applications, teaching tools, or backend design pipelines.

The central abstraction in C6 is the **Construction File (CF)** — a stepwise text specification describing a DNA assembly plan using PCR, restriction digest, Gibson assembly, Golden Gate cloning, transformation, and other procedures. C6 parses CFs into structured instructions and simulates the resulting chemical outcomes using modeled reactions.
The Construction File format is introduced in [Anderson et al., 2023](https://pubmed.ncbi.nlm.nih.gov/37956196/), which provides the conceptual foundation for this abstraction.

C6 models DNA molecules using a `Polynucleotide` abstraction that reflects the physical and chemical properties of DNA fragments used in recombinant DNA procedures. This includes parameters such as strandedness (single or double), topology (linear or circular), RNA vs DNA, and 5′/3′ overhangs or modifications. Helper constructors are provided for common cases (e.g., `dsDNA`, `oligo`, `plasmid`), but the `Polynucleotide` class itself generalizes any linear or circular molecule encountered in assembly workflows.

Beyond simulation, C6 includes design and verification tools:

- Oligo design utilities for standard assembly schemes (e.g., BioBrick, MoClo, BglBrick, RBSLib)
- Annotation and inference tools that map known features to sequences, group them into transcriptional units (TUs), and infer which CDS elements are likely expressed
- Sequence manipulation utilities for reverse complementation, melting temperature, self-complementarity checks, and more
- **Constraint-based specification** of what a construct must be — parts, devices and rules, with enumeration of every design that satisfies them ([`docs/planning/GOAL.md`](docs/planning/GOAL.md))
- **Lab planning**: construction files compiled into labsheets and lab packets — one tab per work session, with what to fetch and from where, what goes in each reaction, what to write on every tube, and which controls prove what ([`docs/LABPLANNER.md`](docs/LABPLANNER.md))
- **Sample inventory** across boxes and plates, with holds placed when a sheet is issued and resolved when it comes back


C6 focuses on modeling the chemical logic of molecular biology protocols rather than abstract logic of synthetic circuits. It is useful for applications involving validation, verification, or generation of DNA designs in formats that correspond closely to wet-lab workflows and in vitro molecular biology techniques.

C6 does not optimize designs. It has no objective function, and it will not tell you which promoter makes the most protein or which pathway variant to try. What it does do, since 2026, is let you state what a construct must be — its devices, the ordered parts each is made of, and the rules that hold across them — and enumerate every combination of available parts that satisfies those rules, with the reason each rejected one failed. That vocabulary is derived from [Eugene](https://doi.org/10.1371/journal.pone.0018882) (Bilitchenko et al., 2011). Choosing among the designs that survive remains a person's job.

Its centre of gravity is still the construction strategy rather than the design: it verifies that a Construction File is syntactically well-formed, chemically coherent, and capable of producing the intended DNA product in silico, and it provides limited analysis of potential gene expression from the resulting constructs. From there it now goes to the bench — construction files compile into the labsheets somebody carries, with protocols transcluded and inventory tracked — though it still generates no robotic instructions.

---

## Where to start

The **skills** are the front doors. Each is a plain JSON file naming the document to read first,
the records it vouches for, and the rules that hold across it:

| skill | what it covers |
|---|---|
| [`sharables/skills/experimental-planning.json`](sharables/skills/experimental-planning.json) | the whole arc — goal, materials, design, build, characterization, record — with the gate between each phase and what enforces it |
| [`sharables/skills/goal.json`](sharables/skills/goal.json) | stating what a construct must be, before anything is known to exist to build it from |
| [`sharables/skills/labsheets.json`](sharables/skills/labsheets.json) | construction file to bench and back |

### The documents

- [`docs/planning/README.md`](docs/planning/README.md) — the end-to-end workflow, phase by phase. Its pages: [GOAL](docs/planning/GOAL.md), [MATERIALS](docs/planning/MATERIALS.md), [DESIGN](docs/planning/DESIGN.md), [RECORD](docs/planning/RECORD.md)
- [`docs/LABPLANNER.md`](docs/LABPLANNER.md) — the labplanner, start to finish; [`LABPLANNER-API.md`](docs/LABPLANNER-API.md) in domain terms; [`LABPLANNER-AUDIT.md`](docs/LABPLANNER-AUDIT.md) on why it did not feel navigable
- [`docs/LABSHEET-SPEC.md`](docs/LABSHEET-SPEC.md) — what a labsheet is; [`LABSHEET-TRANSLATION.md`](docs/LABSHEET-TRANSLATION.md) for reading legacy workbooks in
- [`docs/CHARACTERIZATION.md`](docs/CHARACTERIZATION.md) — what happens to a plasmid after it is verified
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — the bench operations C6 knows; [`ONTOLOGY.md`](docs/ONTOLOGY.md) — the nouns and verbs records are indexed by
- [`docs/OLIGOPOOL-SPEC.md`](docs/OLIGOPOOL-SPEC.md) and [`docs/PACKAGING-SPEC.md`](docs/PACKAGING-SPEC.md) — file formats
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — what was settled and why; [`TOOLKIT-PLAN.md`](docs/TOOLKIT-PLAN.md) — what is still intended
- [`docs/C11-CONNECTOR.md`](docs/C11-CONNECTOR.md) — for a C11 installation mounting this world; [`INSTALLATION.md`](docs/INSTALLATION.md) — installing C6 itself
- [`docs/CLEANING-A-DATA-RESOURCE.md`](docs/CLEANING-A-DATA-RESOURCE.md) and [`FOR-REVIEW.md`](docs/FOR-REVIEW.md)

`test/docs-index.test.js` fails when a document is added and this list is not.

---

## Installation

```bash
npm install c6-sim
```

Or load via CDN:

```html
<script src="https://cdn.jsdelivr.net/npm/c6-sim/dist/c6-sim.min.js"></script>
```

---
## Quickstart

You can use C6 to simulate recombinant DNA steps in Node.js or in the browser.

```javascript
import C6 from 'c6-sim';

const cfText = `
PCR Fwd Rev Template Product
oligo Fwd CAAGTGGGAACGCGTAATG
oligo Rev CGGTCACGGCACCACCATC
plasmid Template TTCAAGTGGGAACGCGTAATGAATTTTGAAGATGGTGGTGCCGTGACCG
`;

const cf = C6.parseCF(cfText);
const result = C6.simCF(cf);
console.log(result);
```

---

## Interactive Demo

You can try the toolkit in your browser using the hosted demo:

👉 [**C6 Interactive Demo**](https://ucb-bioe-anderson-lab.github.io/C6-Multiplatform)

This includes CF simulation, annotation, and expression inference in a no-install playground.

---

## Running Tests

This project uses [Vitest](https://vitest.dev):

```bash
npm test
```

Test coverage includes core simulation, sequence utilities, oligo design, and gene annotation.

---

## Repository

[GitHub – UCB BioE Anderson Lab](https://github.com/UCB-BioE-Anderson-Lab/C6-Multiplatform)

---

## License

MIT License © University of California, Berkeley
