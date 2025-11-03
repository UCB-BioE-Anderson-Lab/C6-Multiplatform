import { revcomp, resolveToSeq, isPalindromic, Polynucleotide, polynucleotide, resolveToPoly, plasmid, oligo, dsDNA } from './C6-Seq.js';

// Helper to display a sequence with context for error messages
function displaySeq(seq) {
  if (!seq) return seq;
  if (seq.length <= 50) return seq;
  return seq.slice(0, 20) + "[...]" + seq.slice(-20);
}

/**
 * @file C6-Sim.gs
 * @author J. Christopher Anderson with ChatGPT
 * @copyright 2023 University of California, Berkeley
 * @license See the LICENSE file included in the repository
 * @version 1.0.0
 * @module C6-Sim
 * @description
 * This script provides a collection of functions for expressing construction files and simulating
 * molecular biology operations including PCR and assembly reactions.
 *
 * @requires C6-Utils
 * @requires C6-Seq
 * @requires C6-Oligos
 */

/**
 * A Construction File (CF) is a structured format for specifying a series of molecular biology construction steps, 
 * such as PCR, assembly, digestion, ligation, and transformation. It is designed to facilitate communication between 
 * researchers and computer programs, allowing users to simulate or perform complex DNA manipulations.
 *
 * In this project, a CF is expressed as JSON. There is a function parseCF which can read in data and convert it to
 * this JSON format. There is another function, simCF, which can input this JSON and simulate the steps. You can
 * also simulate individual steps one at a time by invoking the PCR, assemble, etc. functions.
 *
 * Usage:
 * CFs are used to plan, simulate, and document molecular biology experiments. Researchers can design and share
 * their construction steps in a standardized format, and software programs can parse, simulate, and visualize the
 * planned steps, providing an efficient way to manage and analyze experimental data.
 *
 * Syntax:
 * A Construction File is represented as a JSON object, containing two main elements: 'steps'
 * and 'sequences'. The 'steps' is an array of objects, where each object represents a construction
 * step with its associated operation, input sequences, and output product. The 'sequences' is an object
 * containing key-value pairs, where each key is a unique identifier for a DNA sequence, and the value is the
 * actual sequence.
 *
 * Example:
 * Here's a simple example of a Construction File that demonstrates PCR and assembly steps.
 *
 * {
 *   "steps": [
 *     {
 *       "operation": "PCR",
 *       "output": "P6",
 *       "forward_oligo": "P6libF",
 *       "reverse_oligo": "P6libR",
 *       "template": "pTP1",
 *       "product_size": 3583
 *     },
 *     {
 *       "operation": "Assemble",
 *       "output": "pP6",
 *       "dnas": ["P6"],
 *       "enzyme": "BsaI"
 *     }
 *   ],
 *   "sequences": {
 *     "P6libF": "ccaaaggtctcATTATANNNNNNNNNNNNNNNNNTGTCAANNNNGAacccaggactcctcgaagtcgttcttaagacaac",
 *     "P6libR": "cagttGGTCTCAATAATNNNNNNANNNNGTtagtatttctcctcgtctacggttaactgatactc",
 *     "pTP1": "ATTACCGCCTTTGAGTGG"
 *   }
 * }
 *
 * In this example, the 'steps' array has two steps: PCR and Assemble. The PCR step uses forward and
 * reverse oligos "P6libF" and "P6libR", with "pTP1" as the template. The PCR product is named "P6". The Assemble
 * step uses the "P6" PCR product and the "BsaI" enzyme to create a final output named "pP6". The 'sequences'
 * object contains the sequences for "P6libF", "P6libR", and "pTP1".
 *
 * @typedef {Object} ConstructionFile
 * @property {Array.<PCR|Assemble|Transform|Digest|Ligate>} steps - An array of construction steps, where each step is an operation object.
 * @property {Object} sequences - An object containing key-value pairs of sequence names and their corresponding DNA sequences.
 *
 * @typedef {Object} PCR
 * @property {'PCR'} operation - The type of operation.
 * @property {string} output - The output product of the operation.
 * @property {string} forward_oligo - Forward primer used in PCR operation.
 * @property {string} reverse_oligo - Reverse primer used in PCR operation.
 * @property {string} template - The template DNA used in PCR operation.
 * @property {number} product_size - The expected product size in PCR operation.
 *
 * @typedef {Object} Assemble
 * @property {'Assemble'} operation - The type of operation.
 * @property {string} output - The output product of the operation.
 * @property {Array.<string>} dnas - An array of DNA parts used in the Assemble operation.
 * @property {string} enzyme - The enzyme used in the Assemble operation.
 *
 * @typedef {Object} Transform
 * @property {'Transform'} operation - The type of operation.
 * @property {string} output - The output product of the operation.
 * @property {string} dna - The DNA used in the Transform operation.
 * @property {string} strain - The bacterial strain used in the Transform operation.
 * @property {string} antibiotics - The antibiotics used in the Transform operation.
 * @property {number} [temperature] - The temperature used in the Transform operation (optional).
 *
 * @typedef {Object} Digest
 * @property {'Digest'} operation - The type of operation.
 * @property {string} output - The output product of the operation.
 * @property {string} dna - The DNA used in the Digest operation.
 * @property {number} fragSelect - The index, counted from zero, of the output fragment
 * @property {Array.<string>} enzymes - The enzymes used in the Digest operation.
 *
 * @typedef {Object} Ligate
 * @property {'Ligate'} operation - The type of operation.
 * @property {string} output - The output product of the operation.
 * @property {Array.<string>} dnas - An array of DNA parts used in the Ligate operation.
 */

/**
 * parseCF - A function to parse construction and sequence data from various input formats.
 * 
 * Usage:
 * 
 * const output = parseCF(...blobs);
 * 
 * Arguments:
 * 
 * - blobs: One or more inputs containing construction and sequence data. Each input can be:
 *   - A single cell value (string)
 *   - A 1D array of strings (e.g., a row or column of cell values)
 *   - A 2D array of strings (e.g., a range of cell values)
 *   
 * The function processes the input data, identifies construction and sequence data,
 * and outputs a JSON string containing the parsed data organized into steps
 * and sequences.
 * 
 * Example input data formats:
 * 
 * 1. Single cell value:
 * 
 * "PCR P6libF P6libR on pTP1, P6"
 * 
 * 2. 1D array (e.g., row of cell values):
 * 
 * ["PCR", "P6libF", "P6libR", "on", "pTP1", "P6"]
 * 
 * 3. 2D array (e.g., range of cell values):
 * 
 * [
 *   ["PCR", "P6libF", "P6libR", "on", "pTP1", "P6"],
 *   ["Assemble", "pTP1", "P6", "pP6", "P6"]
 * ]
 * 
 * Example output:
 * 
 * {
 *   "steps": [
 *     {
 *       "operation": "PCR",
 *       "output": "P6",
 *       "forward_oligo": "P6libF",
 *       "reverse_oligo": "P6libR",
 *       "template": "pTP1"
 *     },
 *     {
 *       "operation": "Assemble",
 *       "output": "pP6",
 *       "dnas": ["pTP1", "P6"],
 *       "enzyme": "P6"
 *     }
 *   ],
 *   "sequences": {}
 * }
 * 
 */
/**
 * Parses a construction file (CF) and sequences into the appropriate steps and sequences.
 * 
 * @param  {...any} blobs - The construction file data that may be passed as single/multiple string inputs.
 * @returns {Object} An object containing 'steps' (an array of steps) and 'sequences' (an object of DNA sequences).
 */
function parseCF(...blobs) {
    const normalizeOperation = {
        "pcr": "PCR",
        "digest": "Digest",
        "ligate": "Ligate",
        "gibson": "Gibson",
        "goldengate": "GoldenGate",
        "transform": "Transform"
    };

    const sequenceDataRegex = /^[ACGTRYSWKMBDHVNUacgtryswkmbdhvnu*]+$/;
    const knownTypes = ["oligo", "plasmid", "dsdna"];

    function preprocessData(data) {
        if (Array.isArray(data)) {
            if (data.every(item => Array.isArray(item))) {
                return data.map(row => row.map(cell => cell.toString()).join('\t')).join('\n');
            } else if (data.every(item => typeof item === "string" || typeof item === "number")) {
                return data.map(cell => cell.toString()).join('\t');
            } else {
                throw new Error("Unsupported input type for preprocessData function");
            }
        } else {
            return data.toString();
        }
    }

    function tokenize(text) {
        // Remove comments: #, //, /* ... */
        text = text.replace(/#.*$/g, '').replace(/\/\/.*$/g, '').replace(/\/\*.*?\*\//g, '');
        let tokens = text.trim().split(/\s+/);
        return tokens.filter(token => !["on", "with", ""].includes(token.toLowerCase()));
    }

    let singleblob = "";
    for (const blob of blobs) {
        singleblob += preprocessData(blob) + '\n';
    }

    const preprocessedData = singleblob.trim().split('\n').map(line => tokenize(line));
    const steps = [];
    const sequences = {};

    for (let i = 0; i < preprocessedData.length; i++) {
        const tokens = preprocessedData[i];
        if (tokens.length === 0) continue;
        try {
            const keywordRaw = tokens[0];
            const keyword = keywordRaw.toLowerCase();
            const normalizedOp = normalizeOperation[keyword];

            if (normalizedOp) {
                let step = { operation: normalizedOp };

                switch (normalizedOp) {
                    case "PCR":
                        // Check token count for PCR
                        if (tokens.length < 5) {
                            throw new Error("PCR step requires 5 fields: PCR ForwardPrimer ReversePrimer Template Output");
                        }
                        step.output = tokens[4];
                        step.forward_oligo = tokens[1];
                        step.reverse_oligo = tokens[2];
                        step.template = tokens[3];
                        break;

                    case "Gibson":
                        if (tokens.length < 3) {
                            throw new Error("Gibson step requires at least 3 fields: Gibson Fragment1 [Fragment2 ...] Output");
                        }
                        step.output = tokens[tokens.length - 1];
                        step.dnas = tokens.slice(1, tokens.length - 1);
                        break;

                    case "GoldenGate":
                        if (tokens.length < 4) {
                            throw new Error("GoldenGate step requires at least 4 fields: GoldenGate Fragment1 [Fragment2 ...] Enzyme Output");
                        }
                        step.output = tokens[tokens.length - 1];
                        step.dnas = tokens.slice(1, tokens.length - 2);
                        step.enzyme = tokens[tokens.length - 2];
                        break;

                    case "Ligate":
                        if (tokens.length < 3) {
                            throw new Error("Ligate step requires at least 3 fields: Ligate Fragment1 [Fragment2 ...] Output");
                        }
                        step.output = tokens[tokens.length - 1];
                        step.dnas = tokens.slice(1, tokens.length - 1);
                        break;

                    case "Digest":
                        // Required format: Digest DNA Enzymes FragSelect Output
                        if (tokens.length < 5) {
                          throw new Error("Digest step requires 5 fields: Digest DNA Enzymes FragSelect Output");
                        }
                        step.dna = tokens[1];
                        step.enzymes = tokens[2].split(',');
                        step.fragselect = parseInt(tokens[3], 10);
                        if (Number.isNaN(step.fragselect)) {
                          throw new Error("Digest step: FragSelect must be an integer (0-based)");
                        }
                        step.output = tokens[tokens.length - 1];
                        break;

                    case "Transform":
                        step.dna = tokens[1];
                        step.output = tokens[tokens.length - 1];

                        const remaining = tokens.slice(2, tokens.length - 1);

                        const knownAntibiotics = {
                          "kan": "kan",
                          "kanamycin": "kan",
                          "cam": "cam",
                          "chloramphenicol": "cam",
                          "amp": "amp",
                          "ampicillin": "amp",
                          "spec": "spec",
                          "spectinomycin": "spec",
                          "gen": "gen",
                          "gentamicin": "gen"
                        };

                        for (const token of remaining) {
                          const lower = token.toLowerCase();
                          if (!step.strain && /^[\w\-\.]+$/.test(token)) {
                            step.strain = token;
                          } else if (!step.antibiotics && knownAntibiotics[lower]) {
                            step.antibiotics = knownAntibiotics[lower];
                          } else if (!step.temperature && !isNaN(parseFloat(token))) {
                            step.temperature = parseFloat(token);
                          }
                        }
                        break;
                }

                steps.push(step);
            } else {
                let name, sequence;
                if (knownTypes.includes(keyword)) {
                    name = tokens[1];
                    sequence = tokens.slice(2).join('');
                } else {
                    name = tokens[0];
                    sequence = tokens.slice(1).join('');
                }

                if (sequenceDataRegex.test(sequence)) {
                    switch (keyword) {
                        case "plasmid":
                            sequences[name] = plasmid(sequence.toUpperCase());
                            break;
                        case "oligo":
                            sequences[name] = oligo(sequence.toUpperCase());
                            break;
                        case "dsdna":
                            sequences[name] = dsDNA(sequence.toUpperCase());
                            break;
                        default:
                            sequences[name] = oligo(sequence.toUpperCase());
                            break;
                    }
                } else {
                    throw new Error(`Invalid sequence format: "${sequence}"`);
                }
            }
        } catch (err) {
            throw new Error(`Error parsing line ${i + 1}: "${preprocessedData[i].join(' ')}"\nReason: ${err.message}`);
        }
    }
    console.log("parseCF returning CF")
    return { steps, sequences };
}

/**
 * PCR function predicts the sequence of a PCR product by inputting forward oligo sequence, reverse oligo sequence, and template sequence.
 *
 * The algorithm assumes that the last 18 bp on the 3' end of the oligos exactly match the template, but the 5' end of the oligos may not match.
 * The function first identifies where the forward oligo will anneal to the template by looking for the 18 bp match.
 * It then rotates the template sequence such that it begins with the annealing region of the forward oligo.
 * Then it looks for the annealing site of the reverse oligo by invoking the function revcomp(sequence) which inputs the reverse oligo sequence 
 * and outputs the reverse complement. 
 * The first 18 bp of that revcomp sequence should match the template where it will anneal.
 * Based on the indices of the annealing sites, the final PCR product is calculated from the entire forward sequence, the region between the 
 * annealing regions on the rotated template, and the entire reverse complement of the reverse oligo
 *
 * @param {string} forwardSeq - The forward oligo sequence.
 * @param {string} reverseSeq - The reverse oligo sequence.
 * @param {string} templateSeq - The template sequence.
 *
 * @returns {string} finalProduct - The predicted PCR product.
 */
function PCR(forwardOligo, reverseOligo, template) {
  // Validate that forward and reverse are single-stranded
  if (forwardOligo.isDoubleStranded) {
    throw new Error('Forward oligo must be single-stranded');
  }
  if (reverseOligo.isDoubleStranded) {
    throw new Error('Reverse oligo must be single-stranded');
  }

  // Pull sequences from Polynucleotides
  const forwardSeq = forwardOligo.sequence;
  const reverseSeq = reverseOligo.sequence;
  let templateSeq = template.sequence;

  // Find index of 18 bp match on 3' end of forward oligo and template
  var foranneal = forwardSeq.slice(-18);
  var forwardMatchIndex = templateSeq.indexOf(foranneal);
  if (forwardMatchIndex === -1) {
    const rcTemplate = revcomp(templateSeq);
    forwardMatchIndex = rcTemplate.indexOf(foranneal);
    if (forwardMatchIndex === -1) {
      throw new Error("Forward oligo does not exactly anneal to the template.\nForward oligo (3' 18bp): " + displaySeq(foranneal) + "\nTemplate: " + displaySeq(templateSeq));
    }
    templateSeq = rcTemplate;
  }

  // Rotate template sequence to begin with annealing region of forward oligo
  var rotatedTemplate = templateSeq.slice(forwardMatchIndex) + templateSeq.slice(0, forwardMatchIndex);

  // Find reverse complement of reverse oligo
  var reverseComp = revcomp(reverseSeq);

  // Find index of 18 bp match on 3' end of reverse complement and rotated template
  var revanneal = reverseComp.slice(0,18);
  var reverseMatchIndex = rotatedTemplate.indexOf(revanneal);
  if (reverseMatchIndex === -1) {
    throw new Error("Reverse oligo does not exactly anneal to the template.\nReverse oligo (3' 18bp): " + displaySeq(revanneal) + "\nRotated template: " + displaySeq(rotatedTemplate));
  }

  // Concatenate entire forward oligo, region between annealing regions on rotated template, and entire reverse complement of reverse oligo
  var finalProduct = forwardSeq + rotatedTemplate.slice(18, reverseMatchIndex) + reverseComp;

  console.log("PCR returning product")

  // Wrap result as a double-stranded DNA polynucleotide
  return dsDNA(finalProduct);
}

/**
 * The following blocks describe the cutting pattern of commonly
 * used restriction enzymes.  They are used in the Assemble and
 * Digest simulations, then also during silent site removal (removeSites)
 */
const simRestrictionEnzymes = {
    AarI: {recognitionSequence: "CACCTGC", cut5: 4, cut3: 8},
    BbsI: {recognitionSequence: "GAAGAC", cut5: 2, cut3: 6},
    BsaI: {recognitionSequence: "GGTCTC", cut5: 1, cut3: 5},
    BsmBI: {recognitionSequence: "CGTCTC", cut5: 1, cut3: 5},
    SapI: {recognitionSequence: "GCTCTTC", cut5: 1, cut3: 4},
    BseRI: {recognitionSequence: "GAGGAG", cut5: 10, cut3: 8},
    BamHI: {recognitionSequence: "GGATCC", cut5: -5, cut3: -1},
    BglII: {recognitionSequence: "AGATCT", cut5: -5, cut3: -1},
    EcoRI: {recognitionSequence: "GAATTC", cut5: -5, cut3: -1},
    XhoI: {recognitionSequence: "CTCGAG", cut5: -5, cut3: -1},
    SpeI: {recognitionSequence: "ACTAGT", cut5: -5, cut3: -1},
    XbaI: {recognitionSequence: "TCTAGA", cut5: -5, cut3: -1},
    PstI: {recognitionSequence: "CTGCAG", cut5: -1, cut3: -5},
    NcoI: {recognitionSequence: "CCATGG", cut5: -5, cut3: -1},

}

//Calculate the reverse complement of the recognition sequence as well as
//whether the sticky end generated is a 5' extension (true) or 3' (false)
for (const enzName in simRestrictionEnzymes) {
  const enzyme = simRestrictionEnzymes[enzName];
  enzyme.recognitionRC = revcomp(enzyme.recognitionSequence);
  enzyme.isFivePrime = enzyme.cut5 < enzyme.cut3;
}

// Helper for Golden Gate assembly: sort and validate fragments by sticky ends
function sortAndValidateGoldenGateFragments(digestionFragments) {
  // Sort the digestion fragments based on the sticky ends
  digestionFragments.sort((a, b) => {
    if (a.stickyEnd5 === b.stickyEnd3) {
      return 0;
    }
    else if (a.stickyEnd5 < b.stickyEnd3) {
      return -1;
    }
    else {
      return 1;
    }
  });

  // Validate that all sticky ends are non-palindromic
  digestionFragments.forEach(fragment => {
    if (isPalindromic(fragment.stickyEnd5) || isPalindromic(fragment.stickyEnd3)) {
      throw new Error(`Palindromic sticky ends found in fragment ${fragment.fragment}`);
    }
  });

  // Check if there is a way to assemble the fragments without including all the fragments
  if (digestionFragments.length > 1) {
    const stickyEndCounts = {};

    digestionFragments.forEach(fragment => {
      if (!stickyEndCounts.hasOwnProperty(fragment.stickyEnd5)) {
        stickyEndCounts[fragment.stickyEnd5] = { count5: 0, count3: 0 };
      }
      if (!stickyEndCounts.hasOwnProperty(fragment.stickyEnd3)) {
        stickyEndCounts[fragment.stickyEnd3] = { count5: 0, count3: 0 };
      }
      stickyEndCounts[fragment.stickyEnd5].count5++;
      stickyEndCounts[fragment.stickyEnd3].count3++;
    });

    for (const stickyEnd in stickyEndCounts) {
      if (stickyEndCounts[stickyEnd].count5 > 1 || stickyEndCounts[stickyEnd].count3 > 1) {
        throw new Error('Some fragments have the same sticky ends, which can lead to incorrect assemblies');
      }
    }
  }

  // Validate that the sticky ends match between fragments
  for (var i = 0; i < digestionFragments.length - 1; i++) {
    if (digestionFragments[i].stickyEnd3 !== digestionFragments[i + 1].stickyEnd5) {
      throw new Error(`Error: Sticky ends do not match between fragments 
        ${digestionFragments[i].fragment} and ${digestionFragments[i + 1].fragment}`);
    }
  }
  if (digestionFragments[0].stickyEnd5 !== digestionFragments[digestionFragments.length - 1].stickyEnd3) {
    throw new Error(`Error: Sticky ends do not match between first and last fragments 
      ${digestionFragments[0].fragment} and ${digestionFragments[digestionFragments.length - 1].fragment}`);
  }
}

/**
 * Simulates ligation of Polynucleotides by matching sticky ends.
 * 
 * If there is one fragment, attempts to circularize it by joining its own ends.
 * If there are multiple fragments, iteratively ligates compatible ends
 * and attempts to circularize at the end.
 *
 * @param {Array<Polynucleotide>} dnaPolys - Array of Polynucleotide fragments.
 * @returns {Polynucleotide} - The ligated Polynucleotide, either circularized or linear.
 * @throws {Error} - If fragments cannot ligate properly or not all are incorporated.
 */
function ligate(dnaPolys) {
  console.log(dnaPolys);
  // If only one fragment, try to circularize
  if (dnaPolys.length === 1) {
    const poly = dnaPolys[0];
    const circularized = ligateEnds(poly);
    if (!circularized) {
      throw new Error("Single fragment does not circularize");
    }
    return circularized;
  }

  // Build a map from 5' sticky end to polynucleotide (and its reverse complement)
  const fiveToPoly = {};
  for (const poly of dnaPolys) {
    fiveToPoly[poly.ext5] = poly;
    // Also add reverse-complement (swap ends)
    const rcPoly = new Polynucleotide(
      poly.sequence,
      poly.ext3, 
      poly.ext5,
      poly.isDoubleStranded,
      poly.isRNA,
      poly.isCircular,
      poly.mod_ext3,
      poly.mod_ext5
    );
    fiveToPoly[rcPoly.ext5] = rcPoly;
  }

  // Find a pair that can be ligated
  let lefty = null;
  for (const poly of dnaPolys) {
    const righty = fiveToPoly[poly.ext3];
    if (righty && join(poly, righty)) {
      lefty = poly;
      break;
    }
  }
  if (!lefty) {
    throw new Error("No valid ligation junctions found");
  }

  // Iteratively join fragments
  while (true) {
    const circularized = ligateEnds(lefty);
    if (circularized) {
      lefty = circularized;
      break;
    }
    const righty = fiveToPoly[lefty.ext3];
    if (!righty) {
      break;
    }
    const product = join(lefty, righty);
    if (!product) {
      break;
    }
    lefty = product;
    // Remove righty from fiveToPoly so we don't re-use it
    delete fiveToPoly[righty.ext5];
  }

  // Check that all input fragments are incorporated
  for (const poly of dnaPolys) {
    if (!lefty.sequence.includes(poly.sequence)) {
      throw new Error("Not all input fragments incorporated into ligation product");
    }
  }
  return lefty;
}

// Helper to join two Polynucleotides if their ends are compatible and have proper modifications
function join(lefty, righty) {
  // At least one end must be phosphorylated
  const hasPhosphate = (lefty.mod_ext3 === 'phos5') || (righty.mod_ext5 === 'phos5');
  if (!hasPhosphate) return null;
  // Both ends must be valid
  const validMods = ['phos5', 'hydroxyl'];
  if (!validMods.includes(lefty.mod_ext3) || !validMods.includes(righty.mod_ext5)) return null;
  // Join the sequences, removing any dashes in sticky ends
  const newseq = lefty.sequence + lefty.ext3.replace("-", "") + righty.sequence;
  return new Polynucleotide(
    newseq,
    lefty.ext5,
    righty.ext3,
    true,
    false,
    false,
    lefty.mod_ext5,
    righty.mod_ext3
  );
}

// Helper to circularize a Polynucleotide if its ends are compatible and have proper modifications
function ligateEnds(poly) {
  // At least one end must be phosphorylated
  const hasPhosphate = (poly.mod_ext3 === 'phos5') || (poly.mod_ext5 === 'phos5');
  if (!hasPhosphate) return null;
  // Both ends must be valid
  const validMods = ['phos5', 'hydroxyl'];
  if (!validMods.includes(poly.mod_ext5) || !validMods.includes(poly.mod_ext3)) return null;
  // Ends must match (ignoring dashes, case-insensitive)
  if (poly.ext5.toUpperCase().replace("-", "") !== poly.ext3.toUpperCase().replace("-", "")) return null;
  let sticky = poly.ext5.replace("-", "");
  return new Polynucleotide(
    sticky + poly.sequence,
    "",
    "",
    true,
    false,
    true,
    'circular',
    'circular'
  );
}

/**
 * Assembles a set of Polynucleotide objects using the Golden Gate Assembly method.
 * @param {Array<Polynucleotide>} polynucleotides - Array of double-stranded Polynucleotide objects to assemble.
 * @param {string} enzyme - Restriction enzyme name.
 * @returns {Polynucleotide} The assembled Polynucleotide.
 */
function goldengate(polynucleotides, enzyme) {
  // console.log("what's polynucleotidessssss");
  // console.log(polynucleotides);
  // console.log("what's enzymmmme");
  // console.log(enzyme);
  if (!simRestrictionEnzymes.hasOwnProperty(enzyme)) {
    throw new Error(`Enzyme ${enzyme} not found for Golden Gate assembly`);
  }
  // Validate input is array of Polynucleotides
  if (!Array.isArray(polynucleotides)) {
    throw new Error("Input to goldengate must be an array of Polynucleotide objects");
  }
  // Validate all are double-stranded Polynucleotides
  polynucleotides.forEach((poly, idx) => {
    // console.log(poly)
    if (poly.constructor.name !== "Polynucleotide") {
      throw new Error(`Input at index ${idx} is not a Polynucleotide`);
    }
    if (!poly.isDoubleStranded) {
      throw new Error(`Polynucleotide at index ${idx} is not double-stranded`);
    }
  });

  // Get enzyme details
  const enzymeDetails = simRestrictionEnzymes[enzyme];
  const restrictionSequence = enzymeDetails.recognitionSequence;
  const revRestrictionSequence = enzymeDetails.recognitionRC;
  const cut5 = enzymeDetails.cut5;
  const cut3 = enzymeDetails.cut3;

  // Collect digestion fragments
  const digestionFragments = [];
  polynucleotides.forEach((poly, idx) => {
    const sequence = poly.sequence;
    // Find enzyme sites
    const enzymeSites = sequence.split(restrictionSequence).length - 1;
    const revEnzymeSites = sequence.split(revRestrictionSequence).length - 1;
    const enzymeSite = sequence.indexOf(restrictionSequence);
    const revEnzymeSite = sequence.indexOf(revRestrictionSequence);
    if (enzymeSites === 0) {
      throw new Error(`Error: Enzyme site ${restrictionSequence} not found in sequence at index ${idx}: ${displaySeq(sequence)}`);
    }
    if (revEnzymeSites === 0) {
      throw new Error(`Error: Reverse Enzyme site ${revRestrictionSequence} not found in sequence at index ${idx}: ${displaySeq(sequence)}`);
    }
    if (enzymeSites > 1) {
      throw new Error(`Error: More than one forward enzyme site ${restrictionSequence} found in sequence at index ${idx}: ${displaySeq(sequence)}`);
    }
    if (revEnzymeSites > 1) {
      throw new Error(`Error: More than one reverse enzyme site ${revRestrictionSequence} found in sequence at index ${idx}: ${displaySeq(sequence)}`);
    }
    if (revEnzymeSite < enzymeSite) {
      throw new Error(`Error: Reverse enzyme site found before forward enzyme site in sequence at index ${idx}: ${displaySeq(sequence)}`);
    }
    // Extract the cut fragment, stickyEnd5 and stickyEnd3
    const cutFragment = sequence.substring(enzymeSite + restrictionSequence.length + cut3, revEnzymeSite - cut3);
    const stickyEnd5 = sequence.substring(enzymeSite + restrictionSequence.length + cut5, enzymeSite + restrictionSequence.length + cut3);
    const stickyEnd3 = sequence.substring(revEnzymeSite - cut3, revEnzymeSite - cut5);
    digestionFragments.push({
      fragment: cutFragment,
      stickyEnd5: stickyEnd5,
      stickyEnd3: stickyEnd3,
      ext5: poly.ext5,
      ext3: poly.ext3,
      mod_ext5: poly.mod_ext5,
      mod_ext3: poly.mod_ext3
    });
  });

  // Sort and validate sticky ends
  sortAndValidateGoldenGateFragments(digestionFragments);

  // Assemble the final sequence and determine sticky ends/mods
  let finalSeq = "";
  for (let i = 0; i < digestionFragments.length; i++) {
    finalSeq += digestionFragments[i].stickyEnd5;
    finalSeq += digestionFragments[i].fragment;
  }

  // For ends and modifications: take from first and last fragments
  const ext5 = digestionFragments[0].ext5;
  const ext3 = digestionFragments[digestionFragments.length - 1].ext3;
  const mod_ext5 = digestionFragments[0].mod_ext5;
  const mod_ext3 = digestionFragments[digestionFragments.length - 1].mod_ext3;

  // Determine isCircular based on sticky ends matching
  const isCircular = (
    digestionFragments.length > 1 &&
    digestionFragments[0].stickyEnd5 === digestionFragments[digestionFragments.length - 1].stickyEnd3
  );

  // Return as Polynucleotide
  return polynucleotide(
    finalSeq,
    ext5,
    ext3,
    true,
    false,
    isCircular,
    mod_ext5,
    mod_ext3
  );
}

/**
 * Assembles DNA Polynucleotide objects using the Gibson assembly method.
 * It is also the default algorithm for 'assemble' function.
 * It is also appropriate for SOEing and yeast assembly predictions.
 *
 * @param {Array<Polynucleotide>} polynucleotides - Array of double-stranded, linear Polynucleotide objects to be assembled.
 * @param {boolean} check_circular - whether to check if the assembled product is circular. If set to `false`,
 *                                   the function will not check if the product is circular and will return a linear
 *                                   product. Defaults to `true`.
 *
 * @returns {Polynucleotide} - the assembled Polynucleotide object.
 *
 * @throws {Error} - if the input is not a non-empty array of Polynucleotide objects, or if the assembly does not resolve to
 *                   a single product, or if the products do not assemble correctly, or if the assembled product is
 *                   not circular and `check_circular` is set to `true`.
 */
function gibson(polynucleotides, check_circular = true) {
  // console.log("polynucleotidesss inputs");

  // console.log(polynucleotides.length);
  // console.log(polynucleotides);


  if (!Array.isArray(polynucleotides)) {
    // console.log("tiggggered");

    polynucleotides = [polynucleotides];
  }



  if (polynucleotides.length === 0) {
    throw new Error("Expected non-empty array of Polynucleotide objects");
  }

  for (const poly of polynucleotides) {
    // console.log("lookking for this");
    // console.log(poly.constructor.name);

    if (poly.constructor.name !== "Polynucleotide") {
      throw new Error("All inputs must be Polynucleotide objects");
    }
    if (!poly.isDoubleStranded) {
      throw new Error("All Polynucleotides must be double-stranded");
    }
    if (poly.isCircular) {
      throw new Error("All Polynucleotides must be linear for Gibson assembly");
    }

    // console.log("sequence survivived");
  }

  const HOMOLOGY_LENGTH = 20;

  let assemblyFragments = [...polynucleotides];

  while (assemblyFragments.length > 1) {
    const currFrag = assemblyFragments.shift();
    const currSeq = currFrag.sequence;
    const currLen = currSeq.length;
    const homologyRegion = currSeq.slice(currLen - HOMOLOGY_LENGTH);

    let matchedFrag = null;
    let matchedHomologousRegionEndIndex = 0;

    for (let i = 0; i < assemblyFragments.length; i++) {
      const tempFrag = assemblyFragments[i];
      const tempSeq = tempFrag.sequence;

      if (tempSeq.includes(homologyRegion)) {
        matchedFrag = tempFrag;
        matchedHomologousRegionEndIndex = tempSeq.indexOf(homologyRegion) + HOMOLOGY_LENGTH;
        assemblyFragments.splice(i, 1);
        break;
      } else if (revcomp(tempSeq).includes(homologyRegion)) {
        const revTemp = revcomp(tempSeq);
        matchedFrag = new Polynucleotide(revTemp, null, null, true, false, false);
        matchedHomologousRegionEndIndex = revTemp.indexOf(homologyRegion) + HOMOLOGY_LENGTH;
        assemblyFragments.splice(i, 1);
        break;
      }
    }

    if (!matchedFrag) {
      throw new Error("The provided assembly fragments cannot be joined together because there are not enough homologous regions between them");
    }

    if (!/^[ATCG]+$/i.test(homologyRegion)) {
      throw new Error("The provided assembly contains degenerate base pairs, assembly failed.");
    }

    const currHomologousRegionStartIndex = currSeq.length - matchedHomologousRegionEndIndex;
    const currHomologousRegion = currSeq.slice(currHomologousRegionStartIndex);
    const matchedHomologousRegion = matchedFrag.sequence.slice(0, matchedHomologousRegionEndIndex);

    if (currHomologousRegion !== matchedHomologousRegion) {
      throw new Error("In a Gibson assembly step, the fragment ends do not match");
    }

    const currFragRegion = currSeq.slice(0, currHomologousRegionStartIndex);
    const matchedFragRegion = matchedFrag.sequence;

    const assembledProduct = new Polynucleotide(
      currFragRegion + matchedFragRegion,
      null, null, true, false, false
    );
    assemblyFragments.push(assembledProduct);
  }

  // Final check for circularization
  const linearProduct = assemblyFragments[0];
  const forwardStrand = linearProduct.sequence;
  const lastHomology = forwardStrand.slice(-HOMOLOGY_LENGTH);
  const firstIndex = forwardStrand.indexOf(lastHomology);

  if (firstIndex === forwardStrand.length - HOMOLOGY_LENGTH || firstIndex < 0) {
    if (check_circular) {
      throw new Error("Assembly product cannot be re-circularized");
    } else {
      return dsDNA(forwardStrand);
    }
  }

  console.log("Gibson returning product")

  const circularSeq = forwardStrand.slice(firstIndex, forwardStrand.length - HOMOLOGY_LENGTH);
  return plasmid(circularSeq);
}

/**
 * Cuts a given polynucleotide once with a specified restriction enzyme and returns the resulting fragments as a JSON string.
 * 
 * @function
 * @param {string} polyjson - The JSON string representation of the input polynucleotide.
 * @param {string} enz - The name of the restriction enzyme to be used for the cut.
 * @return {string} The JSON string representation of the resulting polynucleotide fragments after the cut.
 * @throws Will return null if the recognition sequence for the specified enzyme is not found in the input polynucleotide.
 * @example
 * const inputPoly = '{"sequence":"GGACCGGATCCGAGAACCTCATGATCGTGGACAACCCCAA","ext5":"GGACC","ext3":"CCCAA","isDoubleStranded":true,"isRNA":false,"isCircular":false,"mod_ext3":null,"mod_ext5":null}';
 * const enzyme = "BamHI";
 * const result = cutOnce(inputPoly, enzyme);
 * console.log(result); // Output: [{"sequence":"GGACCGGATCCGAGAACCTCATGATCGTGGACAACCCCAA","ext5":"GGACC","ext3":"GATC","isDoubleStranded":true,"isRNA":false,"isCircular":false,"mod_ext3":null,"mod_ext5":null}]
 * @customfunction
 */
function cutOnce(polyjson, enz) {
	let output;
	const poly = polyjson;

	const seq = poly.sequence;
	const enzData = simRestrictionEnzymes[enz];
	const recognitionSeq = enzData.recognitionSequence;
	const recognitionSeqRC = enzData.recognitionRC;
	const cut5 = enzData.cut5;
	const cut3 = enzData.cut3;

	const index = seq.indexOf(recognitionSeq);
	const indexRC = seq.indexOf(recognitionSeqRC);

	if (index === -1 && indexRC === -1) {
		return null;
	}

	const foundOnCodingStrand = index !== -1;
	const isFivePrime = enzData.isFivePrime;
	let ssRegionStart;
	let ssRegionEnd;

	if (foundOnCodingStrand) {
		if (isFivePrime) {
			ssRegionStart = index + recognitionSeq.length + cut5;
			ssRegionEnd = index + recognitionSeq.length + cut3;
		} else {
			ssRegionStart = index + recognitionSeq.length + cut3;
			ssRegionEnd = index + recognitionSeq.length + cut5;
		}
	} else {
		if (isFivePrime) {
			ssRegionStart = indexRC - cut3;
			ssRegionEnd = indexRC - cut5;
		} else {
			ssRegionStart = indexRC - cut5;
			ssRegionEnd = indexRC - cut3;
		}
	}

	let stickyEnd = "";
	if (!isFivePrime) {
		stickyEnd += '-';
	}
	stickyEnd += seq.substring(ssRegionStart, ssRegionEnd);

	if (poly.isCircular) {
		const linearSeq = seq.substring(ssRegionEnd) + seq.substring(0, ssRegionStart);
		const linearPoly = new Polynucleotide(
			linearSeq,
			stickyEnd,
			stickyEnd,
			poly.isDoubleStranded,
			poly.isRNA,
			false,
			"phos5",
			"phos5"
		);
		output = [linearPoly];
	} else {
		const leftPoly = new Polynucleotide(
			seq.substring(0, ssRegionStart),
			poly.ext5,
			stickyEnd,
			poly.isDoubleStranded,
			poly.isRNA,
			false,
			poly.mod_ext5,
			"phos5"
		);

		const rightPoly = new Polynucleotide(
			seq.substring(ssRegionEnd),
			stickyEnd,
			poly.ext3,
			poly.isDoubleStranded,
			poly.isRNA,
			false,
			"phos5",
			poly.mod_ext3
		);

		output = [leftPoly, rightPoly];
	}

	return output;
}

/**
 * Performs a restriction digest to completion on a given DNA Polynucleotide using specified enzymes, and returns a specific fragment.
 * @function
 * @param {Polynucleotide} seq - A Polynucleotide object representing the DNA to digest.
 * @param {string} enzymes - A string containing the names of the restriction enzymes, separated by non-alphanumeric characters (e.g., 'EcoRI,BamHI').
 * @param {number} fragselect - The index of the desired fragment to be returned after digestion. The fragments are arranged left to right from the original sequence numbered 0 to n.
 * @returns {Polynucleotide} The Polynucleotide object of the selected fragment.
 * @throws {Error} If the input is not a Polynucleotide object, enzymes are not found, or fragselect is invalid.
 */
function digest(seq, enzymes, fragselect) {
  // Check input is a Polynucleotide object
  if (typeof seq !== 'object' || typeof seq.sequence !== 'string') {
    throw new Error('Input to digest must be a Polynucleotide object');
  }

  // Tokenize the enzymes list and confirm they are recognizable
  const enzList = enzymes;

  for (let i = 0; i < enzList.length; i++) {
    const enzymeData = simRestrictionEnzymes[enzList[i]];
    if (!enzymeData) {
      throw new Error(`Enzyme "${enzList[i]}" not found.`);
    }
  }

  let fragsOut = [seq];

  outer: while (true) {
    const worklist = [...fragsOut];
    fragsOut = [];
    for (let i = 0; i < worklist.length; i++) {
      let poly = worklist[i];
      let foundCut = false;
      for (let enz of enzList) {
        const frags = cutOnce(poly, enz);
        if (frags) {
          fragsOut = [...fragsOut, ...frags];
          foundCut = true;
          continue outer;
        }
      }
      if (!foundCut) {
        fragsOut.push(poly);
      }
    }
    break;
  }

  if (
    typeof fragselect === "number" &&
    fragselect >= 0 &&
    fragselect < fragsOut.length
  ) {
    if (seq.isCircular) {
      // Order fragments for circular templates relative to the FIRST enzyme's cut, not the plasmid origin.
      // Fragment 0 = segment from first enzyme cut to the next cut going forward.
      // Fragment 1 = the backbone running from the next cut back around to the first cut.
      const firstEnz = enzList[0];
      const originSeq = seq.sequence;

      // Compute the forward-string start index of the first enzyme's single-strand cut window (ssRegionStart),
      // mirroring the math used in cutOnce().
      function computeCutStartIndex(seqStr, enzName) {
        const e = simRestrictionEnzymes[enzName];
        const fwd = e.recognitionSequence;
        const rev = e.recognitionRC;
        const cut5 = e.cut5;
        const cut3 = e.cut3;
        const isFivePrime = e.isFivePrime;

        const idxF = seqStr.indexOf(fwd);
        const idxR = seqStr.indexOf(rev);
        if (idxF === -1 && idxR === -1) {
          throw new Error(`Enzyme "${enzName}" site not found in original circular sequence when establishing fragment order.`);
        }

        if (idxF !== -1) {
          return isFivePrime
            ? (idxF + fwd.length + cut3)    // ssRegionStart when 5' overhang on forward site
            : (idxF + fwd.length + cut5);   // ssRegionStart when 3' overhang on forward site
        } else {
          return isFivePrime
            ? (idxR - cut3)                 // ssRegionStart when 5' overhang on reverse site
            : (idxR - cut5);                // ssRegionStart when 3' overhang on reverse site
        }
      }

      const firstCutStart = computeCutStartIndex(originSeq, firstEnz);

      // Sort fragments by their first occurrence in the original sequence
      fragsOut.sort((a, b) => originSeq.indexOf(a.sequence) - originSeq.indexOf(b.sequence));

      // Rotate list so the fragment starting at firstCutStart is index 0
      let rotateIdx = fragsOut.findIndex(f => originSeq.indexOf(f.sequence) === firstCutStart);
      if (rotateIdx === -1) {
        // Fallback: keep current order if boundary not found exactly (e.g., repeats)
        rotateIdx = 0;
      }
      fragsOut = [...fragsOut.slice(rotateIdx), ...fragsOut.slice(0, rotateIdx)];

      // Return selected fragment in this enzyme-relative order
      return fragsOut[fragselect];
    } else {
      // Linear case: return a dsDNA Polynucleotide with the selected fragment's sequence
      const newSeq = fragsOut[fragselect];
      return newSeq;
    }
  } else {
    throw new Error(
      "Invalid fragselect provided for sequence: " + displaySeq(seq.sequence)
    );
  }
}

/**
 * simCF - A function that simulates a series of molecular biology construction steps given a construction file object.
 *
 * @param {Object} cfData - A construction file object (with `steps` and `sequences`) returned from `parseCF`.
 * @returns {Array<Array<string>>} outputTable - A 2D array where each sub-array is [productName, productSequence], representing the name and full DNA sequence of each construction step result.
 */
function simCF(cfData) {
    const steps = cfData.steps;
    const sequences = cfData.sequences;
    const products = [];

    if (!sequences || Object.keys(sequences).length === 0) {
        return "Error: Sequence data is missing. Please include sequence data in the input JSON.";
    }

  function lookupSequence(key) {
      const foundProduct = products.find((product) => product.name === key);
      if (foundProduct) {
          return foundProduct.sequence;
      }

      const foundSequence = sequences[key];
      if (foundSequence) {
          return foundSequence;
      }

      throw new Error(`Missing sequence for key: ${key}`);
  }

    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];

        switch (step.operation) {
            case 'PCR': {
                const forwardOligoSeq = lookupSequence(step.forward_oligo);
                const reverseOligoSeq = lookupSequence(step.reverse_oligo);
                const templateSeq = lookupSequence(step.template);

                const productPoly = PCR(forwardOligoSeq, reverseOligoSeq, templateSeq);
                products.push({
                    name: step.output,
                    sequence: productPoly
                });
            }
            break;

            case 'GoldenGate': {
                const dnaSequences = step.dnas.map((dnaKey) => lookupSequence(dnaKey));
                const productPoly = goldengate(dnaSequences, step.enzyme);
                products.push({
                    name: step.output,
                    sequence: productPoly
                });
            }
            break;

            case 'Gibson': {
                const dnaSequences = step.dnas.map((dnaKey) => lookupSequence(dnaKey));
                const productPoly = gibson(dnaSequences);
                products.push({
                    name: step.output,
                    sequence: productPoly
                });
            }
            break;

            case 'Digest': {
                const dnaSeq = lookupSequence(step.dna);
                const polyObj = digest(dnaSeq, step.enzymes, step.fragselect);
                // Since digest now returns a real Polynucleotide object, use it directly
                products.push({
                    name: step.output,
                    sequence: polyObj
                });
            }
            break;

            case 'Ligate': {
                const dnaPolys = step.dnas.map((dnaKey) => lookupSequence(dnaKey));
                const ligatedPoly = ligate(dnaPolys);
                products.push({
                    name: step.output,
                    sequence: ligatedPoly
                });
            }
          break;
            case 'Transform': {
                const dnaSeq = lookupSequence(step.dna);
                // TODO: Add real transformation simulation logic here
                // dnaSeq is already a Polynucleotide, so store its .sequence
                products.push({
                    name: step.output,
                    sequence: dnaSeq
                });
            }
            break;

            // ... add more cases for other operations as needed

            default:
                // throw new Error(`Unsupported operation: ${step.operation}`);
        }
    }

    const outputTable = products.map((product) => [product.name, product.sequence]);
    return outputTable;
}


export {
  parseCF,
  simCF,
  PCR,
  goldengate,
  gibson,
  cutOnce,
  digest,
  ligate
};
