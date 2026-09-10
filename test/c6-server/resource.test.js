import { describe, it, expect } from 'vitest';
import {
  createIndex, addEntry, removeEntry, findByName, searchIndex
} from '../../src/c6-server/resource.js';

describe('createIndex', () => {
  it('returns an empty array', () => {
    expect(createIndex()).toEqual([]);
  });
});

describe('addEntry', () => {
  it('adds a new entry', () => {
    const idx = addEntry(createIndex(), {
      name: 'pBR322',
      file_path: 'sequences/pBR322.gb',
      type: 'polynucleotide',
      description: 'Classic cloning vector',
      keywords: ['plasmid', 'vector'],
    });
    expect(idx).toHaveLength(1);
    expect(idx[0].name).toBe('pBR322');
    expect(idx[0].id).toBeTruthy();
  });

  it('replaces existing entry by file_path, preserving id', () => {
    let idx = addEntry(createIndex(), {
      name: 'pBR322', file_path: 'sequences/pBR322.gb',
      type: 'polynucleotide', description: 'old', keywords: [],
    });
    const originalId = idx[0].id;
    idx = addEntry(idx, {
      name: 'pBR322', file_path: 'sequences/pBR322.gb',
      type: 'polynucleotide', description: 'updated', keywords: ['plasmid'],
    });
    expect(idx).toHaveLength(1);
    expect(idx[0].description).toBe('updated');
    expect(idx[0].id).toBe(originalId);
  });
});

describe('removeEntry', () => {
  it('removes by file_path', () => {
    let idx = addEntry(createIndex(), {
      name: 'pBR322', file_path: 'sequences/pBR322.gb',
      type: 'polynucleotide', description: '', keywords: [],
    });
    idx = removeEntry(idx, 'sequences/pBR322.gb');
    expect(idx).toHaveLength(0);
  });
});

describe('findByName', () => {
  const idx = addEntry(createIndex(), {
    name: 'pBR322', file_path: 'sequences/pBR322.gb',
    type: 'polynucleotide', description: '', keywords: [],
  });

  it('finds by bare name (case-insensitive)', () => {
    expect(findByName(idx, 'pbr322')?.name).toBe('pBR322');
  });

  it('finds by dotted path', () => {
    expect(findByName(idx, 'sequences.pBR322')?.name).toBe('pBR322');
  });

  it('returns undefined for unknown name', () => {
    expect(findByName(idx, 'unknown')).toBeUndefined();
  });
});

describe('searchIndex', () => {
  const idx = [
    addEntry(createIndex(), {
      name: 'pBR322', file_path: 'sequences/pBR322.gb',
      type: 'polynucleotide', description: 'AmpR TetR vector', keywords: ['plasmid', 'ampicillin'],
    })[0],
    addEntry(createIndex(), {
      name: 'J23101', file_path: 'sequences/J23101.seq',
      type: 'polynucleotide', description: 'Constitutive promoter', keywords: ['promoter'],
    })[0],
  ];

  it('returns matching entries ranked by hits', () => {
    const results = searchIndex(idx, 'plasmid ampicillin');
    expect(results[0].name).toBe('pBR322');
    expect(results).toHaveLength(1);
  });

  it('returns empty array for no matches', () => {
    expect(searchIndex(idx, 'zyxw')).toHaveLength(0);
  });
});
