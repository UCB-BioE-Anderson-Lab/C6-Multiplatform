// planDilutions.js — do we already have this oligo at working strength, or must we make it?
//
// JCA, 2026-09-10:
//
// > *"Dilutions typically happen before PCR and sequencing. Start by pulling out all the oligos
// > from pcr and sequencing steps. When looking for the oligos to use in PCR, you first search
// > for a 10 uM stock. If that doesn't exist, you search for a 100uM stock. If that doesn't
// > exist you say to buy it… you only have a dilution labsheet if there weren't ready-to-use
// > oligos in the inventory. For sequencing, you look for a 2.66 uM oligo, not 10 uM."*
//
// THREE OUTCOMES PER OLIGO, AND THEY ARE NOT THREE DEGREES OF THE SAME THING. `ready` puts a box
// and a well on the PCR sheet. `dilute` adds a whole labsheet on an earlier day. `order` is not a
// labsheet at all — it is a purchase with a lead time, and the experiment cannot be scheduled
// until it lands. Collapsing the third into the second is the dangerous one: it produces a
// dilution step for a tube that does not exist, and it reads as a plan.
//
// A 100 µM STOCK IS NOT A USABLE PCR OLIGO. `chooseOligoForPCR` ranks it as eligible, because
// `min_uM: 10` asks "is there at least this much", and for ranking that is right. Here the
// question is different — *is this the working stock, or the thing the working stock is made
// from* — so the concentration is matched, not thresholded.
import { findByConstruct } from '../../inventory/query.js';
// **THE NUMBERS AND THE DECISION LIVE WITH THE RULES.** Re-exported here because those are the
// names every existing caller imports. → `rules/dilution.rules.js`
import { choose, near, STOCK_UM, WORKING_UM } from '../rules/dilution.rules.js';

export { STOCK_UM, WORKING_UM };


/** Concentration as µM, or null when the field says something else entirely ('miniprep'). */
export function concentrationUM(text) {
  // **THE MICRO SIGN SURVIVES ALMOST NOTHING, AND THESE ARE REAL TUBES.** Of 1,472 samples in
  // Pimar's `-20`, sixty-one record their strength as `100_m`, `10_m` or `100\uFFFDM` — a `µ` that
  // went through a spreadsheet, an encoding change, or both. They are 100 µM and 10 µM oligo
  // stocks sitting in the freezer, and reading them as "no concentration known" makes the planner
  // say a tube must be ordered or cannot be diluted when it is right there.
  //
  // There are two distinct legitimate characters to begin with — `µ` U+00B5 MICRO SIGN and `μ`
  // U+03BC GREEK SMALL LETTER MU — which look identical and are not equal, so even an unmangled
  // file needs this.
  const t = String(text || '').toLowerCase().replace(/\s+/g, '')
    .replace(/[\u00b5\u03bc_\ufffd]/g, 'u');

  // **AN AMOUNT IS NOT A CONCENTRATION.** IDT ships oligos labelled `25 nmol`, and `25nmol` matched
  // the `nm` pattern and came back as 0.025 µM — a synthesis scale read as a strength, three
  // orders out from the 100 µM the tube almost certainly holds. `nm` and `um` are only units here
  // when nothing follows them.
  if (/[0-9](n|u)mol/.test(t)) return null;

  let m = t.match(/([0-9]*\.?[0-9]+)um(?![a-z])/) || t.match(/um(?![a-z])([0-9]*\.?[0-9]+)/);
  if (m) return parseFloat(m[1]);
  m = t.match(/([0-9]*\.?[0-9]+)nm(?![a-z])/) || t.match(/nm(?![a-z])([0-9]*\.?[0-9]+)/);
  if (m) return parseFloat(m[1]) / 1000;
  return null;
}

// Tubes are labelled "10 uM" and hold 9.8 µM; a tolerance is not sloppiness, it is the format.

function where(sample) {
  const l = sample.location || {};
  return { box: l.boxname || '', row: l.row, col: l.col, label: l.label || '', well: wellOf(l) };
}
// ROWS AND COLUMNS ARE 0-BASED IN THE INVENTORY AND 1-BASED ON A TUBE. Row 0 is "A" and column
// 0 is "1". Reading them as 1-based put oGho17 at C1 when it is at D2 — a location that exists,
// holds something else, and looks entirely plausible on a printed labsheet.
function wellOf(l) {
  // THE SOURCE'S OWN WELL NAME WINS, when it recorded one. A grid inventory may letter its
  // columns and number its rows, which is the transpose of what this computation assumes — so
  // deriving the name from the indices sends somebody to a well that exists and holds something
  // else. `src/inventory/io.js` carries the same rule and the reason.
  if (l && l.well) return String(l.well);
  if (!l || l.row == null || l.col == null) return '';
  return `${String.fromCharCode(65 + Number(l.row))}${Number(l.col) + 1}`;
}

/**
 * Resolve every oligo a set of jobs needs against the inventory, giving one of four answers
 * each: ready at working strength, dilutable from the stock, present but neither, or not there
 * at all. Refuses an empty inventory rather than reporting everything as needing to be ordered.
 *
 * @param {Array} jobs      from extractJobsFromCFs
 * @param {Object} inv      an Inventory
 * @returns {{ready:Array, dilute:Array, order:Array, unknown:Array}}
 */
export function planDilutions(jobs, inv, cfg = {}) {
  const stockUM = cfg.stockUM ?? STOCK_UM;

  // ONE ENTRY PER (OLIGO, WORKING CONCENTRATION), not per oligo. An oligo used both to amplify
  // and to sequence needs a 10 µM tube AND a 2.66 µM tube, and they are different tubes. Keying
  // on the name alone silently drops the second, and the failure appears at the bench as a
  // sequencing reaction set up at four times the intended primer concentration.
  const wanted = new Map();
  for (const job of jobs || []) {
    const um = WORKING_UM[job.operation];
    if (!um) continue;
    for (const name of job.oligos || []) {
      const key = `${name}@${um}`;
      if (!wanted.has(key)) wanted.set(key, { oligo: name, workingUM: um, neededBy: [] });
      wanted.get(key).neededBy.push({ cf: job.cf, line: job.line, output: job.output,
                                      operation: job.operation });
    }
  }

  // AN INVENTORY WITH NOTHING IN IT IS NOT A FREEZER WITH NOTHING IN IT.
  //
  // Found the first time this ran for real: SynThera's inventory file opens with six lines of
  // provenance comments, the tabular parser read the first of them as its column header, and
  // returned a valid, empty Inventory. This function then did exactly what it is supposed to do
  // with an oligo it cannot find — and reported "ORDER THESE (6)" about six oligos sitting in a
  // freezer drawer. Every step behaved correctly and the answer was confidently wrong.
  //
  // So an empty inventory is refused rather than searched. "Could not read the inventory" and
  // "the inventory does not have these" must never print the same thing.
  if (!inv || !inv.samples || Object.keys(inv.samples).length === 0) {
    return { error: 'the inventory is empty or could not be read — refusing to report every '
                  + 'oligo as needing to be ordered',
             ready: [], dilute: [], order: [], ask: [], wanted: [...wanted.values()] };
  }

  const out = { ready: [], dilute: [], order: [], ask: [] };
  for (const need of wanted.values()) {
    const samples = findByConstruct(inv, need.oligo) || [];
    // **THE DECISION IS IN `rules/dilution.rules.js`.** What is left here is reading the freezer:
    // find the tubes, parse each concentration once, and record where each one sits.
    const tubes = samples.map((x) => ({ ...x, uM: concentrationUM(x.concentration) }));
    const got = choose({ tubes, workingUM: need.workingUM, stockUM });

    if (got.outcome === 'ready') {
      out.ready.push({ ...need, source: where(tubes.find((t) => near(t.uM, need.workingUM))) });
    } else if (got.outcome === 'dilute') {
      out.dilute.push({ ...need, from: where(tubes.find((t) => near(t.uM, stockUM))),
                        fromUM: stockUM, destination: got.destination });
    } else if (got.outcome === 'ask') {
      out.ask.push({ ...need,
        found: tubes.map((x) => ({ ...where(x), concentration: x.concentration, uM: x.uM })),
        why: got.note });
    } else {
      out.order.push({ ...need });
    }
  }
  return out;
}

// `injectDilutionJobs` WAS HERE AND IS GONE, 2026-09-13. Two exported functions of that name
// existed, in this file and in `injectDilution.js`, with different signatures and different
// meanings — this one took `(jobs, inventory)` and returned a wrapper object; the live one takes
// `(bins, dilutions)` and inserts the session ahead of everything that needs it. Nothing called
// this one. Two functions under one name is a coin toss for anybody reading an import.

/**
 * Render a dilution plan as the four things it can say: ready to use, needs a dilution, ask, or
 * order.
 */
export function describe(plan) {
  if (plan.error) return `  CANNOT PLAN DILUTIONS: ${plan.error}\n`
    + `  ${plan.wanted.length} oligo(s) were waiting on it: `
    + `${[...new Set(plan.wanted.map((w) => w.oligo))].join(', ')}`;
  const lines = [];
  const loc = (w) => (w.box ? `${w.box} ${w.well}` : '(no location recorded)');
  if (plan.ready.length) {
    lines.push(`  ready to use (${plan.ready.length}) — put these locations on the labsheet:`);
    for (const r of plan.ready) lines.push(`     ${r.oligo.padEnd(10)} ${r.workingUM} uM   ${loc(r.source)}`);
  }
  if (plan.dilute.length) {
    lines.push(`  need a dilution labsheet (${plan.dilute.length}):`);
    for (const d of plan.dilute) lines.push(`     ${d.oligo.padEnd(10)} ${d.workingUM} uM from ${d.fromUM} uM at ${loc(d.from)}   -> destination not yet chosen`);
  }
  if (plan.ask.length) {
    lines.push(`  ASK (${plan.ask.length}) — in the freezer, but not usable as-is and not dilutable by the rule:`);
    for (const u of plan.ask)
      lines.push(`     ${u.oligo.padEnd(10)} ${u.why}\n                ${u.found.map((f) => `"${f.concentration}" at ${loc(f)}`).join(', ')}`);
  }
  if (plan.order.length) {
    lines.push(`  ORDER THESE (${plan.order.length}) — not a labsheet; the experiment waits on delivery:`);
    for (const o of plan.order) lines.push(`     ${o.oligo.padEnd(10)} needed at ${o.workingUM} uM by ${o.neededBy.map((n) => n.output).join(', ')}`);
  }
  return lines.join('\n') || '  every oligo is already at working concentration — no dilution labsheet needed';
}
