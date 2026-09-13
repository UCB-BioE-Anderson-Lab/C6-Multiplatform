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
export const DNA_NAME_MAX = 6;

/** A PCR strip cap. Under four characters, per JCA: *"pcr tubes need <4 character labels"*. */
export const PCR_LABEL_MAX = 3;

/** Is this a construct name somebody can write on a cap? */
export function fitsOnACap(name) {
  const t = String(name || '').trim();
  return t.length > 0 && t.length <= DNA_NAME_MAX;
}

/**
 * The Nth clone designation.
 *
 * JCA: *"clone designations are always [A-Z], or [0-9] or for a plate [0-9][A-Z][0-9] for the Nth
 * plate row X, column M."*
 *
 * Letters, because that is what a picked colony gets. Past Z it would have to become a plate
 * coordinate, which needs the plate it came from — so this refuses rather than inventing `AA`,
 * which is not in the grammar.
 */
export function cloneDesignation(i) {
  if (i < 26) return String.fromCharCode(65 + i);
  throw new Error(`cloneDesignation(${i}): past Z a clone is a plate coordinate `
                + '([0-9][A-Z][0-9]), which needs the plate it came from. Not implemented.');
}

/** Does this string designate a clone? */
export const CLONE = /^([A-Z]|[0-9]|[0-9][A-Z][0-9])$/;
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
export function derivedLabel(operation, sourceLabel) {
  const p = DERIVED_PREFIX[operation];
  if (!p) throw new Error(`derivedLabel: ${operation} makes something new; give it its own label`);
  return `${p}${sourceLabel}`;
}

/**
 * How long a label may be, by what it is written on. → `models/labsheet.js` holds the same table
 * as `TUBE`, because the model is what enforces it; this is the decision, that is the guard.
 */
export function labelLimitFor(tubeKind) {
  return ({ pcr: PCR_LABEL_MAX, micro: DNA_NAME_MAX + 2, plate: 12, block: 12, none: 0 })[tubeKind]
      ?? PCR_LABEL_MAX;
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
