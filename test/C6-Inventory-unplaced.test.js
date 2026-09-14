/**
 * A tube can be in a box without being in a known well, and that is a record, not a hole.
 *
 * JCA, 2026-09-12: *"pJ01 is in the pink training box in the enzyme freezer. There is also one in
 * the control stocks box. It's well gets moved around, but it's in there."*
 *
 * That is how a working freezer behaves — the box is stable, the well is not — and the model could
 * not hold it. `locKey` is `box:row:col`, so no well meant no key, so the tabular reader skipped
 * the row, so every query answered **"no tube of pJ01 is in the inventory"** about a tube somebody
 * could put their hand on.
 *
 * SynThera's inventory already carried six of these and said so in its own header: *"they carry no
 * well, so C6's inventory model SKIPS them. This file holds 43 samples and a query over it sees
 * 37."* A count that silently disagrees with its source is how somebody concludes a tube was never
 * made.
 */
import { describe, it, expect } from 'vitest';
import { ensureInventory } from '../src/inventory/io.js';
import { findByConstruct } from '../src/inventory/query.js';
import { isUnplaced } from '../src/inventory/inventory.js';
import { chooseTemplateSample } from '../src/labplanner/planning/chooseTemplateSample.js';

const TSV = [
  'construct\tlabel\ttype\tconcentration\tbox\twell',
  'pJ01\tpJ01\tplasmid\tminiprep\tPink Training\t',
  'pJ01\tpJ01\tplasmid\tminiprep\tControl Stocks\t',
  'pTRKH3\tpTRKH3\tplasmid\tminiprep\tControl Stocks\t',
  'pOTHER\tpOTHER\tplasmid\tminiprep\tControl Stocks\tB4',
  '\t\t\t\t\t',
].join('\n');

const inv = ensureInventory(TSV, 'shared.tsv');

describe('samples with a box and no well', () => {
  it('are read rather than skipped', () => {
    expect(findByConstruct(inv, 'pJ01').length).toBe(2);
    expect(findByConstruct(inv, 'pTRKH3').length).toBe(1);
  });

  it('do not collide with each other', () => {
    // `box:null:null` is one key, so two unplaced tubes in one box would be one tube. The second
    // would vanish, and nothing would say which.
    const boxes = findByConstruct(inv, 'pJ01').map((s) => s.location.boxname).sort();
    expect(boxes).toEqual(['Control Stocks', 'Pink Training']);
  });

  it('keep their box even when the box holds no placed sample at all', () => {
    expect(Object.keys(inv.boxes).sort()).toEqual(['Control Stocks', 'Pink Training']);
  });

  it('are distinguishable from placed ones', () => {
    expect(isUnplaced(findByConstruct(inv, 'pJ01')[0])).toBe(true);
    expect(isUnplaced(findByConstruct(inv, 'pOTHER')[0])).toBe(false);
  });

  it('do not turn a blank line into a sample', () => {
    expect(Object.keys(inv.samples).length).toBe(4);
  });
});

describe('what a labsheet is told', () => {
  it('names the box, refuses to invent the well, and says where else it is', () => {
    const got = chooseTemplateSample(inv, 'pJ01');
    expect(got.status).toBe('box-only');
    expect(got.where.box).toBe('Pink Training');
    expect(got.where.well).toBe('');
    expect(got.note).toContain('Also in Control Stocks');
  });

  it('still gives a plain location for a tube somebody pinned down', () => {
    const got = chooseTemplateSample(inv, 'pOTHER');
    expect(got.status).toBe('ready');
    expect(got.where.well).toBe('B4');
  });

  it('says absent only when it really is absent', () => {
    expect(chooseTemplateSample(inv, 'pNOWHERE').status).toBe('absent');
  });
});

/**
 * The note describes a tube; it must not read as an instruction.
 *
 * JCA, 2026-09-12, of a note reading "in Control Stocks; the well is not recorded — miniprep":
 * *"sounds like you are asking them to miniprep something."*
 *
 * The cause is that the inventory's `concentration` column holds the word `miniprep` — a noun in
 * the file and a verb on a labsheet. A labsheet is read in a hurry, and a bare verb at the end of
 * a line is an instruction.
 */
describe('how a source reads', () => {
  const withConc = (c) => ensureInventory([
    'construct\tlabel\ttype\tconcentration\tbox\twell',
    `pX\tpX\tplasmid\t${c}\tControl Stocks\t`,
  ].join('\n'), 'x.tsv');

  it('does not end a line with a bare verb', () => {
    const note = chooseTemplateSample(withConc('miniprep'), 'pX').note;
    expect(note).not.toMatch(/—\s*miniprep\.?$/);
    expect(note).toContain('miniprep DNA');
  });

  it('leads with what the tube is, then where it is', () => {
    const note = chooseTemplateSample(withConc('miniprep'), 'pX').note;
    expect(note.indexOf('miniprep DNA')).toBeLessThan(note.indexOf('Control Stocks'));
  });

  it('keeps a concentration that is a concentration', () => {
    expect(chooseTemplateSample(withConc('100uM'), 'pX').note).toContain('100uM stock');
  });

  it('says nothing extra when the column is empty', () => {
    expect(chooseTemplateSample(withConc(''), 'pX').note)
      .toBe('Fetch the tube from Control Stocks, where the well is not recorded — write down '
          + 'which well you took it from.');
  });
});

/**
 * A box that does not track wells is not a box whose wells nobody wrote down.
 *
 * JCA, 2026-09-12: *"It is not worthwhile to speak of the location of pJ01. It is often used, and
 * it moves around in that box as a result."*
 *
 * Empty means nobody recorded it and a labsheet should ask. `untracked` means the box does not
 * work that way: these are working stocks handled several times a week, and a well recorded on
 * Monday is wrong by Thursday. **A question whose answer goes stale immediately trains people to
 * skip the questions that do not**, so the sheet names the box, says nothing about the well, and
 * asks for nothing.
 */
describe('boxes that do not track wells', () => {
  const inv = ensureInventory([
    'construct\tlabel\ttype\tconcentration\tbox\twell',
    'pJ01\tpJ01\tplasmid\tminiprep\tPink Training\tuntracked',
    'pJ01\tpJ01\tplasmid\tminiprep\tControl Stocks\tuntracked',
    'pUNKNOWN\tpUNKNOWN\tplasmid\tminiprep\tCheese1\t',
    'pPLACED\tpPLACED\tplasmid\tminiprep\tCheese1\tB4',
  ].join('\n'), 'x.tsv');

  it('is a different status from a well nobody recorded', () => {
    expect(chooseTemplateSample(inv, 'pJ01').status).toBe('box-untracked');
    expect(chooseTemplateSample(inv, 'pUNKNOWN').status).toBe('box-only');
    expect(chooseTemplateSample(inv, 'pPLACED').status).toBe('ready');
  });

  it('says the box and nothing about the well', () => {
    const note = chooseTemplateSample(inv, 'pJ01').note;
    expect(note).toBe('Fetch the miniprep DNA from Pink Training. Also in Control Stocks.');
    expect(note).not.toContain('well');
  });

  it('still apologises where the well genuinely is missing', () => {
    expect(chooseTemplateSample(inv, 'pUNKNOWN').note).toContain('the well is not recorded');
  });

  it('does not read `untracked` as a well name', () => {
    const s = findByConstruct(inv, 'pJ01')[0];
    expect(s.location.row).toBe(null);
    expect(s.location.untracked).toBe(true);
  });
});
