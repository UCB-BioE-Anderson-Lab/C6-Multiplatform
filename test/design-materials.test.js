/**
 * The materials search: does it rank without excluding, and does it keep the three kinds of
 * nothing apart.
 *
 * **THE TESTS THAT MATTER ARE THE ABSENCE ONES.** A ranked list is easy and nobody is misled by
 * a bad order. What misleads is a search that reports an empty result from an unreachable
 * collection the same way it reports an empty result from a collection it read to the end.
 */
import { describe, it, expect } from 'vitest';
import { rankCandidates, materialsForGoal } from '../src/design/materials.js';

const part = (id, type, Sequence) => ({ id, type, props: Sequence ? { Sequence } : {} });

const FREEZER = {
  name: 'minus80', confidence: 0.9, label: 'verified -80 tube',
  parts: [part('J23100', 'Promoter', 'TTGACGGCTAGCTCAGTCCTAGGTACAGTGCTAGC'), part('gfp', 'ORF', 'ATGAGTAAAGGA')],
};
const STOCKS = {
  name: 'plasmid-stocks', confidence: 0.4, label: 'plasmid stock, unverified',
  parts: [part('J23116', 'Promoter'), part('rfp', 'ORF', 'ATGGCTTCCTCC')],
};
const SEQONLY = { name: 'seqlib', confidence: 0.1, label: 'sequence only, no tube', parts: [part('J23106', 'Promoter', 'TTGACA')] };

const GOAL = {
  id: 'g', title: 't', intent: 'i', host: { organism: 'E. coli' },
  devices: [{ name: 'cassette', slots: [{ type: 'Promoter' }, { type: 'ORF' }, { type: 'Terminator' }] }],
};

describe('ranking one slot', () => {
  const out = rankCandidates({ type: 'Promoter' }, [FREEZER, STOCKS, SEQONLY]);

  it('RETURNS EVERY CANDIDATE, including the least trusted', () => {
    expect(out.found).toBe(3);
    expect(out.candidates.map((c) => c.id)).toContain('J23106');
    expect(out.candidates.map((c) => c.id)).toContain('J23116');
  });

  it('orders by the source\'s own declared confidence', () => {
    expect(out.candidates[0].id).toBe('J23100');
    expect(out.candidates[0].confidence).toBe(0.9);
  });

  it('best is a recommendation ON TOP of the full list, not a filter applied to it', () => {
    const three = rankCandidates({ type: 'Promoter' }, [FREEZER, STOCKS, SEQONLY], { n: 1 });
    expect(three.best).toHaveLength(1);
    expect(three.candidates).toHaveLength(3);
  });

  it('carries the source label through, because a number is not an instruction', () => {
    expect(out.candidates[0].label).toBe('verified -80 tube');
    expect(out.candidates.find((c) => c.id === 'J23116').label).toBe('plasmid stock, unverified');
  });

  it('explains every candidate, so a person can discount what they disagree with', () => {
    expect(out.candidates[0].why.join(' ')).toMatch(/carries a sequence/);
    expect(out.candidates.find((c) => c.id === 'J23116').why.join(' ')).toMatch(/no sequence yet/);
  });

  it('a sequence outranks none at equal confidence, and that is the only judgement made', () => {
    const same = { name: 'x', confidence: 0.5, parts: [part('withSeq', 'ORF', 'ATGC'), part('noSeq', 'ORF')] };
    const r = rankCandidates({ type: 'ORF' }, [same]);
    expect(r.candidates[0].id).toBe('withSeq');
    expect(r.candidates[0].score).toBeGreaterThan(r.candidates[1].score);
  });

  it('a pinned slot only matches that part', () => {
    const r = rankCandidates({ type: 'ORF', id: 'gfp' }, [FREEZER, STOCKS]);
    expect(r.candidates.map((c) => c.id)).toEqual(['gfp']);
  });
});

describe('the three kinds of nothing', () => {
  it('A TYPE NOTHING CAN FILL IS NAMED, with its device', () => {
    const out = materialsForGoal(GOAL, [FREEZER, STOCKS]);
    expect(out.unfilled).toEqual([{ device: 'cassette', type: 'Terminator', id: undefined }]);
  });

  it('AN UNREADABLE SOURCE IS NAMED WITH ITS REASON, never silently skipped', () => {
    const broken = { name: 'an-old-stock-list', unreadable: 'stock list not found at the declared path' };
    const out = materialsForGoal(GOAL, [FREEZER, broken]);
    expect(out.unreadable).toEqual([{ name: 'an-old-stock-list', reason: 'stock list not found at the declared path' }]);
    expect(out.read).toEqual(['minus80']);
  });

  it('an empty result from an unreachable source does not read like an empty freezer', () => {
    const only = materialsForGoal(GOAL, [{ name: 'everything', unreadable: 'mount moved' }]);
    expect(only.read).toEqual([]);
    expect(only.unreadable).toHaveLength(1);
    // Every slot is unfilled, but the reason is visible rather than implied.
    expect(only.unfilled).toHaveLength(3);
  });

  it('names which sources actually answered, so a thin result can be weighed', () => {
    const out = materialsForGoal(GOAL, [FREEZER, STOCKS, SEQONLY]);
    expect(out.read).toEqual(['minus80', 'plasmid-stocks', 'seqlib']);
  });

  it('fills what it can and reports per slot', () => {
    const out = materialsForGoal(GOAL, [FREEZER, STOCKS, SEQONLY], { n: 2 });
    const slots = out.devices[0].slots;
    expect(slots.map((s) => s.found)).toEqual([3, 2, 0]);
    expect(slots[0].best).toHaveLength(2);
  });
});
