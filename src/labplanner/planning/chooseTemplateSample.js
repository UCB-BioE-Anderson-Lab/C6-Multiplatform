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
 * CLONE BEATS CULTURE STAGE WHEN A CLONE IS NAMED, and that order is the whole reason the third
 * argument exists. The ranker below prefers a later culture stage because each re-isolation is
 * cleaner — right when the tubes are the same isolate, wrong when they are not. One construct
 * routinely has several isolates in the freezer and only one of them was sequence-verified and
 * carried forward, and stage ranking cannot see the difference: asked for a construct with two
 * primary minipreps of two different clones, it returns whichever sorted first.
 *
 * SO A NAMED CLONE THAT HAS NO TUBE IS `absent`, NEVER THE NEXT BEST TUBE. Falling back would
 * put a different isolate on the page under the name of the one somebody asked for, which is the
 * one failure this argument exists to prevent — and it would do it silently.
 *
 * @param {Inventory|null} inv
 * @param {string} name  a construct, as a construction file names it
 * @param {string} [clone]  the isolate to insist on, if the step named one
 * @returns {{status:string, where?:Object, note?:string}}
 */
export function chooseTemplateSample(inv, name, clone) {
  const has = !!(inv && inv.samples && Object.keys(inv.samples).length);
  const wanted = String(clone ?? '').trim();
  const { best, all } = has ? chooseTemplateForPCR(inv, name) : { best: null, all: [] };
  let byName = has ? findByConstruct(inv, name) : [];

  if (has && wanted) {
    const ofClone = byName.filter((s) => String(s.clone ?? s.location?.clone ?? '')
                                           .toLowerCase() === wanted.toLowerCase());
    if (!ofClone.length) {
      return { status: 'absent',
               note: `clone ${wanted} of ${name} is not in the inventory. `
                   + `${byName.length} tube(s) of ${name} are, under other clone names — `
                   + `this sheet will not send you to one of those.` };
    }
    // WITHIN THE RIGHT CLONE, THE OLD PREFERENCE STILL APPLIES: the latest culture stage wins,
    // because the stage ranking was never wrong — it was only blind. Filtering the RANKED list by
    // clone keeps both rules in their proper order, `best` first.
    //
    // `all` AND `best` ARE NOT THE SAME SHAPE. `best` is a wrapper with a `.sample`; `all` holds
    // the samples themselves — the line below this block has always relied on that, taking
    // `best.sample` or `all[0]`. Reading `.sample` off both matched nothing, every construct fell
    // through to the unranked list, and the sheet began naming 20x dilutions and primary cultures
    // where it had correctly named secondaries. Normalise before comparing.
    const sampleOf = (r) => (r && typeof r === 'object' && 'sample' in r) ? r.sample : r;
    const sameClone = (x) => String(x?.clone ?? x?.location?.clone ?? '').toLowerCase()
                             === wanted.toLowerCase();
    const ordered = [best, ...(all || [])].map(sampleOf).filter(Boolean);
    const sample = ordered.find(sameClone) ?? ofClone[0];
    const where = whereOf(sample);
    const got = choose({ inv, name, best: sample ? { sample } : null, all: ofClone, byName: ofClone, where,
                         described: describeTube(sample),
                         alsoIn: [...new Set(ofClone.map((s) => s.location?.boxname)
                                                    .filter((b) => b && b !== where.box))] });
    const cloneNote = `clone ${wanted}`;
    return { status: got.status,
             ...(got.where ? { where: got.where } : {}),
             note: got.note ? `${got.note} (${cloneNote})` : cloneNote };
  }

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
