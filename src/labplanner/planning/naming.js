// naming.js — every naming decision, each callable and testable on its own.
//
// **THIS FILE EXISTS BECAUSE OF WHERE THE ERRORS WERE.** On 2026-09-12 JCA corrected the labels
// seven times in one afternoon, and every correction landed in an expression inside a `design/*.js`
// closure — reachable only by calling the whole design, testable only through a rendered sheet.
// He named the cause: *"you have all these testable (and frankly, reviewable by me) algorithms
// that make micro decisions."* A rule you cannot call is a rule you find out about on paper.
//
// The rules themselves are `docs/LABSHEET-SPEC.md`, settled at GATE 0. This is their only
// implementation; `design/` and `injectVerification.js` call in here rather than deciding.
//
// ## The three things that get named, which are not the same thing
//
// JCA, 2026-09-12: *"What is important is what you are naming — are you naming a prefix for the
// experiment, for a sample, or something else."*
//
//   a DNA name        `pBET8`      about 6 characters, because it goes on a cap
//   a tube label      `L3a`        under 4 on a PCR strip; the cap is 200 µL and gloves are on
//   a clone           `A`          [A-Z], [0-9], or [0-9][A-Z][0-9] for a plate
//
// A composed label — `pBET8-A` — is a DNA name plus a clone, and lives on a 1.5 mL tube.

/** A DNA name has to fit on a cap. → `docs/LABSHEET-SPEC.md` § 3 */
export { DNA_NAME_MAX, DNA_NAME_LIMIT } from '../rules/label.rules.js';
import { DNA_NAME_MAX, TUBE } from '../rules/label.rules.js';

/**
 * Where a name stops being worth writing by hand, as against where it stops being neat.
 *
 * **TWO NUMBERS, BECAUSE JCA GAVE TWO.** `DNA_NAME_MAX` is the aim — *"6 cap on a name (a rule on
 * CF drafting more)"* — and this is the limit: *"8 characters would still be writable, that's
 * probably about the limit."* (2026-09-12, 2026-09-13.)
 *
 * Collapsing them flags `pGhost17`, which is eight characters and is a plasmid this lab has been
 * using for years. A warning that fires on names already in use is a warning people learn to skip,
 * and the one it would then hide is the one about `pLongConstructName`.
 */

/** A PCR strip cap. Under four characters, per JCA: *"pcr tubes need <4 character labels"*. */
/** What a 200 µL strip-tube cap takes. → `rules/label.rules.js § TUBE` */
export const PCR_LABEL_MAX = TUBE.pcr.cap;

/** Is this a construct name somebody can write on a cap? */
export function fitsOnACap(name) {
  const t = String(name || '').trim();
  return t.length > 0 && t.length <= DNA_NAME_MAX;
}

/**
 * The Nth clone designation.
 *
 * JCA: *"clone designations are always [A-Z], or [0-9] or for a plate [0-9][A-Z][0-9] for the Nth
 * plate row X, column M."* And, on which to use:
 *
 * > *"When picking single clones of something, like you are making pBET8, not some library, you
 * > use the [A-Z] clone notation. It is when doing libraries that you refer to clones by plate
 * > address, because there are typically many clones screened, so it's unhelpful to name them
 * > sequentially."*
 *
 * **THE NOTATION IS ABOUT THE KIND OF EXPERIMENT, NOT ABOUT THE PLASTICWARE.** Four clones of one
 * construct are A through D whether they sit in tubes or in a block; a library screened in that
 * same block is addressed by well, because the hundredth clone is not usefully called `CV`. What
 * they go in is a separate decision about count — `planning/vessels.js`.
 *
 * Letters run out at Z, and `AA` is not in the grammar. A run that long is a library by any
 * reasonable reading, so this says so rather than inventing a notation.
 *
 * @param {number} i
 * @param {Object=} opts  `{ library: true, plate: 1, rows: 4, cols: 6 }` for plate addresses
 */
export function cloneDesignation(i, opts = {}) {
  if (opts.library) return plateAddress(i, opts);
  if (i < 26) return String.fromCharCode(65 + i);
  throw new Error(`cloneDesignation(${i}): letters run out at Z, and AA is not in the grammar. `
                + `${i + 1} clones is a library — pass { library: true } for plate addresses.`);
}

/**
 * A clone's plate address: `[0-9][A-Z][0-9]` — the Nth plate, row X, column M.
 *
 * Filled down the columns, the same order `vessels.layoutFor` uses, so the address a clone is
 * called by and the well it sits in are the same fact.
 */
export function plateAddress(i, { plate = 1, rows = 4, cols = 6 } = {}) {
  const perPlate = rows * cols;
  const p = plate + Math.floor(i / perPlate);
  const k = i % perPlate;
  if (p > 9) throw new Error(`plateAddress(${i}): past plate 9 the notation has no room.`);
  return `${p}${String.fromCharCode(65 + (k % rows))}${Math.floor(k / rows) + 1}`;
}

export const CLONE = /^([A-Z]|[0-9]|[0-9][A-Z][0-9])$/;

/**
 * Is this string a clone designation — a letter, a digit, or a plate address?
 *
 * The grammar is closed on purpose: `A1` and `AA` are not designations, and something that looks
 * almost like one is usually a label that wandered into the wrong column.
 *
 * @param {string} s
 * @returns {boolean}
 */
export function isCloneDesignation(s) { return CLONE.test(String(s || '')); }

/**
 * What one clone of a construct is called.
 *
 * JCA: *"the convention for a single clone miniprep is to put the construction + '-' + clone
 * identifier"*. Both surfaces of the tube carry it — see `sideLabel`.
 *
 * **THE BASE IS GIVEN, NEVER DERIVED.** `docs/LABSHEET-SPEC.md` § 6: there is no rule about DNA
 * naming, so a compiler reading a transform's input gets `pBET8` for Lactis3 and `gg` for a
 * conventionally-written file, and both are wrong the other way round. The characterization file
 * says which with `clone=`.
 */
export function cloneName(construct, i) {
  if (!construct) throw new Error('cloneName: no construct to name a clone of');
  return `${construct}-${typeof i === 'number' ? cloneDesignation(i) : i}`;
}

/**
 * The DNA half of a strain name: `Mach1/pBET8` is `pBET8`, and a name with no host is itself.
 *
 * **A CONVENTION THE FILES ALREADY WRITE, NOT A GUESS.** `planning/expandClones.js` records it
 * from JCA, 2026-09-12: *"the full name of that strain is going to be jtk165/pBET8, and different
 * colonies of that pick up -A, -B, etc. When you then miniprep that DNA, you end up with samples
 * who lose the jtk165 designation, and are now just pBET8-A etc."* So the slash is the join
 * between a host and what it carries, and dropping the host is what the bench already does when
 * the DNA comes out of the cells.
 *
 * It is here rather than inline because it is the one piece of string surgery in the naming rules
 * that is SANCTIONED — every other derivation in this file refuses, on the grounds that there is
 * no rule about how DNAs are named. This is a rule about how STRAINS are named, which is a
 * different thing and is written down.
 *
 * @param {string} name
 * @returns {string}
 */
export function dnaOfStrain(name) {
  const s = String(name || '').trim();
  const at = s.lastIndexOf('/');
  return at >= 0 ? s.slice(at + 1) : s;
}

/**
 * What a sequencing reaction is called.
 *
 * JCA: *"sequencing labels should be 'pBET8-B', or maybe 'pBET8-Bf' and 'pBET8-Br' if there are
 * two reads. When sequencing comes back, we need to be able to precisely map it to the data. Just
 * 'B' will not be enough to distinguish samples."*
 *
 * The reaction leaves the building and returns as a file named for what was on the tube, so the
 * name is the clone's own — the collision with the miniprep is deliberate and harmless. With two
 * reads the suffixes are `F` and `R`, which is what this lab's own sheets used.
 */
export const READ_SUFFIXES = ['F', 'R'];

/**
 * What the i-th of n sequencing reactions on one clone is called.
 *
 * One read takes the clone's own name — the reaction leaves the building and comes back as a file
 * named for what was on the tube, so the collision with the miniprep is deliberate. Two reads take
 * F and R. More are numbered, because a third letter would be somebody's guess.
 *
 * @param {string} cloneLabel  e.g. `pBET8-A`
 * @param {number} i           0-based
 * @param {number} n           how many reads of this clone
 * @returns {string}
 */
export function readName(cloneLabel, i, n) {
  if (n <= 1) return cloneLabel;
  const suffix = n === 2 ? READ_SUFFIXES[i] : String(i + 1);
  if (!suffix) throw new Error(`readName: no suffix for read ${i + 1} of ${n}`);
  return `${cloneLabel}${suffix}`;
}

/**
 * Two characters standing for an experiment: its initial and its number. `Lactis3` → `L3`.
 *
 * TWO EXPERIMENTS CAN COLLIDE HERE — `Lactis3` and `Lymph3` both give `L3` — and nothing inside one
 * project's files could detect that. The prefix is therefore an override and this is the default.
 */
export function experimentPrefix(experiment) {
  const name = String(experiment || '').trim();
  const m = name.match(/^([A-Za-z])[A-Za-z_-]*?(\d+)$/);
  if (m) return `${m[1].toUpperCase()}${m[2].slice(-1)}`;
  return (name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2) || 'X')
    .replace(/^./, (c) => c.toUpperCase());
}

/** a, b, … z, aa, ab — a running letter, so every coded tube in a packet has its own. */
export function letterAt(i) {
  let out = '';
  let n = i;
  do { out = String.fromCharCode(97 + (n % 26)) + out; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return out;
}

/**
 * What a step that makes a new tube of the SAME DNA calls it.
 *
 * JCA: *"For a zymo, I typically add a z to whatever the PCR label was. A digest would probably
 * have a d in front of the original PCR label."* A prefix, not a suffix — which is the opposite of
 * the 2024 teaching spec's `A1` → `A1p`, and this lab's live convention wins.
 *
 * NOT FOR EVERY STEP. An assembly, a transformation and a pick make something that was not there
 * before and take their own label. Derivation is for the steps whose answer to "which tube is
 * this" is "the one from the step before, cleaned up".
 */
export const DERIVED_PREFIX = { zymo: 'z', digest: 'd' };

/**
 * What a step that makes a new tube of the SAME DNA calls it: the source label, prefixed.
 *
 * Refuses for an operation that makes something new — an assembly is not its fragments cleaned up,
 * and giving it a derived label would say it was.
 *
 * @param {string} operation   `zymo` or `digest`
 * @param {string} sourceLabel the label of the tube going in
 * @returns {string}
 * @throws {Error} for an operation that makes a new molecule
 */
export function derivedLabel(operation, sourceLabel) {
  const p = DERIVED_PREFIX[operation];
  if (!p) throw new Error(`derivedLabel: ${operation} makes something new; give it its own label`);
  return `${p}${sourceLabel}`;
}

/**
 * How long a label may be, by what it is written on. → `rules/label.rules.js § TUBE`
 *
 * **THIS HELD A SECOND TABLE AND THE TWO DISAGREED.** Its own comment claimed to hold *"the same
 * table as `TUBE`"*, and it did not: it said a 1.5 mL takes 8 characters where the model says 12,
 * and it had no entry for a sequencing tube at all — so `labelLimitFor('sequencing')` fell through
 * to the default and returned **3**, against the model's 13.
 *
 * Latent rather than live, because nothing ever passed anything but `'pcr'`. But a test pinned the
 * wrong number for `micro`, which is how a second table stays wrong: it is asserted.
 */
export function labelLimitFor(tubeKind) {
  return (TUBE[tubeKind] ?? TUBE.pcr).cap;
}

/**
 * How a step refers to something it consumes.
 *
 * JCA, 2026-09-12: *"there are sample labels, and there are dna names... In a labsheet, you should
 * not mix these concepts. Here you are referring to what is encoded in the dna, not what the sample
 * is. At the bench, you primarily want to know the label, not what's in it."*
 *
 * So: the tube that holds it, if this packet made it; otherwise the name written on it in the
 * freezer, because that is what somebody reads off a box.
 */
export function referToInput(name, labelOf) {
  return (typeof labelOf === 'function' ? labelOf(name) : null) || name;
}
