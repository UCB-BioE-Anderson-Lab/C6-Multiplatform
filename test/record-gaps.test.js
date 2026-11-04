/**
 * Phase 5: did everything promised get made, and is everything made written down?
 *
 * Both halves of the lifecycle already work — `c6-issue` holds the space, `c6-receive` resolves
 * it. What nobody could ask before is the question three months later, and the two findings here
 * fail in opposite directions: freezer space held for work that stopped, and a tube in a box that
 * no plan ever mentions.
 */
import { describe, it, expect } from 'vitest';
import { recordedAgainstHeld } from '../src/labplanner/planning/recorded.js';

const hold = (construct, boxname = 'B1') => ({ why: construct, location: { boxname, row: 1, col: 1 } });
const sample = (construct, boxname = 'B1') => ({ construct, location: { boxname, row: 2, col: 3 } });

describe('held against recorded', () => {
  it('everything held and made is resolved and complete', () => {
    const out = recordedAgainstHeld([hold('pA'), hold('pB')], [sample('pA'), sample('pB')]);
    expect(out.resolved).toEqual(['pA', 'pB']);
    expect(out.unresolved).toEqual([]);
    expect(out.complete).toBe(true);
  });

  it('A HOLD WITH NO SAMPLE IS FREEZER SPACE PROMISED TO WORK THAT STOPPED', () => {
    const out = recordedAgainstHeld([hold('pA'), hold('pB', 'B7')], [sample('pA')]);
    expect(out.unresolved).toEqual([{ construct: 'pB', location: { boxname: 'B7', row: 1, col: 1 } }]);
    expect(out.complete).toBe(false);
  });

  it('A SAMPLE WITH NO HOLD IS THE HALF THAT GOES MISSING — the inventory has it, no plan names it', () => {
    const out = recordedAgainstHeld([hold('pA')], [sample('pA'), sample('pZ'), sample('pZ')]);
    expect(out.unplanned).toEqual([{ construct: 'pZ', n: 2 }]);
    // It is not a failure: the experiment is still complete against what was held.
    expect(out.complete).toBe(true);
  });

  it('matches on construct, never on well — THE SHEET WINS', () => {
    const out = recordedAgainstHeld([hold('pA', 'B1')], [{ construct: 'pA', location: { boxname: 'B9', row: 8, col: 12 } }]);
    expect(out.resolved).toEqual(['pA']);
    expect(out.unresolved).toEqual([]);
  });

  it('reads a hold that carries `construct` directly as well as one that carries `why`', () => {
    expect(recordedAgainstHeld([{ construct: 'pA' }], [sample('pA')]).resolved).toEqual(['pA']);
  });

  it('nothing issued and nothing returned is complete, not an error', () => {
    expect(recordedAgainstHeld([], [])).toEqual({ resolved: [], unresolved: [], unplanned: [], complete: true });
  });

  it('survives a hold or a sample with no construct rather than inventing one', () => {
    const out = recordedAgainstHeld([{ location: {} }, hold('pA')], [sample('pA'), { location: {} }]);
    expect(out.resolved).toEqual(['pA']);
    expect(out.unresolved).toEqual([]);
  });
});
