// injectAntibioticStock.js — make the antibiotic stock before the step that plates on it.
//
// A PLAN THAT PLATES ON AN ANTIBIOTIC NEEDS THAT ANTIBIOTIC, and every other prerequisite in this
// planner is injected rather than assumed: the gel after the PCR, the cleanup after the gel, the
// working oligo stocks before the reaction that uses them. This is the same rule applied to the
// one material a construction file names and never accounts for.
//
// **THE TRIGGER IS THE INVENTORY, NOT A PREFERENCE.** The stock is made when the freezer cannot be
// shown to have one — exactly the test `injectDilution.js` uses for a working oligo stock, and for
// the same reason: a lab that keeps 1000x aliquots on the shelf should not be told to weigh powder,
// and a lab that does not should not discover it at the bench. `iGEM Cheese Inventory.txt` records
// Amp, Tet and Chl and no erythromycin, which is why Lactis3 gets this session and a spectinomycin
// experiment would not.
//
// **ERYTHROMYCIN IS WHY THIS EXISTS AND IT IS NOT A SPECIAL CASE HERE.** JCA, 2026-09-12: *"we
// should inject into this the protocol for making erythromycin stock, as that has been a recent
// historical pitfall for this group."* What makes erm a pitfall is chemistry, and the protocol
// module has carried it since before this file: it does not dissolve in water at all, dissolution
// is slow, and it precipitates when squirted into hot agar and redissolves on swirling. Every one
// of those reads as a failed prep to somebody who has not been told. So the fix is to put the
// protocol in front of them, and the module already knows which antibiotics need saying.
import { findByConstruct } from '../../inventory/query.js';
import { choose } from '../rules/antibioticStock.rules.js';

/** Fields on a job that name an antibiotic rather than a material. */
const ANTIBIOTIC_FIELDS = ['antibiotics', 'antibiotic'];

// A medium is written as `M17+Erm`, so the antibiotic is the part after the plus. Only ever read
// from a field that is already known to be a medium — splitting arbitrary text on `+` would turn
// `blue+ambient` lighting into an antibiotic called "ambient".
const MEDIUM_FIELDS = ['medium'];

/** Every antibiotic this plan plates or grows on, in the order it is first needed. */
export function antibioticsOf(bins) {
  const seen = new Map();
  for (const bin of bins || []) {
    for (const job of bin.jobs || []) {
      const a = job.args || {};
      const names = [];
      for (const f of ANTIBIOTIC_FIELDS) if (a[f]) names.push(String(a[f]));
      for (const f of MEDIUM_FIELDS) {
        if (!a[f]) continue;
        const parts = String(a[f]).split('+').slice(1);
        names.push(...parts);
      }
      for (const n of names) {
        const key = n.trim();
        if (!key || seen.has(key.toLowerCase())) continue;
        seen.set(key.toLowerCase(), { name: key, depth: bin.depth, bin });
      }
    }
  }
  return [...seen.values()].sort((x, y) => x.depth - y.depth);
}

/** Does the inventory show a stock of this antibiotic, under any of its spellings? */
export function stockIn(inv, name) {
  if (!inv || !inv.samples || !Object.keys(inv.samples).length) return null;
  // The inventory writes what is on the tube — "Erm", "erythromycin", "Amp". The protocol module
  // already owns the synonym table, so this only tries the name as given and its obvious short
  // form; a miss means the sheet says to make it, which is the safe direction.
  for (const spelling of new Set([name, name.toLowerCase(), name.toUpperCase(),
                                  name.slice(0, 3), name.slice(0, 3).toLowerCase()])) {
    const hits = findByConstruct(inv, spelling);
    if (hits.length) return hits[0];
  }
  return null;
}

/**
 * Add a stock-preparation bin ahead of the first step that needs each antibiotic the inventory
 * cannot be shown to have.
 *
 * @param {Array} bins   labsheet bins
 * @param {Object|null} inv
 * @returns {Array} bins, with at most one stock bin added
 */
export function injectAntibioticStockJobs(bins, inv, cfg = {}) {
  const list = [...(bins || [])];
  // **WHETHER A STOCK SESSION IS NEEDED IS A RULE** — `rules/antibioticStock.rules.js`. What is
  // left here is reading the antibiotics off the steps and building the bin.
  const got = choose({ antibiotics: antibioticsOf(list), stockIn: (n) => stockIn(inv, n) });
  const missing = got.inject;
  if (!missing.length) return list;

  // FIRST OF EVERYTHING, not merely before the step that plates. Placing it relative to its
  // consumer put it between the assembly and the transformation — true of the dependency and
  // wrong about the week, because plates are poured days ahead and the stock has to exist before
  // the media session that pours them.
  const first = Math.min(...list.map((b) => b.depth));
  list.push({
    operation: 'stock',
    round: 0,
    rounds: 1,
    injected: true,
    jobs: [],
    cfs: [...new Set(list.flatMap((b) => b.cfs || []))],
    // BEFORE THE DILUTIONS, which sit at -0.5. Plates have to be poured before anybody picks a
    // colony off one, and pouring needs the stock — so this is the earliest session there is.
    depth: first - 0.6,
    stocks: missing.map((m) => ({ antibiotic: m.name, searched: !!inv })),
  });
  list.sort((a, b) => a.depth - b.depth);
  list.forEach((b, i) => { b.index = i; });
  return list;
}
