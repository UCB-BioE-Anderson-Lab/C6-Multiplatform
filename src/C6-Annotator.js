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

import { cleanup, revcomp, translate } from './C6-Seq.js';

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

// Pre-index features by k-mers for fast lookup
function buildFeatureIndex(features, k = 10) {
  console.log("🔧 Building feature index...");
  const index = new Map();

  features.forEach(feature => {
    const pattern = cleanup(feature.Sequence || '');
    if (pattern.length >= k) {
      for (let i = 0; i <= pattern.length - k; i++) {
        const kmer = pattern.slice(i, i + k);
        if (!index.has(kmer)) {
          index.set(kmer, []);
        }
        index.get(kmer).push(feature);
      }
    }
  });

  console.log(`✅ Feature index built with ${index.size} unique ${k}-mers.`);
  return index;
}

// What each IUPAC degeneracy code is allowed to stand for, as a character class.
//
// WHY THIS EXISTS. `cleanup` has always accepted degeneracy codes, and feature libraries have
// always used them: a type IIS enzyme is written with its cut geometry (`GGTCTCnNNNN`) and a
// promoter family as a consensus with variable spacers (`TTTACAnnnnnnnnnnnnnnnnnTATTATnnnnnnA`).
// Matching with `indexOf` asks for those `N`s *literally*, which no real sequence contains, so
// every such feature silently never matched. Not an error, not a skip -- an annotation that comes
// back without them and looks complete. One library had 52 of 626 features in this state, every
// promoter family among them, and it took a person annotating the same sequence in ApE and
// getting more features back to notice.
const IUPAC_CLASS = {
  A: 'A', C: 'C', G: 'G', T: 'T', U: 'T',
  R: 'AG', Y: 'CT', S: 'CG', W: 'AT', K: 'GT', M: 'AC',
  B: 'CGT', D: 'AGT', H: 'ACT', V: 'ACG', N: 'ACGTN'
};

// The fewest concrete bases a degenerate pattern must have before it is allowed to match.
// Six is a type IIS recognition site, which is the shortest thing anyone writes degenerately and
// is real biology: BsaI genuinely does cut roughly every 4 kb. Below that a pattern carries less
// information than the sequence it would be drawn on, and annotating it is noise.
const MIN_INFORMATIVE = 6;

/**
 * Build a matcher for one pattern.
 *
 * A pattern with no degeneracy keeps the old `indexOf` path exactly, so every library that was
 * working before matches the same features at the same coordinates -- the new behaviour is
 * confined to patterns that previously could not match at all.
 *
 * DEGENERACY IS A PROPERTY OF THE PATTERN, NOT OF THE SEQUENCE. An `N` in the subject is an
 * unknown base call, and letting it satisfy a pattern's concrete `A` would make every ambiguous
 * tract match everything in the library. So a subject `N` is accepted only where the pattern also
 * says `N`; everywhere else it fails, and the feature is reported absent rather than guessed.
 */
function patternMatcher(pattern) {
  if (/^[ACGT]+$/.test(pattern)) {
    return function* (seq) {
      for (let pos = seq.indexOf(pattern); pos !== -1; pos = seq.indexOf(pattern, pos + 1)) yield pos;
    };
  }
  const informative = (pattern.match(/[ACGTU]/g) || []).length;
  if (informative < MIN_INFORMATIVE) return null;
  const body = [...pattern].map(c => {
    const cls = IUPAC_CLASS[c];
    if (!cls) return null;                       // '*' and anything else: not a DNA pattern
    return cls.length === 1 ? cls : `[${cls}]`;
  });
  if (body.some(p => p === null)) return null;
  // Overlapping matches: a lookahead so a hit does not consume the bases the next one needs.
  const re = new RegExp(`(?=(${body.join('')}))`, 'g');
  return function* (seq) {
    for (const m of seq.matchAll(re)) yield m.index;
  };
}

// Smart matching using full exact matching (no k-mer seeding)
function annotateSequence(sequence, featureDb = null) {
  //   console.log("🔍 Starting annotation...");
  sequence = cleanup(sequence);
  const detectedFeatures = [];

  const db = featureDb || featureDbGlobal;
  if (!db) throw new Error("No feature database loaded yet.");

  const seqVariants = [sequence, revcomp(sequence)];
  //   console.log("🧬 Scanning sequence and reverse complement with full exact matching...");

  // Patterns are compiled once, not once per strand: the cost of a degenerate pattern is in
  // building its regex, and there are two strands and one db.
  const matchers = db.map(feature => {
    const pattern = cleanup(feature.Sequence || '');
    if (pattern.length < 10) return null;        // Ignore very short patterns
    const next = patternMatcher(pattern);
    return next && { feature, length: pattern.length, next };
  });

  seqVariants.forEach((seq, strandIndex) => {
    matchers.forEach(m => {
      if (!m) return;
      for (const pos of m.next(seq)) {
        detectedFeatures.push({
          start: pos,
          end: pos + m.length,
          strand: strandIndex === 0 ? +1 : -1,
          label: m.feature.Name,
          type: m.feature.Type,
          color: m.feature.Color
        });
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
  if (typeof fetch === 'undefined') return; // Apps Script / non-browser environments
  fetch(defaultFeatureUrl)
    .then(response => {
      //   console.log("📥 Feature file fetched, parsing...");
      return response.text();
    })
    .then(text => {
      const lines = text.split("\n").filter(line => line.trim().length > 0);
      featureDbGlobal = lines.map(line => {
        // Tab-separated: 126 names contain a space ("Pbad promoter", "R6K Ori"), and splitting on
        // any whitespace turned their sequence column into a word, so 117 rows could never match.
        const [Name, Sequence, Type, Color, LabelColor, Forward, Reverse] = line.split('\t');
        return { Name, Sequence, Type, Color };
      });
      //   console.log(`✅ C6-Annotator: Loaded ${featureDbGlobal.length} features.`);
    })
    .catch(err => {
      console.error("❌ Failed to load default features:", err);
    });
})();

export {
  annotateSequence,
  inferTranscriptionalUnits,
  inferExpressedProteins,
  findNonExpressedCDS,
  featureDbGlobal
};