import { describe, it, expect } from 'vitest';

/**
 * `src/index.js` re-exports the whole toolkit. Nothing imported it in the test suite, so when
 * `C6-LabPlanner.js` moved into `src/labplanner/` and line 9 was not repointed, the barrel threw
 * ERR_MODULE_NOT_FOUND for everyone and 1759 tests stayed green.
 *
 * It stayed invisible because `cf.check` and `cf.sim` import submodules directly. What did NOT work
 * was every external consumer: all three of Pimar's Tlib3 simulation scripts import the barrel and
 * could not run at all. Found 2026-09-20, from the other side, by a repo that depends on it.
 *
 * A re-export is exactly the kind of thing a unit test never touches and a user hits immediately.
 */
describe('the barrel export loads', () => {
  it('imports without throwing', async () => {
    await expect(import('src/index.js')).resolves.toBeDefined();
  });

  it('carries the entry points external code actually imports', async () => {
    const C6 = (await import('src/index.js')).default;
    // The four Tlib3's scripts use, plus the class every simulator signature is typed on.
    for (const name of ['parseCF', 'simCF', 'Polynucleotide', 'PCR', 'goldengate']) {
      expect(C6[name], `src/index.js should export ${name}`).toBeDefined();
    }
  });
});
