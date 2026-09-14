// chooseTemplateSample.js — for one named construct, the tube to pull it from.
//
// **THE RULES ARE IN `rules/templateSample.rules.js`, AND THIS IS THE ADAPTER.** What is left here
// is the part about inventories rather than about the decision: rank the candidates, work out
// which other boxes hold the same construct, and hand the facts over.
//
// A CONSTRUCT MADE EARLIER IN THIS PLAN IS NOT A FREEZER LOOKUP, and the caller decides that
// before asking: `planSources.js` only reaches here for inputs nothing upstream produces. Asking
// for a tube of something that will not exist until Tuesday is how a labsheet sends somebody to
// search a box for forty minutes.
import { chooseTemplateForPCR, findByConstruct } from '../../inventory/query.js';
import { whereOf } from './choosePrimerSource.js';
import { choose, describeTube } from '../rules/templateSample.rules.js';

/**
 * Which tube of a named construct to fetch, and where it is. → `rules/templateSample.rules.js`
 *
 * @param {Inventory|null} inv
 * @param {string} name  a construct, as a construction file names it
 * @returns {{status:string, where?:Object, note?:string}}
 */
export function chooseTemplateSample(inv, name) {
  const has = !!(inv && inv.samples && Object.keys(inv.samples).length);
  const { best, all } = has ? chooseTemplateForPCR(inv, name) : { best: null, all: [] };
  const byName = has ? findByConstruct(inv, name) : [];
  const sample = best ? best.sample : (all[0] ?? byName[0] ?? null);
  const where = sample ? whereOf(sample) : {};

  const got = choose({
    inv, name, best, all, byName, where,
    described: describeTube(sample),
    // Every other box holding the same construct, named beside the one we took. One construct
    // routinely sits in several, and a sheet naming only one sends somebody past the others.
    alsoIn: [...new Set(byName.map((s) => s.location?.boxname)
                              .filter((b) => b && b !== where.box))],
  });

  return { status: got.status,
           ...(got.where ? { where: got.where } : {}),
           ...(got.note ? { note: got.note } : { note: null }) };
}
