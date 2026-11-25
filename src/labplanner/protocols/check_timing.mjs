// check_timing.mjs — validate every `timing` export and summarise it.
//
//   node src/labplanner/protocols/check_timing.mjs     (run by npm test)
//
// Checks the shape, not the truth. It cannot tell you a number is wrong, only that
// it is malformed or missing. What has never been measured belongs in `unknown`;
// this reports those too, because an empty-looking protocol with no `unknown` list
// is indistinguishable from one that is genuinely fully specified.
//
// See src/labplanner/protocols/TIMING.txt.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const idx = JSON.parse(await readFile(join(HERE, "index.json"), "utf8"));

const errors = [];
const rows = [];
let withTiming = 0;

/** Minutes as h/min, for reading at a glance. */
function dur(m) {
  if (m == null) return "—";
  if (m < 1) return `${Math.round(m * 60)}s`;
  if (m < 60) return `${+m.toFixed(1)}m`;
  const h = m / 60;
  return h < 48 ? `${+h.toFixed(1)}h` : `${+(h / 24).toFixed(1)}d`;
}

function span(lo, hi) {
  if (lo == null) return "—";
  return hi == null || hi === lo ? dur(lo) : `${dur(lo)}–${dur(hi)}`;
}

function checkList(id, field, list, required) {
  if (list === undefined) return [];
  if (!Array.isArray(list)) {
    errors.push(`${id}: \`${field}\` must be an array`);
    return [];
  }
  for (const [i, e] of list.entries()) {
    const at = `${id}.${field}[${i}]`;
    for (const k of required) {
      if (e[k] === undefined) errors.push(`${at}: missing \`${k}\``);
    }
    for (const k of ["min", "max"]) {
      if (e[k] !== undefined && (typeof e[k] !== "number" || !Number.isFinite(e[k]) || e[k] < 0)) {
        errors.push(`${at}: \`${k}\` must be a non-negative number of minutes`);
      }
    }
    if (e.min !== undefined && e.max !== undefined && e.max < e.min) {
      errors.push(`${at}: max (${e.max}) is less than min (${e.min})`);
    }
  }
  return list;
}

for (const { id } of idx) {
  const mod = await import(join(HERE, "modules", `${id}.js`));
  const t = mod.timing;
  if (!t) continue;
  withTiming++;

  if (typeof t.ends_at !== "string" || !t.ends_at) {
    errors.push(`${id}: \`ends_at\` must say where the protocol stops`);
  }

  const prep = checkList(id, "prep", t.prep, ["label", "min"]);
  const work = checkList(id, "work", t.work, ["label", "min"]);
  const wait = checkList(id, "wait", t.wait, ["label", "min"]);
  const limits = checkList(id, "limits", t.limits, ["step", "max", "why"]);

  for (const p of prep) {
    if (!p.gates) errors.push(`${id}.prep: "${p.label}" has no \`gates\` — what does it block?`);
  }
  // `next` and `park` are what a roadmap's flights are cut from (TIMING.txt).
  if (t.next !== undefined) {
    checkList(id, "next", [t.next], ["max", "why"]);
  }
  if (t.park !== undefined) {
    if (typeof t.park !== "object" || !t.park || typeof t.park.why !== "string" || !t.park.why) {
      errors.push(`${id}: \`park\` must be { why } — say why nothing after it is on a clock`);
    }
    if (t.next !== undefined) {
      errors.push(`${id}: carries both \`park\` and \`next\`; one says nothing is on a clock, the other names the clock`);
    }
  }
  if (t.unknown !== undefined && !Array.isArray(t.unknown)) {
    errors.push(`${id}: \`unknown\` must be an array of strings`);
  }

  // Per-unit work ("each") is not summed — the count comes from the module's inputs.
  const fixedWork = work.filter((w) => !w.each);
  const sum = (l, k) => l.reduce((a, e) => a + (e[k] ?? e.min ?? 0), 0);

  rows.push({
    id,
    // "—" not "0s" when every work item is per-unit: the total is a function of the
    // sample count, not zero.
    work: fixedWork.length ? span(sum(fixedWork, "min"), sum(fixedWork, "max")) : "—",
    scaled: work.filter((w) => w.each).length,
    wait: wait.length ? span(sum(wait, "min"), sum(wait, "max")) : "—",
    limits: limits.length,
    flow: t.park ? "park" : t.next ? `next ${span(t.next.min ?? 0, t.next.max)}` : "",
    unknown: (t.unknown ?? []).length
  });
}

const w = (s, n) => String(s).padEnd(n);
console.log(
  `\n${w("protocol", 30)}${w("hands-on", 14)}${w("waiting", 16)}${w("limits", 8)}${w("then", 14)}unknowns`
);
console.log("-".repeat(92));
for (const r of rows) {
  console.log(
    w(r.id, 30) +
      w(r.work + (r.scaled ? ` +${r.scaled}/ea` : ""), 14) +
      w(r.wait, 16) +
      w(r.limits || "", 8) +
      w(r.flow, 14) +
      (r.unknown || "")
  );
}

console.log(`\n${withTiming} of ${idx.length} protocols carry timing data.`);

const parks = rows.filter((r) => r.flow === "park").length;
const nexts = rows.filter((r) => r.flow.startsWith("next")).length;
console.log(`${nexts} hand a window to the next step; ${parks} end at a park.`);

const gaps = rows.reduce((a, r) => a + r.unknown, 0);
if (gaps) console.log(`${gaps} durations are recorded as not measured.`);

if (errors.length) {
  console.error(`\n${errors.length} problem${errors.length > 1 ? "s" : ""}:`);
  for (const e of errors) console.error(`  ${e}`);
  process.exit(1);
}
console.log("shape ok.");
