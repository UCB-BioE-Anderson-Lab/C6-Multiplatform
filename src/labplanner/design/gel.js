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
  // THE LANE IS A TUBE, and the tube has a label. A gel loads what the PCR made, so the row
  // names that tube first and the construct second — one to find it on the rack, one to know it
  // is the right one.
  // WHAT A GEL LOADS IS THE PCR'S PRODUCT, which is the job's own OUTPUT. `injectGelJobs` pushes
  // the very same job objects as the PCR, so `inputs` here is the PCR's template — reading those
  // put `pJ01` in the load column, which is the tube the reaction was set up FROM.
  columns: (x, ctx) => ({ load: ctx.labelOf(x.output) || x.output, construct: x.output,
                          'expected size': bp(x) }),
  values: ({ samples, module }) => ({ [module]: { samples: samples.length || 1 } }),
  recipe: () => null,
  notes: ({ samples }) => samples.filter((x) => x.productBp == null)
    .map((x) => `${x.output}: no expected size — ${x.sizeNote || 'the reaction was not simulated'}. `
              + `A blank size column reads as "no band expected", which is the opposite.`),
};
