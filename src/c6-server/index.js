// src/c6-server/index.js
// C6 CRUD+PQRS API handlers.
// Each handler is a pure async function — no global state.
// The caller (Node HTTP server or Apps Script doPost) supplies adapter + index.

import { addEntry, removeEntry, findByName, searchIndex } from './resource.js';
import { parseFile } from './parsers/index.js';
import { runFunction, listFunctions } from './registry.js';

const INDEX_PATH = '.c6index.json';

// ---------------------------------------------------------------------------
// Index persistence helpers
// ---------------------------------------------------------------------------

export async function loadIndex(adapter) {
  if (!(await adapter.exists(INDEX_PATH))) return [];
  try {
    const text = await adapter.readFile(INDEX_PATH);
    return JSON.parse(text);
  } catch {
    return [];
  }
}

export async function saveIndex(adapter, index) {
  await adapter.writeFile(INDEX_PATH, JSON.stringify(index, null, 2));
}

// ---------------------------------------------------------------------------
// Folder scan — called on wakeup
// ---------------------------------------------------------------------------

export async function scanFolder(adapter, index) {
  const files = await adapter.listFiles('');
  // Skip the index file itself and hidden files at root
  const dataFiles = files.filter(f => f !== INDEX_PATH && !f.startsWith('.'));

  let updated = index;
  const knownPaths = new Set(updated.map(e => e.file_path));
  const currentPaths = new Set(dataFiles);

  // Remove entries for deleted files
  for (const known of knownPaths) {
    if (!currentPaths.has(known)) {
      updated = removeEntry(updated, known);
    }
  }

  // Add entries for new files
  for (const filePath of dataFiles) {
    if (knownPaths.has(filePath)) continue;
    try {
      const text = await adapter.readFile(filePath);
      const parsed = parseFile(filePath, text);
      if (!parsed) continue; // unsupported extension
      const name = filePath.split('/').pop().replace(/\.[^/.]+$/, '');
      updated = addEntry(updated, {
        name,
        file_path: filePath,
        type: parsed.type,
        description: parsed.description,
        keywords: parsed.keywords,
      });
    } catch {
      // skip unreadable files silently
    }
  }

  return updated;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createHandler(adapter, index, { name, filePath, content, type }) {
  if (!filePath) throw new Error('filePath required');
  if (!content && content !== '') throw new Error('content required');

  await adapter.writeFile(filePath, content);
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  const parsed = parseFile(filePath, text);
  const baseName = name || filePath.split('/').pop().replace(/\.[^/.]+$/, '');
  const newIndex = addEntry(index, {
    name: baseName,
    file_path: filePath,
    type: parsed ? parsed.type : (type || 'unknown'),
    description: parsed ? parsed.description : '',
    keywords: parsed ? parsed.keywords : [],
  });
  await saveIndex(adapter, newIndex);
  return { ok: true, name: baseName, file_path: filePath, index: newIndex };
}

export async function readHandler(adapter, index, { name }) {
  if (!name) throw new Error('name required');
  const entry = findByName(index, name);
  if (!entry) throw new Error(`Resource not found: "${name}"`);
  const text = await adapter.readFile(entry.file_path);
  const parsed = parseFile(entry.file_path, text);
  if (!parsed) return { entry, raw: text };
  return { entry, ...parsed };
}

export async function updateHandler(adapter, index, { name, content }) {
  if (!name) throw new Error('name required');
  const entry = findByName(index, name);
  if (!entry) throw new Error(`Resource not found: "${name}"`);
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  await adapter.writeFile(entry.file_path, text);
  const parsed = parseFile(entry.file_path, text);
  const newIndex = addEntry(index, {
    name: entry.name,
    file_path: entry.file_path,
    type: parsed ? parsed.type : entry.type,
    description: parsed ? parsed.description : entry.description,
    keywords: parsed ? parsed.keywords : entry.keywords,
  });
  await saveIndex(adapter, newIndex);
  return { ok: true, entry: findByName(newIndex, name) };
}

export async function deleteHandler(adapter, index, { name }) {
  if (!name) throw new Error('name required');
  const entry = findByName(index, name);
  if (!entry) throw new Error(`Resource not found: "${name}"`);
  await adapter.deleteFile(entry.file_path);
  const newIndex = removeEntry(index, entry.file_path);
  await saveIndex(adapter, newIndex);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// PQRS
// ---------------------------------------------------------------------------

export function promptHandler(_adapter, _index, { text }) {
  // Stub — future: LLM integration
  return { ok: true, response: `Prompt received: "${text}". (LLM integration not yet implemented.)` };
}

export function queryHandler(_adapter, index, { text, limit = 10 }) {
  if (!text) throw new Error('text required');
  const results = searchIndex(index, text).slice(0, limit);
  return { results };
}

export async function runHandler(_adapter, _index, { fn, args = [] }) {
  if (!fn) throw new Error('fn required');
  const result = runFunction(fn, args);
  return { result };
}

export function showHandler(_adapter, index, { name, format = 'summary' }) {
  if (!name) throw new Error('name required');
  const entry = findByName(index, name);
  if (!entry) throw new Error(`Resource not found: "${name}"`);
  if (format === 'summary') {
    return { display: `${entry.name} (${entry.type}): ${entry.description}` };
  }
  return { entry };
}

// ---------------------------------------------------------------------------
// Dispatch — single entry point for HTTP layer
// ---------------------------------------------------------------------------

const HANDLERS = {
  create: createHandler,
  read:   readHandler,
  update: updateHandler,
  delete: deleteHandler,
  prompt: promptHandler,
  query:  queryHandler,
  run:    runHandler,
  show:   showHandler,
};

/**
 * @param {{ action: string, [key: string]: any }} request
 * @param {import('./fs-adapter.js').FsAdapter} adapter
 * @param {import('./resource.js').ResourceEntry[]} index
 * @returns {Promise<object>}
 */
export async function dispatch(request, adapter, index) {
  const { action, ...params } = request;
  if (action === 'list_functions') return { functions: listFunctions() };
  const handler = HANDLERS[action];
  if (!handler) throw new Error(`Unknown action: "${action}". Available: ${Object.keys(HANDLERS).join(', ')}`);
  return handler(adapter, index, params);
}
