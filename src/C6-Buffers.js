/**
 * C6-Buffers — which NEBuffer a restriction enzyme actually works in.
 *
 * WHY THIS FILE EXISTS. JCA, 2026-09-17: *"The deal is NEB keeps changing their buffers, and we
 * need to know what all the good ones are for a given enzyme."* It came out of Anisha Pallikonda
 * going to the JCA-only box for the Ligase1 probe digestion, looking for **NEB Buffer 2**, and not
 * finding it — because NEBuffer 2 has been renamed twice since the protocol that names it was
 * written. The buffer is in the box. The name on the bottle is `r2.1`.
 *
 * Two lookups, because they are two different questions:
 *
 *   - `buffersFor(enzyme)`   the protocol names an enzyme — which of the four buffers work?
 *   - `currentBuffer(name)`  the protocol names a buffer — what is it called now?
 *
 * TWO LAYERS, AND ONLY ONE OF THEM IS HAND-KEPT.
 *
 * **REBASE** — `src/data/rebase-enzymes.json`, refreshed by `bin/c6-rebase` from Roberts’
 * database at NEB, version-stamped and reissued monthly. Recognition sequence, cut offsets,
 * methylation sensitivity, and the buffer each supplier ships the enzyme in. 1482 enzymes, none
 * of them retyped. Its `cut5`/`cut3` convention is the one `C6-Sim.js` already uses, which is why
 * the two join on the enzyme name with no mapping.
 *
 * **NEB’s performance chart** — `NEB_ACTIVITY` below, hand-transcribed, 17 rows. This is the
 * part REBASE does not have: measured 2026-09-17, the string `%` appears ZERO times in all three
 * of REBASE’s msbuff files. REBASE gives the ONE supplied buffer. It does not give percent
 * activity in the other three, which is precisely *"what all the good ones are"* — nor
 * star-activity flags, incubation temperatures, or NEB’s HF/v2 product names (0 matches for
 * `HF`). So this layer is transcribed, and it is the only thing here that can rot.
 *
 * Activity values are kept as the **strings the chart prints** — `'100*'`, `'<10'` — and parsed on
 * the way out, so a row can be diffed against the PDF by eye. A bare `100` would already have
 * thrown away the `*`, and `*` is the difference between a clean digest and a smear.
 *
 * SOURCES, both retrieved 2026-09-17:
 *   REBASE 609 — ftp://ftp.neb.com/pub/rebase/msbuffmoretabs.txt
 *   Performance Chart for Restriction Enzymes (© 2023) —
 *   https://www.neb.com/en/-/media/posters/document/performance_chart_poster_0315.pdf
 *   (the filename says 0315; the document is the 2023 revision and uses the current r-buffer names)
 */
import REBASE from './data/rebase-enzymes.json' with { type: 'json' };


/** The four current NEBuffers, with their 1X compositions as NEB's performance chart prints them. */
export const NEB_BUFFERS = {
  'r1.1': {
    composition: '10 mM Bis-Tris-Propane-HCl, 10 mM MgCl2, 100 µg/ml Recombinant Albumin',
    pH: '7.0 @ 25°C',
  },
  'r2.1': {
    composition: '50 mM NaCl, 10 mM Tris-HCl, 10 mM MgCl2, 100 µg/ml Recombinant Albumin',
    pH: '7.9 @ 25°C',
  },
  'r3.1': {
    composition: '100 mM NaCl, 50 mM Tris-HCl, 10 mM MgCl2, 100 µg/ml Recombinant Albumin',
    pH: '7.9 @ 25°C',
  },
  rCutSmart: {
    composition: '50 mM Potassium acetate, 20 mM Tris-acetate, 10 mM Magnesium acetate, '
               + '100 µg/ml Recombinant Albumin',
    pH: '7.9 @ 25°C',
  },
};

/**
 * Every buffer name a lab protocol might still say, pointing at the bottle that is in the box now.
 * NEB discontinued the whole un-prefixed set on 2021-12-15. **The ionic composition never changed
 * down any of these chains** — only the protein and reducing agent did (no BSA → +BSA → rAlbumin,
 * DTT dropped) — which is why an old protocol's buffer choice is still the right choice, and
 * substituting the current name is a rename and not a substitution.
 */
export const NEB_BUFFER_ALIASES = {
  'NEBuffer 1': 'r1.1', 'NEBuffer 1.1': 'r1.1',
  'NEBuffer 2': 'r2.1', 'NEBuffer 2.1': 'r2.1',
  'NEBuffer 3': 'r3.1', 'NEBuffer 3.1': 'r3.1',
  // NEBuffer 4 was never renamed to "4.1" — NEB added BSA, dropped DTT, and called it CutSmart.
  'NEBuffer 4': 'rCutSmart', 'CutSmart': 'rCutSmart', 'CutSmart Buffer': 'rCutSmart',
};

/**
 * Names NEB no longer sells, and the product that took over. Kept SEPARATE from the alias table
 * because a renamed enzyme is not the same molecule: BsaI-HFv2 is engineered, and answering a
 * `BsaI` query with HFv2 numbers silently would be putting a different enzyme's data under the
 * name the protocol asked for.
 */
export const NEB_ENZYME_SUCCESSORS = {
  BsaI: { now: 'BsaI-HFv2', cat: 'R3733', why: 'BsaI (R0535) was discontinued 2020-12-31.' },
  BsmBI: { now: 'BsmBI-v2', cat: 'R0739', why: 'BsmBI-v2 (R0739) replaces BsmBI (R0580).' },
};

/**
 * Percent activity of each NEB restriction-enzyme PRODUCT in each of the four NEBuffers,
 * transcribed verbatim from NEB's performance chart. **This is the layer REBASE does not have.**
 *
 * `'*'` on a value means *may exhibit star activity in this buffer* — the chart's own footnote —
 * and `'<10'` is printed as such rather than rounded to a number. `supplied` is the buffer the
 * product ships with; `'U'` means its own unique buffer, none of the four. `inactivate: 'No'`
 * means heat inactivation does not work on it.
 *
 * Keyed by PRODUCT name, not prototype: `BsaI-HFv2`, not `BsaI`. REBASE knows the prototype and
 * this knows the bottle, and `buffersFor` is what joins them.
 */
export const NEB_ACTIVITY = {
  //                supplied      r1.1    r2.1    r3.1    rCutSmart  incub  inact  dil  substrate
  EcoRI:       { supplied: 'U',         'r1.1': '25',  'r2.1': '100*', 'r3.1': '50',  rCutSmart: '50*',  incubate: '37°C', inactivate: '65°C', dilution: 'C', substrate: 'λ DNA' },
  'EcoRI-HF':  { supplied: 'rCutSmart', 'r1.1': '10',  'r2.1': '100',  'r3.1': '<10', rCutSmart: '100',  incubate: '37°C', inactivate: '65°C', dilution: 'C', substrate: 'λ DNA' },
  BamHI:       { supplied: 'r3.1',      'r1.1': '75*', 'r2.1': '100*', 'r3.1': '100', rCutSmart: '100*', incubate: '37°C', inactivate: 'No',   dilution: 'A', substrate: 'λ DNA', note: '3' },
  'BamHI-HF':  { supplied: 'rCutSmart', 'r1.1': '100', 'r2.1': '50',   'r3.1': '10',  rCutSmart: '100',  incubate: '37°C', inactivate: 'No',   dilution: 'A', substrate: 'λ DNA' },
  BglII:       { supplied: 'r3.1',      'r1.1': '10',  'r2.1': '10',   'r3.1': '100', rCutSmart: '<10',  incubate: '37°C', inactivate: 'No',   dilution: 'A', substrate: 'λ DNA' },
  XhoI:        { supplied: 'rCutSmart', 'r1.1': '75',  'r2.1': '100',  'r3.1': '100', rCutSmart: '100',  incubate: '37°C', inactivate: '65°C', dilution: 'A', substrate: 'λ DNA (HindIII digest)', note: 'b' },
  EcoRV:       { supplied: 'r3.1',      'r1.1': '10',  'r2.1': '50',   'r3.1': '100', rCutSmart: '10',   incubate: '37°C', inactivate: '80°C', dilution: 'A', substrate: 'λ DNA' },
  'EcoRV-HF':  { supplied: 'rCutSmart', 'r1.1': '25',  'r2.1': '100',  'r3.1': '100', rCutSmart: '100',  incubate: '37°C', inactivate: '65°C', dilution: 'B', substrate: 'λ DNA' },
  PvuII:       { supplied: 'r3.1',      'r1.1': '50',  'r2.1': '100',  'r3.1': '100', rCutSmart: '100*', incubate: '37°C', inactivate: 'No',   dilution: 'B', substrate: 'λ DNA' },
  'PvuII-HF':  { supplied: 'rCutSmart', 'r1.1': '<10', 'r2.1': '<10',  'r3.1': '<10', rCutSmart: '100',  incubate: '37°C', inactivate: 'No',   dilution: 'B', substrate: 'λ DNA' },
  PstI:        { supplied: 'r3.1',      'r1.1': '75',  'r2.1': '75',   'r3.1': '100', rCutSmart: '50*',  incubate: '37°C', inactivate: '80°C', dilution: 'C', substrate: 'λ DNA' },
  'PstI-HF':   { supplied: 'rCutSmart', 'r1.1': '10',  'r2.1': '75',   'r3.1': '50',  rCutSmart: '100',  incubate: '37°C', inactivate: 'No',   dilution: 'C', substrate: 'λ DNA' },
  XbaI:        { supplied: 'rCutSmart', 'r1.1': '<10', 'r2.1': '100',  'r3.1': '75',  rCutSmart: '100',  incubate: '37°C', inactivate: '65°C', dilution: 'A', substrate: 'λ DNA' },
  'SpeI-HF':   { supplied: 'rCutSmart', 'r1.1': '25',  'r2.1': '50',   'r3.1': '10',  rCutSmart: '100',  incubate: '37°C', inactivate: '80°C', dilution: 'C', substrate: 'pXba-XbaI DNA' },
  'BsaI-HFv2': { supplied: 'rCutSmart', 'r1.1': '100', 'r2.1': '100',  'r3.1': '100', rCutSmart: '100',  incubate: '37°C', inactivate: '80°C', dilution: 'B', substrate: 'pXba DNA' },
  'BsmBI-v2':  { supplied: 'r3.1',      'r1.1': '<10', 'r2.1': '50',   'r3.1': '100', rCutSmart: '25',   incubate: '55°C', inactivate: '80°C', dilution: 'B', substrate: 'λ DNA' },
  BseRI:       { supplied: 'rCutSmart', 'r1.1': '100', 'r2.1': '100',  'r3.1': '75',  rCutSmart: '100',  incubate: '37°C', inactivate: '80°C', dilution: 'A', substrate: 'λ DNA', note: 'd' },
};

/** The chart's own footnotes, so a `note` on a row above resolves without going back to the PDF. */
export const NEB_CHART_NOTES = {
  a: 'Ligation is < 10%',
  b: 'Ligation is 25% – 75%',
  c: 'Recutting after ligation is < 5%',
  d: 'Recutting after ligation is 50% – 75%',
  e: 'Ligation and recutting after ligation is not applicable — the enzyme is a nicking enzyme, '
   + 'is affected by methylation, or cleaves outside its recognition sequence.',
  1: 'Star activity may result from extended digestion, high enzyme concentration or a glycerol '
   + 'concentration of > 5%.',
  2: 'Star activity may result from extended digestion.',
  3: 'Star activity may result from a glycerol concentration of > 5%.',
};

/** One chart cell — `'100*'` becomes a number, a star flag, and whether it was a `<` bound. */
function cell(raw) {
  const star = raw.endsWith('*');
  const t = star ? raw.slice(0, -1) : raw;
  const below = t.startsWith('<');
  return { raw, percent: Number(below ? t.slice(1) : t), star, below };
}

const BUFFERS = ['r1.1', 'r2.1', 'r3.1', 'rCutSmart'];

/**
 * What buffer to digest a given enzyme in, from both layers at once.
 *
 * Pass a protocol's enzyme name — the prototype (`BsaI`) or the product on the bottle
 * (`BsaI-HFv2`); both work. Returns REBASE's facts about the enzyme joined to NEB's activity row
 * for every product sold under that name, each graded into `best` / `workable` / `starRisk` /
 * `avoid`, so a double digest is the intersection of two `workable` lists.
 *
 * ABSENCE IS NOT A ZERO, and this is the whole reason the return shape is what it is. Three
 * different nothings have to stay distinguishable, because a caller that collapses them
 * recommends water:
 *
 *   - `status: 'unknown'` — REBASE has never heard of this name. Says nothing about buffers.
 *   - `products: []` — REBASE knows the enzyme, but it is on no row of NEB's chart, so the
 *     cross-buffer numbers were never looked up. NOT "no buffer works".
 *   - `best: []` on a product — the numbers WERE looked up and no buffer reaches 100% without
 *     star-activity risk. That one IS a finding, and `advice` says so in words.
 *
 * @param {string} name - Enzyme name, e.g. 'EcoRI', 'BsaI', 'BsmBI-v2'. Case-sensitive, as REBASE
 *   and NEB both spell them.
 * @returns {object} `{query, status, enzyme, products, advice}` — see above for the three nothings.
 */
export function buffersFor(name) {
  const query = String(name || '').trim();
  const rebase = REBASE.enzymes[query] || null;

  // A chart row belongs to this query if it IS the query or is a product of it: 'BsaI' owns
  // 'BsaI-HFv2', 'SpeI' owns 'SpeI-HF'. Derived rather than mapped by hand, so a future
  // '-HFv3' is picked up by existing code. The '-' is what stops 'EcoRI' claiming 'EcoRV'.
  const rows = Object.keys(NEB_ACTIVITY)
    .filter((k) => k === query || k.startsWith(`${query}-`)
                || (NEB_ENZYME_SUCCESSORS[query] || {}).now === k);

  const products = rows.map((product) => {
    const row = NEB_ACTIVITY[product];
    const activity = Object.fromEntries(BUFFERS.map((b) => [b, cell(row[b])]));
    const ok = (b) => !activity[b].star && !activity[b].below;
    const best = BUFFERS.filter((b) => ok(b) && activity[b].percent === 100);
    const workable = BUFFERS.filter((b) => ok(b) && activity[b].percent >= 50);
    return {
      product,
      supplied: row.supplied === 'U' ? (rebase?.supplied?.N || 'its own unique buffer')
                                     : row.supplied,
      suppliedIsStandard: row.supplied !== 'U',
      activity,
      best,
      workable,
      starRisk: BUFFERS.filter((b) => activity[b].star),
      avoid: BUFFERS.filter((b) => activity[b].below || activity[b].percent < 50),
      incubate: row.incubate,
      inactivate: row.inactivate,
      heatKills: row.inactivate !== 'No',
      unitSubstrate: row.substrate,
      note: row.note ? { code: row.note, says: NEB_CHART_NOTES[row.note] } : null,
    };
  });

  if (!rebase && !products.length) {
    return {
      query,
      status: 'unknown',
      enzyme: null,
      products: [],
      advice: `REBASE ${REBASE.rebaseVersion} has no enzyme called "${query}", and it is on no row `
            + 'of the NEB chart transcribed here. This is a name that was not found — it is NOT a '
            + 'finding that no buffer works. Check the spelling (both sources are case-sensitive), '
            + 'or run bin/c6-rebase if the enzyme is newer than the stored REBASE release.',
    };
  }

  const renamed = NEB_ENZYME_SUCCESSORS[query];
  const parts = [];
  if (renamed) {
    parts.push(`${query} is not what NEB ships any more — ${renamed.why} The activity numbers `
             + `below are ${renamed.now} (NEB #${renamed.cat}), which is an ENGINEERED enzyme and `
             + `not the same protein, though it reads the same site.`);
  }
  // THE QUERY IS NOT ITSELF ON THE CHART, BUT A PRODUCT OF IT IS. Asking about `SpeI` returned
  // SpeI-HF's numbers with nothing saying so — and NEB still sells plain SpeI (R0133), so this is
  // not a rename that can be waved through. The numbers are a DIFFERENT product's.
  if (products.length && !rows.includes(query) && !renamed) {
    parts.push(`${query} itself is on no row of the chart transcribed here — the numbers below are `
             + `${rows.join(', ')}, a different product reading the same site. NEB still lists `
             + `${query} separately, so if that is what is in the freezer its cross-buffer activity `
             + 'was not looked up here. REBASE has its supplied buffer'
             + `${rebase?.supplied?.N ? `: ${rebase.supplied.N}` : ''}.`);
  }
  if (!products.length) {
    parts.push(`REBASE knows ${query} and NEB ships it in ${rebase.supplied?.N || 'no listed NEBuffer'}, `
             + 'but it is on no row of the performance chart transcribed here, so its activity in '
             + 'the other three buffers was never looked up. That is a gap in this table, not a '
             + 'property of the enzyme.');
  }
  for (const p of products) {
    if (p.best.length) {
      const first = p.suppliedIsStandard && p.best.includes(p.supplied) ? p.supplied : p.best[0];
      parts.push(`${p.product}: use ${first} (100%${p.best.length > 1
        ? `; ${p.best.join(', ')} all reach 100% clean` : ''}). Digest at ${p.incubate}`
        + `${p.heatKills ? `, kill at ${p.inactivate}` : ' — heat inactivation does NOT work'}.`);
    } else {
      parts.push(`${p.product}: NO standard NEBuffer reaches 100% without star-activity risk `
        + `(${BUFFERS.map((b) => `${b} ${p.activity[b].raw}`).join(', ')}). It ships in `
        + `${p.supplied}. This is a measured finding, not missing data — use the supplied buffer, `
        + 'keep the digest short, or switch to the HF product on the same site.');
    }
    if (p.starRisk.length) {
      parts.push(`  star activity possible in ${p.starRisk.join(', ')}`
        + `${p.note ? ` — chart note ${p.note.code}: ${p.note.says}` : ''}.`);
    }
  }
  if (rebase?.methylation) {
    parts.push(`  methylation (REBASE): ${Object.entries(rebase.methylation)
      .map(([k, v]) => `${k} ${v}`).join(', ')}.`);
  }

  return {
    query,
    status: renamed ? 'renamed' : 'found',
    enzyme: rebase && {
      name: query,
      site: rebase.site,
      cut5: rebase.cut5,
      cut3: rebase.cut3,
      // ABSENT, NOT EMPTY. REBASE listing no methylation sensitivity means it listed none — it
      // does not mean the enzyme is insensitive. `undefined` reads as "not stated"; `{}` would
      // read as "nothing blocks it", and PstI is exactly that case.
      methylation: rebase.methylation,
      suppliedBy: rebase.supplied,
      rebaseVersion: REBASE.rebaseVersion,
    },
    products,
    advice: parts.join('\n'),
  };
}

/**
 * What a buffer named in an old protocol is called on the bottle today.
 *
 * NEB discontinued the whole un-prefixed set on 2021-12-15. **The ionic composition never changed
 * down any of these chains** — only the protein and reducing agent did — so an old protocol's
 * buffer CHOICE is still right and this is a rename, not a substitution. That is the difference
 * that matters at the bench: nobody has to re-derive the digest.
 *
 * @param {string} name - A buffer as written in a protocol, e.g. 'NEB Buffer 2', 'CutSmart'.
 * @returns {object} `{query, current, composition, pH, renamed, note}`, or `current: null` when the
 *   name is not one of NEB's four chains — which means unrecognised, not "no such buffer".
 */
export function currentBuffer(name) {
  const query = String(name || '').trim();
  // 'NEB Buffer 2', 'NEBuffer 2', 'nebuffer2' — protocols write it every way. Normalise for the
  // lookup and keep the caller's spelling in the answer.
  const key = query.replace(/^NEB\s*Buffer/i, 'NEBuffer').replace(/^NEBuffer\s*/i, 'NEBuffer ');
  const current = NEB_BUFFERS[query] ? query
    : (NEB_BUFFER_ALIASES[key] || NEB_BUFFER_ALIASES[query] || null);
  if (!current) {
    return {
      query,
      current: null,
      renamed: false,
      note: `"${query}" is not one of NEB's four buffer chains (NEBuffer 1/2/3/4 and their `
          + 'current r1.1 / r2.1 / r3.1 / rCutSmart names). Unrecognised here — which is not the '
          + 'same as saying no such buffer exists; other suppliers’ buffers are in REBASE.',
    };
  }
  return {
    query,
    current,
    composition: NEB_BUFFERS[current].composition,
    pH: NEB_BUFFERS[current].pH,
    renamed: current !== query,
    note: current === query ? `${query} is the current name.`
      : `${query} is the old name for ${current}. Same salts, same Mg2+, same pH — NEB only `
      + 'swapped the protein (no BSA → BSA → recombinant albumin) and dropped the DTT. '
      + 'The bottle in the box says ' + current + '.',
  };
}

/**
 * Every name a bottle of a given current NEBuffer might carry, oldest first.
 *
 * A shared freezer box is an ARCHIVE, not a catalogue: it accumulates for a decade and nobody
 * relabels anything when NEB renames a product. So answering "use r3.1" to somebody standing at
 * an old box is answering a question they cannot act on — there may be no bottle with that word
 * on it, and three that would have worked.
 *
 * SPELLED OUT, NOT DERIVED FROM `NEB_BUFFER_ALIASES`. Inverting the alias table at load time made
 * the right-hand side a CALL, and `bin/c6-sharables` types a call as a `function` — so this
 * constant got a record saying `c6-call ... NEB_BUFFER_LABELS`, which cannot run. A record that
 * declares itself runnable and is not is exactly what that generator's own header warns about.
 * The cost of writing it out is drift, and `test/C6-Buffers.test.js` asserts it against the
 * inversion so the drift cannot happen quietly.
 */
export const NEB_BUFFER_LABELS = {
  'r1.1': ['NEBuffer 1', 'NEBuffer 1.1', 'r1.1'],
  'r2.1': ['NEBuffer 2', 'NEBuffer 2.1', 'r2.1'],
  'r3.1': ['NEBuffer 3', 'NEBuffer 3.1', 'r3.1'],
  rCutSmart: ['NEBuffer 4', 'CutSmart', 'CutSmart Buffer', 'rCutSmart'],
};

/** The chart row to answer a query with, plus whether it is the enzyme actually asked about. */
function primaryRow(name) {
  const r = buffersFor(name);
  const exact = r.products.find((p) => p.product === name);
  return { result: r, row: exact || r.products[0] || null, isExact: !!exact };
}

/**
 * Which NEBuffers could work for a WHOLE SET of enzymes — every buffer, not just the best one.
 *
 * JCA, 2026-09-17: *"we need to name all the NEB buffers that could work for the enzymes they are
 * using. There is a 'jca-only' box that has many different buffers in it, and something in there
 * should work."* That is a different question from `buffersFor`, in two ways that matter:
 *
 *   1. **All of them, graded — not the winner.** Somebody at a freezer needs the whole acceptable
 *      set, because what they can reach is decided by the box, not by the chart. So every buffer
 *      comes back with a verdict, including the ones that will not do, and WHY.
 *   2. **Under every name it was ever sold as.** `alsoLabelled` carries the legacy names, because
 *      the bottle in a ten-year-old box says `NEBuffer 3`, not `r3.1`.
 *
 * `shared` is the buffers that clear the bar for EVERY enzyme in the set. For separate digests
 * that is a convenience — one buffer, three tubes. For a double digest it is the requirement.
 *
 * AN EMPTY `shared` IS A FINDING. It means no single buffer serves them all and they must be
 * digested separately or sequentially — NOT that the lookup failed, which is why `unanswerable`
 * is a distinct field naming the enzymes that had no chart row at all.
 *
 * @param {string[]} names - Enzyme names, e.g. ['BglII', 'EcoRV', 'PstI'].
 * @returns {object} `{enzymes, perBuffer, shared, sharedClean, unanswerable, advice}`.
 */
export function buffersForAll(names) {
  const asked = (names || []).map((n) => String(n).trim()).filter(Boolean);
  const looked = asked.map((n) => ({ name: n, ...primaryRow(n) }));
  const unanswerable = looked.filter((l) => !l.row).map((l) => l.name);
  const usable = looked.filter((l) => l.row);

  const grade = (cell) => {
    if (cell.star) return { verdict: 'caution', why: 'may show star activity in this buffer' };
    if (cell.below) return { verdict: 'no', why: `under ${cell.percent}% activity` };
    if (cell.percent === 100) return { verdict: 'ideal', why: '100% activity' };
    if (cell.percent >= 50) return { verdict: 'workable', why: `${cell.percent}% activity` };
    return { verdict: 'no', why: `only ${cell.percent}% activity` };
  };

  const perBuffer = Object.fromEntries(BUFFERS.map((b) => {
    const byEnzyme = Object.fromEntries(usable.map((l) => [l.name, {
      product: l.row.product,
      raw: l.row.activity[b].raw,
      ...grade(l.row.activity[b]),
    }]));
    const verdicts = Object.values(byEnzyme).map((v) => v.verdict);
    return [b, {
      alsoLabelled: NEB_BUFFER_LABELS[b],
      composition: NEB_BUFFERS[b].composition,
      byEnzyme,
      servesAll: verdicts.length > 0 && verdicts.every((v) => v === 'ideal' || v === 'workable'),
      allIdeal: verdicts.length > 0 && verdicts.every((v) => v === 'ideal'),
    }];
  }));

  const shared = BUFFERS.filter((b) => perBuffer[b].servesAll);
  const sharedClean = BUFFERS.filter((b) => perBuffer[b].allIdeal);

  const parts = [];
  // THE TUBE THAT CAME WITH THE ENZYME. When every enzyme in the set ships in the same buffer,
  // nobody has to find anything in the box at all — the vial next to each enzyme is already it.
  // That is the most actionable sentence available and it was buried in a field.
  const supplied = [...new Set(usable.map((l) => l.row.supplied))];
  if (usable.length > 1 && supplied.length === 1 && NEB_BUFFERS[supplied[0]]) {
    parts.push(`All of ${usable.map((l) => l.name).join(', ')} SHIP in ${supplied[0]} — the buffer `
             + 'tube that came with each enzyme is the right one, so nothing has to be found in a '
             + 'shared box.');
  }
  if (unanswerable.length) {
    parts.push(`No chart row here for ${unanswerable.join(', ')} — their cross-buffer activity was `
             + 'never looked up, so they are excluded from the verdicts below rather than counted '
             + 'as failing.');
  }
  if (sharedClean.length) {
    for (const b of sharedClean) {
      parts.push(`${b} — 100% for all of ${usable.map((l) => l.name).join(', ')}. `
               + `On an older bottle this is labelled ${NEB_BUFFER_LABELS[b].slice(0, -1).join(' or ')}.`);
    }
  }
  for (const b of shared.filter((x) => !sharedClean.includes(x))) {
    parts.push(`${b} — workable but not ideal: `
             + `${Object.entries(perBuffer[b].byEnzyme).map(([e, v]) => `${e} ${v.raw}`).join(', ')}. `
             + `Also labelled ${NEB_BUFFER_LABELS[b].slice(0, -1).join(' or ')}.`);
  }
  if (!shared.length && usable.length) {
    parts.push('NO single NEBuffer serves all of them — this is a measured finding, not a failed '
             + 'lookup. Digest separately, each in its own best buffer: '
             + usable.map((l) => {
               const best = l.row.best[0] || l.row.workable[0];
               return `${l.name} in ${best || l.row.supplied}`;
             }).join(', ') + '.');
  }
  for (const b of BUFFERS.filter((x) => !shared.includes(x))) {
    const bad = Object.entries(perBuffer[b].byEnzyme).filter(([, v]) => v.verdict !== 'ideal' && v.verdict !== 'workable');
    if (bad.length) {
      parts.push(`  NOT ${b} — ${bad.map(([e, v]) => `${e} ${v.raw} (${v.why})`).join(', ')}.`);
    }
  }

  return {
    enzymes: usable.map((l) => ({
      asked: l.name,
      answeredWith: l.row.product,
      isExact: l.isExact,
      supplied: l.row.supplied,
    })),
    perBuffer,
    shared,
    sharedClean,
    unanswerable,
    advice: parts.join('\n'),
  };
}
