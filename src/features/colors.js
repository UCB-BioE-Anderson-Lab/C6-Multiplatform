/**
 * Colours for a feature library, chosen to mean something.
 *
 * JCA 2026-09-14: *"a GFP gene should be green. An amp is reddish (cause that is its antibiotic
 * color tone), a kan is green, a cam is blue, a tet is black. Get creative. Use pastellish nice
 * pleasant colors."*
 *
 * THREE RULES, most specific first, because a colour that means something beats one that merely
 * distinguishes:
 *
 *   1. A PROTEIN THAT HAS A COLOUR GETS ITS OWN. GFP is green because GFP is green. amilGFP is
 *      yellow-green because that is what it fluoresces — giving it the same green as mGFP5 would
 *      throw away the one thing the name tells you.
 *   2. A RESISTANCE MARKER TAKES ITS ANTIBIOTIC'S TONE. Ampicillin reddish, chloramphenicol blue,
 *      kanamycin green, tetracycline near-black, erythromycin amber. These are the plate and
 *      stock-bottle conventions a bench person already carries, so the map reads without a key.
 *   3. OTHERWISE, THE TYPE DECIDES. Promoters leaf-green, terminators coral, origins and the Rep
 *      proteins that run them a shared slate, recombination sites lilac.
 *
 * Everything is desaturated: a feature map is read for a long time, and saturated colour at the
 * density of an annotated plasmid is exhausting. These sit around 60-75% lightness.
 */

const NAMED = [
  // fluorescent and chromoproteins — the colour IS the information
  [/\bamilGFP\b/i,                      '#e3ea88', 'amilGFP fluoresces yellow-green'],
  // NO TRAILING \b: mGFP5 ends in a digit, which is a word character, so `\bmgfp\b` never
  // matched the very protein this rule exists for.
  [/\b(m|sf|e)?gfp\d*/i,                '#8ede8e', 'green fluorescent protein'],
  [/\b(mcherry|rfp|mrfp|dsred)\b/i,     '#f09a9a', 'red fluorescent protein'],
  [/\b(yfp|venus|citrine)\b/i,          '#f2e58a', 'yellow fluorescent protein'],
  [/\b(cfp|cerulean)\b/i,               '#9adfe8', 'cyan fluorescent protein'],
  [/\bmscarlet\b/i,                     '#ef8f9c', 'scarlet'],

  // resistance markers — the antibiotic's own tone
  [/\b(bla|ampR|amp)\b/i,               '#eaa1a1', 'ampicillin'],
  [/\b(cat|cmR|cam)\b/i,                '#9dc9ec', 'chloramphenicol'],
  [/\b(kanR|neoR|nptII|kan)\b/i,        '#a8dca8', 'kanamycin'],
  [/\b(tetK|tetA|tetM|tcR|tet)\b/i,     '#8a8a8a', 'tetracycline — near-black, desaturated to stay readable'],
  [/\b(erm|ermB|ermC|mls)\b/i,          '#f3cb8c', 'erythromycin'],
  [/\b(specR|aadA|strR)\b/i,            '#c9b6e0', 'spectinomycin'],
  [/\b(gent|aacC1)\b/i,                 '#dcc59a', 'gentamicin'],

  // toxins and counter-selection — a warning tone, distinct from any antibiotic
  [/\b(ccdB|sacB|rpsL)\b/i,             '#c9909a', 'counter-selection marker'],

  // secreted and structural surface proteins
  [/\b(slp|slpA|s.?layer)\b/i,          '#e0cfa9', 'S-layer surface protein'],
  [/\b(afp|antifungal)\b/i,             '#f5c09a', 'antifungal protein'],

  // secreted enzymes — one family tone, so a map shows at a glance how many there are
  [/\b(chi[A-Z0-9]*|chit\d*|chitinase)\b/i, '#9ed9d1', 'chitinase'],
  [/\b(prot(ease)?[A-Z]?|lip(ase)?[A-Z]?|amy[A-Z]?)\b/i, '#a9d8c4', 'secreted enzyme'],

  // replication machinery shares the origins' slate
  [/\b(rep[A-Z0-9]*|rop|rom|copR?)\b/i, '#a3b5cc', 'replication protein'],
];

const BY_TYPE = {
  promoter:       '#b7e4a8',
  terminator:     '#f2a9a0',
  rep_origin:     '#b9c9dd',
  protein_bind:   '#d6bce8',
  misc_recomb:    '#d6bce8',
  operator:       '#c8b0de',
  oriT:           '#b9c9dd',
  mobile_element: '#cbbcae',
  CDS:            '#cfd8dc',
  gene:           '#cfd8dc',
  primer_bind:    '#dfe6e9',
  primer:         '#dfe6e9',
  misc_feature:   '#e0e0e0',
};

export const FALLBACK_COLOR = '#e0e0e0';

/**
 * A colour, and the reason for it. The reason is returned so a library can be reviewed: a colour
 * nobody can account for is one nobody will trust.
 */
export function colorOf(feature) {
  const name = String(feature?.name ?? feature?.Name ?? '');
  const type = String(feature?.type ?? feature?.Type ?? '');

  // THE NAME RULES APPLY TO CODING FEATURES ONLY, and that boundary is the whole design.
  // `cat promoter` matched the chloramphenicol rule and `tet promoter` the tetracycline one, so
  // four promoters came out green and two did not. Linking a promoter to its operon's antibiotic
  // is a cute idea and it costs the thing that matters more: a promoter has to read AS a promoter
  // without looking at the label. Regulatory elements are coloured by what they ARE; the gene
  // downstream carries the marker's tone.
  const coding = type === 'CDS' || type === 'gene' || !BY_TYPE[type];
  if (coding) for (const [re, hex, why] of NAMED) if (re.test(name)) return { color: hex, why };
  if (BY_TYPE[type]) return { color: BY_TYPE[type], why: type };
  return { color: FALLBACK_COLOR, why: 'no rule matched' };
}

export const colorFor = (feature) => colorOf(feature).color;
