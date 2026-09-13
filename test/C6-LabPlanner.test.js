// test/C6-LabPlanner.test.js
//
// The file existed and was EMPTY, which vitest reports as a failed suite — so `npm test` was
// red on this branch while 70 tests passed. Filled 2026-09-10 rather than deleted: the models
// it should cover are real and finished, and a placeholder that turns the suite red is worse
// than no file at all.
//
// WHAT IS AND IS NOT COVERED, because the split is the whole point of this branch.
// `src/labplanner/models/` is implemented. Every module under `src/labplanner/planning/` is
// `export {};` — a named decomposition with nothing behind it yet. These tests exercise the
// models, and assert the planning stages are REACHABLE rather than asserting they are empty:
// asserting emptiness would fail the day somebody implements one, which is exactly backwards.
//
// Note the model helpers MUTATE and return undefined (`sheet.inputs.push(input)`), rather than
// returning a new object. The tests are written to that, not to what would be tidier.

import { describe, it, expect } from 'vitest';
import * as LabPlanner from '../src/labplanner/C6-LabPlanner.js';
import {
  createLabPacket, addSheet,
  createLabSheet, addSample, addSource, setRecipe, setMastermix, addNote,
  createMastermix, addComponent, computeComponentTotals,
} from '../src/labplanner/models/index.js';

describe('LabPlanner public surface', () => {
  it('exports Models and Planning', () => {
    expect(LabPlanner.Models).toBeTruthy();
    expect(LabPlanner.Planning).toBeTruthy();
  });

  it('names every stage the pipeline is decomposed into', () => {
    // The names ARE the design: construction file -> jobs -> choices made against inventory ->
    // injected cleanup/gel/recovery steps -> mastermixes -> labsheets. Asserting each stage is
    // reachable keeps the decomposition from silently shrinking while it is still unbuilt.
    for (const stage of [
      'CfToJobs', 'PcrProductSize', 'ChooseTemplateSample', 'ChoosePrimerSource',
      'PlanDilutions', 'ChoosePCRProgram', 'BinPCRRuns', 'InjectCleanup', 'InjectGel',
      'InjectTransformRecovery', 'MakeMastermixPlan', 'JobsToLabSheets',
    ]) {
      expect(LabPlanner.Planning, `planning stage ${stage} is missing`).toHaveProperty(stage);
    }
  });
});

describe('LabSheet', () => {
  // REWRITTEN 2026-09-12 AGAINST `docs/LABSHEET-SPEC.md`. The old model had `inputs` and
  // `outputs` — a shape nobody constructed, since `generateLabPacket` has never run — and no
  // notion of what a label is written on. The spec's sheet has `samples:` (a declared table),
  // `source:` (what to fetch), and a label that is an exact key.
  it('creates with the sections the spec names, all empty', () => {
    const s = createLabSheet({ id: 'slip5-pcr', title: 'PCR for SLIP5', operation: 'PCR',
                               tube: 'pcr', columns: ['label', 'construct'] });
    expect(s.id).toBe('slip5-pcr');
    expect(s.operation).toBe('PCR');
    expect([s.samples, s.sources, s.notes, s.blocks, s.open]).toEqual([[], [], [], [], []]);
    expect(s.recipe).toBe(null);
  });

  it('accumulates samples, sources and notes', () => {
    const s = createLabSheet({ id: 's', title: 't', operation: 'PCR', tube: 'pcr',
                               columns: ['label', 'construct'] });
    addSample(s, { label: '1', construct: 'frag1' });
    addSource(s, { what: 'pGhost16', box: 'boxA', well: 'C1' });
    addNote(s, 'watch the blue front');
    expect(s.samples).toHaveLength(1);
    expect(s.sources).toHaveLength(1);
    expect(s.notes).toContain('watch the blue front');
  });

  it('refuses a row that does not match the declared columns', () => {
    // `tube` and `product` stood as headers for two weeks because nothing compared a row to a
    // contract. This is that comparison.
    const s = createLabSheet({ id: 's', operation: 'PCR', tube: 'pcr',
                               columns: ['label', 'construct'] });
    expect(() => addSample(s, { tube: '1', product: 'frag1' })).toThrow(/not declared/);
  });

  it('refuses a label too long for what it is written on', () => {
    const pcr = createLabSheet({ id: 'p', operation: 'PCR', tube: 'pcr', columns: ['label'] });
    expect(() => addSample(pcr, { label: 'pcr1' })).toThrow(/200 µL PCR strip tube/);
    // A miniprep is NAMED, and checking it against a strip tube's limit flags every correct row.
    const mp = createLabSheet({ id: 'm', operation: 'Miniprep', tube: 'micro',
                                columns: ['label'] });
    expect(() => addSample(mp, { label: 'pBET8-A' })).not.toThrow();
  });

  it('refuses two rows under one label', () => {
    // A label is a key. Two tubes under one key are two tubes nobody can tell apart, and the
    // sheet is where that becomes physical.
    const s = createLabSheet({ id: 's', operation: 'PCR', tube: 'pcr', columns: ['label'] });
    addSample(s, { label: '1' });
    expect(() => addSample(s, { label: '1' })).toThrow(/used twice/);
  });

  it('refuses a side label on a tube with no side', () => {
    const s = createLabSheet({ id: 's', operation: 'PCR', tube: 'pcr',
                               columns: ['label', 'side-label'] });
    expect(() => addSample(s, { label: '1', 'side-label': 'frag1' }))
      .toThrow(/no side to write on/);
  });

  it('carries a recipe and a mastermix', () => {
    const s = createLabSheet({ id: 's', title: 't', operation: 'PCR', tube: 'pcr' });
    setRecipe(s, { id: 'r' });
    setMastermix(s, createMastermix({
      id: 'mm', title: 'PCR mastermix', operation: 'PCR',
      reaction_count: 3, excess_factor: 1.1,
    }));
    expect(s.recipe).toBeTruthy();
    expect(s.mastermix).toBeTruthy();
  });
});

describe('LabPacket', () => {
  it('is an ordered set of LabSheets — one per operation type per run', () => {
    const p = createLabPacket({ id: 'slip5' });
    expect(p.sheets).toEqual([]);
    addSheet(p, createLabSheet({ id: 'a', title: 'PCR', operation: 'PCR', tube: 'pcr' }));
    addSheet(p, createLabSheet({ id: 'b', title: 'Gel', operation: 'Gel' }));
    expect(p.sheets.map((s) => s.operation)).toEqual(['PCR', 'Gel']);
  });
});

describe('Mastermix', () => {
  it('scales each component by reaction count and excess factor', () => {
    // This arithmetic is why a mastermix is computed rather than typed: three reactions at
    // 1.1x is 3.3 of everything, and getting it wrong either wastes enzyme or runs a reaction
    // short — a failure that shows up as a dead PCR, days later, with no obvious cause.
    const mm = createMastermix({
      id: 'mm', title: 'PrimeSTAR', operation: 'PCR',
      reaction_count: 3, excess_factor: 1.1,
    });
    addComponent(mm, { name: 'ddH2O', volume_uL_per_reaction: 32 });
    addComponent(mm, { name: '5X PrimeSTAR GXL Buffer', volume_uL_per_reaction: 10 });

    const totals = computeComponentTotals(mm);
    expect(totals).toHaveLength(2);
    expect(totals.find((t) => t.name === 'ddH2O').total_volume_uL)
      .toBeCloseTo(32 * 3 * 1.1, 6);
    expect(totals.find((t) => t.name === '5X PrimeSTAR GXL Buffer').total_volume_uL)
      .toBeCloseTo(10 * 3 * 1.1, 6);
  });

  it('defaults to 10% excess when none is given — not to 1x, and not to zero', () => {
    // `createMastermix` defaults excess_factor to 1.1, which is a domain decision worth
    // pinning: you always want a little more than the reactions strictly need, because the
    // last reaction pipetted from a mastermix that was measured exactly comes up short.
    //
    // This test was originally written asserting 1x. The code was right and the assumption
    // was wrong — kept as the assertion it should always have been.
    const mm = createMastermix({ id: 'mm', title: 't', operation: 'PCR', reaction_count: 2 });
    addComponent(mm, { name: 'ddH2O', volume_uL_per_reaction: 10 });
    expect(computeComponentTotals(mm)[0].total_volume_uL).toBeCloseTo(10 * 2 * 1.1, 6);
  });
});
