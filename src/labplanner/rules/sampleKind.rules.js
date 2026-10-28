// What kind of molecule is in a tube, worked out from what the tube is.
//
// **THIS REPLACES A STORED `type` COLUMN, AND THAT IS THE POINT.** The inventory used to carry a
// `type` field holding `oligo`, `plasmid`, `miniprep`, `genomic`, `glycerol` or `zymo`, and
// `query.js` filtered on it. Three things were wrong with that at once:
//
//   1. C6 already decides this structurally. `plasmid()`, `dsDNA()` and `oligo()` in `C6-Seq.js`
//      are not labels, they are constructors that set `isDoubleStranded` and `isCircular`. A
//      string in a TSV was a second description of a fact the toolkit already derives.
//   2. The sample kind already implies it. JCA, 2026-10-28: *"If you state it is a miniprep, it
//      isn't necessary to say it is a plasmid as that is all it could be. When you say it is a
//      glycerol stock, there is no need to say it is a cell line, as what else could it be."*
//   3. Nothing filled it in consistently, so the filter it fed was worse than none. Across
//      Pimar's freezer NOT ONE TUBE said `plasmid`, so `chooseTemplateForPCR`'s
//      `!s.type || isPlasmid(s)` kept only tubes whose type was BLANK — pLYC78 had four tubes in
//      the freezer and no template. Filling the field in correctly is what made a tube invisible.
//
// So the class is read off the sample kind instead — the column still called `concentration`,
// which does not hold a concentration. It holds what you ask for at the bench. JCA, 2026-10-28:
// *"We don't say '25 uM' because that isn't usually helpful information to be that precise, it
// usually comes out about the same, and students would never accurately measure it anyway. And it
// is unknowable prior to doing the experiment."* The name is wrong and is being left alone,
// because the enum is used across other repositories, lectures and docs.
//
// **UNKNOWN IS A VERDICT, NOT A FAILURE.** The last rule returns `null`, and callers must read
// that as "do not exclude this tube" rather than "exclude it". That asymmetry is the whole bug
// fix: a filter may drop a tube it has positively classified as something else, never one it
// merely could not place.
//
// Rules are tried in order and the first that applies wins. `c6-rules sampleKind` prints this file.
import { apply, named } from './lib.js';

export const TITLE = 'What kind of molecule a tube holds';

/**
 * `form` as `sample.schema` enumerates it, keyed by the finer class the rules decide.
 *
 * **TWO GRANULARITIES, ONE DERIVATION.** The rules below decide a `class` precise enough to pick
 * a PCR input -- an oligo must never be offered as a template -- while `sample.schema` (JCA,
 * 2026-10-22) enumerates a coarser `form` for the record: glycerol, plasmid-dna, dna-fragment,
 * culture, other. Both come off the same sample kind, so neither is stored and neither can drift
 * from the other.
 *
 * **THE ENUM DOES NOT NAME AN OLIGO OR A GENOMIC PREP.** An oligo is linear single-stranded DNA,
 * so `dna-fragment` is the closest true thing the enum can say, and oligos have a schema of their
 * own in any case. Genomic DNA is neither a plasmid nor a fragment, so it takes `other`, which is
 * what `other` is for. Both are judgements about an enum somebody else wrote, flagged here rather
 * than made quietly -- `class` keeps the distinction either way.
 */
const FORM = {
  cells: 'glycerol',
  plasmid: 'plasmid-dna',
  dsDNA: 'dna-fragment',
  oligo: 'dna-fragment',
  genomic: 'other',
};


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════

// name:  kind
// when:  always — it is the sample kind as written, folded to lower case and stripped to letters,
//        digits and the decimal point
// then:  a comparable token, or '' when nothing was recorded
// why:   The same kind is written several ways in one freezer: `miniprep` and `mini prep`,
//        `dil20x` and `20x-dilute` and `20x dil.`. Comparing the raw strings would make the class
//        depend on somebody's spacing, so the rules below compare this instead.
//
//        **THE µ IS THE REASON THIS STRIPS RATHER THAN DESPACES.** A micro sign does not survive
//        every round trip through Excel and CSV, and this freezer holds the wreckage: 25 tubes
//        say `100<U+FFFD>M` and 36 say `100_m` or `10_m`, all of them `100µM` and `10µM` that lost the
//        character. Dropping everything that is not a letter, a digit or a point lands all three
//        spellings on the same token, so one pattern matches them.
// source: inferred
export const kind = {
  of: ({ concentration }) => String(concentration ?? '').trim().toLowerCase().replace(/[^a-z0-9.]+/g, ''),
};

// name:  micromolar
// when:  the sample kind parses as a micromolar concentration
// then:  true, or false for anything that does not
// why:   A tube labelled with a µM figure is an oligo stock — nothing else in this freezer is
//        quantified that way, because nothing else is bought at a known concentration. This is
//        what distinguishes `10 uM` from `dil20x`, both of which are dilutions.
//
//        The `u` is optional because of the mangled spellings described under `kind`: once the
//        micro sign is gone, `100µM` and `100_m` are both just a number followed by an `m`, and
//        nothing else in the vocabulary takes that shape.
// source: inferred
export const micromolar = {
  of: ({ kind }) => /^[0-9]*\.?[0-9]+u?m$/.test(kind || '') || /^um[0-9]/.test(kind || ''),
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════

// name:  a glycerol stock is cells
// when:  the sample kind names a glycerol stock
// then:  cells — not DNA at all, and never a PCR input
// why:   JCA, 2026-10-28: *"When you say it is a glycerol stock, there is no need to say it is a
//        cell line, as what else could it be."* It matters that this is stated rather than left
//        unknown: a glycerol stock of pLYC78 carries the plasmid name, so a template search finds
//        it by construct, and handing somebody frozen cells as PCR template is a real error.
// source: stated 2026-10-28
// eg:    -80 glycerol
export const glycerolStock = {
  applies: ({ kind }) => kind.includes('glycerol'),
  decide: () => ({ class: 'cells' }),
  says: () => null,
};

// name:  a genomic prep
// when:  the sample kind says genomic
// then:  genomic DNA
// why:   Genomic DNA is a usable PCR template but is not a plasmid, and the distinction is real at
//        the bench: it is linear, vastly more complex, and primers that would be specific against
//        a plasmid may not be against a genome.
// source: inferred
// eg:    genomic
export const genomicPrep = {
  applies: ({ kind }) => kind.includes('genomic'),
  decide: () => ({ class: 'genomic' }),
  says: () => null,
};

// name:  an oligo stock
// when:  the sample kind is a micromolar figure
// then:  an oligo
// why:   This is the one classification that has to be right, because it is the one that can
//        collide: an oligo and a plasmid can carry the same construct name, and handing a PCR the
//        wrong one of those is the error the old `type` column existed to prevent.
// source: inferred
// eg:    10 uM; 100uM; 2.66 uM
export const oligoStock = {
  applies: ({ micromolar }) => micromolar,
  decide: () => ({ class: 'oligo' }),
  says: () => null,
};

// name:  synthesised linear DNA
// when:  the sample kind names a synthesis vendor or product
// then:  linear double-stranded DNA
// why:   A gBlock or a Twist fragment is double-stranded and linear, so `C6-Seq` would build it
//        with `dsDNA()` rather than `plasmid()`. It is a fine PCR template and must not be taken
//        for an oligo on the strength of being neither a miniprep nor a glycerol stock.
// source: inferred
// eg:    gblock; Twist
export const synthesised = {
  applies: ({ kind }) => ['gblock', 'twist', 'gene'].includes(kind),
  decide: () => ({ class: 'dsDNA' }),
  says: () => null,
};

// name:  a plasmid prep
// when:  the sample kind names a prep or a dilution of one
// then:  a plasmid
// why:   JCA, 2026-10-28: *"A miniprep is implicitly a plasmid... If you state it is a miniprep,
//        it isn't necessary to say it is a plasmid as that is all it could be."* A dilution of a
//        miniprep is still a miniprep, which is why the dilution spellings land here rather than
//        falling through to unstated.
//
//        **THE PATTERNS ARE ANCHORED, AND A LOOSE `dil` WAS WRONG.** One tube reads `diluted 10x,
//        contains pimer1` — a dilution of a PRIMER. Matching `dil` anywhere called it a plasmid,
//        which is a positive misclassification and would have excluded it from oligo selection:
//        precisely the harm this rule set exists to stop. Free text that merely contains a known
//        word is not a known kind, and belongs in `unstated`.
// source: stated 2026-10-28
// eg:    miniprep; mini prep; microprep; dil20x; 20x-dilute; diluted 25x
export const plasmidPrep = {
  applies: ({ kind }) => /^(mini|micro)prep$/.test(kind)
                      || /^dil[0-9]+x$/.test(kind)
                      || /^[0-9]+xdil/.test(kind)
                      || /^diluted[0-9]+x$/.test(kind),
  decide: () => ({ class: 'plasmid' }),
  says: () => null,
};

// name:  nothing that places it
// when:  the sample kind is blank, or is a word that does not imply a molecule
// then:  unknown — and a caller must not exclude the tube for it
// why:   **A FILTER MAY DROP WHAT IT HAS CLASSIFIED, NEVER WHAT IT COULD NOT PLACE.** That is the
//        defect this rule set was written to end: the old `type` filter excluded on absence of a
//        match, so a correctly annotated miniprep was invisible and a blank one was usable. Real
//        kinds land here and must stay usable — `zymo` is a column cleanup that says nothing
//        about what was cleaned up, and `1:1` is a dilution of something unnamed.
// source: inferred
// eg:    zymo; 1:1; (blank)
export const unstated = {
  applies: () => true,
  decide: () => ({ class: null }),
  says: () => null,
};


export const FACTS = named({ kind, micromolar });

export const RULES = named({ glycerolStock, genomicPrep, oligoStock, synthesised, plasmidPrep,
                             unstated });

/**
 * The first rule that applies, and what it decided. → `lib.js § apply`
 *
 * Carries both the fine `class` the planner selects on and the `form` that `sample.schema`
 * enumerates. A tube the rules cannot place has neither, and a caller must not exclude it for it.
 */
export const choose = (facts) => {
  const got = apply({ FACTS, RULES, TITLE }, facts);
  return got && got.class ? { ...got, form: FORM[got.class] ?? 'other' } : got;
};

/** What a `// eg:` means here: whatever the sample-kind field holds. */
export const egFacts = (eg) => ({ concentration: String(eg).trim() === '(blank)' ? '' : String(eg).trim() });
