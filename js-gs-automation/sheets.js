

/**
 * @file C6-Seq.gs
 * @author J. Christopher Anderson with ChatGPT
 * @copyright 2023 University of California, Berkeley
 * @license See the LICENSE file included in the repository
 * @version 1.0.0
 * @module C6-Seq
 * @description
 * This script provides a collection of functions for working with DNA sequences
 * and polynucleotide objects within Google Sheets. It offers various utilities
 * for sequence manipulation, validation, and analysis.
 *
 * @requires C6-Utils
 */

/**
 * @typedef {string} DNASequence
 * A string representing a DNA sequence with the following rules:
 * - Contains only the characters 'A', 'T', 'C', and 'G' (case-insensitive), or degeneracy codes
 * - No spaces or other characters are allowed
 */

/**
 * Validate and resolve a biopolymer sequence expressed as a string to a string of valid biopolymer letters
 * 
 * @param {string} sequence The biopolymer sequence to validate and resolve.
 * @return {string} The resolved and validated biopolymer sequence containing only valid biopolymer letters.
 * 
 * @example
 * cleanup("1 ATGGAGAACTAG GGTCTC"); // returns "ATGGAGAACTAGGGTCTC"
 * cleanup("AUGGAGAAACUAG\nGGUCUC"); // returns "AUGGAGAAACUAGGGUCUC"
 * cleanup("MVKHLIVTGLMVAL\nGLCSC"); // returns "MVKHLIVTGLMVALGLCSC"
 * @customfunction
 */
//*****<cleanup>{sequence:String}(String)*****
function cleanup(sequence) {
    // Ensure the input is a string
    if (typeof sequence !== 'string') {
      try {
        sequence = sequence.toString();
      } catch(err) {
        throw new Error("Input must be a string. It's a " + typeof sequence);
      }
    }
    
    // Remove any spaces, numbers, and line returns
    sequence = sequence.replace(/[\s\d\r]/g, "");
    
    // Ensure the input only contains valid biopolymer letters
    var validBiopolymer = /^[ACGTRYSWKMBDHVNUacgtryswkmbdhvnu*]+$/;
    if (!validBiopolymer.test(sequence)) {
      throw new Error("Input must only contain valid biopolymer letters (DNA: A, C, G, T, or degeneracy codes, RNA: A, C, G, U, or degeneracy codes, Protein: 20 standard amino acids and their degeneracy codes)");
    }
    
    // Convert the input to uppercase
    sequence = sequence.toUpperCase();
    
    return sequence;
  }
  
  /**
  * This function takes in a string value, `seq`, and first converts it to a string if it is not. It then 
  * matches the regular expression pattern defined by the constant _regexDNA.
  * If the input matches the pattern, the input is returned.  Otherwise it throws an error.
  * 
  * @param {String} seq - The input containing a DNA sequence string.
  * @return {String} - Returns the input sequence as a string
  * 
  * @example
  * var sequence = resolveToSeq("ATCG");
  * Logger.log(sequence); // outputs "ATCG"
  * var sequence = resolveToSeq("name1");
  * Logger.log(sequence); // outputs the column B value of the matching row
  * @customfunction
  */
  const _regexDNA = /^[ACTGactgMRWSYKVHDBNXmrwsykvhdbnx-]+$/;
  //*****<resolveToSeq>{seq:String|Polynucleotide}(String)*****
  function resolveToSeq(seq) {
    // If seq is already a Polynucleotide, extract the sequence
    if (seq instanceof Polynucleotide) {
      return seq.sequence;  // Return the sequence from the Polynucleotide object
    }
    
    seq = seq.toString();  // Ensure it's a string
  
    if (_regexDNA.test(seq)) {
      return seq.toUpperCase();  // Return the sequence in uppercase if it's valid
    }
    
    throw new Error("Unrecognizable as sequence: " + seq);  // If not a valid DNA sequence
  }
  
  /**
   * Represents a polynucleotide (DNA or RNA) molecule.
   *
   * @class
   * @param {string} sequence - The sequence of the polynucleotide.
   * @param {string} ext5 - The 5' extension of the current coding strand.
   * @param {string} ext3 - The 3' extension of the current coding strand.
   * @param {boolean} isDoubleStranded - Whether the polynucleotide is double stranded.
   * @param {boolean} isRNA - Whether the polynucleotide is RNA.
   * @param {boolean} isCircular - Whether the polynucleotide is circular.
   * @param {string} mod_ext5 - The 5' end modification.
   * @param {string} mod_ext3 - The 3' end modification.
   *
   * @example
   * var polynucleotide = new Polynucleotide("AGCTAGCT", "GATC", "CTAG", true, false, false, "Mod5", "Mod3");
   * console.log(polynucleotide.sequence); // Output: "AGCTAGCT"
   * console.log(polynucleotide.ext5); // Output: "GATC"
   * console.log(polynucleotide.isDoubleStranded); // Output: true
   */
  class Polynucleotide {
    constructor(sequence, ext5 = null, ext3 = null, isDoubleStranded, isRNA, isCircular, mod_ext5, mod_ext3) {
      this.sequence = sequence ? sequence.toUpperCase() : sequence;
      this.ext5 = ext5 ? ext5.toUpperCase() : ext5;
      this.ext3 = ext3 ? ext3.toUpperCase() : ext3;
      this.isDoubleStranded = isDoubleStranded;
      this.isRNA = isRNA;
      this.isCircular = isCircular;
      this.mod_ext3 = mod_ext3 || "";
      this.mod_ext5 = mod_ext5 || "";
    }
  }
  
  /**
 * Compares two Polynucleotide objects for equivalence.
 * Handles linear vs circular cases, reverse complement cases, etc.
 *
 * @param {Polynucleotide} polyA 
 * @param {Polynucleotide} polyB 
 * @returns {boolean} true if equivalent, false otherwise
 */
//*****<comparePolynucleotides>{polyA:Polynucleotide}{polyB:Polynucleotide}(Boolean)*****
function comparePolynucleotides(polyA, polyB) {
  if (polyA.constructor.name !== "Polynucleotide") {
    throw new Error("polyA inputs must be Polynucleotide objects");
  }

  if (polyB.constructor.name !== "Polynucleotide") {
    throw new Error("polyB inputs must be Polynucleotide objects");
  }

  if(polyA.isCircular != polyB.isCircular) {
    return false;
  }

  if(polyA.isRNA != polyB.isRNA) {
    return false;
  }

  if(polyA.isDoubleStranded != polyB.isDoubleStranded) {
    return false;
  }

  //If polyA is circular, see if one contains the other
  if(polyA.isCircular) {
    const polyAseq = polyA.sequence.toLowerCase();
    let polyBseq = polyB.sequence.toLowerCase();
    const doubleAseq = polyAseq + polyAseq;
    if(doubleAseq.indexOf(polyBseq) === -1) {
      polyB = polyrevcomp(polyB);
      polyBseq = polyB.sequence.toLowerCase();
      if(doubleAseq.indexOf(polyBseq) === -1) {
        return false
      }
    }

    //If gets this far, done with inspection of circular dnas
    return true;
  }

  //Only linear ones remain
  const polyAseq = polyA.sequence.toLowerCase();
  let polyBseq = polyB.sequence.toLowerCase();

  //Check the sequence and reorient if needed
  if(polyAseq !== polyBseq) {
      polyB = polyrevcomp(polyB);
      polyBseq = polyB.sequence.toLowerCase();
      if(polyAseq !== polyBseq) {
        return false;
      }
  }

  //Check the extensions
  if(polyA.ext5 !== polyB.ext5) {
    return false;
  }

  if(polyA.ext3 !== polyB.ext3) {
    return false;
  }

  if(polyA.mod_ext5 !== polyB.mod_ext5) {
    return false;
  }

  if(polyA.mod_ext3 !== polyB.mod_ext3) {
    return false;
  }

  //Guantlet complete for a linear DNA
  return true;
}

/**
 * Reverse complements a Polynucleotide object, reversing its sequence and swapping extensions/modifications.
 *
 * @param {Polynucleotide} frag - The Polynucleotide to reverse complement.
 * @returns {Polynucleotide} - The reverse complemented Polynucleotide.
 */
//*****<polyrevcomp>{frag:Polynucleotide}(Polynucleotide)*****
function polyrevcomp(frag) {
  const revseq = revcomp(frag.sequence);

  const revExt = (ext) => {
    if (!ext) return "";
    if (ext.startsWith("-")) {
      return "-" + revcomp(ext.slice(1));
    } else {
      return revcomp(ext);
    }
  };

  const new5 = revExt(frag.ext3);
  const new3 = revExt(frag.ext5);

  return new Polynucleotide(
    revseq,
    new5,
    new3,
    frag.isDoubleStranded,
    frag.isRNA,
    frag.isCircular,
    frag.mod_ext3,
    frag.mod_ext5
  );
}

  /**
  Creates a new polynucleotide (DNA or RNA) object as JSON
  @param {string} sequence - The sequence of the polynucleotide.
  @param {string} ext5 - The 5' extension of the current coding strand.
  @param {string} ext3 - The 3' extension of the current coding strand.
  @param {boolean} isDoubleStranded - Whether the polynucleotide is double stranded.
  @param {boolean} isRNA - Whether the polynucleotide is RNA.
  @param {boolean} isCircular - Whether the polynucleotide is circular.
  @param {string} mod_ext5 - The 5' end modification.
  @param {string} mod_ext3 - The 3' end modification.
  @return {String} The created polynucleotide object as JSON.
  @example
  var polynucleotide = polynucleotide("AGCTAGCT", "GATC", "CTAG", true, false, false, null, null);
  @customfunction
  */
 //*****<polynucleotide>{sequence:String}{ext5:String}{ext3:String}{isDoubleStranded:Boolean}{isRNA:Boolean}{isCircular:Boolean}{mod_ext5:String}{mod_ext3:String}(Polynucleotide)*****
  function polynucleotide(sequence, ext5, ext3, isDoubleStranded, isRNA, isCircular, mod_ext5, mod_ext3) {
    var out = new Polynucleotide(sequence, ext5, ext3, isDoubleStranded, isRNA, isCircular, mod_ext5, mod_ext3);    return out;
  }
  
  /**
  * Creates a Polynucleotide object (as JSON) representing a blunt-ended, double-stranded DNA
  * such as results from PCR or GBlock synthesis.  It lacks 5' phosphates.
  * @param {string} sequence - The coding strand sequence of the dsDNA.
  * @return {string} The string representation of the created polynucleotide as JSON.
  * @example
  * var frag = dsDNA("AGCTAGCT");
  * console.log(frag); // Output: '{"sequence":"AGCTAGCT","ext5":null,"ext3":null,"isDoubleStranded":true,
  * "isRNA":false,"isCircular":false,"mod_ext5":null,"mod_ext3":null}'
  * @customfunction
  */
 //*****<dsDNA>{sequence:String}(Polynucleotide)*****
  function dsDNA(sequence) {
    return new Polynucleotide(sequence, "", "", true, false, false, "hydroxyl", "hydroxyl");
  }
  
  /**
  * Creates a Polynucleotide object (as JSON) representing a linear single stranded DNA (an oligonucleotide)
  * @param {string} sequence - The sequence of the polynucleotide oligo.
  * @return {string} The string representation of the created polynucleotide oligo.
  * @example
  * var oligo = oligo("AGCTAGCT");
  * console.log(oligo); // Output: '{"sequence":"AGCTAGCT","ext5":null,"ext3":null,"isDoubleStranded":false
  * "isRNA":false,"isCircular":false,"mod_ext5":null,"
  */
 //*****<oligo>{sequence:String}(Polynucleotide)*****
  function oligo(sequence) {
    return new Polynucleotide(sequence, null, null, false, false, false, "hydroxyl", null);
  }
  
  /**
  * Creates a Polynucleotide object (as JSON) representing a circular doubkle stranded DNA (a plasmid)
  * @param {string} sequence - The sequence of the polynucleotide plasmid.
  * @return {string} The string representation of the created polynucleotide plasmid.
  * @example
  * var plasmid = plasmid("AGCTAGCT");
  console.log(plasmid); // Output: '{"sequence":"AGCTAGCT","ext5":null,"ext3":null,"isDoubleStranded":true,"isRNA":false,"isCircular":true,"mod_ext5":null,"mod_ext3":null}'
  */
 //*****<plasmid>{sequence:String}(Polynucleotide)*****
  function plasmid(sequence) {
    return new Polynucleotide(sequence, "", "", true, false, true, null, null);
  }
  
  /**
   * Not to be called from Sheets
   * For resolving a string to a Polynucleotide object
   */
  //*****<resolveToPoly>{seqOrJSON:String|JSON}(Polynucleotide|JSON)*****
  function resolveToPoly(seqOrJSON) {
    //See if its a JSON already
    try{
        var json = JSON.parse(seqOrJSON);
        return json;
    }
    catch(err) {/*intentionally empty*/}
  
    //See if its a singular DNA sequence
    if (!_regexDNA.test(seqOrJSON)) {
      throw Error("Cannot resolve " + seqOrJSON);
    }
    
    return new Polynucleotide(seqOrJSON, "", "", true, false, false, "hydroxyl", "hydroxyl");
  }
  
  /**
   * Determines whether a given DNA sequence is palindromic.
   * A palindromic DNA sequence is one that reads the same forward and backward when complemented.
   * This function also checks for invalid characters in the input sequence and throws an exception if any are found.
   *
   * @param {string} seq - The input DNA sequence to be checked for palindromicity.
   * @return {boolean} - Returns true if the input DNA sequence is palindromic, false otherwise.
   * @throws {Error} - Throws an error if the input sequence contains characters other than A, T, C, or G.
   *
   * Usage:
   *   const result = isPalindromic("AATT");
   *   console.log(result); // Output: true
   *
   * Example:
   *   1. isPalindromic("AATT") returns true
   *   2. isPalindromic("AGCT") returns false
   *   3. isPalindromic("GAATTC") returns true
   *   4. isPalindromic("AATN") throws an error (invalid character 'N')
   */
  //*****<isPalindromic>{seq:String}(Boolean)*****
  function isPalindromic(seq) {
    const complements = {
      'A': 'T',
      'T': 'A',
      'C': 'G',
      'G': 'C',
    };
  
    // Check for invalid characters and throw an exception if found
    for (const nucleotide of seq) {
      if (!complements.hasOwnProperty(nucleotide)) {
        throw new Error(`Error: Invalid character '${nucleotide}' found in sequence '${seq}'. Sequence must contain only A, T, C, or G.`);
      }
    }
  
    const reverseComplement = seq.split('').reverse().map(nucleotide => complements[nucleotide]).join('');
    return seq === reverseComplement;
  }
  
  
  /**
   * Calculates the reverse complement of a DNA sequence, including handling of degeneracy codes.
   *
   * @param {string} inseq - The DNA sequence to reverse complement
   * @return {string} The reverse complement of the DNA sequence, or "N/A" if the input contains invalid characters
   */
  //*****<revcomp>{inseq:String}(String)*****
  function revcomp(inseq) {
    if(!inseq.length) {
      return "error on " + inseq;
    }
  
    var output = "";
    for (let i = inseq.length-1; i >= 0; i--) {
      switch(inseq[i]) {
        case 'A': { output += 'T'; continue; }
        case 'T': { output += 'A'; continue; }
        case 'C': { output += 'G'; continue; }
        case 'G': { output += 'C'; continue; }
        case 'a': { output += 't'; continue; }
        case 't': { output += 'a'; continue; }
        case 'c': { output += 'g'; continue; }
        case 'g': { output += 'c'; continue; }
  
        case 'B': { output += 'V'; continue; }
        case 'D': { output += 'H'; continue; }
        case 'H': { output += 'D'; continue; }
        case 'K': { output += 'M'; continue; }
        case 'N': { output += 'N'; continue; }
        case 'R': { output += 'Y'; continue; }
        case 'S': { output += 'S'; continue; }
        case 'M': { output += 'K'; continue; }
        case 'V': { output += 'B'; continue; }
        case 'W': { output += 'W'; continue; }
        case 'Y': { output += 'R'; continue; }
  
        case 'b': { output += 'v'; continue; }
        case 'd': { output += 'h'; continue; }
        case 'h': { output += 'd'; continue; }
        case 'k': { output += 'm'; continue; }
        case 'n': { output += 'n'; continue; }
        case 'r': { output += 'y'; continue; }
        case 's': { output += 's'; continue; }
        case 'm': { output += 'k'; continue; }
        case 'v': { output += 'b'; continue; }
        case 'w': { output += 'w'; continue; }
        case 'y': { output += 'r'; continue; }
        
        default:  throw new Error("Character '" + inseq[i] + "' is not a valid DNA character");
      }
    }
    return output;
  }
           
  
  /**
   * Calculates the G/C content of a DNA sequence.
   *
   * @param {string} inseq - The DNA sequence to analyze
   * @return {number} The G/C content of the DNA sequence, between 0 and 1
   */
  //*****<gccontent>{inseq:String}(Number)*****
  function gccontent(inseq) {
    inseq = inseq.toUpperCase();
    let gcCount = 0;
    for (let i = 0; i < inseq.length; i++) {
      if (inseq[i] == "G" || inseq[i] == "C") {
        gcCount++;
      }
    }
    return gcCount / inseq.length;
  }
  
  /**
   * Calculates the base balance of a DNA sequence.
   *
   * @param {string} inseq - The DNA sequence to analyze
   * @return {number} The base balance of the DNA sequence, between 0 and 1
   */
  //*****<basebalance>{inseq:String}(Number)*****
  function basebalance(inseq) {
      inseq = inseq.toUpperCase();
    let baseCounts = {
      A: 0,
      C: 0,
      G: 0,
      T: 0,
    };
    for (let i = 0; i < inseq.length; i++) {
      baseCounts[inseq[i]]++;
    }
    let score = 1;
    for (const base in baseCounts) {
      if (baseCounts[base] == 0) {
        score = 0;
        break;
      }
      score *= baseCounts[base] / inseq.length;
    }
    return 4*Math.pow(score, 1/4);
  }
  
  /**
   * Finds the longest streak of repeating bases in a DNA sequence.
   *
   * @param {string} inseq - The DNA sequence to analyze
   * @return {number} The longest streak of repeating bases in the DNA sequence
   */
  //*****<maxrepeat>{inseq:String}(Number)*****
  function maxrepeat(inseq) {
    inseq = inseq.toUpperCase();
  
    let lastBase = "";
    let streak = 0;
    let maxStreak = 0;
    for (let i = 0; i < inseq.length; i++) {
      if (inseq[i] == lastBase) {
        streak++;
        maxStreak = Math.max(maxStreak, streak);
      } else {
        lastBase = inseq[i];
        streak = 1;
      }
    }
    return maxStreak;
  }
  

/**
 * Translates a DNA sequence to an amino acid sequence (single-letter codes, no stop codons).
 * Throws if the input is not a string, or contains invalid DNA letters.
 * @param {string} dna - DNA sequence to translate
 * @return {string} Amino acid sequence (no stop codons)
 */
//*****<translate>{dna:String}(String)*****
function translate(dna) {
  if (typeof dna !== 'string') throw new Error("Translate: " + dna + " is not a string.");
  dna = cleanup(dna);
  if (!/^[ACGT]+$/.test(dna)) throw new Error("Input must only contain valid DNA letters (A, C, G, T).");
  
  const geneticCode = {
    'ATA':'I','ATC':'I','ATT':'I','ATG':'M',
    'ACA':'T','ACC':'T','ACG':'T','ACT':'T',
    'AAC':'N','AAT':'N','AAA':'K','AAG':'K',
    'AGC':'S','AGT':'S','AGA':'R','AGG':'R',
    'CTA':'L','CTC':'L','CTG':'L','CTT':'L',
    'CCA':'P','CCC':'P','CCG':'P','CCT':'P',
    'CAC':'H','CAT':'H','CAA':'Q','CAG':'Q',
    'CGA':'R','CGC':'R','CGG':'R','CGT':'R',
    'GTA':'V','GTC':'V','GTG':'V','GTT':'V',
    'GCA':'A','GCC':'A','GCG':'A','GCT':'A',
    'GAC':'D','GAT':'D','GAA':'E','GAG':'E',
    'GGA':'G','GGC':'G','GGG':'G','GGT':'G',
    'TCA':'S','TCC':'S','TCG':'S','TCT':'S',
    'TTC':'F','TTT':'F','TTA':'L','TTG':'L',
    'TAC':'Y','TAT':'Y','TAA':'*','TAG':'*',
    'TGC':'C','TGT':'C','TGA':'*','TGG':'W',
  };

  let aaSequence = "";
  for (let i = 0; i < dna.length; i += 3) {
    const codon = dna.substring(i, i + 3);
    const aa = geneticCode[codon];
    if (!aa) throw new Error("Invalid codon: " + codon);
    if (aa !== '*') aaSequence += aa;
  }
  return aaSequence;
}



// C6-Annotator.js - DNA Autoannotation and Expression Inference
//
// Philosophical Basis:
// This system models biological sequence annotations through a central dogma lens:
// Features are classified by biological stage:
// - dnaFeatures: Regulatory or structural genomic elements (e.g., promoters, operators, terminators)
// - rnaFeatures: Elements present in the transcribed RNA product (e.g., RBS, riboswitches, UTRs)
// - cdsFeatures: Open reading frames translated into proteins
//
// This classification is a pragmatic subset derived from principles seen in established biological ontologies
// (e.g., SO: Sequence Ontology), but is simplified for synthetic biology circuit modeling.
// In particular, the TU (Transcriptional Unit) abstraction models the logical transcription output of a promoter:
// - Starts immediately after the promoter
// - Ends at the terminator
// - Includes RNA-relevant features but not the promoter or terminator themselves
//
// Promoters and terminators are boundary markers but not included in the TU's internal features[] list.
// Although parts of promoters and terminators are technically transcribed, this model omits spacer regions
// and focuses on logical, design-relevant transcriptional content.
//
// Future extensions to this system may map additional feature types from broader ontologies
// into these bins without disrupting the core logic.


// Feature Ontology Bins:
const dnaFeatures = new Set([
  'promoter', 'operator', 'enhancer', 'silencer', 'recombination_site', 'insulator', 'terminator'
]);

const rnaFeatures = new Set([
  'rbs', 'kozak', 'riboswitch', 'intron', 'exon', 'utr', 'polyA_signal'
]);

const cdsFeatures = new Set([
  'cds'
]);

// Smart matching using full exact matching (no k-mer seeding)
function annotateSequence(sequence, featureDb = null) {
  //   console.log("🔍 Starting annotation...");
  sequence = cleanup(sequence);
  const detectedFeatures = [];

  const db = featureDb || featureDbGlobal;
  if (!db) throw new Error("No feature database loaded yet.");

  const seqVariants = [sequence, revcomp(sequence)];
  //   console.log("🧬 Scanning sequence and reverse complement with full exact matching...");

  seqVariants.forEach((seq, strandIndex) => {
    db.forEach(feature => {
      const pattern = cleanup(feature.Sequence || '');
      if (pattern.length < 10) return; // Ignore very short patterns

      let pos = seq.indexOf(pattern);
      while (pos !== -1) {
        detectedFeatures.push({
          start: pos,
          end: pos + pattern.length,
          strand: strandIndex === 0 ? 1 : -1,
          label: feature.Name,
          type: feature.Type,
          color: feature.Color
        });
        pos = seq.indexOf(pattern, pos + 1);
      }
    });
  });

  //   console.log(`🔎 Found ${detectedFeatures.length} matching features.`);
  return detectedFeatures.sort((a, b) => a.start - b.start);
}

function inferTranscriptionalUnits(features) {
  //   console.log("🧬 Starting new-style TU inference...");

  const tus = [];
  const featureList = features.slice().sort((a, b) => a.start - b.start);
  const openTUs = [];

  const allowedTypes = new Set([
    ...dnaFeatures,
    ...rnaFeatures,
    ...cdsFeatures
  ]);

  for (const feature of featureList) {
    const type = feature.type.toLowerCase();
    if (!allowedTypes.has(type)) continue;

    if (type === 'promoter') {
      //   console.log(`🔵 Found promoter: ${feature.label} at ${feature.start}`);
      openTUs.push({
        promoter: feature,
        start: feature.end, // Start at end of promoter
        features: [],
        terminator: null,
        end: null
      });
    }

    // Add feature to all open TUs, but skip DNA-only features
    openTUs.forEach(tu => {
      if (feature.start >= tu.start && !dnaFeatures.has(type)) {
        tu.features.push(feature);
        // console.log(`➕ Assigned feature ${feature.label} (${feature.type}) to TU started by ${tu.promoter.label}`);
      }
    });

    if (type === 'terminator') {
      //   console.log(`🔴 Found terminator: ${feature.label} at ${feature.start}`);
      // Close all open TUs
      openTUs.forEach(tu => {
        tu.terminator = feature;
        tu.end = feature.start; // End before terminator starts
        tus.push(tu);
        // console.log(`✅ Closed TU from ${tu.start} to ${feature.start} (promoter: ${tu.promoter.label}, terminator: ${feature.label})`);
      });
      openTUs.length = 0; // Clear open TUs
    }
  }

  //   console.log(`✅ Finished TU inference: ${tus.length} transcriptional units.`);
  return tus;
}


// Infer expressed proteins from TUs
function inferExpressedProteins(tus) {
  const proteins = [];

  tus.forEach((tu, index) => {
    tu.features.forEach(feature => {
      if (feature.type.toLowerCase() === 'cds') {
        proteins.push({
          tuIndex: index + 1,
          label: feature.label
        });
      }
    });
  });

  return proteins;
}

// Find non-expressed CDS
function findNonExpressedCDS(allFeatures, expressedProteins) {
  const expressedLabels = new Set(expressedProteins.map(p => p.label));
  const nonExpressed = [];

  allFeatures.forEach(feature => {
    if (feature.type.toLowerCase() === 'cds' && !expressedLabels.has(feature.label)) {
      nonExpressed.push({ label: feature.label });
    }
  });

  return nonExpressed;
}

// Internal feature database
let featureDbGlobal = [];

// Load feature database automatically
(function initializeFeatureDatabase() {
  const defaultFeatureUrl = "https://raw.githubusercontent.com/UCB-BioE-Anderson-Lab/cloning-tutorials/main/sequences/Default_Features.txt";

  //   console.log("🌐 Fetching default features...");
  fetch(defaultFeatureUrl)
    .then(response => {
      //   console.log("📥 Feature file fetched, parsing...");
      return response.text();
    })
    .then(text => {
      const lines = text.split("\n").filter(line => line.trim().length > 0);
      featureDbGlobal = lines.map(line => {
        const [Name, Sequence, Type, Color, LabelColor, Forward, Reverse] = line.split(/\s+/);
        return { Name, Sequence, Type, Color };
      });
      //   console.log(`✅ C6-Annotator: Loaded ${featureDbGlobal.length} features.`);
    })
    .catch(err => {
      console.error("❌ Failed to load default features:", err);
    });
})();



// Simplified codon usage table for E. coli
const codonUsageData = {
  F: ["TTT", "TTC"], S: ["TCT", "TCC", "TCA", "TCG", "AGT", "AGC"],
  Y: ["TAT", "TAC"], C: ["TGT", "TGC"], L: ["TTA", "TTG", "CTT", "CTC", "CTA", "CTG"],
  P: ["CCT", "CCC", "CCA", "CCG"], H: ["CAT", "CAC"], R: ["CGT", "CGC", "CGA", "CGG", "AGA", "AGG"],
  Q: ["CAA", "CAG"], I: ["ATT", "ATC"], T: ["ACT", "ACC", "ACA", "ACG"],
  N: ["AAT", "AAC"], K: ["AAA", "AAG"], M: ["ATG"], W: ["TGG"],
  A: ["GCT", "GCC", "GCA", "GCG"], V: ["GTT", "GTC", "GTA", "GTG"],
  D: ["GAT", "GAC"], E: ["GAA", "GAG"], G: ["GGT", "GGC", "GGA", "GGG"],
};

// Dummy restriction enzyme list for demonstration
const geneRestrictionEnzymes = {
  BsaI: { recognitionSequence: "GGTCTC", recognitionRC: "GAGACC" },
  BsmBI: { recognitionSequence: "CGTCTC", recognitionRC: "GAGACG" }
};

//*****<removeSites>{orf:String}(String)*****
function removeSites(orf) {
  if (typeof orf !== 'string') throw new Error("Invalid input: ORF must be a string.");
  orf = cleanup(orf);
  if (orf.length % 3 !== 0) throw new Error("Invalid input sequence. Must be a multiple of 3.");
  orf = orf.toUpperCase();
  if (!/^[ATGC]*$/.test(orf)) throw new Error("Invalid input sequence. Must be composed of only DNA characters.");

  let stopCodon = orf.slice(-3);
  if (!["TAA", "TGA", "TAG"].includes(stopCodon)) {
    stopCodon = "TAA";
  } else {
    orf = orf.slice(0, -3);
  }

  const codonArray = orf.match(/.{1,3}/g);
  const proteinSequence = translate(orf);

  const forbiddenSequences = [];
  for (const enzymeName in geneRestrictionEnzymes) {
    const { recognitionSequence, recognitionRC } = geneRestrictionEnzymes[enzymeName];
    forbiddenSequences.push(recognitionSequence);
    if (recognitionSequence !== recognitionRC) forbiddenSequences.push(recognitionRC);
  }

  outer: while (true) {
    let changeMade = false;
    for (const site of forbiddenSequences) {
      let searchStart = 0;
      while (true) {
        const siteIndex = orf.indexOf(site, searchStart);
        if (siteIndex === -1) break;

        const overlapping = [];
        for (let i = 0; i < Math.floor(site.length / 3); i++) {
          overlapping.push(i + Math.floor(siteIndex / 3));
        }

        const idx = overlapping[Math.floor(Math.random() * overlapping.length)];
        const aa = proteinSequence[idx];
        const options = codonUsageData[aa];
        let newCodon = options[Math.floor(Math.random() * options.length)];
        while (newCodon === codonArray[idx]) {
          newCodon = options[Math.floor(Math.random() * options.length)];
        }

        codonArray[idx] = newCodon;
        orf = codonArray.join("");
        searchStart = siteIndex + 1;
        changeMade = true;
        continue outer;
      }
    }
    if (!changeMade) break;
  }

  return codonArray.join("") + stopCodon;
}

//*****<oneAAoneCodon>{peptide:String}(String)*****
function oneAAoneCodon(peptide) {
  if (!/^[A-Z\*]+$/.test(peptide)) throw new Error("Input must be amino acid letters and asterisks.");
  return peptide.split("").map(aa => aa === '*' ? "TAA" : codonUsageData[aa][0]).join("");
}



/**
 * @file C6-Oligos.js
 * @author J. Christopher Anderson with ChatGPT
 * @copyright 2025 University of California, Berkeley
 * @license See the LICENSE file included in the repository
 * @version 1.0.0
 * @module C6-Oligos
 * @description
 * This script provides a collection of functions for designing oligos,
 * gblocks, or gene synthesis sequences and wetlab instructions for
 * manipulating them.
 */

/**
 * Calculates a score for an annealing sequence based on various criteria.
 *
 * The score is calculated based on the following criteria:
 *  - Whether the first and last base of the annealing sequence are G or C
 *  - The G/C content of the annealing sequence (between 50% and 65%)
 *  - The base balance of the annealing sequence (no missing bases, no excesses of one particular base)
 *  - The randomness of the annealing sequence (no long stretches of a single base, no large regions of G/C rich sequence and all A/T in other regions)
 *
 * @param {string} inseq - The annealing sequence to score
 * @return {number} The score of the annealing sequence, between 0 and 1
 */
//*****<scoreanneal>{inseq:String|Polynucleotide}(Number)*****
function scoreanneal(inseq) {
  let anneal = resolveToSeq(inseq);
  let score = 0;
  const maxPossibleScore = 5;
  
  // Check if first and last base are G or C
  if (anneal[0] == "G" || anneal[0] == "C") {
    score++;
  }
  if (anneal[anneal.length - 1] == "G" || anneal[anneal.length - 1] == "C") {
    score++;
  }
  
  // Check G/C content
  const gcContent = gccontent(anneal);
  if (gcContent >= 0.5 && gcContent <= 0.65) {
    score++;
  }
  
  // Check base composition
  const baseBalance = basebalance(anneal);
  if (baseBalance > 0.75) {
    score++;
  }
  
  // Check for randomness
  const maxRepeat = maxrepeat(anneal);
  if (maxRepeat <= 3) {
    score++;
  }
  
  // Check length
  const lengthDiff = Math.abs(anneal.length - 20);
  score -= lengthDiff/2;
  
  return Math.max(0,score / maxPossibleScore);
}

/**
 * Returns the best annealing sequence for an input DNA sequence.
 *
 * The annealing sequence is a substring of the input sequence that meets the following criteria:
 *  - It is between 18 and 25 bases in length
 *  - If lock5 is true, the start of the annealing sequence must be the start of the input sequence
 *  - If lock3 is true, the end of the annealing sequence must be the end of the input sequence
 *  - The first and last base of the annealing sequence are ideally G or C
 *  - The overall G/C content of the annealing sequence is between 50% and 65%
 *  - The base composition of the annealing sequence is balanced (no missing bases, no excesses of one particular base)
 *  - The annealing sequence appears random (no long stretches of a single base, no large regions of G/C rich sequence and all A/T in other regions)
 *
 * If both lock5 and lock3 are true, the function throws an Error. It is not topologically possible.
 *
 * @param {string} inseq - The input DNA sequence
 * @param {boolean} lock5 - Whether the annealing sequence must start at the start of the input sequence
 * @param {boolean} lock3 - Whether the annealing sequence must end at the end of the input sequence
 * @return {string} The best annealing sequence that meets the specified criteria
 */
//*****<findanneal>{inseq:String|Polynucleotide}{lock5:Boolean}{lock3:Boolean}(String)*****
function findanneal(inseq, lock5, lock3) {
  inseq = resolveToSeq(inseq);

  const minLength = 18;
  const maxLength = 25;
  let bestAnneal = "N/A";
  let bestScore = -1;

  // Case: lock5=true, lock3=false
  if (lock5 && !lock3) {
    let startIndex = 0;
    for (let endIndex = minLength; endIndex <= maxLength; endIndex ++) {
      let anneal = inseq.substring(startIndex, endIndex);
      let score = scoreanneal(anneal);
      if(score > bestScore) {
        bestAnneal = anneal;
        bestScore = score;
      }
    }
    return bestAnneal;
  }

  // Case: lock5=false, lock3=true
  if (!lock5 && lock3) {
    let endIndex = inseq.length;
    for (let startIndex = endIndex - maxLength; startIndex < endIndex - minLength; startIndex++) {
      let anneal = inseq.substring(startIndex, endIndex);
      let score = scoreanneal(anneal);
      if(score > bestScore) {
        bestAnneal = anneal;
        bestScore = score;
      }
    }
    return bestAnneal;
  }

  if (!lock5 && !lock3) {
    let annealStart = 0;
    let annealEnd = inseq.length;
    
    for (; annealStart < annealEnd - minLength; annealStart++) {
      for (let i = annealStart + minLength; i < annealEnd; i++) {
        const anneal = inseq.substring(annealStart, i);
        const score = scoreanneal(anneal);
        
        if (score > bestScore) {
          bestAnneal = anneal;
          bestScore = score;
        }
      }
    }
    
    return bestAnneal;
  }

  throw new Error(`Cannot lock both ends of the template`);
}

/**
 * PCA function that generates oligos for a synthon using the polymerase chain assembly method.
 *
 * @param {string} synthon - The synthon DNA sequence.
 * @return {string} - A JSON array of oligos needed to build the synthon.
 */
//*****<pca>{synthon:String|Polynucleotide}([String])*****
function pca(synthon) {
  synthon = resolveToSeq(synthon);

  //Figure out the spacing
  let chunks = Math.round(synthon.length / 25);
  if(chunks % 2 != 0) {
    chunks++;
  }
  const chunksize = Math.round(synthon.length/chunks);

  // Initialize an array to store the annealing indices
  const annealingIndices = [];

  // Iterate through the synthon chunksize (about 25) bp at a time
  for (let i = chunksize; i < synthon.length - chunksize; i += chunksize) {
    // Get the 12 bp before and after the current site
    const seq = synthon.substr(i - 12, 24);

    // Get the best annealing site within the current window
    const anneal = findanneal(seq, false, false);

    // Store the start and end indices of 'anneal' on 'synthon'
    const startIndex = synthon.indexOf(anneal);
    const endIndex = startIndex + anneal.length;
    annealingIndices.push([startIndex, endIndex]);  
  }

  // Initialize an array to store the annealing indices
  const oligos = [];

  // Iterate through annealingIndices and construct oligos
  for (let i = 0; i < annealingIndices.length; i++) {
    //The forward first oligo
    if(i==0) {
      oligos.push(synthon.substring(0, annealingIndices[1][1]));
      continue;
    }

    //The last reverse oligo
    if(i==annealingIndices.length - 1) {
      let lastoligo = synthon.substring(annealingIndices[i][0]);
      oligos.push(revcomp(lastoligo));
      continue;
    }

    //For internal forward oligos
    if(i%2 == 0) {
      oligos.push(synthon.substring(annealingIndices[i][0], annealingIndices[i+1][1]));
      continue;
    }

    //For internal reverse oligos
    let rcoligo = synthon.substring(annealingIndices[i][0], annealingIndices[i+1][1]);
    oligos.push(revcomp(rcoligo));
  }

  // Return the oligos as a JSON array
  return oligos;
}

/**
 * LCA function that generates oligos for a synthon using the ligase chain assembly method.
 *
 * @param {string} synthon - The synthon DNA sequence.
 * @return {string} - A JSON array of oligos needed to build the synthon.
 */
//*****<lca>{synthon:String|Polynucleotide}([String])*****
function lca(synthon) {
  synthon = resolveToSeq(synthon);
    let seqLen = synthon.length;
    let oligos = [];

    // Find the largest chunk size that allows for roughly equal-sized chunks
    let mod = (seqLen - 25) % 50;
    let n = (seqLen - mod) / 50;
    if (mod > 25) {
        n++;
    } else if (mod < -25) {
        n--;
    }
    let chunkSize = Math.floor(seqLen / n);

    function generateOligos(s) {
        // Generate the n chunkSize oligos
        for (let i = 0; i < n; i++) {
            let oligo = s.substring(i*chunkSize, i*chunkSize + chunkSize);
            oligos.push(oligo);
        }
    }

    // Reverse complement the synthon sequence
    let synthonRevcomp = revcomp(synthon);

    // Generate oligos for the forward and reverse strands
    generateOligos(synthon);
    generateOligos(synthonRevcomp);

    // Return the oligos as a JSON array
    return oligos;
}

/**
 * Designs oligos or gene synthesis sequences for a BlgBrick part based on the input parameters.
 *
 * @param {string} sequence - the DNA sequence for the internal guts of the part.
 * @param {string} frgs - specifies whether a forward (F) or reverse (R) oligo is returned,
 *                      or a sequence for gene synthesis synthon (S) or a linear gblock (G).
 *
 * @returns {string} - the designed sequence.
 *
 * @example
 *
 * // Design a forward oligo for a BlgBrick part
 * const partSequence = 'atgcatgtaagtaattttacagctggattgctattacttgtaatagcatttggcggaacataa';
 * const forwardOligo = bglbrick(partSequence, 'F'); // returns 'ccataAGATCTATGCATGTAAGTAATTTTAC'
 *
 * // Design a reverse oligo for a BlgBrick part
 * const reverseOligo = bglbrick(partSequence, 'R'); // returns 'catcaCTCGAGttaGGATCCTTATGTTCCGCCAAATGCTA'
 *
 * // Design a gene synthesis sequence for a BlgBrick part
 * const geneSynthesisSeq = bglbrick(partSequence, 'G'); // returns 'AGATCTggataGAATTCatgAGATCTATGCATGTAAGTAATTTTACGGATCCtaaCTCGAG'
 */
//*****<bglbrick>{sequence:String|Polynucleotide}{frgs:String}(String)*****
function bglbrick(sequence, frgs) {
  let rORf = frgs[0].toUpperCase();
  sequence = resolveToSeq(sequence);

  if ( rORf === 'F') {
    return "ccata" + "AGATCT" + findanneal(sequence, true, false);

  } else if (rORf === 'R') {
    return "catca" + "CTCGAGttaGGATCC" + revcomp(findanneal(sequence, false, true));

  } else if (rORf === 'S') {  
    return "GAATTCatgAGATCT" + sequence + "GGATCCtaaCTCGAG";

  } else if (rORf === 'G') {  
    return "ccataGAATTCatgAGATCT" + sequence + "GGATCCtaaCTCGAGtaacg";

  } else {
    throw new Error("Invalid value for 'frgs'. Please enter either 'F' or 'R' or 'Gblock' or 'Synthon'.");
  }
}

/**
 * Designs oligos or gene synthesis sequences for a BioBrick (RFC10).
 *
 * @param {string} sequence - the DNA sequence for the internal guts of the part.
 * @param {boolean} isCDS - specifies if the sequence is a CDS (true) or not (false).
 * @param {string} frgs - specifies whether a forward (F) or reverse (R) oligo is returned,
 *                      or a sequence for gene synthesis synthon (S) or a linear gblock (G).
 *
 * @returns {string} - the designed sequence.
 *
 * @example
 *
 * // Design a forward oligo for a BioBrick part with a CDS sequence
 * const partSequence = 'atgcatgtaagtaattttacagctggattgctattacttgtaatagcatttggcggaacataa';
 * const isCDS = true;
 * const forwardOligo = biobrick(partSequence, isCDS, 'F'); // returns 'gacttGAATTCgcggccgctTCTAGGGATAGAATTCATGAGATC'
 *
 * // Design a forward oligo for a BioBrick part with a non-CDS sequence
 * const partSequence = 'tccctatcagtgatagagattgacatccctatcagtgatagagatactgagcac';
 * const isCDS = false;
 * const forwardOligo = biobrick(partSequence, isCDS, 'F'); // returns 'gacttGAATTCgcggccgctTCTAGAgTCCCTATCAGTGATAGAG'
 *
 * // Design a reverse oligo for a BioBrick part
 * const partSequence = 'atgcatgtaagtaattttacagctggattgctattacttgtaatagcatttggcggaacataa';
 * const isCDS = true;
 * const reverseOligo = biobrick(partSequence, isCDS, 'R'); // returns 'catcaACTAGTaTTATGTTCCGCCAAATGCTA'
 *
 * // Design a gene synthesis sequence for a BioBrick part with a CDS sequence
 * const geneSynthesisSeq = biobrick(partSequence, isCDS, 'G'); // returns 'GAATTCgcggccgctTCTAGatgcatgtaagtaattttacagctggattgctattacttgtaatagcatttggcggaacataatACTAGT'
 */
//*****<biobrick>{sequence:String|Polynucleotide}{isCDS:Boolean}{frgs:String}(String)*****
function biobrick(sequence, isCDS, frgs) {
  let rORf = frgs[0].toUpperCase();
  sequence = resolveToSeq(sequence);

  if ( rORf === 'F') {
    if(isCDS) {
      return "gacttGAATTCgcggccgctTCTAG" + findanneal(sequence, true, false);
    } else {
      return "gacttGAATTCgcggccgctTCTAGAg" + findanneal(sequence, true, false);
    }

  } else if (rORf === 'R') {
    return "catca" + "ACTAGTa" + revcomp(findanneal(sequence, false, true));

  } else if (rORf === 'G') {  
    if(isCDS) {
      return "ccataGAATTCgcggccgctTCTAG" + sequence + "tACTAGTagcggccgCTGCAGcatcg";
    } else {
      return "ccataGAATTCgcggccgctTCTAG" + sequence + "tACTAGTagcggccgCTGCAGcatcg";
    }

  } else if (rORf === 'S') {  
    if(isCDS) {
      return "GAATTCgcggccgctTCTAG" + sequence + "tACTAGTagcggccgCTGCAG";
    } else {
      return "GAATTCgcggccgctTCTAGAg" + sequence + "tACTAGTagcggccgCTGCAG";
    }
    
  } else {
    throw new Error("Invalid value for 'frgs'. Please enter either 'F' or 'R' or 'Gblock' or 'Synthon'.");
  }
}

const stickyEnds = {
    UC: ['TACT', 'AAGC'],
    TP: ['GCTT', 'AGTA'],
    SP: ['AATG', 'ACCT'],
    U: ['TACT', 'CATT'],
    C: ['AGGT', 'AAGC'],
    T: ['GCTT', 'AGCG'],
    P: ['GGAG', 'AGTA']
};

/**
 * moclo - a function to design a forward or reverse oligo for MoClo cloning
 *
 * MoClo (Modular Cloning) is a DNA cloning method used in synthetic biology. 
 * It is based on the use of Type IIS restriction enzymes to generate standardized
 * 4 bp sticky ends based on part type. The types are P for promoter parts, U for 
 * 5' UTR parts (RBS), C for CDS/ORF parts, T for terminator parts, and SP for 
 * secretion tags.  UC parts are rbs.CDS joined parts.  TP parts are joined parts
 * of a terminator followed by a promoter.
 *
 * @param {string} sequence - the DNA sequence
 * @param {string} partType - one of {UC, TP, P, U, C, T, SP}
 * @param {string} frgs - specifies whether a forward (F) or reverse (R) oligo is returned,
 *                      or a sequence for gene synthesis synthon (S) or a linear gblock (G).
 *
 * @return {string} - the designed sequence
 *
 * @example
 * moclo("tccctatcagtgatagagattgacatccctatcagtgatagagatactgagcac", "P", forward);
 * // returns: "ccataGGTCTCaGGAGTCCCTATCAGTGATAGAG"
 */
//*****<moclo>{sequence:String|Polynucleotide}{partType:String}{frgs:String}(String)*****
function moclo(sequence, partType, frgs) {
  let rORf = frgs[0].toUpperCase();
  sequence = resolveToSeq(sequence);
  if ( rORf === 'F') {
    let sticky = stickyEnds[partType][0];
    return "ccata" + "GGTCTCa" + sticky + findanneal(sequence, true, false);

  } else if (rORf === 'R') {
    let sticky = stickyEnds[partType][1];
    return "catca" + "GGTCTCt" + sticky + revcomp(findanneal(sequence, false, true));

  } else if (rORf === 'S') {  
    let sticky5 = stickyEnds[partType][0];
    let sticky3 = stickyEnds[partType][1];
    return "GGTCTCt" + sticky5 + sequence + revcomp(sticky3) + "aGAGACC";

  } else if (rORf === 'G') {  
    let sticky5 = stickyEnds[partType][0];
    let sticky3 = stickyEnds[partType][1];
    return "ccataGGTCTCt" + sticky5 + sequence + revcomp(sticky3) + "aGAGACCtaacg";

  } else {
    throw new Error("Invalid value for 'frgs'. Please enter either 'F' or 'R' or 'Gblock' or 'Synthon'.");
  }
}

/**
 * Designs oligos for PCR and subsequent homology-based assembly of two DNA sequences
 * into one molecule. It takes in two DNA sequences as input and returns the designed
 * oligos as output. The function is useful for joining overlapping DNA fragments or
 * inserting a DNA fragment into a larger construct using homology-based assembly methods
 * such as SOEing, Gibson assembly, or yeast homologous recombination.
 *
 * Usage:
 * var seq1 = "tccctatcagtgatagagattgacatccctatcagtgatagagatactgagcac";
 * var seq2 = "atgcatgtaagtaattttacagctggattgctattacttgtaatagcatttggcggaacataa";
 * var oligos = genejoin(seq1, seq2, "F");
 * // returns: "GTGATAGAGATACTGAGCACATGCATGTAAGTAATTTTAC"
 *
 * @param {string} fivePrimeSeq The 5' DNA sequence to be joined.
 * @param {string} threePrimeSeq The second DNA sequence to be joined.
 * @param {string} ForR whether a forward (F) or reverse (R) oligo is returned
 * @return {string} The designed oligos for homology-based joining of the input sequences.
 */
//*****<genejoin>{fivePrimeSeq:String|Polynucleotide}{threePrimeSeq:String|Polynucleotide}{ForR:String}(String)*****
function genejoin(fivePrimeSeq, threePrimeSeq, ForR) {
  fivePrimeSeq = resolveToSeq(fivePrimeSeq);
  threePrimeSeq = resolveToSeq(threePrimeSeq);

  let anneal5 = findanneal(fivePrimeSeq,false,true);
  let anneal3 = findanneal(threePrimeSeq,true,false);
  let rORf = ForR[0].toUpperCase();

  let forOligo = anneal5 + anneal3;

  if ( rORf === 'F') {
    return forOligo;

  } else if (rORf === 'R') {
    return revcomp(forOligo);
  }

  throw new Error("Invalid value for 'ForR'. Please enter either 'Forward' or 'Reverse'.  You put in: " + ForR);
}

/**
 * Designs a ribosome binding site library of MoClo UC type
 *
 * @param {string} orf - the open reading frame of the CDS being controlled
 * @param {string} utr - the native or other known and function 5' UTR for the orf
 * @param {string} frg - whether a forward (F) or reverse (R) oligo is returned,
 * or a sequence for gene synthesis (G)
 *
 * @return {string} - the designed sequence
 */
//*****<rbslib>{orf:String|Polynucleotide}{utr:String|Polynucleotide}{frg:String}(String)*****
function rbslib(orf, utr, frg)   {
  orf = resolveToSeq(orf);
  utr = resolveToSeq(utr);

  //Check that the orf is a multiple of 3 (codons)
  if (orf.length % 3 !== 0) {
    throw new Error("Length of orf must be a multiple of 3");
  }

  //If it lacks a stop codon, make it TAA
  if (!["TAA", "TGA", "TAG"].includes(orf.substring(orf.length-3))) {
      orf += "TAA";
  }

  //Abort if it isn't an orf
  if (!["ATG", "GTG", "CTG", "TTG"].includes(orf.substring(0, 3))) {
    throw new Error("Start of CDS not a start codon");
  }

  //Make it start with ATG
  if (!orf.startsWith("ATG")) {
    orf = "A" + orf.substring(1);
  }

  let rORf = frg[0].toUpperCase();

  if (rORf === 'R') {
    return "catca" + "GGTCTCt" + "AAGC" + revcomp(findanneal(orf, false, true));
  }
  
  // Figure out the PWM library
  let rbs = utr.substring(utr.length - 7);
  rbs = "NVWGGRD" + rbs;
  rbs = utr.substring(utr.length - 17, utr.length - 14) + rbs;

  if ( rORf === 'F') {
    return "ccata" + "GGTCTCa" + "TACT" + rbs.toLowerCase() + findanneal(orf, true, false);
  }  

  if (rORf === 'G') {  
    return "ccataGGTCTCt" + "TACT" + rbs.toLowerCase() + orf + "GCTT" + "aGAGACCtgatg";
  }

  if (rORf === 'S') {  
    return "GGTCTCt" + "TACT" + rbs.toLowerCase() + orf + "GCTT" + "aGAGACC";
  }
}



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
                        // Check token count for Digest
                        if (tokens.length < 4) {
                            throw new Error("Digest step requires at least 4 fields: Digest DNA Enzymes FragSelect Output");
                        }
                        step.dna = tokens[1];
                        step.enzymes = tokens[2].split(',');
                        step.fragselect = tokens[3] ? parseInt(tokens[3], 10) : 1;
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
    console.log("parseCF returning CF");
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

  console.log("PCR returning product");

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

};

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
  const lastHomology = forwardStrand.slice(-20);
  const firstIndex = forwardStrand.indexOf(lastHomology);

  if (firstIndex === forwardStrand.length - HOMOLOGY_LENGTH || firstIndex < 0) {
    if (check_circular) {
      throw new Error("Assembly product cannot be re-circularized");
    } else {
      return dsDNA(forwardStrand);
    }
  }

  console.log("Gibson returning product");

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
      let targetIndex = fragselect;
      // Sort fragments by start position in the original sequence
      fragsOut.sort((a, b) => {
        const startPosA = seq.sequence.indexOf(a.sequence);
        const startPosB = seq.sequence.indexOf(b.sequence);
        return startPosA - startPosB;
      });
      // Handle circular case where the first fragment should actually be the last
      if (seq.sequence.indexOf(fragsOut[0].sequence) !== 0) {
        const firstFrag = fragsOut.shift();
        fragsOut.push(firstFrag);
        targetIndex = fragselect === 0 ? fragsOut.length - 1 : fragselect - 1;
      }
      // Return a new plasmid Polynucleotide with the selected fragment's sequence
      const newSeq = fragsOut[targetIndex];
      return newSeq;
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
                // throw new Error(`Unsupported operation: ${step.operation}`);
        }
    }

    const outputTable = products.map((product) => [product.name, product.sequence]);
    return outputTable;
}



// C6-Utils.js - General Utility Functions for Web Applications
// Adapted from C6-Utils.gs for browser-based applications

// Function to merge multiple strings or arrays into a single string with a delimiter
function merge(...args) {
    if (args.length < 2) {
        throw new Error("At least two arguments are required");
    }

    const delimiter = args.pop();
    if (typeof delimiter !== "string") {
        throw new Error("The last argument must be a delimiter string");
    }

    return args.flat().join(delimiter);
}

// Function to extract a field from a JSON object or array as a string
function field(objJSON, fieldName) {
    try {
        const obj = JSON.parse(objJSON);
        const value = obj[fieldName];
        return typeof value === "object" ? JSON.stringify(value) : value;
    } catch (error) {
        throw new Error("Invalid JSON format or field not found.");
    }
}

// Simplified version: Converts an array of [key, value] pairs into a JSON object string
function makeJSON(inputArray) {
    const obj = {};
    inputArray.forEach(([key, value]) => {
        if (typeof key === 'string' && key.trim()) {
            obj[key.trim()] = value === 'null' ? null :
                              value === 'undefined' ? undefined :
                              value;
        }
    });
    return JSON.stringify(obj);
}




//# sourceMappingURL=c6-sim.min.js.map
