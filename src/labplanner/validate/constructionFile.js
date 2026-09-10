// src/labplanner/validate/constructionFile.js
//
// Structural checks over a construction file, above and beyond whether it parses.
//
// WHY THIS EXISTS. C6 can already simulate a construction file, and JCA's own account of the
// toolchain is that "I have never had an experimental plan pass construction file simulator and
// then later be revealed to have a sequence design or process error." The gap is not the
// simulator — it is that nothing runs it over a project. These checks are the cheap half: they
// need no sequences, so they run on any construction file in any repo, including the many that
// reference templates whose maps are not committed.
//
// THE CHECKS ARE NOT INVENTED. Each one was written against a defect found in a real repository
// on 2026-09-10, and each names the file it came from. A check with no such provenance does not
// belong here — the failure modes of wetlab planning are discovered, not imagined.
//
// WHAT THIS DELIBERATELY DOES NOT DO: it does not correct anything. A construction file is
// somebody's experimental record, and a plausible repair applied automatically is how a wrong
// number becomes a permanent one. Findings are reported with the line and the reasoning; a
// human decides.

import { parseCF } from '../../C6-Sim.js';

// Which fields on a parsed step name DNA that must already exist. `strain`, `antibiotics`,
// `enzyme(s)` and `fragselect` are deliberately absent: they name reagents and parameters, not
// products of earlier steps, and treating them as DNA would report every Transform as broken.
const INPUT_FIELDS = {
  PCR:        ['forward_oligo', 'reverse_oligo', 'template'],
  Gibson:     ['dnas'],
  GoldenGate: ['dnas'],
  Ligate:     ['dnas'],
  Digest:     ['dna'],
  Transform:  ['dna'],
};

// Fields that hold DNA on an operation this module has not been taught. Used only as a
// fallback, so an unfamiliar operation degrades to partial checking rather than to silence.
const GENERIC_INPUT_FIELDS = ['dna', 'dnas', 'template', 'forward_oligo', 'reverse_oligo'];

// Mirrors `normalizeOperation` in C6-Sim.js. Duplicated rather than imported because that table
// is a local inside `parseCF` and not exported; `unknownOperationsAgreeWithTheParser` in the
// tests asserts the two stay in step, so the copy cannot drift silently.
export const KNOWN_OPERATIONS = ['pcr', 'digest', 'ligate', 'gibson', 'goldengate', 'transform'];

// Lines that declare material rather than perform an operation. A construction file may carry
// `oligo NAME SEQ` / `plasmid NAME SEQ` headers, as the Drive workbooks' `construction` tabs do.
const DECLARATION_KEYWORDS = new Set(['oligo', 'plasmid', 'dsdna']);

/**
 * First tokens that are neither a known operation nor a declaration. -> [{line, op}]
 *
 * absence-ok: a file of only declarations yields [], and so does an empty file. Neither is an
 * unknown operation, and reporting one would make every sequence list look broken.
 */
export function unknownOperations(text) {
  const out = [];
  String(text).split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) return;
    const first = line.split(/[\s,]+/)[0].toLowerCase();
    if (!first) return;
    if (KNOWN_OPERATIONS.includes(first)) return;
    if (DECLARATION_KEYWORDS.has(first)) return;
    // A bare sequence line is data, not a mistyped verb.
    if (/^[acgtryswkmbdhvnu*]+$/i.test(first)) return;
    out.push({ line: i + 1, op: line.split(/[\s,]+/)[0] });
  });
  return out;
}

function inputsOf(step) {
  // A generically-read step keeps ALL its inputs in `dnas`, whatever its operation is called.
  // Without this check, a generic `Transform` matched INPUT_FIELDS.Transform = ['dna'], found
  // nothing, and its input vanished — which reported the assembly product it consumes as
  // dangling. A false "nothing uses this" on a checker's first outing is the finding that
  // teaches somebody to ignore it.
  const fields = step._generic ? ['dnas'] : (INPUT_FIELDS[step.operation] || GENERIC_INPUT_FIELDS);
  const out = [];
  for (const f of fields) {
    const v = step[f];
    if (Array.isArray(v)) out.push(...v.filter(Boolean));
    else if (typeof v === 'string' && v) out.push(v);
  }
  return out;
}

/**
 * Read operation lines without the parser: first token is the operation, last is the product,
 * everything between is an input. -> [{operation, output, dnas}]
 *
 * **Only used when `parseCF` cannot read the file**, so that a toolchain gap does not silence
 * the structural checks entirely. It is genuinely approximate: for `Transform g17 JTK145 AB
 * Spec pGhost17` it will treat the strain and the antibiotic as inputs. That costs nothing for
 * the checks that matter here — DUPLICATE_INPUT and DANGLING_PRODUCT look for a name repeated
 * within one line and for a product nothing consumes, and neither is confused by an extra
 * non-DNA token appearing exactly once.
 */
export function genericSteps(text) {
  return String(text).split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'))
    .map((l) => l.split(/[\t,]+|\s{2,}| /).filter(Boolean))
    .filter((t) => t.length >= 3 && !DECLARATION_KEYWORDS.has(t[0].toLowerCase()))
    .map((t) => ({
      _generic: true,
      operation: t[0],
      output: t[t.length - 1],
      dnas: t.slice(1, t.length - 1),
    }));
}

/**
 * The dataflow checks, over any list of steps. Shared by the parsed path and the generic
 * fallback so a file C6 cannot parse still gets analysed — see the UNKNOWN_OPERATION branch.
 *
 * @param {Array} steps  objects with {operation, output, ...input fields}
 * @param {string} note  prefix on every message, used to mark best-effort readings as such
 */
function structuralFindings(steps, note = '') {
  const findings = [];
  const producedAt = new Map();       // name -> 1-based step that produces it
  const consumedAt = new Map();       // name -> [1-based steps that consume it]

  steps.forEach((step, i) => {
    const n = i + 1;
    const ins = inputsOf(step);

    // ---- DUPLICATE_INPUT ------------------------------------------------------------------
    // The SLIP4 defect exactly: `Assemble S8i S8i SL8`, where S8i is consumed twice and the
    // sibling PCR product S8v is consumed never. An assembly that joins a fragment to itself
    // is nearly always a copy-paste of the neighbouring token.
    const seen = new Set();
    for (const inp of ins) {
      if (seen.has(inp)) {
        findings.push({
          code: 'DUPLICATE_INPUT', level: 'error', step: n,
          message: note + `step ${n} (${step.operation}) uses "${inp}" more than once. An assembly ` +
                   `joining a fragment to itself is almost always a mistyped neighbour — ` +
                   `check whether a sibling product was meant.`,
        });
      }
      seen.add(inp);
      if (!consumedAt.has(inp)) consumedAt.set(inp, []);
      consumedAt.get(inp).push(n);
    }

    // ---- USE_BEFORE_PRODUCED --------------------------------------------------------------
    // Referencing something a LATER step makes is an ordering error; referencing something no
    // step makes is normal (oligos, existing plasmids) and is not reported here, because a
    // construction file legitimately names inputs that live in the freezer.
    for (const inp of ins) {
      const madeAt = producedAt.get(inp);
      if (madeAt === undefined) continue;
      if (madeAt > n) {
        findings.push({
          code: 'USE_BEFORE_PRODUCED', level: 'error', step: n,
          message: note + `step ${n} uses "${inp}", which step ${madeAt} produces. Steps run in order.`,
        });
      }
    }

    if (step.output) {
      if (producedAt.has(step.output)) {
        findings.push({
          code: 'DUPLICATE_PRODUCT', level: 'error', step: n,
          message: note + `"${step.output}" is produced twice — at step ${producedAt.get(step.output)} ` +
                   `and step ${n}. Later references are ambiguous.`,
        });
      } else {
        producedAt.set(step.output, n);
      }
    }
  });

  // ---- DANGLING_PRODUCT ---------------------------------------------------------------------
  // A product nothing consumes, that is not the file's final output. In SLIP4 this is `S8v` —
  // made by the first PCR and then abandoned, which is the other half of the duplicate above.
  const finalOutput = steps.length ? steps[steps.length - 1].output : null;
  for (const [product, at] of producedAt) {
    if (product === finalOutput) continue;
    if (!consumedAt.has(product)) {
      findings.push({
        code: 'DANGLING_PRODUCT', level: 'error', step: at,
        message: note + `step ${at} produces "${product}" and nothing uses it. Either a later step ` +
                 `should consume it, or the step is doing work the plan does not need.`,
      });
    }
  }
  return findings;
}

/**
 * Check one construction file.
 *
 * @param {string} text      file contents
 * @param {string} name      for messages; typically the filename
 * @returns {{ok: boolean, parsed: boolean, steps: number, findings: Array}}
 *
 * A finding is `{code, level, step, message}` where level is 'error' or 'warn'. `step` is the
 * 1-based step index, or null when the finding is about the file as a whole.
 */
/**
 * Which construction-file dialect this is. -> 'tabular' | 'parenthetical' | 'unknown'
 *
 * **There is more than one, and C6 reads one of them.** Discovered 2026-09-10 by running the
 * checker over every project on the machine and getting 1032 dangling-product findings — a
 * number that is its own evidence of a bug. The cause was not the checks; it was that
 * `UCB_iGEM_Assembly` and much of `Pimar` are written in a different dialect entirely:
 *
 *     tabular         PCR<tab>oGho23<tab>oGho26<tab>pGhost16<tab>17a
 *     parenthetical   pcr PAB2F, PAB2R on pAPAP3    (10045 bp, back_C)
 *
 * The parenthetical form puts the product INSIDE the parentheses next to the expected size, uses
 * `on` before the template, and separates primers with commas. Read as tabular it produces
 * nonsense, and nonsense at that volume is how a checker gets switched off in its first week.
 *
 * Detecting it is not the same as supporting it. Saying "C6 cannot read this dialect" once per
 * file is true and useful; guessing at its structure is neither.
 */
export function detectDialect(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'));
  if (!lines.length) return 'unknown';

  const opLines = lines.filter((l) => {
    const first = l.split(/[\s,]+/)[0].toLowerCase();
    return KNOWN_OPERATIONS.includes(first) || !DECLARATION_KEYWORDS.has(first);
  });
  if (!opLines.length) return 'unknown';

  // `(… , product)` or ` on ` are the parenthetical dialect's two signatures. One line carrying
  // either is enough: the dialects are not mixed within a file in any project on this machine.
  const paren = opLines.filter((l) => /\([^)]*,[^)]*\)\s*$/.test(l) || /\bon\b/i.test(l));
  if (paren.length) return 'parenthetical';

  const tabbed = opLines.filter((l) => /\t/.test(l) || /\s{2,}/.test(l));
  return tabbed.length ? 'tabular' : 'unknown';
}

export function validateConstructionFile(text, name = 'construction file') {
  const dialect = detectDialect(text);
  if (dialect === 'parenthetical') {
    return {
      ok: false,
      parsed: false,
      dialect,
      steps: 0,
      findings: [{
        code: 'UNSUPPORTED_DIALECT',
        level: 'error',
        step: null,
        message: `${name} is written in the parenthetical construction-file dialect ` +
                 `("pcr A, B on TEMPLATE   (1234 bp, product)"), which C6's parser does not ` +
                 `read — it handles the tab-separated form. NO CHECKS WERE RUN on this file. ` +
                 `This is a toolchain gap, not a defect in the file: the dialect is in wide ` +
                 `use across Pimar and UCB_iGEM_Assembly, and it carries the expected product ` +
                 `size inline, which the tabular form does not.`,
      }],
    };
  }
  // ---- UNKNOWN_OPERATION, checked BEFORE parsing ------------------------------------------
  // The parser's `normalizeOperation` table knows pcr/digest/ligate/gibson/goldengate/transform.
  // Anything else falls through to being treated as sequence data, so an unrecognised verb
  // surfaces as "Invalid sequence format" — which reads exactly like a corrupt file and is not.
  //
  // This is not hypothetical. `Assemble` is used across SynThera AND Pimar and is in no alias
  // table, so on 2026-09-10 three of ten SynThera files "failed to parse" and two of those were
  // this. **Reporting a toolchain gap as somebody's broken record sends them to fix the wrong
  // thing**, and would burn the credibility a checker needs on its first run.
  //
  // Deliberately NOT fixed by aliasing here: `Assemble` is ambiguous in the real files —
  // `Assemble gho_back par_frag BsaI gg` carries an enzyme and reads as GoldenGate, while
  // `Assemble S8i S8i SL8` has none and reads as Gibson. Choosing one is a decision about the
  // format, not a bug fix.
  const unknown = unknownOperations(text);
  if (unknown.length) {
    const findings = unknown.map((u) => ({
      code: 'UNKNOWN_OPERATION',
      level: 'error',
      step: u.line,
      message: `line ${u.line} of ${name} begins with "${u.op}", which C6 does not know. ` +
               `Known operations: ${KNOWN_OPERATIONS.join(', ')}. ` +
               `THIS IS A TOOLCHAIN GAP, NOT NECESSARILY A BROKEN FILE — the parser treats ` +
               `an unknown verb as sequence data, which is why it complains about sequence ` +
               `format. The file may be perfectly good and unreadable by C6.`,
    }));

    // **The structural checks still run, on a generic reading of the lines.** Without this the
    // toolchain gap MASKS the real defect: SynThera's `Construction of pGhost16.txt` uses an
    // unknown `Assemble`, and its actual problem — the same fragment consumed twice while a
    // sibling is abandoned — would never be reached, because the file never parses. A checker
    // that goes quiet exactly where a file is most unusual is worse than none.
    findings.push(...structuralFindings(genericSteps(text), '(read generically: C6 could not ' +
      'parse this file, so inputs and outputs were taken as "first token is the operation, ' +
      'last is the product, the rest are inputs". Treat as a lead, not a verdict.) '));

    return { ok: false, parsed: false, steps: genericSteps(text).length, findings };
  }

  let cf;
  try {
    cf = parseCF(text);
  } catch (err) {
    // A parse failure IS the finding, and it is the most valuable one: on 2026-09-10 the
    // parser rejected SynThera's `Construction of pGhost16.txt` outright, and had done so for
    // as long as the file existed. Nobody had run it.
    return {
      ok: false,
      parsed: false,
      steps: 0,
      findings: [{
        code: 'PARSE_FAILED',
        level: 'error',
        step: null,
        message: `${name} does not parse: ${String(err.message).split('\n').join(' ')}`,
      }],
    };
  }

  const steps = cf.steps || [];
  const findings = structuralFindings(steps);
  return {
    ok: findings.every((f) => f.level !== 'error'),
    parsed: true,
    steps: steps.length,
    findings,
  };
}
