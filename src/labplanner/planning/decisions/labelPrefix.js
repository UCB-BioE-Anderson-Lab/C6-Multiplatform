/**
 * labelPrefix — two or three characters standing for an experiment, on every coded tube it makes.
 *
 * **THE WORKED EXAMPLE FOR GATE 4, AND IT IS JCA'S OWN.** He named it when asked what an agentic
 * decision looks like: *"making up an acronym for the PCR labels that an LLM call needs to make.
 * That LLM could be a full cortex context, such that the full situation can be considered in
 * choosing those label names."*
 *
 * ## Why this one cannot be decided by rule
 *
 * The rule exists and is in `naming.js`: initial plus trailing digit, `Lactis3` → `L3`. It is a
 * good rule and it cannot answer the question, for a reason stated in that function's own comment:
 *
 * > TWO EXPERIMENTS CAN COLLIDE HERE — `Lactis3` and `Lymph3` both give `L3` — and nothing inside
 * > one project's files could detect that.
 *
 * A label is an exact key, and JCA's constraint is a hundred people sharing freezers:
 * *"The labels need to be distinctive and unique."* Uniqueness is a property of the LAB, and a
 * compiler reading one project's directory is looking at the wrong scope to establish it. That is
 * not a gap to be closed with more parsing — it is the definition of a decision that needs the
 * whole situation, which is what Cortex has and C6 does not.
 *
 * ## Why it still has a fallback, when most decisions must not
 *
 * `heat_shock_transformation` saying "plate on Amp" over an erythromycin sheet is the failure this
 * repository keeps finding: a default that reads exactly like an answer. A fallback is allowed here
 * because the rule behind it can be stated on the page and is — the sheet says the prefix was taken
 * from the folder name and not checked against anything else. A student reading that knows what
 * they have; a student reading "plate on Amp" does not.
 */
import { experimentPrefix, labelLimitFor } from '../naming.js';

/**
 * How long the prefix may be: the tightest cap this experiment writes on, less one for the running
 * letter. An experiment with PCRs gets two characters; one with none gets three.
 */
function maxPrefix(ctx) {
  return (ctx.hasStripTubes === false ? 4 : labelLimitFor('pcr')) - 1;
}

/** Two or three characters, a capital then letters or digits. `L3`, `Tl3`, `BE1`. */
export const PREFIX = /^[A-Z][A-Za-z0-9]{1,2}$/;

export default {
  id: 'labelPrefix',

  question: 'which short prefix should stand for this experiment on every tube it makes, given '
          + 'what else is live in the lab',

  // THE SCHEMA IS A FUNCTION OF THE SITUATION, because the constraint is. It advertised two-or-
  // three characters while `check` rejected three for any experiment with PCRs in it — a
  // specification that contradicts its own validator, handed to a model, and then the model gets
  // blamed for the answer.
  schema: (ctx) => ({
    type: 'string',
    pattern: `^[A-Z][A-Za-z0-9]{1,${maxPrefix(ctx) - 1}}$`,
    maxLength: maxPrefix(ctx),
    description: 'The prefix. A running letter is appended per tube, so `L3` gives L3a, L3b, L3c.',
  }),

  /**
   * WHAT THE MODEL IS TOLD, AND WHAT IT IS NOT. It gets the experiment's name, its constructs and
   * how many tubes will carry the prefix — enough to choose something mnemonic. It is not given a
   * suggested answer, because a suggestion in a prompt is an answer with extra steps.
   */
  prompt: (ctx) => {
    const { experiment, constructs = [], tubes = 0, taken = [] } = ctx;
    // THE LENGTH IS NOT NEGOTIABLE AND IS NOT THE SAME EVERY TIME. A PCR cap takes three
    // characters INCLUDING the running letter, so an experiment that runs PCRs gets two and one
    // that does not can have three. Asking for "two or three" and then rejecting three is the sort
    // of prompt that gets a model blamed for a specification error.
    const strip = maxPrefix(ctx);
    const lines = [
      `An experiment named "${experiment}" is about to be compiled into labsheets.`,
      '',
      'Every coded tube it produces is labelled with a short prefix plus a running letter — a',
      `prefix of "L3" gives L3a, L3b, L3c. This experiment will label ${tubes || 'several'} tube(s).`,
      '',
      constructs.length ? `The constructs it builds: ${constructs.join(', ')}.` : null,
      taken.length
        ? `Prefixes already in use by other live experiments: ${taken.join(', ')}. Do not reuse one.`
        : 'You have not been told which prefixes are already in use. If you cannot establish that, '
          + 'say so rather than guessing — a collision here puts two different tubes under one name '
          + 'in a shared freezer.',
      '',
      strip === 2
        ? 'Choose EXACTLY TWO characters: a capital letter followed by one letter or digit. This '
          + 'experiment sets up PCRs, and a 200 µL strip-tube cap holds three characters including '
          + 'the running letter.'
        : 'Choose two or three characters: a capital letter followed by one or two letters or '
          + 'digits.',
      'It should be recognisable as this experiment to somebody holding the tube a year from now.',
    ];
    return lines.filter((l) => l !== null).join('\n');
  },

  /**
   * The mechanical half of the question, which is the half a model is worst at. Length and shape
   * are checkable here; whether it collides with another lab member's experiment is not, and that
   * is exactly why the question was asked outside.
   */
  check: (value, ctx) => {
    const bad = [];
    const v = String(value || '');
    if (!PREFIX.test(v)) {
      bad.push(`${JSON.stringify(v)} is not two or three characters starting with a capital`);
    }
    // A PREFIX PLUS A RUNNING LETTER HAS TO FIT ON A PCR CAP, which takes three — so a
    // three-character prefix is only allowed for an experiment that sets up no strip tubes.
    if (v.length > maxPrefix(ctx)) {
      bad.push(`${JSON.stringify(v)} is ${v.length} characters, and this experiment sets up PCRs `
             + 'whose caps take three including the running letter');
    }
    if (/^\d/.test(v)) bad.push('a label starting with a digit reads as a number in a spreadsheet');
    return bad;
  },

  /** The rule, used where nobody has answered — and said on the page when it is. */
  fallback: (ctx) => {
    const value = experimentPrefix(ctx.experiment);
    return { value, why: `taken from the folder name "${ctx.experiment}" by rule` };
  },

  /**
   * WHAT THE SHEET SAYS WHEN THE RULE WAS USED. Not the full question — that would put a paragraph
   * about lab-wide uniqueness on every labsheet of every experiment forever. One sentence, so
   * somebody holding the tube knows what was and was not checked.
   */
  openWhenFallback: (ctx, value) =>
    `the tube prefix "${value}" was taken from the folder name and not checked against other `
    + 'experiments in the lab — if another group is using it, say so before these are written',
};
