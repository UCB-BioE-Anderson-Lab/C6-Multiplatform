// verificationFile.js — the decisions the verification chain needs, in a file somebody can argue
// with.
//
// **THESE ARE NOT NEW DECISIONS. THEY WERE ALREADY MADE.** JCA, 2026-09-12: *"was there a
// sequencing plan in the original spreadsheet? I don't recall what it is, but we arent actually
// making a new cloning plan."* There was: two reads per clone, bf037 forward and bf038 reverse,
// minipreps into `cheese_temp` C1–F1, and *"Go with just 2 [colonies] unless there is significant
// phenotypic diversity."* All of it sat in a workbook that is being retired, and the compiler was
// defaulting past it and reporting the same choices as still open.
//
// **WHY A THIRD FILE AND NOT A FLAG.** A construction file describes the chemical structure of the
// DNA; a characterization file describes what the plasmid is for. Picking, minipreping and reading
// traces establish that it is built, which is neither — `injectVerification.js` says so at length
// and injects them precisely because no file holds them. This is that file, and the same rule
// applies as everywhere else today: a decision belongs somewhere a person can read and disagree
// with, not in a command line somebody has to remember to repeat.
//
// **EVERY FIELD IS OPTIONAL.** With no file the chain is injected with its defaults exactly as
// before, and every undecided field is reported as open. The file closes decisions; it does not
// create them.
//
//     # Verification of pBET8.txt
//     Pick        n=2 max=4 medium=2YT+Erm
//     Miniprep    box=cheese_temp
//     Sequence    oligos=bf037,bf038 reads=F,R
//
// One line per step, the step's name first, `key=value` for the rest — the characterization
// file's grammar without the subject and product columns, because this file describes how a step
// is done rather than what it consumes.

/** The steps a verification file may speak about. Anything else is a line in the wrong file. */
export const VERIFICATION_STEPS = ['pick', 'miniprep', 'sequence', 'analysis'];

const NAMED = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/;

// KEYS WHOSE VALUE IS ONE TOKEN. Letting a value be prose means a trailing bare word is absorbed
// into whatever came before it — `n=2 4` quietly becomes `n = "2 4"`, which parses as NaN and
// picks nothing. The permissive split is right for a criterion and wrong for a count, so the keys
// that cannot contain a space say so.
const SINGLE = new Set(['n', 'max', 'box', 'oligos', 'reads', 'volume']);

/**
 * Parse a verification file into `{ pick: {...}, miniprep: {...}, sequence: {...} }`.
 *
 * @param {string} text
 * @param {string} name  the filename, for problem messages
 * @returns {{steps:Object, problems:Array}}
 */
export function parseVerification(text, name = '') {
  const steps = {};
  const problems = [];
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.split('#')[0].trim();
    if (!line) return;
    // SPLIT AT THE NEXT KEY, NOT AT EVERY SPACE. A criterion is a sentence — *"go with 2 unless
    // there is significant phenotypic diversity"* — and splitting on whitespace turned it into
    // eight complaints about unnamed values. Breaking only where a `key=` begins lets a value be
    // prose, which is what half of these decisions are.
    const tokens = line.split(/\s+(?=[A-Za-z_][A-Za-z0-9_]*=)/)
      .flatMap((t, i) => (i === 0 ? t.split(/\t+|\s{2,}| /).filter(Boolean) : [t.trim()]))
      .filter(Boolean);
    const step = tokens[0].toLowerCase();
    if (!VERIFICATION_STEPS.includes(step)) {
      problems.push({ line: i + 1, code: 'UNKNOWN_STEP',
        message: `line ${i + 1}${name ? ` of ${name}` : ''} begins with "${tokens[0]}", which a `
          + `verification file does not know. Known: ${VERIFICATION_STEPS.join(', ')}.` });
      return;
    }
    const args = {};
    for (const t of tokens.slice(1)) {
      const m = NAMED.exec(t);
      // A BARE WORD IS A MISTAKE WORTH NAMING. This file is all key=value; a lone token means
      // somebody wrote a value and forgot what it was for, and silently dropping it would leave a
      // decision looking made when nothing read it.
      if (!m) {
        problems.push({ line: i + 1, code: 'UNNAMED_VALUE',
          message: `line ${i + 1}${name ? ` of ${name}` : ''} has "${t}" with no key — this file `
            + 'is key=value throughout.' });
        continue;
      }
      const key = m[1].toLowerCase();
      const value = m[2];
      if (SINGLE.has(key) && /\s/.test(value)) {
        problems.push({ line: i + 1, code: 'UNNAMED_VALUE',
          message: `line ${i + 1}${name ? ` of ${name}` : ''}: ${key}=${JSON.stringify(value)} `
            + `has a space in it. ${key} takes one value, so something after it lost its key.` });
        continue;
      }
      args[key] = value;
    }
    steps[step] = { ...(steps[step] || {}), ...args };
  });
  return { steps, problems };
}

/** Does this filename look like a verification file? */
export function isVerificationFile(basename) {
  return /verification.*\.txt$/i.test(String(basename));
}

/**
 * The config `injectVerificationJobs` takes, out of a parsed verification file. Absent fields stay
 * absent so the injector's own defaults apply and the decision is still reported as open.
 */
export function verificationConfig(steps = {}) {
  const out = {};
  const pick = steps.pick || {};
  const mini = steps.miniprep || {};
  const seq = steps.sequence || {};
  if (pick.n) out.picks = Number(pick.n);
  if (pick.medium) out.pickMedium = pick.medium;
  if (pick.criteria) out.pickCriteria = pick.criteria;
  if (pick.max) out.pickMax = Number(pick.max);
  if (mini.box) out.minprepBox = mini.box;
  if (seq.oligos) out.sequencingOligos = seq.oligos.split(',').map((s) => s.trim()).filter(Boolean);
  if (seq.reads) out.readSuffixes = seq.reads.split(',').map((s) => s.trim()).filter(Boolean);
  return out;
}
