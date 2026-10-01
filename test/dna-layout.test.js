import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { layout, columnsOf, parseLocation, parseRegion } from '../src/views/dna-layout.js';
import { annotate } from './fixtures/dna/annotate-pUC19.mjs';
import { cutOnce } from '../src/C6-Sim.js';
import { dsDNA, polyrevcomp } from '../src/C6-Seq.js';

/**
 * The producer behind `dna.view`. What the page draws is decided here, so this is where the
 * biology is checked: which strand an overhang is on, which end carries the phosphate, and that
 * an unreadable file is never laid out as an empty molecule.
 *
 * The molecules come from C6 itself wherever they can: fragments cut by `cutOnce`, and the
 * reverse complement from `polyrevcomp`. A test that built its own Polynucleotides would only
 * check this file against the author's reading of C6's convention; these check it against C6.
 */
const ROOT = path.resolve(__dirname, '..');
const FIX = path.join(ROOT, 'test/fixtures/dna');

function produce(...args) {
  return JSON.parse(execFileSync('node', [path.join(ROOT, 'bin/c6-dna'), ...args], { cwd: ROOT, encoding: 'utf8' }));
}

/** A Polynucleotide as the molecule `layout` takes, the way `bin/c6-dna --poly` reads one. */
function mol(p, name = 'test') {
  return {
    name, description: '', source: { kind: 'polynucleotide' }, sequence: p.sequence,
    ext5: p.ext5 || '', ext3: p.ext3 || '', mod5: p.mod_ext5 || '', mod3: p.mod_ext3 || '',
    isCircular: p.isCircular, isDoubleStranded: p.isDoubleStranded, isRNA: p.isRNA,
    featureStatus: 'not_carried', rawFeatures: [], notes: [],
  };
}
const whole = (p) => ({ start: 1, end: p.sequence.length });
const strandText = (cols, which) => cols.map((c) => c[which] || '.').join('');

describe('the pUC19 fixture', () => {
  it('is what annotate-pUC19.mjs writes from the NCBI record, so no coordinate was typed', () => {
    const raw = fs.readFileSync(path.join(FIX, 'pUC19.gb'), 'utf8');
    expect(fs.readFileSync(path.join(FIX, 'pUC19.annotated.gb'), 'utf8')).toBe(annotate(raw));
  });
});

describe('reading', () => {
  it('a whole annotated plasmid is a circular map with its five features, source dropped', () => {
    const p = produce('--file', 'test/fixtures/dna/pUC19.annotated.gb');
    expect(p.status).toBe('drawn');
    expect(p.level).toBe('circular');
    expect(p.molecule).toMatchObject({ length: 2686, topology: 'circular', strands: 'double' });
    expect(p.features.status).toBe('annotated');
    expect(p.features.items.map((f) => f.name).sort()).toEqual(['M13 fwd', 'M13 rev', 'MCS', 'bla', 'lacZ-alpha']);
    const bla = p.features.items.find((f) => f.name === 'bla');
    expect(bla).toMatchObject({ location_label: '1,626..2,486', strand_label: 'reverse', length_label: '861 bp' });
    expect(p.read_files).toEqual([path.join(FIX, 'pUC19.annotated.gb')]);
  });

  it('three kinds of featureless are three different statuses', () => {
    expect(produce('--file', 'test/fixtures/dna/pUC19.gb').features.status).toBe('none_annotated');
    expect(produce('--file', 'test/fixtures/dna/T7promoter.fasta').features.status).toBe('not_carried');
    expect(produce('--file', 'test/fixtures/dna/not-genbank.gb').features.status).toBe('not_read');
  });

  it('a file that cannot be read is unreadable with a reason, and has no drawing at all', () => {
    for (const f of ['test/fixtures/dna/not-genbank.gb', 'test/fixtures/dna/nothing-here.gb', 'README.md', 'x.dna']) {
      const p = produce('--file', f);
      expect(p.status, f).toBe('unreadable');
      expect(p.problem, f).toMatch(/\w/);
      expect(p.drawing, f).toBeNull();
      expect(p.molecule, f).toBeNull();
    }
  });

  it('a request that names no source, or two, is refused outright rather than drawn', () => {
    expect(() => execFileSync('node', ['bin/c6-dna'], { cwd: ROOT, stdio: 'pipe' })).toThrow();
    expect(() => execFileSync('node', ['bin/c6-dna', '--sequence', 'ACGT', '--file', 'a.gb'], { cwd: ROOT, stdio: 'pipe' })).toThrow();
  });
});

describe('overhangs, on the strand C6 says they are on', () => {
  it('EcoRI: the right fragment starts with the top strand protruding 5\'-AATT', () => {
    const [, right] = cutOnce(dsDNA('CCCCCGAATTCGGGGG'), 'EcoRI');
    const cols = columnsOf(right, whole(right));
    expect(strandText(cols, 'top')).toBe('AATTCGGGGG');
    expect(strandText(cols, 'bottom')).toBe('....GCCCCC');
  });

  it('EcoRI: the left fragment ends with the bottom strand protruding', () => {
    const [left] = cutOnce(dsDNA('CCCCCGAATTCGGGGG'), 'EcoRI');
    const cols = columnsOf(left, whole(left));
    expect(strandText(cols, 'top')).toBe('CCCCCG....');
    expect(strandText(cols, 'bottom')).toBe('GGGGGCTTAA');
  });

  it('PstI leaves 3\' overhangs: the left fragment\'s top strand runs on past the bottom', () => {
    const [left, right] = cutOnce(dsDNA('CCCCCCTGCAGGGGGGG'), 'PstI');
    expect(strandText(columnsOf(left, whole(left)), 'top')).toBe('CCCCCCTGCA');
    expect(strandText(columnsOf(left, whole(left)), 'bottom')).toBe('GGGGGG....');
    expect(strandText(columnsOf(right, whole(right)), 'top')).toBe('....GGGGGGG');
    expect(strandText(columnsOf(right, whole(right)), 'bottom')).toBe('ACGTCCCCCCC');
  });

  it('reverse-complementing with C6 mirrors the drawing exactly: top and bottom swap, ends swap', () => {
    for (const [seq, enz] of [['CCCCCGAATTCGGGGG', 'EcoRI'], ['CCCCCCTGCAGGGGGGG', 'PstI'], ['CCCCCGGTCTCAGGGGGGG', 'BsaI']]) {
      for (const frag of cutOnce(dsDNA(seq), enz)) {
        const a = columnsOf(frag, whole(frag));
        const rc = polyrevcomp(frag);
        const b = columnsOf(rc, whole(rc));
        const mirrored = a.slice().reverse().map((c) => [c.bottom, c.top]);
        expect(b.map((c) => [c.top, c.bottom]), `${enz} ${frag.sequence}`).toEqual(mirrored);
      }
    }
  });

  it('a stretch that does not reach an end draws no overhang there', () => {
    const [, right] = cutOnce(dsDNA('CCCCCGAATTCGGGGG'), 'EcoRI');
    expect(strandText(columnsOf(right, { start: 2, end: 6 }), 'top')).toBe('GGGGG');
  });
});

describe('end chemistry is drawn as C6 records it, never guessed', () => {
  const endsOf = (payload) => Object.fromEntries(payload.drawing.strands.flatMap((s) =>
    s.ends.map((e) => [`${s.which}-${e.side}`, e.kind])));

  it('a cut end carries a 5\' phosphate on the strand whose 5\' end is there; 3\' ends are OH', () => {
    const [, right] = cutOnce(dsDNA('CCCCCGAATTCGGGGG'), 'EcoRI');
    const ends = endsOf(layout(mol(right)));
    expect(ends['top-left']).toBe('phosphate');      // mod_ext5 phos5, top strand's 5' end
    expect(ends['bottom-left']).toBe('hydroxyl');    // bottom strand's 3' end
    expect(ends['top-right']).toBe('hydroxyl');      // top strand's 3' end
    expect(ends['bottom-right']).toBe('hydroxyl');   // mod_ext3 hydroxyl, bottom strand's 5' end
  });

  it('an empty mod is "not stated", not a hydroxyl', () => {
    const p = layout({ ...mol(dsDNA('ACGTACGT')), mod5: '', mod3: '' });
    expect(endsOf(p)['top-left']).toBe('not_stated');
    expect(endsOf(p)['bottom-right']).toBe('not_stated');
    expect(p.molecule.ends.left.chemistry).toBe('5′ end chemistry not stated');
  });

  it('a circular molecule has no ends to label', () => {
    const p = layout({ ...mol(dsDNA('ACGTACGTAC')), isCircular: true });
    expect(p.molecule.ends).toBeNull();
    expect(p.drawing.strands.flatMap((s) => s.ends).every((e) => e.kind === 'continues')).toBe(true);
  });

  it('hydrogen bonds: two per A·T, three per G·C', () => {
    expect(layout(mol(dsDNA('AT'))).drawing.pairs).toHaveLength(4);
    expect(layout(mol(dsDNA('GC'))).drawing.pairs).toHaveLength(6);
  });
});

describe('regions and levels', () => {
  const F = ['--file', 'test/fixtures/dna/pUC19.annotated.gb'];

  it('the level follows the span: molecule, then sequence, then a map', () => {
    expect(produce(...F, '--region', '375..420').level).toBe('molecule');
    expect(produce(...F, '--region', '300..900').level).toBe('sequence');
    expect(produce(...F, '--region', '1..2000').level).toBe('linear');
    expect(produce(...F).level).toBe('circular');
  });

  it('a level that cannot draw the span is refused with the reason and a way back', () => {
    const p = produce(...F, '--level', 'molecule');
    expect(p.status).toBe('bad_request');
    expect(p.problem).toMatch(/at most 150 bp/);
    expect(p.drawing).toBeNull();
    expect(p.nav).toEqual([{ label: 'Whole molecule', args: { file: 'test/fixtures/dna/pUC19.annotated.gb' } }]);
  });

  it('a region outside the molecule is refused, not clipped', () => {
    expect(produce(...F, '--region', '1..9999').status).toBe('bad_request');
    expect(parseRegion('20..10', 100)).toMatch(/backwards/);
  });

  it('every link repeats the source, so following one asks the producer about the same DNA', () => {
    const p = produce(...F, '--region', '380..460', '--mark', 'MCS=396..452');
    const links = [...p.nav, ...p.levels.filter((l) => l.args), ...p.features.items.filter((f) => f.args), ...p.marks]
      .map((x) => x.args);
    expect(links.length).toBeGreaterThan(5);
    for (const a of links) {
      expect(a.file).toBe('test/fixtures/dna/pUC19.annotated.gb');
      expect(a.mark).toBe('MCS=396..452');
    }
    const zoomIn = p.nav.find((n) => n.label.startsWith('Zoom in')).args.region;
    const [a, b] = zoomIn.split('..').map(Number);
    expect(a).toBeGreaterThanOrEqual(380);
    expect(b).toBeLessThanOrEqual(460);
  });

  it('a feature through the origin of a circle is one span, and on a line it is unreadable', () => {
    expect(parseLocation('complement(2600..50)', 2686, true)).toEqual({ spans: [{ start: 2600, end: 2736 }], strand: -1 });
    expect(parseLocation('2600..50', 2686, false)).toBeNull();
  });
});

describe('genome scale: thousands of features stay a map', () => {
  // MG1655 (NC_000913.3) has 4,651 genes and 4,318 CDSs. It is too big to commit, so this builds
  // the same shape: a 1-Mb circle with 1,000 genes, each with a CDS twin at the same span.
  const length = 1_000_000;
  const rawFeatures = [];
  for (let i = 0; i < 1000; i++) {
    const a = i * 1000 + 1, b = a + 899;
    const loc = i % 2 ? `complement(${a}..${b})` : `${a}..${b}`;
    rawFeatures.push({ key: 'gene', qualifiers: { location: loc, gene: `g${i}` } });
    rawFeatures.push({ key: 'CDS', qualifiers: { location: loc, gene: `g${i}` } });
  }
  rawFeatures.push({ key: 'mobile_element', qualifiers: { location: '200001..260000', note: 'prophage' } });
  const big = { ...mol(dsDNA('A'.repeat(length))), isCircular: true, featureStatus: 'carried', rawFeatures };

  it('folds each gene into the CDS at its span, and says how many', () => {
    const p = layout(big);
    expect(p.notes.join(' ')).toContain('1,000 gene records sit exactly under a product');
    expect(p.drawing.features).toHaveLength(1001);
  });

  it('labels only what can be read, lists at most 200, and says what it left out', () => {
    const p = layout(big);
    expect(p.drawing.labels.map((l) => l.text)).toEqual(['prophage']);
    expect(p.drawing.caption).toContain('1,000 of 1,001 features are too small to label');
    expect(p.features.items).toHaveLength(200);
    expect(p.features.table_note).toBe('Listing the first 200 of 1,001 features in this molecule, by position. Zoom in to list the rest.');
    const lin = layout(big, { level: 'linear' });
    expect(lin.drawing.features.filter((f) => f.label)).toHaveLength(1);
  });

  it('a zoomed table lists only what is in the stretch', () => {
    const p = layout(big, { region: '1..5000' });
    expect(p.features.items.map((f) => f.name)).toEqual(['g0', 'g1', 'g2', 'g3', 'g4']);
    expect(p.features.table_note).toBe('5 of 1,001 features fall in this stretch.');
  });
});
