// gel.js — the design of an analytical gel labsheet.
//
// The gel asks one question: did a band form, and is it the right size? So the expected sizes ARE
// the sheet. `injectGel.js` puts it the same way: *"a gel with no expected size tells you a band
// exists; it does not tell you whether it is the right band, which is the only question the gel
// was run to answer."*
//
// NO SOURCE BLOCK, AND THAT IS DELIBERATE — see `derivedFrom` in the projection. A gel bin shares
// its job objects with the PCR it follows, so its materials read as the PCR's oligos and
// template. True of the reaction, false of the gel, which loads tubes of PCR product.
import { bp } from './util.js';

export default {
  operation: 'gel',
  title: 'Gel',
  module: 'analytical_gel',
  shownAsColumn: [],
  columns: (x) => ({ 'PCR product': x.output, 'expected size': bp(x) }),
  values: ({ samples, module }) => ({ [module]: { samples: samples.length || 1 } }),
  recipe: () => null,
  notes: ({ samples }) => samples.filter((x) => x.productBp == null)
    .map((x) => `${x.output}: no expected size — ${x.sizeNote || 'the reaction was not simulated'}. `
              + `A blank size column reads as "no band expected", which is the opposite.`),
};
