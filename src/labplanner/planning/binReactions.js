// binReactions.js — which operations can share one labsheet, and which must not.
//
// JCA, 2026-09-10: *"First step: bin like reactions. Pull out all the PCRs into one list, all
// the gels into one, etc. Figure out any dependencies between samples. Like, the pcr's to
// sequence cannot be binned with pcrs to clone. One has to happen long before the other. So,
// you can logic through dependencies, and this is also something you should be able to do
// precisely with code looking at input/output relationships of steps."*
//
// THE RULE, STATED EXACTLY: two steps of the same operation may share a labsheet **iff neither
// can reach the other through the dependency graph**. Not "iff they are at the same depth" —
// that is a different and wrong rule, and the difference shows up immediately on real input. Two
// construction files of unequal length both end in a Transform; the shorter one's Transform sits
// at depth 2 and the longer one's at depth 4, and nothing whatsoever connects them. They belong
// on one labsheet and a depth rule puts them on two.
//
// Grouping by "no path between them" is partitioning a partial order into ANTICHAINS. By
// Mirsky's theorem the fewest antichains needed equals the longest chain, and assigning each
// step its height *within the operation's own induced order* achieves that minimum. So the
// number of PCR labsheets this produces is the number of rounds of PCR the experiment actually
// requires — provably, not heuristically. For pGhost17 → miniprep → PCR-to-sequence that chain
// is 2, which is Chris's example arriving as arithmetic rather than as a special case.
//
// A BIN IS THE LARGEST SET THAT *MAY* SHARE A SHEET, NOT ONE THAT HAS TO. JCA, 2026-09-10:
// *"There is no strict requirement that you have to consolidate to 1 labsheet… Sometimes more
// labsheets will be more clear to the experimentalist than one giant one."* So this computes the
// hard constraint and nothing else; splitting a bin further — by chemistry, by plasticware, or
// for readability — is editorial and always available. Nothing downstream may refuse a split.
//
// WHAT THIS DOES NOT DO is decide the order a human runs them in beyond what dependency forces,
// or merge two operations that could physically share a bench session. Both are judgement, and
// both belong to the per-operation instructions in `planning/operations/`.

/** transitive reachability: can `a` reach `b` by consuming, directly or indirectly, its product */
function reachability(jobs, resolve) {
  const index = new Map(jobs.map((j, i) => [j.id, i]));
  const out = jobs.map(() => new Set());
  // direct edges: producer -> consumer
  for (const j of jobs) {
    for (const name of j.dnaInputs) {
      const p = resolve(j, name);
      if (p && index.has(p.id)) out[index.get(p.id)].add(index.get(j.id));
    }
  }
  // close it. Jobs are tens, not thousands; a clear fixpoint beats a clever algorithm.
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < jobs.length; i++) {
      for (const k of [...out[i]]) {
        for (const m of out[k]) if (!out[i].has(m)) { out[i].add(m); changed = true; }
      }
    }
  }
  return { out, index };
}

/**
 * @param {{jobs:Array, byOutput:Map}} lifted  from extractJobsFromCFs
 * @returns {{sheets:Array, cycles:Array}}
 */
export function binReactions({ jobs, byOutput, resolve }) {
  // Fall back to a plain name lookup only when a caller built the input by hand; every path
  // through extractJobsFromCFs supplies `resolve`, which knows which file is asking.
  const lookup = resolve || ((job, name) => byOutput.get(name));
  const { out, index } = reachability(jobs, lookup);

  // A CYCLE IS NOT SOMETHING TO PLAN AROUND. If a step transitively depends on itself the
  // construction files describe something that cannot be built in any order, and every height
  // below would be meaningless. Reported and excluded rather than silently linearised.
  const cycles = jobs.filter((j) => out[index.get(j.id)].has(index.get(j.id)))
                     .map((j) => ({ code: 'CYCLE', cf: j.cf, line: j.line, output: j.output }));
  const cyclic = new Set(cycles.map((c) => `${c.cf}:${c.line}:${c.output}`));
  const live = jobs.filter((j) => !cyclic.has(j.id));

  const sheets = [];
  const byOp = new Map();
  for (const j of live) {
    if (!byOp.has(j.operation)) byOp.set(j.operation, []);
    byOp.get(j.operation).push(j);
  }

  for (const [operation, group] of byOp) {
    // height within THIS operation's induced order: 0 if no other job of the same operation
    // must precede it, else 1 + the greatest height among those that must.
    const height = new Map();
    const heightOf = (j) => {
      if (height.has(j.id)) return height.get(j.id);
      height.set(j.id, 0);                                  // guards a cycle we failed to catch
      let h = 0;
      for (const other of group) {
        if (other === j) continue;
        if (out[index.get(other.id)].has(index.get(j.id))) h = Math.max(h, heightOf(other) + 1);
      }
      height.set(j.id, h);
      return h;
    };
    const rounds = new Map();
    for (const j of group) {
      const h = heightOf(j);
      if (!rounds.has(h)) rounds.set(h, []);
      rounds.get(h).push(j);
    }
    for (const [round, members] of [...rounds.entries()].sort((a, b) => a[0] - b[0])) {
      // TWO CONSTRUCTION FILES OFTEN NEED THE SAME REACTION, AND YOU RUN IT ONCE.
      //
      // From cloning-tutorials, planning/inventory_labsheets.md, on a bin holding three PCRs:
      // *"The first and third steps are identical — no need to repeat the reaction. A single PCR
      // yields far more material than needed."* Two of lycopene33's construction files both
      // amplify `back72` from `pLYC72` with the same primers; that is one tube, serving both.
      //
      // Collapsed only on an exact match of operation, inputs AND product name — the case the
      // tutorial describes. Two steps with the same inputs but different product names are left
      // alone: they may well be one reaction physically, but everything downstream refers to
      // them by name, and merging them silently would leave one of those names produced by
      // nothing.
      const seen = new Map();
      const unique = [];
      for (const j of members) {
        const key = [j.operation, j.output, [...j.dnaInputs].sort().join('|'),
                     [...(j.oligos || [])].sort().join('|')].join('::');
        if (seen.has(key)) { seen.get(key).alsoFor.push(j.cf); continue; }
        const copy = { ...j, alsoFor: [] };
        seen.set(key, copy);
        unique.push(copy);
      }
      const collapsed = members.length - unique.length;

      sheets.push({
        operation,
        round,                                     // 0-based: which pass of this operation
        rounds: rounds.size,
        collapsed,
        jobs: unique,
        cfs: [...new Set(members.map((m) => m.cf))],
        // depth in the WHOLE graph, used only to order the sheets against each other
        depth: Math.min(...members.map((m) => globalDepth(m, lookup))),
      });
    }
  }

  // Order the labsheets the way the experiment runs: earliest possible first, and where two
  // are equally early, the one more things are waiting on.
  sheets.sort((a, b) => a.depth - b.depth
    || b.jobs.length - a.jobs.length
    || a.operation.localeCompare(b.operation));
  sheets.forEach((s, i) => { s.index = i; });
  return { sheets, cycles };
}

const _depth = new WeakMap();
function globalDepth(job, lookup) {
  if (_depth.has(job)) return _depth.get(job);
  _depth.set(job, 0);
  let d = 0;
  for (const name of job.dnaInputs) {
    const p = lookup(job, name);
    if (p && p !== job) d = Math.max(d, globalDepth(p, lookup) + 1);
  }
  _depth.set(job, d);
  return d;
}

/** A one-line summary per labsheet — what the planner decided and why there are that many. */
export function describe({ sheets, cycles }) {
  const lines = sheets.map((s) => {
    const many = s.rounds > 1 ? `  (${s.operation} round ${s.round + 1} of ${s.rounds})` : '';
    const dedup = s.collapsed ? `  [${s.collapsed} identical reaction(s) collapsed]` : '';
    return `  ${String(s.index + 1).padStart(2)}. ${s.operation.padEnd(11)} `
         + `${String(s.jobs.length).padStart(2)} sample(s)  from ${s.cfs.join(', ')}${many}${dedup}\n`
         + `      ${s.jobs.map((j) => j.output).join(', ')}`;
  });
  if (cycles.length) lines.push(`  ${cycles.length} step(s) in a dependency cycle: `
    + cycles.map((c) => `${c.cf}:${c.line} ${c.output}`).join('; '));
  return lines.join('\n');
}
