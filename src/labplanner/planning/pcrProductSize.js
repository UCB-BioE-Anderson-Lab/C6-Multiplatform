// pcrProductSize.js — how long is each PCR product, according to the simulation?
//
// Needed by two later decisions and guessed by neither: the extension time in the thermocycler
// program comes from the length, and so does the choice between PrimeSTAR and Taq.
//
// SIMULATE THE FILE, NOT THE STEP. A construction file's later PCRs template on things earlier
// steps make, so a step pulled out on its own has no template to amplify. Each file is simulated
// once and every product it yields is measured; a job is annotated from that.
//
// A LENGTH THAT COULD NOT BE COMPUTED IS `null`, NEVER A DEFAULT. `simCF` refuses any primer
// whose 3'-most 18 bases do not match the template exactly, which excludes a whole class of real
// primers — a site-removal mutagenic primer has to put its changed base where the site is.
// SynThera's pGhost17 is in the freezer and cannot be simulated for exactly that reason. So
// "unknown" is a state this stage reports, and the program stage must refuse to invent a number
// from it rather than falling back to something plausible like 1 kb.
import { parseCF, simCF } from '../../C6-Sim.js';
import { preambleFor } from './projectSequences.js';

const _log = console.log;
const quietly = (fn) => { console.log = () => {}; try { return fn(); } finally { console.log = _log; } };

/**
 * Measure each PCR product by simulating the whole construction file, since a step pulled out
 * alone has no template. A length that could not be computed stays null and carries the reason.
 *
 * @param {Array} jobs        from extractJobsFromCFs
 * @param {Object} cfg        { cfs: [{name,text}], sequences: from projectSequences }
 * @returns {Array} the same jobs, with `productBp` and `sizeNote` where a PCR
 */
export function annotatePCRProductSizes(jobs, cfg = {}) {
  const sizes = new Map();          // `${cf}:${output}` -> bp
  const notes = new Map();          // `${cf}` -> why the file could not be simulated

  for (const { name, text } of cfg.cfs || []) {
    const pre = cfg.sequences ? preambleFor(text, cfg.sequences) : '';
    try {
      const out = quietly(() => simCF(parseCF(pre ? `${pre}\n${text}` : text)));
      for (const [product, value] of out) {
        const seq = String(value && value.sequence != null ? value.sequence : value);
        sizes.set(`${name}:${product}`, seq.length);
      }
    } catch (e) {
      notes.set(name, String(e.message || e).split('\n')[0]);
    }
  }

  for (const job of jobs || []) {
    if (job.operation !== 'pcr') continue;
    const bp = sizes.get(`${job.cf}:${job.output}`);
    if (bp != null) { job.productBp = bp; continue; }
    job.productBp = null;
    job.sizeNote = notes.get(job.cf)
      || 'the file simulated, but this product was not among its outputs';
  }
  return jobs;
}
