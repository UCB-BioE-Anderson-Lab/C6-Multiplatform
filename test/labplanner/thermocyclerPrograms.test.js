/**
 * Thermocycler programs: every name a labsheet uses is defined, and an undefined one is
 * told apart from an undefined-but-in-use one.
 *
 * WHY THIS EXISTS. On 2026-10-14 a student asked which thermocycler program to run a Gibson
 * on, because the machine had no Gibson setting. GIB2 was named on three issued labpackets
 * and defined nowhere. `src/labplanner/data/thermocycler_programs/` held exactly one file,
 * PG4K55, imported by nothing — while the labsheets actually named PG6K55 thirteen times,
 * PG8K55 five, GIB2 three and PG6K45 twice. Nothing checked, so nothing said.
 */

import { describe, it, expect } from 'vitest';
import { PROGRAMS, program, runtimeSeconds }
  from '../../src/labplanner/data/thermocycler_programs/index.js';
import { checkPacket, namesIn }
  from '../../src/labplanner/validate/thermocyclerPrograms.js';

// The names the labsheets and construction files in the lab's repositories actually use.
const IN_USE = ['PG6K55', 'PG8K55', 'GG1', 'GIB2', 'PG6K45', 'PG4K55'];

describe('the programs the lab actually runs are defined', () => {
  it('every name used by an issued labsheet resolves', () => {
    for (const n of IN_USE) expect(program(n), `${n} is used and must be defined`).toBeTruthy();
  });

  it('the PrimeSTAR family encodes its own parameters, and the steps agree', () => {
    // PG<size>K<anneal>, extension 1 min/kb. A name that disagrees with its steps is the
    // error this check exists for — eight near-identical files are exactly where a 55 ends
    // up where a 45 belongs.
    for (const kb of [2, 4, 6, 8]) {
      for (const anneal of [45, 55]) {
        const p = program(`PG${kb}K${anneal}`);
        const cycle = p.steps.find((s) => s.kind === 'cycle');
        const [, annealStep, extendStep] = cycle.steps;
        expect(annealStep.temp_c, `PG${kb}K${anneal} anneals at ${anneal}`).toBe(anneal);
        expect(extendStep.time_s, `PG${kb}K${anneal} extends 1 min/kb`).toBe(kb * 60);
      }
    }
  });

  it('GG1 reproduces the 195 minutes the old protocol module computed by hand', () => {
    // protocols/modules/golden_gate_assembly.js carries `{ label: 'GG1 on the thermocycler',
    // min: 195 }`, worked out from the steps in a comment. Moving the program must not
    // change what it means; this is the cross-check that it did not.
    expect(runtimeSeconds('GG1') / 60).toBe(195);
  });
});

describe('unknown and incomplete are different findings', () => {
  it('a program nobody defined is an ERROR — probably a typo, and it sends somebody to a machine to hunt', () => {
    const r = checkPacket({ metadata: { program: 'GIB3' } });
    expect(r.ok).toBe(false);
    expect(r.unknown).toEqual(['GIB3']);
  });

  it('a program in use whose conditions are unrecorded is a WARNING, and does NOT fail the sheet', () => {
    // Three labpackets already name GIB2 and already compile. Failing them would punish the
    // sheets for a gap in the data; the gap is the thing to fix.
    const r = checkPacket({ metadata: { program: 'GIB2' } });
    expect(r.ok).toBe(true);
    expect(r.incomplete[0].name).toBe('GIB2');
    expect(r.incomplete[0].unknown[0]).toMatch(/duration/);
  });

  it('an incomplete program has NO runtime, and null is not zero', () => {
    // Returning 0 would schedule a multi-hour PCR as instantaneous and promise a student a
    // slot that cannot exist.
    expect(runtimeSeconds('GIB2')).toBeNull();
    expect(runtimeSeconds('TAQ45')).toBeNull();
    expect(runtimeSeconds('PG6K55')).toBeGreaterThan(0);
  });

  it('a terminal 16 C hold is time_s 0 and means infinite — the one zero that means zero', () => {
    for (const n of ['PG6K55', 'PGXL4', 'GG1']) {
      const last = program(n).steps[program(n).steps.length - 1];
      expect(last.temp_c, `${n} ends on a hold`).toBe(16);
      expect(last.time_s).toBe(0);
    }
  });
});

describe('reading a real labpacket', () => {
  it('finds every program named anywhere in it', () => {
    const packet = { sections: [{ metadata: { program: 'PG6K55' } },
                                { metadata: { program: 'GIB2' } }] };
    expect(namesIn(packet)).toEqual(['GIB2', 'PG6K55']);
  });

  it('every program in the index declares either steps or why not', () => {
    for (const [name, p] of Object.entries(PROGRAMS)) {
      if (p.steps === null) {
        expect(p.incomplete, `${name} has no steps and must say it is incomplete`).toBe(true);
        expect(p.why_unknown, `${name} must say WHY it is unknown`).toBeTruthy();
      } else {
        expect(Array.isArray(p.steps), `${name} has steps`).toBe(true);
      }
    }
  });
});
