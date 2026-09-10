// test/labplanner/validate.test.js
//
// Every case here is drawn from a real file. The checks were written on 2026-09-10 against
// defects found in UCB_iGEM_SynThera, not against imagined ones — so the tests are the same
// shapes, reduced to the smallest form that still reproduces them.
//
// A check whose founding defect it cannot reproduce does not belong in this file.

import { describe, it, expect } from 'vitest';
import {
  validateConstructionFile, unknownOperations, genericSteps, detectDialect,
  KNOWN_OPERATIONS,
} from '../../src/labplanner/validate/constructionFile.js';

const codes = (r) => r.findings.map((f) => f.code);

// SLIP5/Construction of pGhost17.txt, reduced. Parses, and is correct.
const GOOD = [
  'PCR\toGho23\toGho26\tpGhost16\t17a',
  'PCR\toGho25\toGho28\tpGhost16\t17b',
  'Gibson\t17a\t17b\tg17',
  'Transform\tg17\tJTK145 AB\tSpec\tpGhost17',
].join('\n');

// SLIP4/Construction of pGhost16.txt, reduced. Uses `Assemble` (unknown to C6), consumes S8i
// twice, and abandons S8v.
const SLIP4 = [
  'PCR\toGho19\toGho20\tpBACr899\tS8v',
  'PCR\toGho21\toGho22\tpGhost12-A\tS8i',
  'Assemble\tS8i\tS8i\tSL8',
  'Transform\tSL8\tJTK145 AB\tSpec\t37\tpGhost16',
].join('\n');

describe('a correct construction file', () => {
  it('passes with no findings', () => {
    const r = validateConstructionFile(GOOD, 'good.txt');
    expect(r.parsed).toBe(true);
    expect(r.ok).toBe(true);
    expect(r.findings).toEqual([]);
    expect(r.steps).toBe(4);
  });
});

describe('UNKNOWN_OPERATION — a toolchain gap, reported as one', () => {
  it('names the unknown verb rather than complaining about sequence format', () => {
    // The parser treats an unrecognised keyword as sequence data, so its own error reads
    // "Invalid sequence format: S8iS8iSL8" — which looks exactly like a corrupt file and is
    // not. `Assemble` is used across SynThera and Pimar and is in no alias table.
    const r = validateConstructionFile(SLIP4, 'pGhost16.txt');
    expect(codes(r)).toContain('UNKNOWN_OPERATION');
    const f = r.findings.find((x) => x.code === 'UNKNOWN_OPERATION');
    expect(f.message).toContain('Assemble');
    expect(f.message).toMatch(/TOOLCHAIN GAP/);
  });

  it('does not fire on declarations or on bare sequence lines', () => {
    expect(unknownOperations('oligo\toGho23\tACGT')).toEqual([]);
    expect(unknownOperations('plasmid\tpGhost16\tACGTACGT')).toEqual([]);
    expect(unknownOperations('ACGTACGTACGT')).toEqual([]);
    expect(unknownOperations('')).toEqual([]);
    expect(unknownOperations('# a comment')).toEqual([]);
  });

  it('agrees with the parser about which operations exist', () => {
    // KNOWN_OPERATIONS mirrors `normalizeOperation`, which is a local inside parseCF and not
    // exported. If somebody teaches the parser a new verb and this copy is not updated, every
    // file using it is reported as unknown — so the copy is asserted against the source text.
    // Scoped to the normalizeOperation block. The first version of this matched every
    // `"key": "value"` in C6-Sim.js and found sixteen, which is a test failing for a reason
    // that has nothing to do with what it claims to check.
    const src = readParserSource();
    const start = src.indexOf('const normalizeOperation = {');
    expect(start, 'normalizeOperation is gone or renamed — this check is now blind')
      .toBeGreaterThan(-1);
    const block = src.slice(start, src.indexOf('};', start));
    const mapped = [...block.matchAll(/"([a-z]+)"\s*:/g)].map((m) => m[1]).sort();

    expect(mapped, 'KNOWN_OPERATIONS has drifted from the parser\'s normalizeOperation table')
      .toEqual([...KNOWN_OPERATIONS].sort());
  });
});

describe('the structural checks still run when C6 cannot parse the file', () => {
  it('finds the duplicated input and the abandoned product in SLIP4', () => {
    // This is the point of the generic fallback. Without it the toolchain gap MASKS the real
    // defect, and the checker goes quiet exactly where a file is most unusual.
    const r = validateConstructionFile(SLIP4, 'pGhost16.txt');
    expect(codes(r)).toContain('DUPLICATE_INPUT');
    expect(codes(r)).toContain('DANGLING_PRODUCT');
    expect(r.findings.find((f) => f.code === 'DUPLICATE_INPUT').message).toContain('S8i');
    expect(r.findings.find((f) => f.code === 'DANGLING_PRODUCT').message).toContain('S8v');
  });

  it('does NOT report the assembly product as abandoned — the transform consumes it', () => {
    // A regression guard for a real bug in the first version: a generically-read `Transform`
    // matched INPUT_FIELDS.Transform = ['dna'], found nothing (generic steps use `dnas`), and
    // its input vanished — so SL8 was reported as consumed by nobody. A false "nothing uses
    // this" on a checker's first outing is what teaches somebody to ignore it.
    const r = validateConstructionFile(SLIP4, 'pGhost16.txt');
    const dangling = r.findings.filter((f) => f.code === 'DANGLING_PRODUCT');
    expect(dangling.map((f) => f.message).join(' ')).not.toContain('"SL8"');
  });

  it('marks generic readings as leads rather than verdicts', () => {
    const r = validateConstructionFile(SLIP4, 'pGhost16.txt');
    const s = r.findings.find((f) => f.code === 'DUPLICATE_INPUT');
    expect(s.message).toContain('read generically');
  });
});

describe('genericSteps', () => {
  it('keeps every mid-line token as an input, including non-DNA ones', () => {
    const steps = genericSteps(SLIP4);
    expect(steps).toHaveLength(4);
    expect(steps[3].operation).toBe('Transform');
    expect(steps[3].output).toBe('pGhost16');
    expect(steps[3].dnas).toContain('SL8');   // the one that matters
  });
});

describe('checks over a parsed file', () => {
  it('reports a product that no later step consumes', () => {
    const cf = [
      'PCR\toA\toB\tpX\tfragA',
      'PCR\toC\toD\tpX\tfragB',
      'Gibson\tfragA\tfragA\tprod',     // fragB abandoned, fragA doubled
      'Transform\tprod\tMach1\tSpec\tpFinal',
    ].join('\n');
    const r = validateConstructionFile(cf, 'x.txt');
    expect(r.parsed).toBe(true);
    expect(codes(r)).toContain('DANGLING_PRODUCT');
    expect(codes(r)).toContain('DUPLICATE_INPUT');
    expect(r.ok).toBe(false);
  });

  it('does not report inputs that were never produced — they live in the freezer', () => {
    // A construction file legitimately names oligos and existing plasmids it does not make.
    // Reporting those would make every correct file fail.
    const r = validateConstructionFile(GOOD, 'good.txt');
    expect(codes(r)).not.toContain('USE_BEFORE_PRODUCED');
  });
});


describe('legacy files — older than the published format, not a second dialect', () => {
  // Found by running the checker over every project and getting 1032 dangling-product
  // findings. The checks were fine; the files were a different dialect being read as tabular.
  const PAREN = [
    'pcr PAB2F, PAB2R on pAPAP3\t\t(10045 bp, back_C)',
    'assemble back_C,yp_pcr\t\t(BsaI, pAPAP4Yp)',
    'transform pAPAP4Yp\t\t(Mach1, Amp)',
  ].join('\n');

  it('recognises the legacy style and runs NO checks on it', () => {
    const r = validateConstructionFile(PAREN, 'pAPAP4Yp.txt');
    expect(r.dialect).toBe('legacy');
    expect(codes(r)).toEqual(['LEGACY_FORMAT']);
    expect(r.findings[0].message).toMatch(/not a defect/);
  });

  it('does not mistake a tabular file for the parenthetical one', () => {
    expect(detectDialect(GOOD)).toBe('current');
    expect(detectDialect(SLIP4)).toBe('current');
  });

  it('emits exactly one finding per unsupported file, not one per line', () => {
    // The whole point: volume is what gets a checker switched off. Three unreadable lines
    // must produce one statement, not three guesses.
    expect(validateConstructionFile(PAREN, 'x').findings).toHaveLength(1);
  });
});

function readParserSource() {
  // eslint-disable-next-line
  const fs = require('fs');
  const path = require('path');
  return fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), '../../src/C6-Sim.js'), 'utf8');
}
