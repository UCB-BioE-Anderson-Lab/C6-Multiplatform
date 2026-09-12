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
  if (best) return describe(best.sample, inv, name);
  // Ranked nothing is not the same as found nothing: `chooseTemplateForPCR` filters to samples
  // annotated as plasmids, and a grid inventory that records no type annotates none of them.
  const any = all.length ? all : findByConstruct(inv, name);
  if (any.length) return describe(any[0], inv, name);
  return { status: 'absent', note: `no tube of ${name} is in the inventory` };
}

// A PLACED TUBE AND A TUBE IN A BOX ARE DIFFERENT ANSWERS. JCA, 2026-09-12: *"pJ01 is in the pink
// training box in the enzyme freezer. There is also one in the control stocks box. It's well gets
// moved around, but it's in there."* So where the well is not recorded, the box is stated, every
// other box holding the same construct is named beside it, and the well is left to be asked.
function describe(sample, inv, name) {
  const w = whereOf(sample);
  const rest = findByConstruct(inv, name)
    .map((s) => s.location?.boxname).filter((b) => b && b !== w.box);
  const also = [...new Set(rest)];
  return { status: w.wellUnknown ? 'box-only' : 'ready', where: w,
           note: noteFor(sample, w, also) };
}

// WHAT THE TUBE IS, THEN WHERE IT IS. JCA, 2026-09-12, of a note reading "in Control Stocks; the
// well is not recorded — miniprep": *"sounds like you are asking them to miniprep something."*
//
// He is right, and the cause is that the inventory's `concentration` column holds the word
// `miniprep` — a noun in the file and a verb on a labsheet. Every field here is a DESCRIPTION of a
// tube somebody is fetching, so each one is written as a noun phrase and the sentence leads with
// the thing rather than the place. A labsheet is read in a hurry and a bare verb at the end of a
// line is an instruction.
function noteFor(sample, where, also) {
  const what = kindOf(sample);
  const bits = [sample.clone && `clone ${sample.clone}`,
                sample.culture && `${sample.culture} culture`].filter(Boolean);
  const head = [what, ...bits].filter(Boolean).join(', ');
  if (!where.wellUnknown) return head || null;
  const tail = also.length ? ` Also in ${also.join(', ')}.` : '';
  return `${head ? `${head[0].toUpperCase()}${head.slice(1)} in ` : 'In '}${where.box}`
       + ` — the well is not recorded.${tail}`;
}

/** The concentration column, read as a description of the tube. */
function kindOf(sample) {
  const c = String(sample.concentration || '').trim();
  if (!c) return '';
  if (/^minipreps?$/i.test(c)) return 'miniprep DNA';
  if (/^(gdna|genomic)$/i.test(c)) return 'genomic DNA';
  if (/^(cells|glycerol)/i.test(c)) return c.toLowerCase();
  return `${c} stock`;
}
