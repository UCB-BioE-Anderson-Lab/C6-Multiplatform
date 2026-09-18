// generate.js — turn a scenario's spec into the files of an experiment directory.
//
// **A SCENARIO IS AN EXPERIMENT, NOT A UNIT TEST.** What comes out of here is exactly what a
// person would have in a folder: construction files, a characterization file, the project's
// sequences and oligos, and an inventory. Nothing in the pipeline learns it is being tested, so a
// scenario exercises the same code path a real compile does, including the parts of it that read
// the folder name and the file names.
//
// **WHY THE FILES AND NOT THE OBJECTS.** The planner could be handed jobs directly and it would be
// faster. But four of the defects this repository has found lived in the seam between the files
// and the objects — the parenthetical dialect, the tab-versus-space split, the `_oligos.txt` that
// holds no sequencing primer, the product name taken from a filename. A fixture that starts after
// the parser cannot see any of them.
//
// **THE CONTENT IS DELIBERATELY SYNTHETIC AND DELIBERATELY BORING.** `docs/TOOLKIT-PLAN.md`'s
// second north star is that C6 must never learn whose lab it is, and a fixture carrying a real
// construct is that failing quietly. These plasmids are called `pS1`, their oligos `s1F1`, and
// they encode nothing.
import fs from 'node:fs';
import path from 'node:path';
import { amplicon, OVERHANGS } from './dna.js';

/**
 * The strength a working oligo stock is at, and the strength the freezer tube is at.
 * → `rules/dilution.rules.js`, which holds the same two numbers and decides from them.
 */
const WORKING = '10uM';
const STOCK = '100uM';

/**
 * What an inventory can look like, as far as any decision in the toolkit can tell.
 *
 * **THESE ARE THE STATES, NOT A SAMPLE OF THEM.** `rules/primerSource.rules.js` and
 * `rules/templateSample.rules.js` between them distinguish seven situations a material can be in,
 * and two fixture inventories reached three. The names here are the situations those rules
 * already name, so a scenario picking one is saying which branch it is there to reach.
 *
 *   none        no file at all — "could not look", which must never print as "absent"
 *   full        every material placed, at working strength, antibiotic on the shelf
 *   partial     the ordinary state of a real freezer: some at stock strength so a dilution is
 *               needed, some absent so the sheet has to ask, no antibiotic so the stock fires
 *   untracked   a box that deliberately records no wells — the box IS the answer
 *   wellblank   a tracked box, and this row's well was never written down
 *   odd         tubes exist at neither the working strength nor the stock
 *   cultures    two minipreps of one construct, from different stages of a serial culture
 */
export const INVENTORIES = ['none', 'full', 'partial', 'untracked', 'wellblank', 'odd',
                            'cultures'];

/** Where a scenario's construct names come from: `pS1`, `pS2`… and their oligos `s1F1`, `s1R1`. */
const constructName = (spec, i) => (spec.constructs > 1 ? `${spec.name}${i + 1}` : spec.name);
const stem = (spec, i) => `${constructName(spec, i).replace(/[^A-Za-z0-9]/g, '')}`.toLowerCase();

/**
 * Every material one scenario needs: its templates, its oligos, and what each PCR will yield.
 *
 * Built before any file is written because three files have to agree about it — the construction
 * file names the oligos, the sequences file carries the templates, and the inventory says where
 * the tubes are. Deriving each of them separately is how a fixture comes to name an oligo that is
 * in no ordering sheet.
 */
function materials(spec) {
  const out = [];
  for (let c = 0; c < spec.constructs; c += 1) {
    const s = stem(spec, c);
    const n = spec.sizes.length;
    const frags = spec.sizes.map((bp, i) => {
      const a = amplicon({ name: `${s}t${i + 1}`, bp,
                           left: OVERHANGS[i % OVERHANGS.length],
                           right: OVERHANGS[(i + 1) % Math.max(n, 1) % OVERHANGS.length] });
      // **A PRIMER THAT DOES NOT MATCH IS A REAL PRIMER**, not a broken fixture. `simCF` refuses
      // any primer whose 3'-most 18 bases are not an exact match, which excludes a whole class of
      // ordinary ones — a site-removal mutagenic primer has to put its changed base where the site
      // is. The product then has no length, and two rules exist for exactly that state: the
      // program must refuse rather than invent a number, and the cleanup must not warn about
      // short fragments it cannot see. Neither had ever fired in a compile.
      const forward = spec.mismatch && i === 0
        ? `${a.forward.slice(0, -3)}${a.forward.slice(-3) === 'AAA' ? 'CCC' : 'AAA'}`
        : a.forward;
      return { ...a, forward, template: `p${s.toUpperCase()}T${i + 1}`,
               forwardName: `${s}F${i + 1}`,
               reverseName: `${s}R${i + 1}`, product: `${s}frag${i + 1}` };
    });
    out.push({ construct: constructName(spec, c), assembly: `${s}gg`, frags });
  }
  return out;
}

/**
 * One construction file: a PCR per fragment, one assembly, and the transformation that names the
 * plasmid — or no transformation at all, where the scenario is about an experiment that does not
 * select for anything.
 */
function constructionFile(spec, m) {
  const lines = m.frags.map((f) =>
    `PCR\t${f.forwardName}\t${f.reverseName}\t${f.template}\t${f.product}`);
  lines.push(`GoldenGate\t${m.frags.map((f) => f.product).join('\t')}\tBsaI\t${m.assembly}`);
  // NO TRANSFORMATION IS A REAL SHAPE, not a truncated file. An experiment can end at an assembly
  // — and then nothing selects for anything, which is the one situation in which no antibiotic
  // stock session should be injected. → `rules/antibioticStock.rules.js § nothingSelects`
  if (spec.marker !== 'none') {
    // **EVERY SCENARIO NAMES A REAL ANTIBIOTIC NOW.** A cell holding a word that is not one, and a
    // cell holding nothing, are both refusals as of 2026-09-17 — so neither is a scenario, and
    // both live in `faults.js` where things that get refused belong. A scenario is an input that
    // produces a workbook. → JCA: *"they need to state a valid antibiotic for it to be parsible"*
    const marker = spec.marker;
    lines.push(`Transform\t${m.assembly}\tMach1\t${marker}\t37\t${m.construct}`);
  }
  return `${lines.join('\n')}\n`;
}

/**
 * One characterization file, in the two halves a scenario can ask for independently.
 *
 * **VERIFICATION DECLARED AND VERIFICATION INJECTED ARE TWO CODE PATHS FOR ONE PHYSICAL ACTION**,
 * and until these scenarios existed each fixture exercised exactly one of them — golden injects,
 * tlib3 declares — so nothing ever compared them. That comparison is what `verify` is for.
 */
function characterizationFile(spec, m) {
  const lines = [];
  const clones = `${m.construct}_clones`;
  if (spec.verify === 'declared') {
    // **A COLONY IS A STRAIN AND A MINIPREP IS DNA**, so the two steps rename to DIFFERENT bases.
    // Writing `clone=` the same on both makes the miniprep produce the pick's own names, and the
    // file is refused with *"pS-A is produced twice"* — which is correct, and is a finding about
    // this generator rather than about the toolkit. → `planning/expandClones.js`
    lines.push(`Pick\t${m.construct}\tn=${spec.clones} phenotype=growing on the selective plate clone=Mach1/${m.construct}`
      + `${spec.vessel ? ` vessel=${spec.vessel}` : ''}${spec.library ? ' library=true' : ''}`
      + `\t${clones}`);
    lines.push(`Miniprep\t${clones}\tclone=${m.construct} box=SBox\t${m.construct}_dna`);
    // ONE OLIGO OR TWO, WHICH IS A DIFFERENT NAMING PATH. One read needs no suffix; two are `F`
    // and `R` and the tubes are `pS-AF` and `pS-AR`, paired with the oligos by position.
    const seqArgs = spec.reads === 2
      ? `oligos=${m.frags[0].forwardName},${m.frags[0].reverseName} reads=F,R`
      : `oligo=${m.frags[0].forwardName} reads=F`;
    lines.push(`Sequencing\t${m.construct}_dna\t${seqArgs}\t${m.construct}_reads`);
    lines.push(`Analysis\t${m.construct}_reads\texpects=assembly_junctions\t${m.construct}_verdict`);
  }
  if (spec.phase2) {
    const host = `${m.construct}_host`;
    const hostClones = `${m.construct}_hclones`;
    // **L. LACTIS, BECAUSE THAT IS THE ORGANISM THIS TOOLKIT HAS A PROCEDURE FOR.** An
    // electroporation into a host with no protocol is refused as of 2026-09-17, and a scenario is
    // an input that COMPILES — the file that names one we cannot do is `faults.js §
    // method-not-described`, which is where it belongs. The species is a property of the method
    // here, not a lab's choice of organism.
    lines.push(`Retransform\t${m.construct}\thost=L.lactis antibiotic=${spec.marker || 'Kan'} `
      + `temp=30 method=electroporation\t${host}`);
    lines.push(`Pick\t${host}\tn=${spec.clones} phenotype=growing on the selective plate, fluorescent under blue light clone=L.lactis/${m.construct} `
      + `lighting=blue+ambient\t${hostClones}`);
    lines.push(`Culture\t${hostClones}\tmedium=LB+${spec.marker || 'Kan'} `
      + `vessel=${spec.vessel || '24-well'} volume=4mL temp=30 to=saturation\t${m.construct}_cul`);
    lines.push(`Assay\t${m.construct}_cul\tprotocol=plate_reader_fluorescence reporter=GFP `
      + `ex=485 em=515 od=600\t${m.construct}_assay`);
  }
  return lines.length ? `${lines.join('\n')}\n` : null;
}

/** The project's sequences: one row per synthetic template. → `planning/projectSequences.js` */
function sequencesFile(ms) {
  const rows = ['# Synthetic templates, generated by src/labplanner/scenarios/. They encode nothing.'];
  for (const m of ms) for (const f of m.frags) rows.push(`${f.template}\t${f.plasmid}\tplasmid\t`);
  return `${rows.join('\n')}\n`;
}

/** The ordering sheet, which is where a project's oligo sequences actually live. */
function oligosFile(ms) {
  const rows = [];
  for (const m of ms) for (const f of m.frags) {
    rows.push(`${f.forwardName}\t${f.forward}\t25nm\tSTD`);
    rows.push(`${f.reverseName}\t${f.reverse}\t25nm\tSTD`);
  }
  return `${rows.join('\n')}\n`;
}

/**
 * The freezer, in whichever of the six states this scenario asked for. → `INVENTORIES`
 *
 * Returns null for `none`, which is the state that must not be confused with an empty freezer:
 * no file means nothing was looked up, and every sheet has to say so.
 */
function inventoryFile(spec, ms) {
  if (spec.inventory === 'none') return null;
  // THE CULTURE COLUMN IS ONLY WORTH WRITING WHEN SOMETHING RANKS ON IT. A construct with the same
  // plasmid minipreped at several stages of a serial culture is the situation
  // `rules/cultureStage.rules.js` exists to settle. One tube of a construct never reaches it.
  const staged = spec.inventory === 'cultures';
  const rows = [`box\twell\tconstruct\tconcentration${staged ? '\tculture' : ''}`];

  // **EVERY MATERIAL IN ONE FLAT LIST, SO LEAVING SOME OUT IS ONE DECISION.** This iterated
  // fragment by fragment and skipped on a counter that only advanced inside the placement, so the
  // test for "leave this one out" was never true and a `partial` inventory held everything. Two
  // rules — `dilution.mustOrder` and `primerSource.notInInventory`, which are what a sheet says
  // when a tube has to be ordered — went on reading as covered while nothing reached them.
  const wanted = [];
  for (const m of ms) for (const f of m.frags) {
    wanted.push({ construct: f.forwardName, kind: 'oligo' });
    wanted.push({ construct: f.reverseName, kind: 'oligo' });
    wanted.push({ construct: f.template, kind: 'dna' });
    // ALL FOUR STAGES, so the order is actually demonstrated. With only a primary and a secondary
    // in the freezer, "prefer the later one" and JCA's 3 > 2 > 1 > 4+ pick the same tube, and the
    // evidence on the claims page could not tell the two apart.
    if (staged) {
      for (const stage of ['secondary', 'tertiary', 'quaternary']) {
        wanted.push({ construct: f.template, kind: 'dna', stage });
      }
    }
  }
  if (spec.inventory === 'full' && spec.marker && spec.marker !== 'none') {
    wanted.push({ construct: spec.marker, kind: 'stock' });
  }

  let placed = 0;
  for (const [i, w] of wanted.entries()) {
    // A PARTIAL INVENTORY LEAVES SOME MATERIALS OUT ENTIRELY, which is the ordinary state of a
    // real freezer and the only way to reach the "not in the inventory at all" branch. It is not
    // the same as no inventory, and the sheets print the two differently.
    if (spec.inventory === 'partial' && i % 4 === 3) continue;
    placed += 1;
    const well = spec.inventory === 'untracked' ? 'untracked'
               : spec.inventory === 'wellblank' ? ''
               : `${String.fromCharCode(65 + ((placed - 1) % 8))}${Math.floor((placed - 1) / 8) + 1}`;
    const strength = w.kind === 'stock' ? '1000x'
                   : w.kind === 'dna' ? 'miniprep'
                   : spec.inventory === 'odd' ? '50uM'
                   : spec.inventory === 'partial' ? (i % 2 === 0 ? STOCK : WORKING)
                   : WORKING;
    rows.push(`SBox\t${well}\t${w.construct}\t${strength}`
            + (staged ? `\t${w.stage || 'primary'}` : ''));
  }
  return `${rows.join('\n')}\n`;
}

/**
 * Build one synthetic experiment's files from a scenario spec, ready to write into a directory.
 *
 * @param {Object} spec  a scenario — see `scenarios.js § SCENARIOS` for the fields
 * @returns {Object} filename -> file contents, exactly as a person's project folder would hold it
 */
export function scenarioFiles(spec) {
  const ms = materials(spec);
  const files = {};
  for (const m of ms) files[`Construction of ${m.construct}.txt`] = constructionFile(spec, m);
  for (const m of ms) {
    const text = characterizationFile(spec, m);
    if (text) files[`Characterization of ${m.construct}.txt`] = text;
  }
  files[`${spec.id}_sequences.tsv`] = sequencesFile(ms);
  files[`${spec.id}_oligos.txt`] = oligosFile(ms);
  const inv = inventoryFile(spec, ms);
  if (inv) files['inventory.txt'] = inv;
  // **THE ANSWER GOES IN A FILE, NOT ON THE COMMAND LINE.** `--label-prefix` is the convenience
  // form and `--answers <file>` is the mechanism — § 6: ask with `c6-decide`, answer out of band,
  // feed it back so the compile is deterministic and the answer is in git. A scenario that
  // demonstrates a compile with nothing left open should demonstrate it through the seam that is
  // actually meant to carry it.
  if (spec.answers) files['answers.json'] = `${JSON.stringify(spec.answers, null, 2)}\n`;
  return files;
}

/**
 * Write one synthetic experiment into a directory, creating it if it is not there.
 *
 * @param {Object} spec  a scenario
 * @param {string} root  the directory the experiment's own folder is created inside
 * @returns {string} the path of the experiment folder
 */
export function writeScenario(spec, root) {
  const dir = path.join(root, spec.id);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, text] of Object.entries(scenarioFiles(spec))) {
    fs.writeFileSync(path.join(dir, name), text);
  }
  return dir;
}
