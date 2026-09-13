/**
 * Decisions the compiler will not make by rule — declared, not improvised.
 *
 * JCA, 2026-09-12, on what LabPlanner is:
 *
 * > *"It has code-defined things like pcr program selection whenever things can be done strictly
 * > logically. It has other pieces like making up an acronym for the PCR labels that an LLM call
 * > needs to make. That LLM could be a full cortex context, such that the full situation can be
 * > considered in choosing those label names."*
 *
 * So there are two kinds of decision and **the difference is in the decision, not in where it
 * lives.** Choosing a PCR program from a product size is arithmetic and belongs in a function.
 * Choosing two characters to stand for an experiment needs to know what else is in the freezer,
 * which no file in one project can tell you.
 *
 * ## The compile never calls an LLM
 *
 * That is the load-bearing choice here, and it is not about cost. A compile that asks a model
 * mid-run is a compile whose output changes between runs for reasons nobody recorded, and this
 * whole toolkit exists because JCA could not tell improvisation from design by reading the sheets.
 * So:
 *
 *   1. **Collect.** A compile with no answer for a decision uses its fallback where it has a
 *      defensible one, and refuses where it does not — carrying the question onto the sheet as an
 *      open decision either way. `bin/c6-decide` prints every pending question with its prompt and
 *      its schema.
 *   2. **Answer.** Out of band, by a person or by an agent with the whole situation in context.
 *      C6 ships no resolver. Cortex is one.
 *   3. **Write back.** The answers land in a file the compile reads. From then on the compile is
 *      deterministic and the answer is in git, next to the experiment, where somebody can disagree
 *      with it.
 *
 * **C6 refuses rather than inventing.** A default that reads exactly like an answer is the failure
 * mode this repository keeps finding — `heat_shock_transformation` saying "plate on Amp" over an
 * erythromycin sheet, `cycle_sequencing` offering somebody else's primer. A fallback is allowed
 * only where the rule behind it can be stated on the page, and it says so when it is used.
 */
import labelPrefix from './labelPrefix.js';

export const DECISIONS = Object.fromEntries([labelPrefix].map((d) => [d.id, d]));

/** A decision by id, or undefined. Never guesses at a near-match. */
export function decisionFor(id) { return DECISIONS[id]; }

/**
 * Answer one decision from what is already known.
 *
 * @param {string} id        which decision
 * @param {Object} ctx       whatever that decision's `prompt` and `fallback` read
 * @param {Object=} answers  `{ [id]: value }`, from the answers file
 * @returns {{value: *, source: 'answered'|'fallback'|'refused', why: string, open: string|null}}
 */
export function decide(id, ctx, answers = {}) {
  const d = DECISIONS[id];
  if (!d) throw new Error(`decide: no decision named ${JSON.stringify(id)}`);

  const given = answers[id];
  if (given !== undefined && given !== null && given !== '') {
    // AN ANSWER IS CHECKED, NOT TRUSTED. It came from a model or from a person typing into a JSON
    // file, and the mechanical half of the question — is it the right length, is it the right
    // shape — is exactly the half neither of those is good at. A bad answer is reported and the
    // fallback is used, rather than a malformed label reaching a tube.
    const bad = d.check(given, ctx);
    if (!bad.length) {
      return { value: given, source: 'answered', why: `answered: ${d.id}`, open: null };
    }
    const back = d.fallback(ctx);
    return { value: back ? back.value : null, source: back ? 'fallback' : 'refused',
             why: `the answer given for ${d.id} was rejected — ${bad.join('; ')}`
                + `${back ? `. Using ${JSON.stringify(back.value)}: ${back.why}` : ''}`,
             open: `${d.question} (the answer on file was rejected: ${bad.join('; ')})` };
  }

  const back = d.fallback(ctx);
  if (back) {
    return { value: back.value, source: 'fallback', why: back.why, open: d.openWhenFallback
      ? d.openWhenFallback(ctx, back.value) : null };
  }
  return { value: null, source: 'refused', why: `no answer for ${d.id}`, open: d.question };
}

/**
 * Every decision that is still open, with what an agent needs to answer it.
 *
 * This is what `bin/c6-decide` prints and what Cortex reads. The prompt is built here rather than
 * by the caller so that the question asked is the question this repository declared — a prompt
 * composed at the call site is one nobody reviewed.
 *
 * @param {Array<{id: string, ctx: Object}>} wanted
 * @param {Object=} answers
 * @returns {Array<{id, question, prompt, schema, fallback, why}>}
 */
export function pending(wanted, answers = {}) {
  const out = [];
  for (const { id, ctx } of wanted) {
    const d = DECISIONS[id];
    if (!d) continue;
    const got = decide(id, ctx, answers);
    if (got.source === 'answered') continue;
    const back = d.fallback(ctx);
    out.push({
      id: d.id,
      question: d.question,
      prompt: d.prompt(ctx),
      // A DECISION MAY SHAPE ITS ANSWER TO THE SITUATION. The prefix's length depends on whether
      // the experiment sets up PCRs, so the schema is a function of the same context the prompt is.
      schema: typeof d.schema === 'function' ? d.schema(ctx) : d.schema,
      fallback: back ? back.value : null,
      why: back ? back.why : 'nothing here can answer this by rule',
    });
  }
  return out;
}
