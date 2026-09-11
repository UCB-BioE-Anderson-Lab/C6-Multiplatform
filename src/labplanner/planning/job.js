// job.js — one operation lifted out of a construction file, with where it came from.
//
// A JOB IS A STEP THAT REMEMBERS ITS ORIGIN. The whole point of the planner is that steps from
// several construction files get shuffled together into shared labsheets — six library
// constructs' PCRs become one PCR labsheet — and the moment that happens, "which experiment is
// this row for" stops being answerable from position. So `cf` and `line` ride along on every
// job and every row that is eventually drawn from it.
//
// `dnaInputs` is separated from the other arguments deliberately. `Transform g17 JTK145 AB Spec
// pGhost17` names a fragment, a strain and an antibiotic, and only the first is a thing another
// step can produce. Dependency analysis that treats the strain as a DNA input finds no producer
// for it and is merely wrong about one edge; dependency analysis that treats the *antibiotic* as
// an input starts linking unrelated experiments that happen to both use Spec.

// Fields, per operation, that name DNA a PREVIOUS STEP COULD HAVE MADE. These and only these
// become dependency edges. Field names are parseCF's.
export const DNA_INPUTS = {
  pcr: ['template'],
  digest: ['dna'],
  ligate: ['dnas'],
  gibson: ['dnas'],
  goldengate: ['dnas'],
  transform: ['dna'],
};

// OLIGOS ARE INPUTS BUT NEVER PRODUCTS, so they are held apart from the dependency edges.
// Nothing in a construction file makes an oligo — it is ordered — so an oligo in `dnaInputs`
// would be a name with no producer forever, and the one real consequence of that is losing the
// ability to say so. Kept separately because the dilution stage's first act is exactly *"pull
// out all the oligos from pcr and sequencing steps"* (JCA, 2026-09-10), and a planner that has
// to re-derive which inputs were oligos has already thrown the answer away.
export const OLIGO_INPUTS = {
  pcr: ['forward_oligo', 'reverse_oligo'],
  sequence: ['oligo'],
  sequencing: ['oligo'],
};

/** Arguments that are conditions rather than materials — never dependency edges. */
export const NON_DNA = {
  digest: ['enzymes', 'fragselect'],
  goldengate: ['enzyme'],
  transform: ['strain', 'antibiotics', 'antibiotic', 'temperature'],
};

export function createJob({ operation, output, dnaInputs, oligos, args, cf, line, raw }) {
  return {
    id: `${cf || 'cf'}:${line || 0}:${output}`,
    operation: String(operation || '').toLowerCase(),
    output: output || '',
    dnaInputs: (dnaInputs || []).filter(Boolean),
    oligos: (oligos || []).filter(Boolean),
    args: args || {},
    cf: cf || '',
    line: line || 0,
    raw: raw || '',
  };
}

/** Every job that must happen before this one, by name of the thing it consumes. */
export function producersOf(job, byOutput) {
  return job.dnaInputs.map((n) => byOutput.get(n)).filter(Boolean);
}
