/**
 * Validate and resolve a biopolymer sequence expressed as a string to a string of 
 * valid biopolymer letters
 * 
 * @param {string} sequence
 * @customfunction
 */
function cleanup(sequence) {
  varDict = {"sequence":["String"]}; 
  return verifyOutputs(JS_cleanup(...verifyInputs(varDict, [...arguments])));
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
  varDict = {"seq":["String","Polynucleotide"]}; 
  return verifyOutputs(JS_resolveToSeq(...verifyInputs(varDict, [...arguments])));
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
  varDict = {"polyA":["Polynucleotide"],"polyB":["Polynucleotide"]}; 
  return verifyOutputs(JS_comparePolynucleotides(...verifyInputs(varDict, [...arguments])));
}

/**
 * Reverse complements a Polynucleotide object, reversing its sequence and swapping
 *  extensions/modifications.
 * 
 * @param {Polynucleotide} frag
 * @customfunction
 */
function polyrevcomp(frag) {
  varDict = {"frag":["Polynucleotide"]}; 
  return verifyOutputs(JS_polyrevcomp(...verifyInputs(varDict, [...arguments])));
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
  varDict = {"sequence":["String"],"ext5":["String"],"ext3":["String"],"isDoubleStranded":["Boolean"],"isRNA":["Boolean"],"isCircular":["Boolean"],"mod_ext5":["String"],"mod_ext3":["String"]}; 
  return verifyOutputs(JS_polynucleotide(...verifyInputs(varDict, [...arguments])));
}

/**
 * Creates a Polynucleotide object (as JSON) representing a blunt-ended, double-str
 * anded DNA such as results from PCR or GBlock synthesis.  It lacks 5' phosphates.
 * 
 * @param {string} sequence
 * @customfunction
 */
function dsDNA(sequence) {
  varDict = {"sequence":["String"]}; 
  return verifyOutputs(JS_dsDNA(...verifyInputs(varDict, [...arguments])));
}

/**
 * Creates a Polynucleotide object (as JSON) representing a linear single stranded 
 * DNA (an oligonucleotide)
 * 
 * @param {string} sequence
 * @customfunction
 */
function oligo(sequence) {
  varDict = {"sequence":["String"]}; 
  return verifyOutputs(JS_oligo(...verifyInputs(varDict, [...arguments])));
}

/**
 * Creates a Polynucleotide object (as JSON) representing a circular doubkle strand
 * ed DNA (a plasmid)
 * 
 * @param {string} sequence
 * @customfunction
 */
function plasmid(sequence) {
  varDict = {"sequence":["String"]}; 
  return verifyOutputs(JS_plasmid(...verifyInputs(varDict, [...arguments])));
}

function resolveToPoly(...inputArray) {
  return JS_resolveToPoly(...inputArray);
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
  varDict = {"seq":["String"]}; 
  return verifyOutputs(JS_isPalindromic(...verifyInputs(varDict, [...arguments])));
}

/**
 * Calculates the reverse complement of a DNA sequence, including handling of degen
 * eracy codes.
 * 
 * @param {string} inseq
 * @customfunction
 */
function revcomp(inseq) {
  varDict = {"inseq":["String"]}; 
  return verifyOutputs(JS_revcomp(...verifyInputs(varDict, [...arguments])));
}

/**
 * Calculates the G/C content of a DNA sequence.
 * 
 * @param {string} inseq
 * @customfunction
 */
function gccontent(inseq) {
  varDict = {"inseq":["String"]}; 
  return verifyOutputs(JS_gccontent(...verifyInputs(varDict, [...arguments])));
}

/**
 * Calculates the base balance of a DNA sequence.
 * 
 * @param {string} inseq
 * @customfunction
 */
function basebalance(inseq) {
  varDict = {"inseq":["String"]}; 
  return verifyOutputs(JS_basebalance(...verifyInputs(varDict, [...arguments])));
}

/**
 * Finds the longest streak of repeating bases in a DNA sequence.
 * 
 * @param {string} inseq
 * @customfunction
 */
function maxrepeat(inseq) {
  varDict = {"inseq":["String"]}; 
  return verifyOutputs(JS_maxrepeat(...verifyInputs(varDict, [...arguments])));
}

/**
 * Translates a DNA sequence to an amino acid sequence (single-letter codes, no sto
 * p codons). Throws if the input is not a string, or contains invalid DNA letters.
 * 
 * @param {string} dna
 * @customfunction
 */
function translate(dna) {
  varDict = {"dna":["String"]}; 
  return verifyOutputs(JS_translate(...verifyInputs(varDict, [...arguments])));
}

function annotateSequence(...inputArray) {
  return JS_annotateSequence(...inputArray);
}

function inferTranscriptionalUnits(...inputArray) {
  return JS_inferTranscriptionalUnits(...inputArray);
}

function inferExpressedProteins(...inputArray) {
  return JS_inferExpressedProteins(...inputArray);
}

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
  varDict = {"orf":["String"]}; 
  return verifyOutputs(JS_removeSites(...verifyInputs(varDict, [...arguments])));
}

/**
 * Returns a polynucleotide sequence with a single codon per amino acid given a pol
 * ypeptide sequence.
 * 
 * @param {string} peptide
 * @customfunction
 */
function oneAAoneCodon(peptide) {
  varDict = {"peptide":["String"]}; 
  return verifyOutputs(JS_oneAAoneCodon(...verifyInputs(varDict, [...arguments])));
}

/**
 * Calculates a score for an annealing sequence based on various criteria.
 * 
 * @param {(string|Polynucleotide)} inseq
 * @customfunction
 */
function scoreanneal(inseq) {
  varDict = {"inseq":["String","Polynucleotide"]}; 
  return verifyOutputs(JS_scoreanneal(...verifyInputs(varDict, [...arguments])));
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
  varDict = {"inseq":["String","Polynucleotide"],"lock5":["Boolean"],"lock3":["Boolean"]}; 
  return verifyOutputs(JS_findanneal(...verifyInputs(varDict, [...arguments])));
}

/**
 * PCA function that generates oligos for a synthon using the polymerase chain asse
 * mbly method.
 * 
 * @param {(string|Polynucleotide)} synthon
 * @customfunction
 */
function pca(synthon) {
  varDict = {"synthon":["String","Polynucleotide"]}; 
  return verifyOutputs(JS_pca(...verifyInputs(varDict, [...arguments])));
}

/**
 * LCA function that generates oligos for a synthon using the ligase chain assembly
 *  method.
 * 
 * @param {(string|Polynucleotide)} synthon
 * @customfunction
 */
function lca(synthon) {
  varDict = {"synthon":["String","Polynucleotide"]}; 
  return verifyOutputs(JS_lca(...verifyInputs(varDict, [...arguments])));
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
  varDict = {"sequence":["String","Polynucleotide"],"frgs":["String"]}; 
  return verifyOutputs(JS_bglbrick(...verifyInputs(varDict, [...arguments])));
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
  varDict = {"sequence":["String","Polynucleotide"],"isCDS":["Boolean"],"frgs":["String"]}; 
  return verifyOutputs(JS_biobrick(...verifyInputs(varDict, [...arguments])));
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
  varDict = {"sequence":["String","Polynucleotide"],"partType":["String"],"frgs":["String"]}; 
  return verifyOutputs(JS_moclo(...verifyInputs(varDict, [...arguments])));
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
  varDict = {"fivePrimeSeq":["String","Polynucleotide"],"threePrimeSeq":["String","Polynucleotide"],"ForR":["String"]}; 
  return verifyOutputs(JS_genejoin(...verifyInputs(varDict, [...arguments])));
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
  varDict = {"orf":["String","Polynucleotide"],"utr":["String","Polynucleotide"],"frg":["String"]}; 
  return verifyOutputs(JS_rbslib(...verifyInputs(varDict, [...arguments])));
}

function displaySeq(...inputArray) {
  return JS_displaySeq(...inputArray);
}

/**
 * Parses a construction file (CF) and sequences into the appropriate steps and seq
 * uences.
 * 
 * @param {(string|string[])} blobs
 * @customfunction
 */
function parseCF(blobs) {
  varDict = {"blobs":["String","StringArray"]}; 
  return verifyOutputs(JS_parseCF(...verifyInputs(varDict, [...arguments])));
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
  varDict = {"forwardOligo":["Polynucleotide"],"reverseOligo":["Polynucleotide"],"template":["Polynucleotide"]}; 
  return verifyOutputs(JS_PCR(...verifyInputs(varDict, [...arguments])));
}

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
  varDict = {"dnaPolys":["PolyArray"]}; 
  return verifyOutputs(JS_ligate(...verifyInputs(varDict, [...arguments])));
}

function join(...inputArray) {
  return JS_join(...inputArray);
}

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
  varDict = {"polynucleotides":["PolyArray"],"enzyme":["String"]}; 
  return verifyOutputs(JS_goldengate(...verifyInputs(varDict, [...arguments])));
}

/**
 * Assembles DNA Polynucleotide objects using the Gibson assembly method.
 * 
 * @param {Polynucleotide[]} polynucleotides
 * @param {boolean} check_circular
 * @customfunction
 */
function gibson(polynucleotides,check_circular) {
  varDict = {"polynucleotides":["PolyArray"],"check_circular":["Boolean"]}; 
  return verifyOutputs(JS_gibson(...verifyInputs(varDict, [...arguments])));
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
  varDict = {"polyjson":["Polynucleotide"],"enz":["String"]}; 
  return verifyOutputs(JS_cutOnce(...verifyInputs(varDict, [...arguments])));
}

/**
 * Performs a restriction digest to completion on a given DNA Polynucleotide using 
 * specified enzymes, and returns a specific fragment.
 * 
 * @param {Polynucleotide} seq
 * @param {string} enzymes
 * @param {number} fragselect
 * @customfunction
 */
function digest(seq,enzymes,fragselect) {
  varDict = {"seq":["Polynucleotide"],"enzymes":["String"],"fragselect":["Number"]}; 
  return verifyOutputs(JS_digest(...verifyInputs(varDict, [...arguments])));
}

/**
 * A function that simulates a series of molecular biology construction steps given
 *  a construction file object.
 * 
 * @param {*} cfData
 * @customfunction
 */
function simCF(cfData) {
  varDict = {"cfData":["Pass"]}; 
  return verifyOutputs(JS_simCF(...verifyInputs(varDict, [...arguments])));
}

/**
 * Function to merge multiple strings or arrays into a single string with a delimit
 * er
 * 
 * @param {string[]} args
 * @customfunction
 */
function merge(args) {
  varDict = {"args":["StringArray"]}; 
  return verifyOutputs(JS_merge(...verifyInputs(varDict, [...arguments])));
}

/**
 * Function to extract a field from a JSON object or array as a string
 * 
 * @param {string} objJSON
 * @param {string} fieldName
 * @customfunction
 */
function field(objJSON,fieldName) {
  varDict = {"objJSON":["JSON"],"fieldName":["String"]}; 
  return verifyOutputs(JS_field(...verifyInputs(varDict, [...arguments])));
}

/**
 * Converts an array of [key, value] pairs into a JSON object string
 * 
 * @param {string[][]} inputArray
 * @customfunction
 */
function makeJSON(inputArray) {
  varDict = {"inputArray":["2DArray"]}; 
  return verifyOutputs(JS_makeJSON(...verifyInputs(varDict, [...arguments])));
}

