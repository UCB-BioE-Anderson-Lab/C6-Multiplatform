import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadIndex, saveIndex, scanFolder,
  createHandler, readHandler, updateHandler, deleteHandler,
  queryHandler, runHandler, showHandler, dispatch,
} from '../../src/c6-server/index.js';

// In-memory adapter for testing — no filesystem needed.
function makeMemAdapter(files = {}) {
  const store = { ...files };
  return {
    async readFile(path) {
      if (!(path in store)) throw new Error(`File not found: ${path}`);
      return store[path];
    },
    async writeFile(path, content) { store[path] = content; },
    async deleteFile(path) { delete store[path]; },
    async listFiles() { return Object.keys(store).filter(k => !k.startsWith('.')); },
    async exists(path) { return path in store; },
    _store: store,
  };
}

describe('loadIndex / saveIndex', () => {
  it('returns empty array when no index file', async () => {
    const adapter = makeMemAdapter();
    expect(await loadIndex(adapter)).toEqual([]);
  });

  it('round-trips index through saveIndex / loadIndex', async () => {
    const adapter = makeMemAdapter();
    const entry = [{ id: '1', name: 'foo', file_path: 'foo.seq', type: 'polynucleotide', description: '', keywords: [], indexed_at: 0 }];
    await saveIndex(adapter, entry);
    expect(await loadIndex(adapter)).toEqual(entry);
  });
});

describe('scanFolder', () => {
  it('indexes new files on scan', async () => {
    const adapter = makeMemAdapter({ 'sequences/test.seq': 'ATGCATGC' });
    const idx = await scanFolder(adapter, []);
    expect(idx).toHaveLength(1);
    expect(idx[0].name).toBe('test');
    expect(idx[0].type).toBe('polynucleotide');
  });

  it('removes entries for deleted files', async () => {
    const adapter = makeMemAdapter({});
    // Start with an entry for a file that no longer exists
    const staleIndex = [{ id: '1', name: 'gone', file_path: 'gone.seq', type: 'polynucleotide', description: '', keywords: [], indexed_at: 0 }];
    const idx = await scanFolder(adapter, staleIndex);
    expect(idx).toHaveLength(0);
  });
});

describe('CRUD handlers', () => {
  let adapter, index;
  beforeEach(() => {
    adapter = makeMemAdapter();
    index = [];
  });

  it('create writes file and updates index', async () => {
    const result = await createHandler(adapter, index, {
      name: 'testseq',
      filePath: 'sequences/testseq.seq',
      content: 'ATGCATGC',
    });
    expect(result.ok).toBe(true);
    expect(result.index).toHaveLength(1);
    expect(adapter._store['sequences/testseq.seq']).toBe('ATGCATGC');
  });

  it('read returns parsed data', async () => {
    const { index: newIdx } = await createHandler(adapter, index, {
      filePath: 'sequences/testseq.seq', content: 'ATGCATGC',
    });
    const result = await readHandler(adapter, newIdx, { name: 'testseq' });
    expect(result.type).toBe('polynucleotide');
    expect(result.data.sequence).toBe('ATGCATGC');
  });

  it('delete removes file and index entry', async () => {
    const { index: newIdx } = await createHandler(adapter, index, {
      filePath: 'sequences/testseq.seq', content: 'ATGCATGC',
    });
    const result = await deleteHandler(adapter, newIdx, { name: 'testseq' });
    expect(result.ok).toBe(true);
    expect(adapter._store['sequences/testseq.seq']).toBeUndefined();
  });

  it('read throws for unknown name', async () => {
    await expect(readHandler(adapter, index, { name: 'nope' })).rejects.toThrow('not found');
  });
});

describe('queryHandler', () => {
  it('returns matching entries', () => {
    const index = [
      { id: '1', name: 'pBR322', file_path: 'sequences/pBR322.gb', type: 'polynucleotide', description: 'AmpR vector', keywords: ['plasmid'], indexed_at: 0 },
      { id: '2', name: 'J23101', file_path: 'sequences/J23101.seq', type: 'polynucleotide', description: 'Constitutive promoter', keywords: ['promoter'], indexed_at: 0 },
    ];
    const result = queryHandler(null, index, { text: 'promoter' });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toBe('J23101');
  });
});

describe('runHandler', () => {
  it('runs rev_comp', async () => {
    const result = await runHandler(null, null, { fn: 'rev_comp', args: ['ATCG'] });
    expect(result.result).toBe('CGAT');
  });

  it('throws for unknown function', async () => {
    await expect(runHandler(null, null, { fn: 'nonexistent', args: [] })).rejects.toThrow('Unknown function');
  });
});

describe('dispatch', () => {
  it('dispatches run action', async () => {
    const adapter = makeMemAdapter();
    const result = await dispatch({ action: 'run', fn: 'rev_comp', args: ['AAAA'] }, adapter, []);
    expect(result.result).toBe('TTTT');
  });

  it('dispatches list_functions', async () => {
    const result = await dispatch({ action: 'list_functions' }, makeMemAdapter(), []);
    expect(result.functions).toContain('rev_comp');
  });

  it('throws for unknown action', async () => {
    await expect(dispatch({ action: 'fly' }, makeMemAdapter(), [])).rejects.toThrow('Unknown action');
  });
});
