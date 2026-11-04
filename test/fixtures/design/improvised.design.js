// A design script done the way the phase exists to catch. Deliberately bad, and used by
// test/design-runner.test.js to watch the gate reject something.
//
// The forward primer is an arbitrary 30-mer off the template, chosen by position rather than by
// any property — which is precisely the failure described on 2026-11-04. The reverse primer is
// typed in as a literal and does not appear in the template at all.
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const template = fs.readFileSync(path.join(here, 'template.txt'), 'utf8').trim();

export function design() {
  const fwd = template.slice(111, 141);
  const rev = 'TTTTTTTTTTTTTTTTTTTTAAAAAAAAAA';

  return {
    oligos: [
      { name: 'oBad-F', sequence: fwd, anneal: fwd, template },
      { name: 'oBad-R', sequence: rev, anneal: rev, template },
      { name: 'oBad-X', sequence: fwd },
    ],
    cf: 'PCR oBad-F oBad-R pTemplate badAmp',
  };
}
