// injectDilution.js — make the working stocks before the session that needs them.
//
// JCA, 2026-09-12, on Lactis3's four PCR oligos: *"The bf oligos exist, and I recommend we start
// this experiment from 100 uM --> 10 uM dilutions. So, it should ask them to type in the box and
// well of where they find the bf oligos, and when they return the labsheet you can extract that
// information."*
//
// THE OLIGO NOT BEING IN THE INVENTORY FILE IS NOT THE OLIGO NOT BEING IN THE FREEZER. That is
// the distinction this module exists for. `planDilutions` correctly reports an oligo it cannot
// find as `order`, and a planner that stopped there would tell four people to buy four oligos
// that are in a drawer — because the inventory is a document somebody maintains, and documents
// fall behind benches.
//
// So an oligo with no located working stock gets a dilution step either way, and the difference
// between the two cases is who fills in the location:
//
//   dilute        the 100 µM stock IS in the inventory. Its box and well are printed.
//   order / ask   nobody knows where it is. The box and well are ENTRY CELLS, and the returned
//                 workbook is what teaches the inventory. *"when they return the labsheet you can
//                 extract that information."*
//
// ONE DILUTION SESSION, BEFORE THE FIRST THING THAT NEEDS IT. Dilutions happen ahead of PCR and
// sequencing; this places the bin at a fractional depth below the earliest consumer so it sorts
// into place with the other injectors rather than being appended.
import { WORKING_UM, STOCK_UM } from './planDilutions.js';

/** Operations whose oligos must be at working strength before the session starts. */
export const NEEDS_WORKING_STOCK = ['pcr', 'sequence', 'sequencing'];

/**
 * Add a dilution bin ahead of the first bin that needs working-strength oligos.
 *
 * @param {Array} bins       labsheet bins
 * @param {Object} dilutions from `planDilutions`, or null when no inventory was read
 * @returns {Array} bins, with at most one dilution bin added
 */
export function injectDilutionJobs(bins, dilutions, cfg = {}) {
  const list = [...(bins || [])];
  const first = list.find((b) => NEEDS_WORKING_STOCK.includes(b.operation));
  if (!first) return list;

  // WITHOUT AN INVENTORY, EVERY OLIGO IS UNLOCATED — which is true, and is not the same as every
  // oligo needing to be made. The bin is still emitted, because the working stocks have to exist
  // before the PCR either way, and every location is a question rather than a claim.
  const oligos = [...new Set(list.filter((b) => NEEDS_WORKING_STOCK.includes(b.operation))
                                 .flatMap((b) => b.jobs.flatMap((j) => j.oligos || [])))];
  if (!oligos.length) return list;

  const ready = new Set((dilutions?.ready || []).map((r) => r.oligo));
  const from = new Map((dilutions?.dilute || []).map((d) => [d.oligo, d.from]));
  const needed = oligos.filter((o) => !ready.has(o));
  if (!needed.length) return list;

  const targets = needed.map((oligo) => {
    const at = from.get(oligo);
    return {
      oligo,
      description: `PCR primer for ${first.cfs.join(', ')}`,
      box: at?.box || '',
      well: at?.well || '',
      // WHETHER ANYBODY KNOWS WHERE THIS IS. The renderer turns an unlocated row into cells the
      // student fills in; a located one is printed, because asking somebody to look up a thing
      // the file already knows is how a form teaches people to skip its questions.
      located: !!at?.box,
    };
  });

  const out = [...list];
  out.push({
    operation: 'dilution',
    round: 0,
    rounds: 1,
    injected: true,
    jobs: [],
    cfs: first.cfs,
    depth: first.depth - 0.5,
    dilution: { stock_uM: cfg.stockUM ?? STOCK_UM,
                target_uM: cfg.targetUM ?? WORKING_UM.pcr,
                targets },
    ...(targets.some((t) => !t.located)
        ? { open: [`where the ${targets.filter((t) => !t.located).length} unlocated oligo stock(s) `
                 + `are — the sheet asks, and the returned workbook is what updates the inventory`] }
        : {}),
  });
  out.sort((a, b) => a.depth - b.depth);
  out.forEach((b, i) => { b.index = i; });
  return out;
}
