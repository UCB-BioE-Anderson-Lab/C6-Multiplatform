// toRoadmap.js — a plan's labsheets as an experiment ROADMAP: steps, what each waits on, and the
// windows that make a run of bench days a flight.
//
// JCA, 2026-11-25: *"there is an underlying gant diagram associated with the experiment that needs
// to be translated into todos and put on my calendar when they become enabled ... So, this
// gant-like structure is probably a schema, and is something per-experiment, and that is probably
// part of C6 as it is domain-aware of time dependencies between protocols."*
//
// THE SEAM, NARROW ON PURPOSE. C6 answers what the steps are, what each waits on, and under what
// windows; Cortex decides when (its spec/runtime.md § 25). Nothing here knows about a calendar, and
// Cortex never learns what a restreak is. The output is `experiment.roadmap` (sharables/), which is
// exactly the file Cortex reads from its `roadmaps/` directory.
//
// ONE STEP PER LABSHEET, because a labsheet is a bench session and a session is what goes on a
// calendar. A step's `window` is the `next` of the protocol it follows (TIMING.txt); a protocol
// with `park` ends a flight. A sheet whose operation has no protocol module, or whose module
// carries no timing, is emitted with `timing: "unknown"` and no `work_min`, so the placer treats
// it as unmeasured rather than instant. A number is never invented to fill a gap.
import { DESIGNS } from '../design/index.js';

/** The protocol module a labsheet is run from, or null when no design names one. A design whose
 *  `module` is chosen per sample (sequencing waits for its oligo) is asked with the projected
 *  sheet, exactly as `applyDesign` asks it; when it cannot answer, the timing is unknown. */
export function moduleFor(operation, projected = null) {
  const m = DESIGNS[operation] && DESIGNS[operation].module;
  if (typeof m !== 'function') return typeof m === 'string' ? m : null;
  try {
    const sheet = projected || {};
    return m({ sheet, samples: sheet.samples || [], operation, mastermix: sheet.mastermix || null }) || null;
  } catch {
    return null;
  }
}

/** Fixed hands-on minutes, or null when any part scales with a count or the timing is absent. */
function workMin(t) {
  if (!t || !Array.isArray(t.work) || !t.work.length) return null;
  if (t.work.some((w) => w.each)) return null;
  return Math.round(t.work.reduce((a, w) => a + (w.max ?? w.min ?? 0), 0));
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * @param {Object} p
 * @param {{sheets:Array}} p.binned        from binReactions / planExperiment
 * @param {Array=} p.sheets                planExperiment's projected sheets (carry samples), by index
 * @param {{jobs:Array, resolve:Function, byOutput:Map}} p.lifted
 * @param {Object<string,Object>} p.timings  module id -> its `timing` export
 * @param {string} p.id                      the roadmap's id (its file name in Cortex)
 * @param {string} p.name                    the GOAL: what this experiment makes possible
 * @returns {{id,name,source,steps,progress}}
 */
export function toRoadmap({ binned, lifted, sheets = [], timings = {}, id, name }) {
  // A DERIVED BIN SHARES ITS JOBS WITH THE ONE IT CAME FROM (`injectGel`, `injectCleanup` push the
  // very same job objects). So a job belongs to a chain of sheets, PCR then its gel then its
  // cleanup, in index order: each derived sheet waits on the one before it in the chain, and
  // whatever consumes the product waits on the LAST, because that is the tube it is handed.
  const steps = binned.sheets.map((s) => ({ sheet: s, sid: `${s.index + 1}-${slug(s.operation)}` }));
  const chainOf = new Map();       // job id -> [step id, ...] in index order
  const byKey = new Map();         // operation::output -> job id, for collapsed duplicates
  for (const { sheet, sid } of steps) {
    for (const j of sheet.jobs) {
      if (!chainOf.has(j.id)) chainOf.set(j.id, []);
      chainOf.get(j.id).push(sid);
      byKey.set(`${j.operation}::${j.output}`, j.id);
    }
  }
  const lookup = lifted.resolve || ((job, n) => lifted.byOutput && lifted.byOutput.get(n));
  const chain = (j) => (j && (chainOf.get(j.id) || chainOf.get(byKey.get(`${j.operation}::${j.output}`)))) || [];
  const producer = (j) => { const c = chain(j); return c.length ? c[c.length - 1] : null; };
  const byId = new Map(lifted.jobs.map((j) => [j.id, j]));

  const out = steps.map(({ sheet, sid }) => {
    const after = new Set();
    for (const j of sheet.jobs) {
      if (sheet.derivedFrom) {
        const c = chain(j);
        const i = c.indexOf(sid);
        if (i > 0) after.add(c[i - 1]);
        continue;                  // its inputs are its parent's, already waited on through it
      }
      for (const n of j.dnaInputs || []) {
        const p = producer(lookup(j, n));
        if (p && p !== sid) after.add(p);
      }
      for (const d of j.deps || []) {
        const p = producer(byId.get(d));
        if (p && p !== sid) after.add(p);
      }
    }
    const mod = moduleFor(sheet.operation, sheets.find((p) => p.index === sheet.index) || null);
    const t = mod ? timings[mod] : null;
    const outputs = sheet.jobs.map((j) => j.output);
    const step = {
      id: sid,
      title: `${sheet.operation} ${outputs.slice(0, 4).join(', ')}${outputs.length > 4 ? ` +${outputs.length - 4}` : ''}`.trim(),
      after: [...after].sort(),
      operation: sheet.operation,
      module: mod,
    };
    const w = workMin(t);
    if (w != null) step.work_min = w;
    if (!t) step.timing = 'unknown';
    if (t && t.park) step.park = true;
    step._next = t && t.next ? t.next : null;
    step._injected = Boolean(sheet.injected);
    return step;
  });

  // AN INJECTED SESSION (antibiotic stock, oligo dilutions) IS FIRST OF EVERYTHING, which is how
  // `injectAntibioticStock` places it: so every step that otherwise waits on nothing waits on it.
  const injected = out.filter((s) => s._injected).map((s) => s.id);
  for (const s of out) if (!s._injected && !s.after.length) s.after = [...injected];

  // ONLY THE DIRECT EDGES. A pick that waits on the transformation does not also need to say it
  // waits on the assembly before it; the redundant edge is true and makes `show` unreadable.
  const reach = new Map();
  const reachable = (sid) => {
    if (!reach.has(sid)) {
      reach.set(sid, new Set());
      const st = out.find((x) => x.id === sid);
      for (const a of st.after) { reach.get(sid).add(a); for (const r of reachable(a)) reach.get(sid).add(r); }
    }
    return reach.get(sid);
  };
  for (const s of out) {
    s.after = s.after.filter((a) => !s.after.some((b) => b !== a && reachable(b).has(a))).sort();
  }

  // A step's window is handed to it by what it follows. With two predecessors on a clock, the
  // step must satisfy both: the later floor and the earlier ceiling.
  const find = new Map(out.map((s) => [s.id, s]));
  for (const s of out) {
    const clocks = s.after.map((a) => find.get(a)._next).filter(Boolean);
    if (clocks.length) {
      s.window = {
        min_h: Math.max(...clocks.map((c) => (c.min ?? 0) / 60)),
        max_h: Math.min(...clocks.map((c) => c.max / 60)),
        why: clocks.map((c) => c.why).join('; '),
      };
    }
  }
  for (const s of out) { delete s._next; delete s._injected; }

  return { id, name, source: 'c6-plan --roadmap', steps: out, progress: {} };
}
