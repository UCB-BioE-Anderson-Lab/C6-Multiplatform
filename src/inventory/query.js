/**
 * Read-only queries over the inventory indices.
 * Includes preference/constraint-aware selection helpers for:
 *  - Oligos (working stock selection by µM with hard minima)
 *  - Plasmid minipreps (culture stage preference: tertiary > secondary > primary)
 */

import { locKey } from './inventory.js';

/**
 * The sample at exactly this location, or null.
 *
 * @param {Inventory} inv
 * @param {Location} location
 * @returns {Sample|null}
 */
export function getSample(inv, location) {
  return inv.samples[locKey(location)] || null;
}

/**
 * Every sample of a named construct, anywhere in the inventory.
 *
 * Matching is case-insensitive, and one construct routinely has several samples — a 100 uM stock
 * and a 10 uM working dilution, or four minipreps of the same clone. This returns all of them and
 * does not choose; `chooseOligoForPCR` and `chooseTemplateForPCR` are what rank them.
 *
 * @param {Inventory} inv
 * @param {string} construct
 * @returns {Array<Sample>} possibly empty
 */
export function findByConstruct(inv, construct) {
  const key = (construct || '').toLowerCase();
  const set = inv.construct_to_locations[key];
  if (!set) return [];
  return Array.from(set).map(k => inv.samples[k]);
}

/**
 * Every sample whose concentration field matches this string EXACTLY.
 *
 * A string comparison, not a measurement: "10 uM" and "10uM" are different values here, because
 * the field records what is written on the tube. Use `rankOligoSamples`, which parses the number,
 * when you mean "at least this concentrated".
 *
 * @param {Inventory} inv
 * @param {string} conc - as labelled, e.g. '100 uM', 'miniprep'
 * @returns {Array<Sample>}
 */
export function findByConcentration(inv, conc) {
  const out = [];
  for (const [k, v] of Object.entries(inv.loc_to_conc)) {
    if (v === conc) out.push(inv.samples[k]);
  }
  return out;
}

/**
 * Every sample of a named clone, case-insensitively.
 *
 * A clone is one isolate that may or may not match the design; several samples can come from it.
 *
 * @param {Inventory} inv
 * @param {string} clone
 * @returns {Array<Sample>}
 */
export function findByClone(inv, clone) {
  const out = [];
  for (const [k, v] of Object.entries(inv.loc_to_clone)) {
    if ((v || '').toLowerCase() === String(clone).toLowerCase()) out.push(inv.samples[k]);
  }
  return out;
}

/**
 * Every sample from a named culture stage, case-insensitively — 'primary', 'secondary',
 * 'tertiary', 'library'.
 *
 * @param {Inventory} inv
 * @param {string} culture
 * @returns {Array<Sample>}
 */
export function findByCulture(inv, culture) {
  const out = [];
  for (const [k, v] of Object.entries(inv.loc_to_culture)) {
    if ((v || '').toLowerCase() === String(culture).toLowerCase()) out.push(inv.samples[k]);
  }
  return out;
}

// ------------------ Preference & constraint helpers ------------------

function isOligo(sample) {
  return String(sample?.type || sample?.metadata?.type || '').toLowerCase() === 'oligo';
}

function isPlasmid(sample) {
  return String(sample?.type || sample?.metadata?.type || '').toLowerCase() === 'plasmid';
}

// parse typical concentration tokens into µM for oligos
function _parseOligoUM(concStr) {
  if (!concStr && concStr !== 0) return null;
  const t = String(concStr).trim().toLowerCase().replace('µ','u');
  // accept forms like '10 uM', 'uM10', '10uM', '2660 nM'
  let m = t.match(/([0-9]*\.?[0-9]+)\s*u\s*m/);
  if (m) return { uM: parseFloat(m[1]) };
  m = t.match(/u\s*m\s*([0-9]*\.?[0-9]+)/);
  if (m) return { uM: parseFloat(m[1]) };
  m = t.match(/([0-9]*\.?[0-9]+)\s*n\s*m/);
  if (m) return { uM: parseFloat(m[1]) / 1000 };
  return null;
}

/**
 * Rank oligo samples for PCR using a minimum µM and a preferred list (e.g., [10, 100, 2.66]).
 * Returns { ranked: Array<{sample,uM,eligible,score,reason}>, best }
 */
export function rankOligoSamples(samples, opts = {}) {
  const min_uM = opts.min_uM ?? 10;
  const preferUM = Array.isArray(opts.preferUM) ? opts.preferUM : [10, 100, 2.66];
  const ranked = (samples || []).map(s => {
    const parsed = _parseOligoUM(s.concentration);
    const uM = parsed ? parsed.uM : NaN;
    const eligible = Number.isFinite(uM) && uM >= min_uM;
    let prefIndex = -1;
    for (let i = 0; i < preferUM.length; i++) {
      if (Number.isFinite(uM) && Math.abs(uM - preferUM[i]) < 0.25) { prefIndex = i; break; }
    }
    if (prefIndex === -1) prefIndex = preferUM.length;
    const penalty = eligible ? 0 : 1000; // ineligible pushed to the bottom
    const score = penalty + prefIndex * 10 + (Number.isFinite(uM) ? Math.abs(uM - min_uM) : 999);
    const reason = eligible
      ? (prefIndex < preferUM.length ? `working stock ~${preferUM[prefIndex]} uM` : `>= ${min_uM} uM`)
      : `below minimum ${min_uM} uM or unparseable`;
    return { sample: s, uM, eligible, score, reason };
  }).sort((a, b) => a.score - b.score);
  const best = ranked.find(r => r.eligible) || null;
  return { ranked, best };
}

/**
 * Given an inventory and an oligo name, return { best, ranked, all } for PCR use.
 * Hard constraint: min_uM (default 10). Only oligos considered if type is annotated.
 */
export function chooseOligoForPCR(inv, oligoName, opts = {}) {
  const all = findByConstruct(inv, oligoName).filter(s => !s.type || isOligo(s));
  const { ranked, best } = rankOligoSamples(all, opts);
  return { best, ranked, all };
}

// Culture preference for minipreps
const DEFAULT_CULTURE_ORDER = ['tertiary', 'secondary', 'primary'];

/** Rank plasmid minipreps by culture stage preference (desc). */
export function rankMinipreps(samples, opts = {}) {
  const order = (opts.preferCulture || DEFAULT_CULTURE_ORDER).map(s => String(s).toLowerCase());
  const rankMap = new Map(order.map((c, i) => [c, order.length - i]));
  const ranked = (samples || []).map(s => {
    const culture = String(s.culture || s.metadata?.culture || '').toLowerCase();
    const rank = rankMap.get(culture) || 0;
    const score = -rank; // higher rank preferred
    const reason = rank > 0 ? `prefer ${culture}` : 'unranked culture';
    return { sample: s, culture, rank, score, reason };
  }).sort((a, b) => a.score - b.score);
  const best = ranked.length ? ranked[0] : null;
  return { ranked, best };
}

/** Choose a plasmid template for PCR by name with culture preference. */
export function chooseTemplateForPCR(inv, templateName, opts = {}) {
  const all = findByConstruct(inv, templateName).filter(s => !s.type || isPlasmid(s));
  const { ranked, best } = rankMinipreps(all, opts);
  return { best, ranked, all };
}

/**
 * Convenience: choose forward/reverse oligos and a plasmid template for PCR.
 * Returns a summary with any hard-constraint failures noted.
 */
export function choosePCRInputs(inv, { forwardName, reverseName, templateName }, opts = {}) {
  const oligoOpts = { min_uM: opts.min_uM ?? 10, preferUM: opts.preferUM || [10, 100, 2.66] };
  const tmplOpts  = { preferCulture: opts.preferCulture || DEFAULT_CULTURE_ORDER };

  const fwd = chooseOligoForPCR(inv, forwardName, oligoOpts);
  const rev = chooseOligoForPCR(inv, reverseName, oligoOpts);
  const tmpl = chooseTemplateForPCR(inv, templateName, tmplOpts);

  const problems = [];
  if (!fwd.best) problems.push(`No eligible forward oligo ≥ ${oligoOpts.min_uM} uM`);
  if (!rev.best) problems.push(`No eligible reverse oligo ≥ ${oligoOpts.min_uM} uM`);
  if (!tmpl.best) problems.push('No preferred plasmid template found');

  return { forward: fwd, reverse: rev, template: tmpl, problems };
}
