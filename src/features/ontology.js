/**
 * What counts as a FEATURE, and at which stage of the central dogma it acts.
 *
 * JCA 2026-09-14, drawing the line this whole exercise had been missing:
 *
 *   *"I define features as 'biochemical features', like things on a DNA that directly map onto
 *   players *in the cell*. So, like, unless an oligo is binding inside of the cell, it is part of
 *   the cloning ontology not the biochemical ontology because it is happening in vitro not in
 *   TxTl."*
 *
 * ANNOTATION AND FEATURE ARE NOT THE SAME THING. A primer binding site, a restriction site and a
 * cloning intermediate are all worth marking on a map and none of them is a feature: they are the
 * cloning ontology, in vitro. A feature is something the cell itself acts on.
 *
 * STAGE is where it is functional, not what it is made of. A promoter acts AS DNA — it is the DNA
 * the polymerase binds. A CDS acts as protein. A gRNA acts as RNA.
 *
 * WHY THERE IS NO RNA STAGE HERE, and it is a practical decision rather than an omission. The
 * honest RNA unit is the mRNA, +1 to transcript end. JCA: *"The problem with that approach is that
 * the +1 site is rarely precise, and I have designed my parts such that the promoter 'parts'
 * overlap +1 quite a bit such that the 5' utr is within the promoter part. And terminators are
 * never super clear as to where they actually end. So, it is more practical to define promoter and
 * terminator parts than to define an mRNA region."*
 *
 * AND THE RBS IS AN ANNOTATION, NOT A FEATURE: *"the rbs can't really be autoannotated — the
 * meaning of the sequence is dependent on adjacency to the start codon. It should be annotated,
 * but I don't think we count it as a feature."* That is a stronger reason than the one the
 * indexer had found for itself, which was merely that six bases match everywhere. A sequence whose
 * meaning comes from what it sits next to cannot be recognised by looking at the sequence.
 *
 * SUB-FEATURES BELONG TO THEIR PARENT. A -10 box belongs to a promoter and a His-tag belongs to a
 * CDS; neither stands alone. They are annotations WITHIN a feature's own record, not entries
 * beside it.
 */

/** Acts as DNA: the molecule the machinery binds is the double helix itself. */
export const DNA_STAGE = new Set([
  'promoter', 'terminator', 'rep_origin', 'protein_bind', 'misc_recomb',
  'operator', 'enhancer', 'silencer', 'insulator', 'oriT', 'mobile_element',
]);

/** Acts as protein: the sequence is read through to a polypeptide. */
export const PROTEIN_STAGE = new Set(['CDS', 'gene']);

/** Acts as RNA. Empty of GenBank types today — see the note above on why. */
export const RNA_STAGE = new Set(['ncRNA', 'sgRNA', 'riboswitch', 'tRNA', 'rRNA']);

/** In vitro. Worth annotating on a map; never a feature. */
export const CLONING = new Set(['primer', 'primer_bind', 'misc_binding']);

/**
 * Names that are annotations rather than features whatever their GenBank type.
 * RBS is here on JCA's reasoning, not on length.
 */
export const NOT_A_FEATURE = [
  /^rbs\b/i, /ribosome.?binding/i,
  /^translation \d+-\d+$/i,          // pLannotate's ORF calls, not named features
  /\bcassette\b/i, /\bfusion protein\b/i,   // composites; they decompose into features
  /^piece\d/i,                        // cloning intermediates

  // A FRAGMENT IS NOT A FEATURE. JCA 2026-09-14: *"remnants and fragments of features are no
  // longer functional features."* A feature is something the cell acts on; half a resistance gene
  // is not half-functional, it is non-functional. Cheese carried eight — `TcR remnant 1` and
  // `2` (two pieces of one disrupted gene at opposite ends of pTRKH3-slpGFP), plus `(fragment)`
  // marks on slpA, tnpA, CmR, copR, RSF ori and IS1.
  //
  // This is a claim about BIOLOGY and not about completeness: it is exactly why a fragment must
  // not sit in a library used to infer what a sequence does. Annotating one says a function is
  // present when it is not.
  /\(fragment\)/i, /\bremnant\b/i, /\btruncat/i,
];

/** 'dna' · 'protein' · 'rna' · 'cloning' · 'annotation' · null when nothing decides it. */
export function stageOf(feature) {
  const name = String(feature.name || '');
  const type = String(feature.type || '');
  if (NOT_A_FEATURE.some(re => re.test(name))) return 'annotation';
  if (CLONING.has(type)) return 'cloning';
  if (DNA_STAGE.has(type)) return 'dna';
  if (PROTEIN_STAGE.has(type)) return 'protein';
  if (RNA_STAGE.has(type)) return 'rna';
  return null;
}

/** Is this one of the biochemical features — the things the cell acts on? */
export const isBiochemical = (feature) => ['dna', 'protein', 'rna'].includes(stageOf(feature));
