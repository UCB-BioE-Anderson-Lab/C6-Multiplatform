/**
 * Validate and resolve a biopolymer sequence expressed as a string to a string of 
 * valid biopolymer letters
 * 
 * @param {string} sequence
 * @customfunction
 */
function cleanup(sequence) {
  const varDict = {"sequence":["String"]}; 
  return verifyOutputs(JS_cleanup(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * This function takes in a string value, `seq`, and first converts it to a string 
 * if it is not. It then matches the regular expression pattern defined by the cons
 * tant _regexDNA. If the input matches the pattern, the input is returned. Otherwi
 * se it throws an error.
 * 
 * @param {(string|Polynucleotide)} seq
 * @customfunction
 */
function resolveToSeq(seq) {
  const varDict = {"seq":["String","Polynucleotide"]}; 
  return verifyOutputs(JS_resolveToSeq(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Compares two Polynucleotide objects for equivalence. Handles linear vs circular 
 * cases, reverse complement cases, etc.
 * 
 * @param {Polynucleotide} polyA
 * @param {Polynucleotide} polyB
 * @customfunction
 */
function comparePolynucleotides(polyA,polyB) {
  const varDict = {"polyA":["Polynucleotide"],"polyB":["Polynucleotide"]}; 
  return verifyOutputs(JS_comparePolynucleotides(...verifyInputs(varDict, true, [...arguments])));
}

/**
 * Reverse complements a Polynucleotide object, reversing its sequence and swapping
 *  extensions/modifications.
 * 
 * @param {Polynucleotide} frag
 * @customfunction
 */
function polyrevcomp(frag) {
  const varDict = {"frag":["Polynucleotide"]}; 
  return verifyOutputs(JS_polyrevcomp(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Creates a new polynucleotide (DNA or RNA) object as JSON
 * 
 * @param {string} sequence
 * @param {string} ext5
 * @param {string} ext3
 * @param {boolean} isDoubleStranded
 * @param {boolean} isRNA
 * @param {boolean} isCircular
 * @param {string} mod_ext5
 * @param {string} mod_ext3
 * @customfunction
 */
function polynucleotide(sequence,ext5,ext3,isDoubleStranded,isRNA,isCircular,mod_ext5,mod_ext3) {
  const varDict = {"sequence":["String"],"ext5":["String"],"ext3":["String"],"isDoubleStranded":["Boolean"],"isRNA":["Boolean"],"isCircular":["Boolean"],"mod_ext5":["String"],"mod_ext3":["String"]}; 
  return verifyOutputs(JS_polynucleotide(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Creates a Polynucleotide object (as JSON) representing a blunt-ended, double-str
 * anded DNA such as results from PCR or GBlock synthesis.  It lacks 5' phosphates.
 * 
 * @param {string} sequence
 * @customfunction
 */
function dsDNA(sequence) {
  const varDict = {"sequence":["String"]}; 
  return verifyOutputs(JS_dsDNA(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Creates a Polynucleotide object (as JSON) representing a linear single stranded 
 * DNA (an oligonucleotide)
 * 
 * @param {string} sequence
 * @customfunction
 */
function oligo(sequence) {
  const varDict = {"sequence":["String"]}; 
  return verifyOutputs(JS_oligo(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Creates a Polynucleotide object (as JSON) representing a circular doubkle strand
 * ed DNA (a plasmid)
 * 
 * @param {string} sequence
 * @customfunction
 */
function plasmid(sequence) {
  const varDict = {"sequence":["String"]}; 
  return verifyOutputs(JS_plasmid(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * For resolving a string to a Polynucleotide object
 * 
 * @param {(string|string)} seqOrJSON
 * @param {string} type
 * @customfunction
 */
function resolveToPoly(seqOrJSON,type) {
  const varDict = {"seqOrJSON":["String","JSON"],"type":["String"]}; 
  return verifyOutputs(JS_resolveToPoly(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Determines whether a given DNA sequence is palindromic. A palindromic DNA sequen
 * ce is one that reads the same forward and backward when complemented. This funct
 * ion also checks for invalid characters in the input sequence and throws an excep
 * tion if any are found.
 * 
 * @param {string} seq
 * @customfunction
 */
function isPalindromic(seq) {
  const varDict = {"seq":["String"]}; 
  return verifyOutputs(JS_isPalindromic(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Calculates the reverse complement of a DNA sequence, including handling of degen
 * eracy codes.
 * 
 * @param {string} inseq
 * @customfunction
 */
function revcomp(inseq) {
  const varDict = {"inseq":["String"]}; 
  return verifyOutputs(JS_revcomp(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Calculates the G/C content of a DNA sequence.
 * 
 * @param {string} inseq
 * @customfunction
 */
function gccontent(inseq) {
  const varDict = {"inseq":["String"]}; 
  return verifyOutputs(JS_gccontent(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Calculates the base balance of a DNA sequence.
 * 
 * @param {string} inseq
 * @customfunction
 */
function basebalance(inseq) {
  const varDict = {"inseq":["String"]}; 
  return verifyOutputs(JS_basebalance(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Finds the longest streak of repeating bases in a DNA sequence.
 * 
 * @param {string} inseq
 * @customfunction
 */
function maxrepeat(inseq) {
  const varDict = {"inseq":["String"]}; 
  return verifyOutputs(JS_maxrepeat(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Translates a DNA sequence to an amino acid sequence (single-letter codes, no sto
 * p codons). Throws if the input is not a string, or contains invalid DNA letters.
 * 
 * @param {string} dna
 * @customfunction
 */
function translate(dna) {
  const varDict = {"dna":["String"]}; 
  return verifyOutputs(JS_translate(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Annotates a sequence. Smart matching using full exact matching (no k-mer seeding
 * )
 * 
 * @param {string} sequence
 * @param {Object} featureDb
 * @customfunction
 */
function annotateSequence(...inputArray) {
  return JS_annotateSequence(...inputArray);
}

/**
 * Infers transcriptional units.
 * 
 * @param {Array} features
 * @customfunction
 */
function inferTranscriptionalUnits(...inputArray) {
  return JS_inferTranscriptionalUnits(...inputArray);
}

/**
 * Infer expressed proteins.
 * 
 * @param {Array} tus
 * @customfunction
 */
function inferExpressedProteins(...inputArray) {
  return JS_inferExpressedProteins(...inputArray);
}

/**
 * Find non expressed coding DNA sequences (CDS)
 * 
 * @param {*} allFeatures
 * @param {*} expressedProteins
 * @customfunction
 */
function findNonExpressedCDS(...inputArray) {
  return JS_findNonExpressedCDS(...inputArray);
}

/**
 * Remove restriction enzyme sites by replacing them with a different sequence that
 *  encodes the same amino acids.
 * 
 * @param {string} orf
 * @customfunction
 */
function removeSites(orf) {
  const varDict = {"orf":["String"]}; 
  return verifyOutputs(JS_removeSites(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Returns a polynucleotide sequence with a single codon per amino acid given a pol
 * ypeptide sequence.
 * 
 * @param {string} peptide
 * @customfunction
 */
function oneAAoneCodon(peptide) {
  const varDict = {"peptide":["String"]}; 
  return verifyOutputs(JS_oneAAoneCodon(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Calculates a score for an annealing sequence based on various criteria.
 * 
 * @param {(string|Polynucleotide)} inseq
 * @customfunction
 */
function scoreanneal(inseq) {
  const varDict = {"inseq":["String","Polynucleotide"]}; 
  return verifyOutputs(JS_scoreanneal(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Returns the best annealing sequence for an input DNA sequence.
 * 
 * @param {(string|Polynucleotide)} inseq
 * @param {boolean} lock5
 * @param {boolean} lock3
 * @customfunction
 */
function findanneal(inseq,lock5,lock3) {
  const varDict = {"inseq":["String","Polynucleotide"],"lock5":["Boolean"],"lock3":["Boolean"]}; 
  return verifyOutputs(JS_findanneal(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * PCA function that generates oligos for a synthon using the polymerase chain asse
 * mbly method.
 * 
 * @param {(string|Polynucleotide)} synthon
 * @customfunction
 */
function pca(synthon) {
  const varDict = {"synthon":["String","Polynucleotide"]}; 
  return verifyOutputs(JS_pca(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * LCA function that generates oligos for a synthon using the ligase chain assembly
 *  method.
 * 
 * @param {(string|Polynucleotide)} synthon
 * @customfunction
 */
function lca(synthon) {
  const varDict = {"synthon":["String","Polynucleotide"]}; 
  return verifyOutputs(JS_lca(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Designs oligos or gene synthesis sequences for a BlgBrick part based on the inpu
 * t parameters.
 * 
 * @param {(string|Polynucleotide)} sequence
 * @param {string} frgs
 * @customfunction
 */
function bglbrick(sequence,frgs) {
  const varDict = {"sequence":["String","Polynucleotide"],"frgs":["String"]}; 
  return verifyOutputs(JS_bglbrick(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Designs oligos or gene synthesis sequences for a BioBrick (RFC10).
 * 
 * @param {(string|Polynucleotide)} sequence
 * @param {boolean} isCDS
 * @param {string} frgs
 * @customfunction
 */
function biobrick(sequence,isCDS,frgs) {
  const varDict = {"sequence":["String","Polynucleotide"],"isCDS":["Boolean"],"frgs":["String"]}; 
  return verifyOutputs(JS_biobrick(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * A function to design a forward or reverse oligo for MoClo cloning
 * 
 * @param {(string|Polynucleotide)} sequence
 * @param {string} partType
 * @param {string} frgs
 * @customfunction
 */
function moclo(sequence,partType,frgs) {
  const varDict = {"sequence":["String","Polynucleotide"],"partType":["String"],"frgs":["String"]}; 
  return verifyOutputs(JS_moclo(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Designs oligos for PCR and subsequent homology-based assembly of two DNA sequenc
 * es into one molecule. It takes in two DNA sequences as input and returns the des
 * igned oligos as output. The function is useful for joining overlapping DNA fragm
 * ents or inserting a DNA fragment into a larger construct using homology-based as
 * sembly methods such as SOEing, Gibson assembly, or yeast homologous recombinatio
 * n.
 * 
 * @param {(string|Polynucleotide)} fivePrimeSeq
 * @param {(string|Polynucleotide)} threePrimeSeq
 * @param {string} ForR
 * @customfunction
 */
function genejoin(fivePrimeSeq,threePrimeSeq,ForR) {
  const varDict = {"fivePrimeSeq":["String","Polynucleotide"],"threePrimeSeq":["String","Polynucleotide"],"ForR":["String"]}; 
  return verifyOutputs(JS_genejoin(...verifyInputs(varDict, true, [...arguments])));
}

/**
 * Designs a ribosome binding site library of MoClo UC type.
 * 
 * @param {(string|Polynucleotide)} orf
 * @param {(string|Polynucleotide)} utr
 * @param {string} frg
 * @customfunction
 */
function rbslib(orf,utr,frg) {
  const varDict = {"orf":["String","Polynucleotide"],"utr":["String","Polynucleotide"],"frg":["String"]}; 
  return verifyOutputs(JS_rbslib(...verifyInputs(varDict, true, [...arguments])));
}

/**
 * Helper to display a sequence with context for error messages
 * 
 * @param {string} seq
 * @customfunction
 */
function displaySeq(...inputArray) {
  return JS_displaySeq(...inputArray);
}

/**
 * Parses a construction file (CF) and sequences into the appropriate steps and seq
 * uences.
 * 
 * @param {*} ...blobs
 * @customfunction
 */
function parseCF(...blobs) {
  const varDict = {"...blobs":["ConstructionFile"]}; 
  return verifyOutputs(JS_parseCF(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * PCR function predicts the sequence of a PCR product by inputting forward oligo s
 * equence, reverse oligo sequence, and template sequence.
 * 
 * @param {Polynucleotide} forwardOligo
 * @param {Polynucleotide} reverseOligo
 * @param {Polynucleotide} template
 * @customfunction
 */
function PCR(forwardOligo,reverseOligo,template) {
  const varDict = {"forwardOligo":["ssPolynucleotide"],"reverseOligo":["ssPolynucleotide"],"template":["dsPolynucleotide"]}; 
  return verifyOutputs(JS_PCR(...verifyInputs(varDict, true, [...arguments])));
}

/**
 * Helper for Golden Gate assembly: sort and validate fragments by sticky ends
 * 
 * @param {string[]} digestionFragments
 * @customfunction
 */
function sortAndValidateGoldenGateFragments(...inputArray) {
  return JS_sortAndValidateGoldenGateFragments(...inputArray);
}

/**
 * Simulates ligation of Polynucleotides by matching sticky ends.
 * 
 * @param {Polynucleotide[]} dnaPolys
 * @customfunction
 */
function ligate(dnaPolys) {
  const varDict = {"dnaPolys":["PolyArray"]}; 
  return verifyOutputs(JS_ligate(...verifyInputs(varDict, true, [...arguments])));
}

/**
 * Helper to join two Polynucleotides if their ends are compatible and have proper 
 * modifications
 * 
 * @param {Polynucleotide} lefty
 * @param {Polynucleotide} righty
 * @customfunction
 */
function join(...inputArray) {
  return JS_join(...inputArray);
}

/**
 * Helper to circularize a Polynucleotide if its ends are compatible and have prope
 * r modifications
 * 
 * @param {Polynucleotide} poly
 * @customfunction
 */
function ligateEnds(...inputArray) {
  return JS_ligateEnds(...inputArray);
}

/**
 * Assembles a set of Polynucleotide objects using the Golden Gate Assembly method.
 * 
 * @param {Polynucleotide[]} polynucleotides
 * @param {string} enzyme
 * @customfunction
 */
function goldengate(polynucleotides,enzyme) {
  const varDict = {"polynucleotides":["PolyArray"],"enzyme":["String"]}; 
  return verifyOutputs(JS_goldengate(...verifyInputs(varDict, true, [...arguments])));
}

/**
 * Assembles DNA Polynucleotide objects using the Gibson assembly method.
 * 
 * @param {Polynucleotide[]} polynucleotides
 * @param {boolean} check_circular
 * @customfunction
 */
function gibson(polynucleotides,check_circular) {
  const varDict = {"polynucleotides":["PolyArray"],"check_circular":["Boolean"]}; 
  return verifyOutputs(JS_gibson(...verifyInputs(varDict, true, [...arguments])));
}

/**
 * Cuts a given polynucleotide once with a specified restriction enzyme and returns
 *  the resulting fragments as a JSON string.
 * 
 * @param {Polynucleotide} polyjson
 * @param {string} enz
 * @customfunction
 */
function cutOnce(polyjson,enz) {
  const varDict = {"polyjson":["Polynucleotide"],"enz":["String"]}; 
  return verifyOutputs(JS_cutOnce(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Performs a restriction digest to completion on a given DNA Polynucleotide using 
 * specified enzymes, and returns a specific fragment.
 * 
 * @param {Polynucleotide} seq
 * @param {(string|string[])} enzymes
 * @param {number} fragselect
 * @customfunction
 */
function digest(seq,enzymes,fragselect) {
  const varDict = {"seq":["Polynucleotide"],"enzymes":["String","StringArray"],"fragselect":["Number"]}; 
  return verifyOutputs(JS_digest(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * A function that simulates a series of molecular biology construction steps given
 *  a construction file object.
 * 
 * @param {undefined} cfData
 * @customfunction
 */
function simCF(cfData) {
  const varDict = {"cfData":["Object"]}; 
  return verifyOutputs(JS_simCF(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Function to merge multiple strings or arrays into a single string with a delimit
 * er
 * 
 * @param {*} arbitrary
 * @customfunction
 */
function merge(...inputArray) {
  return JS_merge(...inputArray);
}

/**
 * Function to extract a field from a JSON object or array as a string
 * 
 * @param {string} objJSON
 * @param {string} fieldName
 * @customfunction
 */
function field(objJSON,fieldName) {
  const varDict = {"objJSON":["JSON"],"fieldName":["String"]}; 
  return verifyOutputs(JS_field(...verifyInputs(varDict, false, [...arguments])));
}

/**
 * Converts an array of [key, value] pairs into a JSON object string
 * 
 * @param {string[][]} inputArray
 * @customfunction
 */
function makeJSON(inputArray) {
  const varDict = {"inputArray":["2DArray"]}; 
  return verifyOutputs(JS_makeJSON(...verifyInputs(varDict, false, [...arguments])));
}

function locKey(...inputArray) {
  return JS_locKey(...inputArray);
}

function _emptyIndices(...inputArray) {
  return JS__emptyIndices(...inputArray);
}

function _indexAdd(...inputArray) {
  return JS__indexAdd(...inputArray);
}

function _indexRemove(...inputArray) {
  return JS__indexRemove(...inputArray);
}

function cloneInventory(...inputArray) {
  return JS_cloneInventory(...inputArray);
}

function createInventory(...inputArray) {
  return JS_createInventory(...inputArray);
}

function addBox(...inputArray) {
  return JS_addBox(...inputArray);
}

function removeBox(...inputArray) {
  return JS_removeBox(...inputArray);
}

function upsertSample(...inputArray) {
  return JS_upsertSample(...inputArray);
}

function removeSample(...inputArray) {
  return JS_removeSample(...inputArray);
}

function removeSampleByKey(...inputArray) {
  return JS_removeSampleByKey(...inputArray);
}

function moveSample(...inputArray) {
  return JS_moveSample(...inputArray);
}

function mapSamples(...inputArray) {
  return JS_mapSamples(...inputArray);
}

function filterSamples(...inputArray) {
  return JS_filterSamples(...inputArray);
}

function inBounds(...inputArray) {
  return JS_inBounds(...inputArray);
}

function isOccupied(...inputArray) {
  return JS_isOccupied(...inputArray);
}

function wellName(...inputArray) {
  return JS_wellName(...inputArray);
}

function fromWellName(...inputArray) {
  return JS_fromWellName(...inputArray);
}

function makeLabel(...inputArray) {
  return JS_makeLabel(...inputArray);
}

function applyLabelPolicy(...inputArray) {
  return JS_applyLabelPolicy(...inputArray);
}

function validateBox(...inputArray) {
  return JS_validateBox(...inputArray);
}

function validatePosition(...inputArray) {
  return JS_validatePosition(...inputArray);
}

function assignNext(...inputArray) {
  return JS_assignNext(...inputArray);
}

function placeNext(...inputArray) {
  return JS_placeNext(...inputArray);
}

function assignBatch(...inputArray) {
  return JS_assignBatch(...inputArray);
}

function getSample(...inputArray) {
  return JS_getSample(...inputArray);
}

function findByConstruct(...inputArray) {
  return JS_findByConstruct(...inputArray);
}

function findByConcentration(...inputArray) {
  return JS_findByConcentration(...inputArray);
}

function findByClone(...inputArray) {
  return JS_findByClone(...inputArray);
}

function findByCulture(...inputArray) {
  return JS_findByCulture(...inputArray);
}

function isOligo(...inputArray) {
  return JS_isOligo(...inputArray);
}

function isPlasmid(...inputArray) {
  return JS_isPlasmid(...inputArray);
}

function _parseOligoUM(...inputArray) {
  return JS__parseOligoUM(...inputArray);
}

function rankOligoSamples(...inputArray) {
  return JS_rankOligoSamples(...inputArray);
}

function chooseOligoForPCR(...inputArray) {
  return JS_chooseOligoForPCR(...inputArray);
}

function rankMinipreps(...inputArray) {
  return JS_rankMinipreps(...inputArray);
}

function chooseTemplateForPCR(...inputArray) {
  return JS_chooseTemplateForPCR(...inputArray);
}

function choosePCRInputs(...inputArray) {
  return JS_choosePCRInputs(...inputArray);
}

function normalizeHeaders(...inputArray) {
  return JS_normalizeHeaders(...inputArray);
}

function parseBlocks(...inputArray) {
  return JS_parseBlocks(...inputArray);
}

function parseBoxWideFields(...inputArray) {
  return JS_parseBoxWideFields(...inputArray);
}

function parsePlate(...inputArray) {
  return JS_parsePlate(...inputArray);
}

function letterForRow(...inputArray) {
  return JS_letterForRow(...inputArray);
}

function serializePlate(...inputArray) {
  return JS_serializePlate(...inputArray);
}

function parseGridFile(...inputArray) {
  return JS_parseGridFile(...inputArray);
}

function parseTabular(...inputArray) {
  return JS_parseTabular(...inputArray);
}

function toRows(...inputArray) {
  return JS_toRows(...inputArray);
}

function toTabular(...inputArray) {
  return JS_toTabular(...inputArray);
}

function serializeGrid(...inputArray) {
  return JS_serializeGrid(...inputArray);
}

function parse(...inputArray) {
  return JS_parse(...inputArray);
}

function inventoryFrom(...inputArray) {
  return JS_inventoryFrom(...inputArray);
}

function ensureInventory(...inputArray) {
  return JS_ensureInventory(...inputArray);
}

function mergeInventories(...inputArray) {
  return JS_mergeInventories(...inputArray);
}

function toJSON(...inputArray) {
  return JS_toJSON(...inputArray);
}

function fromJSON(...inputArray) {
  return JS_fromJSON(...inputArray);
}

function inventoryTo(...inputArray) {
  return JS_inventoryTo(...inputArray);
}

function fromTSV(...inputArray) {
  return JS_fromTSV(...inputArray);
}

