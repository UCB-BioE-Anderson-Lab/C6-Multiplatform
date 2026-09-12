/**
 * One labsheet is one person doing one work session — and the pairing is remembered, not re-derived.
 *
 * JCA, 2026-09-11: *"KISS and make it one labsheet per person… 1 sheet per work session."* And,
 * 2026-09-12: *"Remembering pre-done orderings of labsheets, and being able to reference past
 * experiments for sequences of events is definitely something we will want as part of labplanner.
 * Like, the user can say 'do it like the Tlib3 experiment' and you can understand that as a step
 * sequence."*
 *
 * `binReactions` answers which steps MAY share a sheet — reachability, and that is exact. A
 * sequence answers which SHOULD, which is about how long a person can stand at a bench. The first
 * is a graph property and the second is lab knowledge, so the second is data.
 */
import { describe, it, expect } from 'vitest';
import { groupIntoSessions } from '../src/labplanner/planning/sessions.js';
import { SEQUENCES, sequenceNamed, bestSequenceFor }
  from '../src/labplanner/planning/sequences/index.js';

const FULL = ['pcr', 'gel', 'zymo', 'goldengate', 'transform', 'pick', 'miniprep',
              'sequencing', 'analysis', 'retransform', 'pick', 'culture', 'assay'];
const bins = (ops) => ops.map((operation, index) => ({ operation, index }));
const names = (ops, seq) => groupIntoSessions(bins(ops), seq).sessions.map((s) => s.name);

describe('session sequences', () => {
  it('reproduces the nine sessions JCA gave for Lactis3', () => {
    expect(names(FULL, sequenceNamed('clone-and-characterize'))).toEqual([
      'PCR',
      'Gel, cleanup and assembly',
      'Transformation',
      'Picking',
      'Miniprep and sequencing',
      'Sequence analysis',
      'Electroporation',
      'Picking and inoculation',
      'Assay',
    ]);
  });

  it('tells the two picks apart', () => {
    // `pick` appears in two sessions of one sequence — after the cloning transformation and after
    // the electroporation. A lookup table keyed on the operation would put both on one sheet,
    // which is two organisms' colonies in one block.
    const sessions = groupIntoSessions(bins(FULL), sequenceNamed('clone-and-characterize')).sessions;
    const picks = sessions.filter((s) => s.bins.some((b) => b.operation === 'pick'));
    expect(picks.length).toBe(2);
    expect(picks[0].bins.map((b) => b.operation)).toEqual(['pick']);
    expect(picks[1].bins.map((b) => b.operation)).toEqual(['pick', 'culture']);
  });

  it('stops at the verified plasmid when there is no characterization phase', () => {
    // Not a prefix of the nine: an experiment that ends at a verified plasmid ENDS there, and
    // three empty sessions on the page read as work somebody forgot to do.
    const ops = FULL.slice(0, 9);
    expect(bestSequenceFor(ops).id).toBe('clone-only');
    expect(names(ops, bestSequenceFor(ops)).length).toBe(6);
  });

  it('picks the characterization sequence when the plan has an assay', () => {
    expect(bestSequenceFor(FULL).id).toBe('clone-and-characterize');
  });

  it('never adds or drops a step', () => {
    // A sequence is a preference about grouping. One that silently dropped a step would be a plan
    // that omits work, and the omission would look like a decision.
    for (const seq of Object.values(SEQUENCES)) {
      const { sessions } = groupIntoSessions(bins(FULL), seq);
      const got = sessions.flatMap((s) => s.bins.map((b) => b.operation));
      expect(got).toEqual(FULL);
    }
  });

  it('gives an unrecognised step its own sheet and says so', () => {
    const ops = [...FULL.slice(0, 4), 'electrocompetent', ...FULL.slice(4)];
    const { sessions, unplaced } = groupIntoSessions(bins(ops),
                                                    sequenceNamed('clone-and-characterize'));
    expect(unplaced.map((b) => b.operation)).toEqual(['electrocompetent']);
    expect(sessions.flatMap((s) => s.bins.map((b) => b.operation))).toEqual(ops);
    expect(sessions.find((s) => s.outOfShape).bins[0].operation).toBe('electrocompetent');
  });

  it('refuses to invent a sequence for a name it does not know', () => {
    expect(sequenceNamed('Tlib3')).toBe(null);
  });
});
