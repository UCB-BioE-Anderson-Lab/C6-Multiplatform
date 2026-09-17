/**
 * Every scenario compiles, or is refused for the reason it is recorded as being refused for.
 *
 * JCA, 2026-09-15: *"How do we get confidence that the labsheets are valid?"* — and, on what has
 * worked before, *"validation scripts backed up by synthetic tests with different permutations of
 * scenarios. IDK if we have already done that for all these decision-making algorithms or not."*
 *
 * **THE ANSWER WAS: FOR THE RULES YES, FOR THEIR COMPOSITION NO.** `rules.test.js` requires every
 * rule to be fired by one of its own worked examples, across all fourteen files — branch coverage
 * by construction, and already done. What had never been permuted is which operations sit next to
 * which, at what counts, with what in the freezer. Two experiments had ever been compiled end to
 * end, and 23 of 51 rules had never once been reached by a real compile.
 *
 * ## The binary this test holds
 *
 * A compile ends in exactly one of two states, and a third is a bug:
 *
 *   compiles   a packet comes out, and every sheet went through `models/labsheet.js`
 *   refuses    a message a person can act on, naming what is wrong
 *   ——
 *   anything else — a crash, or a packet with no sheets — is a defect
 *
 * That binary is what makes a matrix worth having: twenty-seven experiments can be checked without
 * anybody reading twenty-seven packets.
 *
 * ## Why `expect` is recorded rather than tolerated
 *
 * One scenario is refused today and it records the message it is refused with. **A scenario that
 * starts compiling fails this test.** The count has been down as well as up: three were refused on
 * the day this was written, two turned out to be defects and were fixed. That is the golden snapshot's discipline — *"when this
 * fails, look at the diff before re-recording it"* — applied to an outcome rather than to a page:
 * a refusal going away is either a fix worth noticing or a check that has stopped checking, and
 * those are not distinguishable from a green run.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { everyScenario } from '../../src/labplanner/scenarios/scenarios.js';
import { writeScenario } from '../../src/labplanner/scenarios/generate.js';
import { trace } from '../../src/labplanner/rules/lib.js';
import { compileScenario as compile, returnedSheets } from '../../src/labplanner/scenarios/compile.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const RULES_DIR = path.join(root, 'src/labplanner/rules');

// GENERATED INTO A TEMPORARY DIRECTORY, NOT COMMITTED. A scenario's files are derived from its
// spec by a pure function, so a checked-in copy is a second description of the same thing and the
// two can disagree — which is the defect this repository keeps finding. `bin/c6-scenarios --write`
// is how a person gets one on disk to look at.
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'c6-scenarios-'));

const SPECS = everyScenario();
const got = new Map();
const back = {};
let fired = new Map();

// **THE COMPILE AND THE FOUR WRONG ANSWERS LIVE IN `scenarios/compile.js`**, not here, because
// `coverage.js` needs the same ones and two copies of a compile are two descriptions of one thing,
// free to disagree. They run inside the TRACE below and not inside an `it`: the rule tally is
// captured when `beforeAll` finishes, so work done in an assertion fires rules the ratchet cannot
// see — which is how four `receipt.*` rules sat in COLD as unreachable while `issue.test.js` had
// been exercising three of them all along.

beforeAll(() => {
  const stop = trace();
  for (const spec of SPECS) got.set(spec.id, compile(writeScenario(spec, OUT)));
  // The first scenario that actually asks for freezer space. Not pinned to an id: which scenarios
  // need a box is a property of the designs, and naming one here would make the receipt checks
  // fail for a reason that has nothing to do with them.
  const issuing = SPECS.map((x) => got.get(x.id))
    .find((r) => r.outcome === 'compiles' && r.issued && r.issued.assignments.length > 2);
  Object.assign(back, { issuing, ...(returnedSheets(issuing) || {}) });
  fired = stop();
});

describe('the scenario matrix', () => {
  it('has a scenario for every axis, and no two under one name', () => {
    expect(new Set(SPECS.map((s) => s.id)).size).toBe(SPECS.length);
    expect(SPECS.length).toBeGreaterThan(20);
  });

  // A SCENARIO WITHOUT A REASON IS A PERMUTATION NOBODY CHOSE. `reaches` is what makes the list
  // readable as an argument rather than as a sweep, and it is the field somebody disagrees with.
  it('every scenario says what it is and what it is there to reach', () => {
    for (const s of SPECS) {
      expect(String(s.what || ''), `${s.id} has no \`what\``).not.toBe('');
      expect(String(s.reaches || '').length, `${s.id}: \`reaches\` is too short to be a reason`)
        .toBeGreaterThan(40);
    }
  });

  for (const spec of SPECS) {
    describe(spec.id, () => {
      it(`${spec.expect}`, () => {
        const r = got.get(spec.id);
        expect(r.outcome, `${spec.id}: ${r.message || ''}`).toBe(spec.expect);
      });

      if (spec.expect === 'refuses') {
        // THE MESSAGE, NOT MERELY THE REFUSAL. A scenario that begins failing somewhere else
        // entirely still "refuses", and that is the failure mode this repository keeps meeting:
        // a check that stays green while the thing under it changes.
        it('is refused for the reason recorded against it', () => {
          expect(got.get(spec.id).message).toContain(spec.refusal);
        });
      } else {
        it('produces sheets, and every one of them has something on it', () => {
          const { packet } = got.get(spec.id);
          expect(packet.sheets.length).toBeGreaterThan(0);
          for (const sh of packet.sheets) {
            // A SHEET WITH NOTHING ON IT IS A PAGE SOMEBODY PRINTS AND CANNOT ACT ON. The thin
            // default design is deliberate and still says something; an entirely empty sheet
            // means a session was created for work that did not survive.
            //
            // **`dilution` IS NOT A FIELD `createLabSheet` DECLARES**, and finding that out is
            // why this check counts it. The dilution session carries its whole content there —
            // *"the dilution sheet IS its procedure — the renderer draws the tables and the
            // formulas"* — so counting only the declared fields called every dilution sheet empty
            // whose oligos all happened to be located. That is the same shape `setCheckpoint`'s
            // docstring records: *"a slot nothing declares is a slot nothing can be wrong about."*
            const carries = sh.samples.length + sh.blocks.length + sh.notes.length
                          + sh.sources.length + sh.open.length
                          + (sh.dilution ? 1 : 0) + (sh.recipe ? 1 : 0);
            expect(carries, `${spec.id}/${sh.id} is an empty page`).toBeGreaterThan(0);
          }
        });
      }
    });
  }
});

/**
 * What a sheet says when it comes back, which is an axis of its own.
 *
 * **THE MATRIX COMPILES EXPERIMENTS AND NEVER FILLS ONE IN.** Every scenario above ends at a
 * packet; the wells it asks for come back written by hand, weeks later, and whether that hand
 * wrote `C4`, `top shelf`, or nothing at all is not a property of the experiment's shape. So it is
 * not a scenario — it is a second dimension over one, and four of `rules/receipt.rules.js` sit
 * behind it.
 *
 * **THIS EXISTS BECAUSE I GOT THE DIAGNOSIS WRONG.** Those four were listed as unreachable, with
 * the reason *"generating a returned workbook is a separate piece of work"*. It is not: `resolve`
 * takes what came back as a plain map of construct to whatever was written, and each of the four
 * is one string. `test/labplanner/issue.test.js` had been exercising three of them all along —
 * `Z99`, an unreadable cell, an occupied well — so the rules were covered and the RATCHET was
 * blind, which is a different problem with a different fix. Widening the trace was ten lines.
 *
 * The assertion is the one that matters at a −20: **nonsense written back produces a finding, and
 * never a placement.** A tube recorded where it is not is the failure the whole issue-and-receive
 * lifecycle exists to prevent — JCA: *"Just don't say things are in there that aren't there."*
 */
describe('what comes back on the sheet', () => {
  it('the matrix produces something that asks for freezer space at all', () => {
    expect(back.issuing, 'no scenario issues wells, so nothing below is testing anything')
      .toBeTruthy();
  });

  it.each([
    ['a cell nobody could read', 'unreadable'],
    ['a well the box does not have', 'outside'],
  ])('refuses to place %s, and says so', (_what, key) => {
    const out = back[key];
    expect(out.placed, 'it was recorded as a location').toHaveLength(0);
    expect(out.problems.join(' '), 'it produced no finding').not.toBe('');
    // **AND THE HOLD IS LET GO ANYWAY.** An abandoned or unreadable row must not leave a
    // reservation standing, because nothing else will ever come back to release it.
    expect(out.released.length, 'the hold is still standing').toBeGreaterThan(0);
  });

  it('refuses to overwrite a different construct', () => {
    expect(back.overwritten.placed, 'a second construct was written over the first')
      .toHaveLength(0);
    expect(back.overwritten.problems.join(' ')).toMatch(/\S/);
  });

  it('recognises its own tube when the same sheet is read twice', () => {
    // AN ORDINARY ACCIDENT — a workbook re-imported, a run repeated — so it must be idempotent
    // rather than either an error or a second tube in the same well.
    expect(back.twice.placed.some((p) => p.already),
      'the second read did not recognise the tube it had just recorded').toBe(true);
  });
});

/**
 * The rules nothing in this file reaches, as a named set rather than a count.
 *
 * **A COUNT IS NOT A RATCHET.** `plumbing.test.js` asks for fewer than thirty, which stays true
 * while one rule goes cold and another goes hot — and a rule going cold is precisely the event
 * worth catching, because it means a code path stopped being taken and nothing said so.
 *
 * Two left, and they are cold for opposite reasons:
 *
 *   label.noSide                       a side-label on a tube that has no side. The COMPILER's own
 *                                      error, not anything a file can ask for, so no experiment
 *                                      reaches it and its unit test is the right home.
 *   labelUniqueness.twoOfAKindOneSitting
 *                                      a REFUSAL, and nothing is broken in that way any more.
 *                                      `four-constructs` used to fire it — sixteen picks into one
 *                                      block, four of them in A1 — and `allocateWells` closed
 *                                      that. Going cold is the good outcome, and it is named here
 *                                      rather than tolerated because the day it goes HOT again is
 *                                      the day a compile started producing a collision.
 *
 * **FOUR `receipt.*` RULES USED TO BE ON THIS LIST AND SHOULD NOT HAVE BEEN.** They were recorded
 * as needing "a returned workbook generator, which is a separate piece of work". They needed ten
 * lines: `resolve` takes what came back as a plain map of construct to whatever somebody wrote, and
 * each of the four is one string. `issue.test.js` had been exercising three of them all along, so
 * the rules were covered and this TRACE was blind — a different problem with a different fix. A
 * ratchet that measures less than the suite does reports gaps that are not there, which is worse
 * than no ratchet: it sends somebody off to build the thing nobody needed.
 */
const COLD = [
  'label.noSide',
  'labelUniqueness.twoOfAKindOneSitting',
];

describe('what the matrix reaches', () => {
  it('leaves exactly the rules recorded as unreachable, and no others', async () => {
    const cold = [];
    for (const f of fs.readdirSync(RULES_DIR).filter((x) => x.endsWith('.rules.js'))) {
      const m = await import(path.join(RULES_DIR, f));
      for (const r of m.RULES || []) {
        if (!(fired.get(`${m.TITLE}·${r.id}`) || 0)) cold.push(`${f.replace('.rules.js', '')}.${r.id}`);
      }
    }
    // BOTH DIRECTIONS FAIL, AND THE SECOND IS THE GOOD NEWS. A rule that has gone cold is a path
    // that stopped being taken; a rule that has gone hot is a scenario doing more than it was
    // written to do, and the list should be shortened to say so.
    expect(cold.sort(), 'the set of unreachable rules has changed — see COLD in this file')
      .toEqual([...COLD].sort());
  });
});

/**
 * Two paths, one physical situation — do they agree?
 *
 * **THIS IS THE HALF A SNAPSHOT CANNOT DO.** A frozen packet proves one experiment has not
 * changed. It cannot say a new one is right, and it cannot see the failure this toolkit keeps
 * meeting: the same physical fact computed twice, in two places, free to disagree.
 * `design/assay.js` says so about itself — the well map is *"recomputed the same way rather than
 * carried, because the pick sheet and this one disagreeing about A2 is worse than either of them
 * being wrong alone."* Nothing checked that they agree. These do.
 *
 * Each comparison records whether it HOLDS today. One does not, and is recorded rather than
 * quietly tolerated, because the fix turns on a domain question nobody has answered.
 */
describe('two paths, one physical situation', () => {
  /** Which session of a packet an operation lands in, or null where the packet has none. */
  const sessionOf = (packet, op) =>
    packet.sheets.findIndex((sh) => (sh.metadata.operations || []).includes(op));

  /**
   * **A COMPARISON THAT SKIPPED EVERY SCENARIO WOULD PASS, AND THAT IS THE DEFECT THIS WHOLE FILE
   * IS ABOUT.** Each of these walks the matrix and steps over the scenarios it cannot speak about
   * — one with no assay has no well map to check — so the guards are right and they are also how a
   * comparison quietly stops comparing: narrow one scenario, or rename an operation, and the loop
   * runs twenty-seven times and asserts nothing.
   *
   * So each one counts what it actually looked at and says so. The number is asserted, not
   * printed: a count nobody checks is the same as no count.
   */
  const checked = (n, what) => {
    expect(n, `${what}: this comparison looked at no scenario at all — its guards are stepping `
      + 'over everything, so it is green and checking nothing').toBeGreaterThan(0);
  };

  // ── 1 ────────────────────────────────────────────────────────────────────────────────────────
  // **NOTHING THAT USES A VERIFIED CONSTRUCT HAPPENS BEFORE THE VERDICT.**
  //
  // The edge exists to be walked: `cfToJobs § verifiers` makes every later step on a construct
  // wait for the analysis that verifies it. It was reachable only from an INJECTED verification
  // chain, because only the injector wrote `verifies=`, and both fixtures inject. A file that
  // declares its four verification steps got no edge at all, and `binReactions` — correct by its
  // own rule, given the graph it was handed — put a Mach1 verification pick and a B. subtilis host
  // pick on one page, weeks apart and in two organisms.
  it('a verdict comes before everything that uses what it verified', () => {
    let seen = 0;
    for (const spec of SPECS) {
      const r = got.get(spec.id);
      if (r.outcome !== 'compiles') continue;
      const analysis = sessionOf(r.packet, 'analysis');
      const retransform = sessionOf(r.packet, 'retransform');
      if (analysis < 0 || retransform < 0) continue;
      seen += 1;
      expect(analysis, `${spec.id}: the electroporation is scheduled at or before the sequence `
        + 'analysis that is supposed to justify it').toBeLessThan(retransform);
    }
    checked(seen, 'a verdict comes before what uses it');
  });

  // **AND A DECLARED ANALYSIS KNOWS WHICH CLONES IT IS ABOUT**, which is the same derivation seen
  // from the sheet rather than from the graph. One verdict box for thirty clones is what the
  // absence looked like on paper.
  it('an analysis has one row per clone, however the verification got there', () => {
    let seen = 0;
    for (const spec of SPECS) {
      const r = got.get(spec.id);
      if (r.outcome !== 'compiles') continue;
      const sh = r.packet.sheets.find((x) => (x.metadata.operations || []).includes('analysis'));
      if (!sh) continue;
      seen += 1;
      // ONE ROW PER CLONE PER CONSTRUCT. Four plasmids picked four ways is sixteen verdicts, not
      // four: the analysis bins across constructs and each clone is judged on its own.
      const want = spec.clones * spec.constructs;
      expect(sh.samples.length, `${spec.id}: ${sh.samples.length} verdict row(s) for `
        + `${want} clone(s)`).toBe(want);
      for (const row of sh.samples) {
        expect(String(row.reads || ''), `${spec.id}: a verdict row with no read to judge`)
          .not.toBe('');
      }
    }
    checked(seen, 'one verdict row per clone');
  });

  // ── 2 ────────────────────────────────────────────────────────────────────────────────────────
  // **THE WELL MAP THE ASSAY DRAWS IS THE LAYOUT THE PICK PROPOSED.**
  //
  // Two computations of one fact, in two files, two sessions apart. A plate reader returns a grid
  // of numbers and a grid with no key is not data — so if these ever disagree, the number read out
  // of A2 is attributed to whatever the other page thinks is in A2.
  it('the assay reads the wells the pick filled', () => {
    let seen = 0;
    for (const spec of SPECS) {
      const r = got.get(spec.id);
      if (r.outcome !== 'compiles') continue;
      const pick = r.packet.sheets.find((x) => (x.metadata.operations || []).includes('culture'));
      const assay = r.packet.sheets.find((x) => (x.metadata.operations || []).includes('assay'));
      if (!pick || !assay) continue;
      const filled = pick.samples.map((x) => String(x.well || '')).filter(Boolean);
      const map = (assay.blocks.find((b) => b.kind === 'table' && b.rows?.[0]?.[0] === 'well')
                   || { rows: [[]] }).rows.slice(1).map((row) => String(row[0]));
      if (!filled.length) continue;
      seen += 1;
      for (const w of filled) {
        expect(map, `${spec.id}: the pick fills ${w} and the assay's well map does not mention it`)
          .toContain(w);
      }
    }
    checked(seen, "the assay reads the pick's wells");
  });

  // ── 3 ────────────────────────────────────────────────────────────────────────────────────────
  // **THE SAME FOUR COLONIES, NAMED THE SAME WAY, HOWEVER THE PICK GOT ONTO THE PLAN.**
  //
  // `minimal` and `declared-verification` are one experiment: a plasmid, four colonies picked,
  // minipreped and read. The only difference is whether the characterization file says so. They
  // used to disagree about the most basic thing on the page:
  //
  //     declared   4 rows, labelled Dee, Def, Deg, Deh — four of the packet's running letters
  //     injected   1 row,  labelled Mie                — one name for four culture tubes
  //
  // Both were wrong, and neither was visible from inside its own path: `expandClones` fixed the
  // declared half only, because it runs inside `extractJobsFromCFs` while the injector runs later
  // on bins; and the running letter is the second naming scheme `design/miniprep.js` argues
  // against — *"it makes little sense to refer to them as L3h when you are also naming them B."*
  //
  // JCA, 2026-09-15, settling it: *"When you pick colonies, you put like pBET8-C on the tube. So,
  // the clone designation is determined during picking. The labsheets presume a certain number of
  // colonies and thus a specific bag of letters, is used."*
  it('picks the same colonies under the same names, declared or injected', () => {
    const pickOf = (id) => got.get(id).packet.sheets
      .find((x) => (x.metadata.operations || []).includes('pick'));
    const a = pickOf('minimal');
    const b = pickOf('declared-verification');
    expect(a.samples.length, 'one label for four culture tubes').toBe(4);
    expect(a.samples.map((r) => r.label)).toEqual(['pS-A', 'pS-B', 'pS-C', 'pS-D']);
    // THE TWO PATHS, ROW FOR ROW. `from plate` differs — the packet's letter for the plate is
    // minted per experiment and these are two experiments — so the comparison is of what is
    // written on the tubes and what is in them.
    expect(a.samples.map((r) => `${r.label} <- ${r.clone}`))
      .toEqual(b.samples.map((r) => `${r.label} <- ${r.clone}`));
  });

  // AND THE NAME SURVIVES THE WHOLE CHAIN, which is the reason for choosing it: the colony is
  // picked into `pBET8-C`, grown, minipreped into `pBET8-C`, and submitted as `pBET8-C`. A label
  // that changes at each step is one that has to be cross-referenced at each step.
  it('a tube keeps its name from the colony to the miniprep', () => {
    let seen = 0;
    for (const id of ['minimal', 'declared-verification', 'five-clones', 'one-clone']) {
      const sheets = got.get(id).packet.sheets;
      const pick = sheets.find((x) => (x.metadata.operations || []).includes('pick'));
      const prep = sheets.find((x) => (x.metadata.operations || []).includes('miniprep'));
      if (!pick || !prep) continue;
      const picked = pick.samples.map((r) => r.label).filter(Boolean);
      if (!picked.length) continue;          // a block: the well is the identity, not a label
      seen += 1;
      expect(prep.samples.map((r) => r.label), `${id}: the miniprep renames what was picked`)
        .toEqual(picked);
    }
    checked(seen, 'a tube keeps its name');
  });
});

/**
 * The decisions nobody has ruled on, held as an exact set the way `COLD` holds the cold rules.
 *
 * JCA, 2026-09-16: *"How complete are we though?"* — and the honest answer has two halves. A rule or
 * a design being REACHED is what the suite above measures, and it says only that the path does not
 * crash. A design being RULED ON means a claim on `docs/REPORT.html` showed somebody what it puts on
 * a page and they answered true or false. **Nothing but a person can give the second**, so the gap
 * between the two is worth failing on when it grows.
 *
 * **THE LIST MAY ONLY SHRINK.** A design leaving it is a claim getting written, which is the work.
 * A design joining it is a new design nobody has been shown, which is exactly the moment to notice
 * — the four-constructs collision reached production through two rules at full coverage.
 */
const UNRULED_DESIGNS = ['analysis', 'culture', 'gel', 'goldengate', 'retransform', 'stock'];

describe('what the claims page asks about', () => {
  it('leaves exactly the designs recorded as having no claim', async () => {
    const { coverage } = await import('../../src/labplanner/scenarios/coverage.js');
    const cov = await coverage();
    expect(cov.designs.filter((d) => !d.ruled).map((d) => d.id).sort(),
      'the set of designs no claim asks about has changed — see UNRULED_DESIGNS in this file')
      .toEqual([...UNRULED_DESIGNS].sort());
    // AND EVERY DESIGN STILL RUNS. A design dropping out of the matrix would empty its claim of
    // evidence without emptying the claim, which is the one failure this page cannot show.
    expect(cov.designs.filter((d) => !d.reached).map((d) => d.id)).toEqual([]);
  }, 60_000);
});
