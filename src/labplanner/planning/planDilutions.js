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

/** What each use needs in hand. Sequencing is 2.66 µM; everything else is 10 µM. */
export const WORKING_UM = { pcr: 10, sequence: 2.66, sequencing: 2.66 };
export const STOCK_UM = 100;

/** Concentration as µM, or null when the field says something else entirely ('miniprep'). */
export function concentrationUM(text) {
  const t = String(text || '').toLowerCase().replace(/\s+/g, '');
  let m = t.match(/([0-9]*\.?[0-9]+)um/) || t.match(/um([0-9]*\.?[0-9]+)/);
  if (m) return parseFloat(m[1]);
  m = t.match(/([0-9]*\.?[0-9]+)nm/) || t.match(/nm([0-9]*\.?[0-9]+)/);
  if (m) return parseFloat(m[1]) / 1000;
  return null;
}

// Tubes are labelled "10 uM" and hold 9.8 µM; a tolerance is not sloppiness, it is the format.
const near = (a, b) => a != null && Math.abs(a - b) <= Math.max(0.05, b * 0.05);

function where(sample) {
  const l = sample.location || {};
  return { box: l.boxname || '', row: l.row, col: l.col, label: l.label || '', well: wellOf(l) };
}
// ROWS AND COLUMNS ARE 0-BASED IN THE INVENTORY AND 1-BASED ON A TUBE. Row 0 is "A" and column
// 0 is "1". Reading them as 1-based put oGho17 at C1 when it is at D2 — a location that exists,
// holds something else, and looks entirely plausible on a printed labsheet.
function wellOf(l) {
  if (!l || l.row == null || l.col == null) return '';
  return `${String.fromCharCode(65 + Number(l.row))}${Number(l.col) + 1}`;
}

/**
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
    const at = (um) => samples.find((s) => near(concentrationUM(s.concentration), um));

    const working = at(need.workingUM);
    if (working) { out.ready.push({ ...need, source: where(working) }); continue; }

    const stock = at(stockUM);
    if (stock) {
      out.dilute.push({ ...need, from: where(stock), fromUM: stockUM,
                        // WHERE IT GOES IS NOT DECIDED HERE. The dilution sheet ends by putting
                        // a tube in the freezer and the PCR sheet begins by fetching it, so the
                        // location is the join between two sessions — and choosing a good one
                        // means looking at what the box already holds. `operations/miniprep.md`
                        // and `operations/dilutions.md` say why that is judgement. Left null so
                        // an unplaced tube cannot be mistaken for a placed one.
                        destination: null });
      continue;
    }

    // IT IS HERE, BUT NOT AS SOMETHING THIS STEP CAN USE OR DILUTE FROM. Two different states
    // arrive here and both need a person, so both are reported with what was actually found
    // rather than as one vague bucket:
    //
    //   * the concentration field says something unreadable — "miniprep", or blank
    //   * it reads fine and is simply neither the working stock nor the 100 µM source. G00101
    //     sits at 10 µM and sequencing wants 2.66 µM; you could make that from the 10, but the
    //     stated rule is to dilute from the 100 and there isn't one. Not a decision to invent.
    if (samples.length) {
      const found = samples.map((x) => ({ ...where(x), concentration: x.concentration,
                                          uM: concentrationUM(x.concentration) }));
      const readable = found.filter((f) => f.uM != null);
      out.ask.push({ ...need, found,
        why: readable.length
          ? `found at ${readable.map((f) => `${f.uM} uM`).join(', ')} — neither the `
            + `${need.workingUM} uM working stock nor a ${stockUM} uM stock to make it from`
          : 'present, but at no concentration that can be read' });
      continue;
    }
    out.order.push({ ...need });
  }
  return out;
}

/** The planner's shape: dilution jobs to schedule ahead of everything that needs them. */
export function injectDilutionJobs(jobs, inv, cfg = {}) {
  const plan = planDilutions(jobs, inv, cfg);
  return { jobs, dilutions: plan };
}

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
