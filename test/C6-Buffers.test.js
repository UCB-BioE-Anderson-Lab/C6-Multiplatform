import { buffersFor, currentBuffer, NEB_ACTIVITY, NEB_BUFFERS } from 'src/C6-Buffers.js';
import REBASE from 'src/data/rebase-enzymes.json' with { type: 'json' };
import { readFileSync } from 'fs';

// Built alongside src/C6-Buffers.js, 2026-09-17. The cases that would be EXPENSIVE to get wrong
// are the three nothings: a name that was not found, an enzyme whose numbers were never looked
// up, and an enzyme whose numbers WERE looked up and came back bad. A caller that cannot tell
// those apart recommends a buffer for a digest nobody measured.

describe('the three nothings stay distinguishable', () => {
  test('an unknown name is unknown — it says nothing about buffers', () => {
    const r = buffersFor('Frobnicase');
    expect(r.status).toBe('unknown');
    expect(r.enzyme).toBe(null);
    expect(r.products).toEqual([]);
    expect(r.advice).toMatch(/NOT a finding that no buffer works/);
  });

  test('an enzyme REBASE knows but the chart does not gets a gap, not a verdict', () => {
    // HindIII is in REBASE and is not one of the twelve transcribed here.
    expect(REBASE.enzymes.HindIII).toBeTruthy();
    expect(NEB_ACTIVITY.HindIII).toBeUndefined();
    const r = buffersFor('HindIII');
    expect(r.status).toBe('found');
    expect(r.products).toEqual([]);
    expect(r.enzyme.site).toBe('AAGCTT');
    expect(r.advice).toMatch(/gap in this table, not a property of the enzyme/);
  });

  test('an enzyme with no clean 100% buffer says so as a FINDING, not as missing data', () => {
    // EcoRI: 25 / 100* / 50 / 50* — every 100 carries a star. best is legitimately empty.
    const p = buffersFor('EcoRI').products.find((x) => x.product === 'EcoRI');
    expect(p.best).toEqual([]);
    expect(p.starRisk).toEqual(['r2.1', 'rCutSmart']);
    expect(buffersFor('EcoRI').advice).toMatch(/NO standard NEBuffer reaches 100%/);
    expect(buffersFor('EcoRI').advice).toMatch(/measured finding, not missing data/);
  });
});

describe('a star is never rounded away', () => {
  test('100* does not count as a usable 100', () => {
    const p = buffersFor('BamHI').products.find((x) => x.product === 'BamHI');
    expect(p.activity['r2.1'].raw).toBe('100*');
    expect(p.activity['r2.1'].percent).toBe(100);
    expect(p.activity['r2.1'].star).toBe(true);
    expect(p.best).toEqual(['r3.1']);          // the only 100 without a star
    expect(p.workable).toEqual(['r3.1']);
  });

  test('<10 is a bound, not the number 10, and never lands in workable', () => {
    const p = buffersFor('BglII').products[0];
    expect(p.activity.rCutSmart.raw).toBe('<10');
    expect(p.activity.rCutSmart.below).toBe(true);
    expect(p.workable).not.toContain('rCutSmart');
    expect(p.avoid).toContain('rCutSmart');
  });
});

describe('a renamed enzyme is not silently answered with a different protein', () => {
  test('BsaI returns HFv2 numbers and says whose they are', () => {
    const r = buffersFor('BsaI');
    expect(r.status).toBe('renamed');
    expect(r.products.map((p) => p.product)).toEqual(['BsaI-HFv2']);
    expect(r.advice).toMatch(/ENGINEERED enzyme and not the same protein/);
  });

  test('SpeI is NOT a rename — NEB still sells it — so the flag is different', () => {
    const r = buffersFor('SpeI');
    expect(r.status).toBe('found');
    expect(r.products.map((p) => p.product)).toEqual(['SpeI-HF']);
    expect(r.advice).toMatch(/SpeI itself is on no row of the chart/);
    expect(r.advice).not.toMatch(/ENGINEERED/);
  });

  test("EcoRI's prefix match does not swallow EcoRV", () => {
    expect(buffersFor('EcoRI').products.map((p) => p.product)).toEqual(['EcoRI', 'EcoRI-HF']);
    expect(buffersFor('EcoRV').products.map((p) => p.product)).toEqual(['EcoRV', 'EcoRV-HF']);
  });
});

describe('methylation is absent, never empty', () => {
  test('PstI lists none in REBASE and so reports undefined, not {}', () => {
    // {} would read as "nothing blocks it". REBASE listed nothing, which is not the same claim.
    expect(REBASE.enzymes.PstI.methylation).toBeUndefined();
    expect(buffersFor('PstI').enzyme.methylation).toBeUndefined();
    expect(buffersFor('PstI').advice).not.toMatch(/methylation/);
  });

  test('XbaI is dam-blocked and says so — the layer the chart alone would have lost', () => {
    expect(buffersFor('XbaI').enzyme.methylation).toEqual({ Dam: 'blocked' });
    expect(buffersFor('XbaI').advice).toMatch(/Dam blocked/);
  });
});

describe('the buffer rename that started this', () => {
  test('NEB Buffer 2, however a protocol spells it, is r2.1', () => {
    for (const spelling of ['NEB Buffer 2', 'NEBuffer 2', 'NEBuffer 2.1']) {
      const r = currentBuffer(spelling);
      expect(r.current).toBe('r2.1');
      expect(r.renamed).toBe(true);
    }
  });

  test('NEBuffer 4 became CutSmart, not "4.1"', () => {
    expect(currentBuffer('NEBuffer 4').current).toBe('rCutSmart');
    expect(currentBuffer('CutSmart').current).toBe('rCutSmart');
  });

  test('a current name is not reported as a rename', () => {
    const r = currentBuffer('rCutSmart');
    expect(r.renamed).toBe(false);
    expect(r.composition).toBe(NEB_BUFFERS.rCutSmart.composition);
  });

  test("another supplier's buffer is unrecognised, not denied", () => {
    const r = currentBuffer('Promega H');
    expect(r.current).toBe(null);
    expect(r.note).toMatch(/not the same as saying no such buffer exists/);
  });
});

describe('the two layers agree with each other and with C6-Sim', () => {
  test("C6-Sim's own enzyme table matches REBASE on every row", () => {
    const src = readFileSync('src/C6-Sim.js', 'utf8');
    const re = /^\s*(\w+):\s*\{recognitionSequence:\s*"(\w+)",\s*cut5:\s*(-?\d+),\s*cut3:\s*(-?\d+)\}/gm;
    const rows = [...src.matchAll(re)];
    expect(rows.length).toBeGreaterThan(10);
    for (const [, name, site, c5, c3] of rows) {
      const r = REBASE.enzymes[name];
      expect(r, `${name} missing from REBASE`).toBeTruthy();
      expect([r.site, r.cut5, r.cut3], `${name} disagrees with REBASE`)
        .toEqual([site, Number(c5), Number(c3)]);
    }
  });

  test('every transcribed chart row names a real REBASE enzyme or a product of one', () => {
    for (const product of Object.keys(NEB_ACTIVITY)) {
      const proto = product.replace(/-(HF|HFv\d|v\d)$/, '');
      expect(REBASE.enzymes[proto], `${product} → ${proto} not in REBASE`).toBeTruthy();
    }
  });

  test('every chart row has all four buffers and they parse', () => {
    for (const [product, row] of Object.entries(NEB_ACTIVITY)) {
      for (const b of ['r1.1', 'r2.1', 'r3.1', 'rCutSmart']) {
        expect(row[b], `${product} ${b}`).toMatch(/^(<?\d{1,3})\*?$/);
      }
      expect(row.supplied === 'U' || NEB_BUFFERS[row.supplied], `${product} supplied`).toBeTruthy();
    }
  });

  test('all twelve enzymes JCA named are answerable', () => {
    const asked = ['EcoRI', 'BamHI', 'BglII', 'XhoI', 'EcoRV', 'PvuII',
                   'PstI', 'XbaI', 'SpeI', 'BsaI', 'BsmBI', 'BseRI'];
    for (const e of asked) {
      const r = buffersFor(e);
      expect(r.status, e).not.toBe('unknown');
      expect(r.products.length, `${e} has no chart row`).toBeGreaterThan(0);
    }
  });
});
