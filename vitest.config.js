// vitest.config.js
//
// **THE ALIAS BLOCK IS THE WHOLE OF WHAT VITEST 4 ADDED HERE.** 38 test files import modules
// root-relative — `from 'src/C6-Seq.js'` rather than `'../src/C6-Seq.js'`. Vitest 3 resolved that
// on its own; Vitest 4 does not, and every one of those files failed with "Cannot find package
// 'src/...'" on the upgrade. Rewriting 38 files' import lines was the alternative: more diff, more
// risk, no clearer.
//
// The upgrade was not cosmetic: Vitest 3.1.2 carried two CRITICAL advisories — arbitrary file read
// and execution while the UI server listens, and a prototype-pollution gadget to RCE in tinypool —
// and `npm run test:ui` is in this package's scripts, so the UI path is one somebody here uses.
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // Unchanged, and load-bearing: four test files call `describe`/`it` without importing them.
  test: { globals: true },
  resolve: {
    alias: [
      // Root-relative, not a package: `src/...` and `test/...` resolve from the repository root.
      { find: /^src\//, replacement: `${path.join(root, 'src')}/` },
      { find: /^test\//, replacement: `${path.join(root, 'test')}/` },
    ],
  },
});
