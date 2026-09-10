// src/c6-server/registry.js
// Maps function names to callable C6 core functions.

import * as Seq from '../C6-Seq.js';
import * as Gene from '../C6-Gene.js';
import * as Oligos from '../C6-Oligos.js';
import * as Sim from '../C6-Sim.js';
import * as Annotator from '../C6-Annotator.js';
import * as Utils from '../C6-Utils.js';

// Canonical registry: snake_case names that sheets/API callers use.
// Values are functions that accept (args: any[]) and return a result.
const REGISTRY = {
  // Sequence
  rev_comp:       (args) => Seq.revcomp(args[0]),
  cleanup:        (args) => Seq.cleanup(args[0]),
  gc_content:     (args) => Seq.gccontent(args[0]),
  base_balance:   (args) => Seq.basebalance(args[0]),
  max_repeat:     (args) => Seq.maxrepeat(args[0]),
  is_palindromic: (args) => Seq.isPalindromic(args[0]),
  translate:      (args) => Seq.translate(args[0]),
  plasmid:        (args) => Seq.plasmid(args[0]),
  oligo:          (args) => Seq.oligo(args[0]),
  ds_dna:         (args) => Seq.dsDNA(args[0]),

  // Gene
  remove_sites:     (args) => Gene.removeSites(args[0]),
  one_aa_one_codon: (args) => Gene.oneAAoneCodon(args[0]),

  // Oligos
  score_anneal: (args) => Oligos.scoreanneal(args[0]),
  find_anneal:  (args) => Oligos.findanneal(args[0], args[1], args[2]),
  pca:          (args) => Oligos.pca(args[0]),

  // Sim
  parse_cf:   (args) => Sim.parseCF(...args),
  sim_cf:     (args) => Sim.simCF(args[0]),
  pcr:        (args) => Sim.PCR(args[0]),
  golden_gate:(args) => Sim.goldengate(args[0]),
  gibson:     (args) => Sim.gibson(args[0]),
  digest:     (args) => Sim.digest(args[0]),
  ligate:     (args) => Sim.ligate(args[0]),

  // Annotator
  annotate_sequence: (args) => Annotator.annotateSequence(args[0], args[1]),

  // Utils
  merge:     (args) => Utils.merge(...args),
  field:     (args) => Utils.field(args[0], args[1]),
  make_json: (args) => Utils.makeJSON(args[0]),
};

/**
 * @returns {string[]} sorted list of registered function names
 */
export function listFunctions() {
  return Object.keys(REGISTRY).sort();
}

/**
 * @param {string} name
 * @param {any[]} args
 * @returns {any}
 */
export function runFunction(name, args = []) {
  const fn = REGISTRY[name];
  if (!fn) throw new Error(`Unknown function: "${name}". Available: ${listFunctions().join(', ')}`);
  return fn(args);
}

export { REGISTRY };
