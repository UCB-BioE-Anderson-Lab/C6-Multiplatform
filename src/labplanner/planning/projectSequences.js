// projectSequences.js — resolve a construction file's named inputs across a whole project.
//
//     import { projectSequences } from '.../projectSequences.js';
//     const { oligos, plasmids, sources } = projectSequences('/path/to/project');
//
// WHY THIS IS PROJECT-WIDE AND NOT PER-EXPERIMENT. A construction file names its inputs and
// says nothing about where they live, because in a real lab they live wherever they were made:
// SynThera's `Construction of pGhost16.txt` takes `pBACr899` from SLIP4 and `pGhost12-A` from
// SLIP3, two folders apart. Anything that resolves only within the experiment folder reports
// the other input as missing, which is a false finding about a file that is correct.
//
// WHERE SEQUENCES ACTUALLY ARE — all four of these, because each holds some that no other does:
//
//   *.seq / *.gb / *.gbk / *.ape   plasmid maps, one per file, named by the file
//   *_oligos.txt                   the ordering sheet: name, sequence, scale, purification
//   the workbook's `sequences` tab a labsheet's own list of what it uses
//   the workbook's `construction`  SLIP5 keeps whole sequences inline beside the operations
//
// THE THIRD AND FOURTH ARE THE ONES A TOOL FORGETS, and forgetting them is silent. `G00101` and
// `s101R` — the universal sequencing pair SynThera uses everywhere — exist in NO `_oligos.txt`
// at all. A resolver reading only files on disk finds every other oligo, finds those two
// missing, and reports a correct construction file as broken.
import fs from 'fs';
import path from 'path';
import { parseGenbank } from '../../c6-server/parsers/genbank.js';

const MAPS = /\.(seq|gb|gbk|gcc|ape)$/i;
const DNA = /^[ACGTRYSWKMBDHVN]+$/i;

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

/**
 * Find every oligo and plasmid sequence in a project, across all four places they live: plasmid
 * maps, ordering sheets, extracted workbook tables and inline declarations. Inputs live
 * wherever they were made, so this is project-wide by necessity.
 */
export function projectSequences(root) {
  const oligos = {}, plasmids = {}, sources = {};
  // **A STENCIL IS A PLASMID AS FAR AS THE SIMULATOR IS CONCERNED**, and that is the whole point.
  // JCA, 2026-09-13: *"the CF simulation code will need simple N's to work, and it would be a lot
  // of work to change that. So, I wouldn't get fancy with this."* So the sequence goes in
  // `plasmids` with everything else and `simCF` never learns the word; what lives here is only
  // what the SHEET needs to report honestly — how long the variable span really runs.
  const stencils = {};
  const note = (bag, name, seq, where) => {
    if (!name || !seq) return;
    // FIRST DEFINITION WINS, AND A CONFLICT IS RECORDED RATHER THAN RESOLVED. Two files
    // disagreeing about one name is a finding about the project, not something a resolver
    // should quietly pick a side in.
    const key = name.trim();
    if (bag[key] && bag[key].toUpperCase() !== seq.toUpperCase()) {
      (sources[key] ||= []).push(where + ' (CONFLICTS)');
      return;
    }
    bag[key] = seq;
    (sources[key] ||= []).push(where);
  };

  for (const p of walk(root)) {
    const base = path.basename(p);
    if (MAPS.test(base)) {
      try {
        const g = parseGenbank(fs.readFileSync(p, 'utf8'));
        const s = g.sequence || (g.data && g.data.sequence);
        note(plasmids, base.replace(/\.[^.]*$/, '').split(' ')[0], s, path.relative(root, p));
      } catch { /* an unparseable map is not a sequence; c6-check reports those */ }
      continue;
    }
    // Sequences extracted from labsheet workbooks — see render/workbook-sequences.py. A
    // generic filename convention, so the resolver never learns which project it is reading.
    if (/_sequences\.tsv$/i.test(base)) {
      for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
        if (line.startsWith('#')) continue;
        const c = line.split('\t');
        if (c.length >= 2 && DNA.test((c[1] || '').trim())) {
          const kind = (c[2] || '').trim().toLowerCase();
          note(kind === 'plasmid' || kind === 'stencil' || c[1].trim().length > 200
                 ? plasmids : oligos,
               c[0], c[1].trim(), path.relative(root, p));
          // `span=138-152` and an optional `n=30`, in the fourth column. Free text, because the
          // alternative is a schema for four numbers.
          if (kind === 'stencil') {
            const extra = (c[3] || '').trim();
            const sp = extra.match(/span=(\d+)-(\d+)/i);
            const n = extra.match(/\bn=(\d+)/i);
            stencils[c[0]] = {
              // The N-run the string itself carries. Every product length is this plus a constant,
              // so one simulation and these three numbers give the whole range by arithmetic.
              ns: ((c[1].trim().match(/N/gi) || []).length),
              ...(sp ? { min: Number(sp[1]), max: Number(sp[2]) } : {}),
              ...(n ? { members: Number(n[1]) } : {}),
            };
          }
        }
      }
      continue;
    }
    if (/_oligos\.txt$/i.test(base)) {
      for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
        const c = line.split('\t');
        if (c.length >= 2 && DNA.test((c[1] || '').trim()))
          note(oligos, c[0], c[1].trim(), path.relative(root, p));
      }
    }
  }
  return { oligos, plasmids, sources, stencils };
}

// Sequences held INSIDE a labsheet workbook. Kept separate because reading .xlsx needs a
// dependency this toolkit does not have in JavaScript — the caller extracts the rows (the
// Python side of the renderer already does) and hands them over as [name, sequence] pairs.
/**
 * Add sequences that live inside a labsheet workbook to a resolver's tables, classifying by
 * declared kind or by length.
 */
export function addWorkbookSequences({ oligos, plasmids, sources, stencils }, rows, where) {
  for (const [name, seq, kind] of rows) {
    if (!name || !seq || !DNA.test(String(seq).trim())) continue;
    const bag = (kind === 'plasmid' || String(seq).length > 200) ? plasmids : oligos;
    if (!bag[name.trim()]) { bag[name.trim()] = String(seq).trim(); (sources[name.trim()] ||= []).push(where); }
  }
  return { oligos, plasmids, sources, stencils: stencils || {} };
}

// The `oligo <name> <seq>` / `plasmid <name> <seq>` lines a construction file needs in order to
// simulate. Only what the CF actually mentions, so the preamble stays readable.
/**
 * The oligo and plasmid declarations a construction file needs in order to simulate — only the
 * names it actually mentions, so the preamble stays readable.
 */
export function preambleFor(cfText, { oligos, plasmids }) {
  const named = new Set(cfText.split('\n').flatMap((l) => l.split('\t')).map((s) => s.trim()).filter(Boolean));
  const lines = [];
  for (const [n, s] of Object.entries(oligos)) if (named.has(n)) lines.push(`oligo\t${n}\t${s}`);
  for (const [n, s] of Object.entries(plasmids)) if (named.has(n)) lines.push(`plasmid\t${n}\t${s}`);
  return lines.join('\n');
}
