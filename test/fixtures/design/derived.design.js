// A design script done the way the phase asks for it.
//
// THE TEMPLATE COMES FROM A FILE, NOT FROM A LITERAL. That is the whole convention: a sequence
// typed into a script is a sequence somebody decided, and the audit cannot tell a template from
// an improvised primer by looking at them. Reading it keeps the script free of both.
import fs from 'node:fs';
import path from 'node:path';
import { findanneal } from '../../../src/C6-Oligos.js';
import { revcomp } from '../../../src/C6-Seq.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const template = fs.readFileSync(path.join(here, 'template.txt'), 'utf8').trim();

export function design() {
  // Both primers are DERIVED: the tool picks the anneal, locked to the 3' end the junction fixes.
  const fwdWindow = template.slice(0, 40);
  const revWindow = revcomp(template.slice(-40));
  const fwd = findanneal(fwdWindow, false, true);
  const rev = findanneal(revWindow, false, true);

  return {
    oligos: [
      { name: 'oGFP-F', sequence: fwd, anneal: fwd, template },
      { name: 'oGFP-R', sequence: rev, anneal: rev, template },
    ],
    cf: ['PCR oGFP-F oGFP-R pTemplate gfpAmp', 'Transform gfpAmp Mach1 Amp'].join('\n'),
  };
}
