// chooseTemplateSample.js — for one named construct, the tube to pull it from.
//
// JCA, 2026-09-11, writing the characterization file's own commentary: *"It is literally
// referring to a sequence, in whatever drop of liquid you find in the freezer. It is not a
// specific sample, and it is not necessarily from mach1. But it should be identifiable, and
// linked to a source tube in the inventory like with pcr."*
//
// That is the whole job. A construction file names a CONSTRUCT — `pJ01`, `pBET8` — and the bench
// needs a BOX AND A WELL. One construct routinely has several tubes, so this ranks them the way
// `query.js` already does (tertiary culture over secondary over primary) and says which it took.
//
// A CONSTRUCT MADE EARLIER IN THIS PLAN IS NOT A FREEZER LOOKUP, and the caller decides that
// before asking: `planSources.js` only reaches here for inputs nothing upstream produces. Asking
// for a tube of something that will not exist until Tuesday is how a labsheet sends somebody to
// search a box for forty minutes.
import { chooseTemplateForPCR, findByConstruct } from '../../inventory/query.js';
import { whereOf } from './choosePrimerSource.js';

/**
 * @param {Inventory|null} inv
 * @param {string} name
 * @returns {{status:string, where?:Object, note?:string}}
 */
export function chooseTemplateSample(inv, name) {
  if (!inv || !inv.samples || Object.keys(inv.samples).length === 0) {
    return { status: 'unsearched', note: 'no inventory was read, so nothing was looked up' };
  }
  const { best, all } = chooseTemplateForPCR(inv, name);
  if (best) {
    const s = best.sample;
    return { status: 'ready', where: whereOf(s),
             note: [s.concentration, s.clone && `clone ${s.clone}`, s.culture]
                     .filter(Boolean).join(', ') || null };
  }
  // Ranked nothing is not the same as found nothing: `chooseTemplateForPCR` filters to samples
  // annotated as plasmids, and a grid inventory that records no type annotates none of them.
  const any = all.length ? all : findByConstruct(inv, name);
  if (any.length) {
    const s = any[0];
    return { status: 'ready', where: whereOf(s),
             note: [s.concentration, s.clone && `clone ${s.clone}`].filter(Boolean).join(', ')
                   || null };
  }
  return { status: 'absent', note: `no tube of ${name} is in the inventory` };
}
