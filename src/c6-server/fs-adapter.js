// src/c6-server/fs-adapter.js
// Filesystem abstraction interface + Node.js implementation.
// The Drive implementation lives in apps-script/DriveAdapter.gs.

import { readFile, writeFile, unlink, readdir, stat } from 'fs/promises';
import { join, relative } from 'path';

/**
 * @typedef {Object} FsAdapter
 * @property {(filePath: string) => Promise<string>} readFile
 * @property {(filePath: string, content: string) => Promise<void>} writeFile
 * @property {(filePath: string) => Promise<void>} deleteFile
 * @property {(folder: string) => Promise<string[]>} listFiles  - returns relative paths
 * @property {(filePath: string) => Promise<boolean>} exists
 */

/**
 * Node.js fs/promises implementation.
 * All paths are absolute on disk; listFiles returns paths relative to rootDir.
 * @param {string} rootDir - absolute path to the data folder root
 * @returns {FsAdapter}
 */
export function makeNodeAdapter(rootDir) {
  return {
    async readFile(filePath) {
      return readFile(join(rootDir, filePath), 'utf8');
    },

    async writeFile(filePath, content) {
      const abs = join(rootDir, filePath);
      // Ensure parent directory exists
      const { mkdir } = await import('fs/promises');
      await mkdir(abs.replace(/\/[^/]+$/, ''), { recursive: true });
      await writeFile(abs, content, 'utf8');
    },

    async deleteFile(filePath) {
      await unlink(join(rootDir, filePath));
    },

    async listFiles(folder = '') {
      const base = join(rootDir, folder);
      const results = [];
      await collectFiles(base, base, results);
      return results;
    },

    async exists(filePath) {
      try {
        await stat(join(rootDir, filePath));
        return true;
      } catch {
        return false;
      }
    },
  };
}

async function collectFiles(base, dir, results) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(base, full, results);
    } else {
      results.push(relative(base, full));
    }
  }
}

// Index file path within the data folder
export const INDEX_PATH = '.c6index.json';
