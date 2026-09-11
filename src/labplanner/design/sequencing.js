// sequencing.js — will this sequencing oligo read the thing we changed?
//
// JCA, 2026-09-10: *"Sequencing oligos are exact string match, so you just have to look for the
// oligo in the sequence exactly, then pull the region between +20 and 800 of where the 3' end
// lands, and confirm that the region you mutated is in that window."*
//
// EXACT MATCH, NOT ANNEALING. A sequencing primer is not doing PCR — there is no tolerance
// question and no 18 nt rule. Either the string is in the template or it is not, and the whole
// reason to write this down is that the last session kept reaching for annealing logic where a
// string search was the right and simpler answer.
//
// THE READ WINDOW IS +20 TO +800 FROM THE 3' END. The first ~20 bases after the primer are
// unreadable and the trace degrades past ~800. A target at +5 or at +1200 is not "probably
// fine"; it is not covered, and a labsheet that says to sequence it is asking for a result the
// method cannot give.
//
// MORE THAN ONE SITE IS A FINDING. Two exact sites give two overlapping traces and an
// unreadable result — the one failure a construction file can never show you.
export const READ_FROM = 20;
export const READ_TO = 800;

const RC = (s) => String(s).toUpperCase().split('').reverse()
  .map((c) => ({ A: 'T', T: 'A', G: 'C', C: 'G' }[c] || 'N')).join('');

/** Every exact site for `oligo` in `template`, on both strands. Circular by default. */
export function findSites(template, oligo, { circular = true } = {}) {
  const t = String(template).toUpperCase();
  const o = String(oligo).toUpperCase().replace(/\s/g, '');
  const hay = circular ? t + t.slice(0, o.length - 1) : t;
  const out = [];
  for (const [strand, probe] of [['+', o], ['-', RC(o)]]) {
    let i = -1;
    while ((i = hay.indexOf(probe, i + 1)) >= 0) {
      // 3' end of the primer, in template coordinates, and which way it reads from there
      const threePrime = strand === '+' ? (i + o.length) % t.length
                                        : ((i % t.length) - 1 + t.length) % t.length;
      out.push({ strand, start: (i % t.length) + 1, length: o.length, threePrime: threePrime + 1 });
    }
  }
  return out;
}

/**
 * What a read primed here actually covers.
 * @returns {{from:number,to:number,strand:string}} 1-based, inclusive, may wrap
 */
export function readWindow(template, site, { from = READ_FROM, to = READ_TO } = {}) {
  const L = String(template).length;
  const p = site.threePrime;
  const at = (d) => ((p - 1 + (site.strand === '+' ? d : -d)) % L + L) % L + 1;
  return { from: at(from), to: at(to), strand: site.strand };
}

const inWindow = (pos, w, L) => {
  if (w.strand === '+') return w.from <= w.to ? pos >= w.from && pos <= w.to
                                             : pos >= w.from || pos <= w.to;
  return w.from >= w.to ? pos <= w.from && pos >= w.to : pos <= w.from || pos >= w.to;
};

/**
 * Does this oligo read the target region of this template?
 * @param {string} template
 * @param {string} oligo
 * @param {{start:number,end:number}} target  1-based inclusive
 */
export function readsTarget(template, oligo, target, opts = {}) {
  const L = String(template).length;
  const sites = findSites(template, oligo, opts);
  if (!sites.length) return { ok: false, sites: 0, why: 'the oligo does not occur in this sequence' };
  if (sites.length > 1)
    return { ok: false, sites: sites.length,
             why: `${sites.length} exact sites — two overlapping traces, so the read is unusable` };
  const w = readWindow(template, sites[0], opts);
  const bothEnds = inWindow(target.start, w, L) && inWindow(target.end, w, L);
  const dist = (() => {
    const d = (target.start - sites[0].threePrime) * (sites[0].strand === '+' ? 1 : -1);
    return ((d % L) + L) % L;
  })();
  return {
    ok: bothEnds, sites: 1, site: sites[0], window: w, distance: dist,
    why: bothEnds
      ? `target sits ${dist} bp from the 3' end, inside the ${opts.from ?? READ_FROM}-${opts.to ?? READ_TO} window`
      : `target sits ${dist} bp from the 3' end — outside the ${opts.from ?? READ_FROM}-${opts.to ?? READ_TO} window`,
  };
}

/** Which of a set of candidate oligos can read this target — the usual planning question. */
export function chooseSequencingOligo(template, oligos, target, opts = {}) {
  const tried = Object.entries(oligos).map(([name, seq]) =>
    ({ name, ...readsTarget(template, seq, target, opts) }));
  return { usable: tried.filter((t) => t.ok).sort((a, b) => a.distance - b.distance),
           rejected: tried.filter((t) => !t.ok) };
}
