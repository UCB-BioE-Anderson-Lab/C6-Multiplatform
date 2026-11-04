// culture.js — the design of an overnight-growth labsheet.
//
// WHAT GOES IN THE BLOCK IS THE PICKED CLONES PLUS THE CONTROLS, and the controls arrive here
// rather than at the pick because a control plate offers nothing to select between. `inoculate=`
// names them with the medium each is grown in, which is not always the sample's: an untransformed
// control grows on plain M17 because it has no resistance to select with.
//
// NO MODULE. `preparation_of_starter_culture` is a flask protocol and this is a 24-well block;
// transcluding it would print the wrong vessel, the wrong volume and the wrong shaker.
import { cond } from './util.js';

export default {
  operation: 'culture',
  title: 'Culture',
  module: null,
  // WHAT GOES UNDER THE TABLE. Declared, so a field the planner adds later cannot
  // leak onto the page. Anything in a column, in the notes, or bookkeeping is absent
  // by not being named here.
  conditions: ['temp'],
  columns: (x, ctx) => ({
    label: ctx.label(x.output),
    construct: x.output,
    from: ctx.from(x),
    medium: cond(x.params, 'medium'),
    vessel: cond(x.params, 'vessel'),
    volume: cond(x.params, 'volume'),
  }),
  values: () => ({}),
  recipe: () => null,
  notes: ({ samples }) => {
    const p = samples[0]?.params || {};
    const out = [];
    // THE CONTROLS SHARE THE BLOCK, so they get wells from the same layout, continuing after the
    // picked clones. A sheet that lays out the clones and then says "one well" for the controls
    // has left the last two positions to be invented at the bench.
    const controls = String(cond(p, 'inoculate')).split(',').map((s) => s.trim()).filter(Boolean);
    // **READ, NOT RECOMPUTED.** This was `layoutFor(picked + controls.length).slice(picked)` — the
    // count of ONE construct's clones, which is right while an experiment has one construct and
    // says A2 about a block whose A2 holds somebody else's culture the moment it has four. A well
    // is a property of the SITTING, and `planning/allocateWells.js` is what knows the sitting.
    const wells = String(cond(p, 'controlWells') || '').split(',').map((s) => s.trim())
      .filter(Boolean);
    for (const [i, t] of controls.entries()) {
      const [what, medium] = t.split(':');
      out.push(`Control: inoculate ${what} into ${medium || cond(p, 'medium')}`
             + `${wells[i] ? `, well ${wells[i]}` : ', one well'}, from its restreak. It is not `
             + 'picked from — every colony on a control plate is the same thing.');
    }
    // **A CULTURE THAT POOLS CLONES SAYS SO.** `PER_CLONE` is `pick, miniprep, sequencing`: a
    // culture is a per-CONSTRUCT step and never fans, so four picked colonies feed ONE culture and
    // the assay reads ONE number. For a screen that is the intent; for a reporter experiment,
    // where per-clone fluorescence is the whole point, it is the wrong answer — and nothing on the
    // sheet said which was happening. Found 2026-11-04 by a session designing cold, which could
    // not tell intended pooling from a missed fan-out by reading the workbook.
    //
    // This does NOT change the fan-out, which is a decision about what the lab means rather than
    // a defect to patch: it makes the pooling visible to the person holding the plate, who is the
    // one who can say it is wrong.
    const pooled = Number(cond(p, 'pooledFrom') || 0);
    if (pooled > 1) {
      out.push(`This is ONE culture from ${pooled} picked colonies, and the assay reads it as one `
             + 'number. If this experiment needs a reading per clone — a reporter comparison, '
             + 'usually — stop and say so: it needs one culture per colony, not one pooled well.');
    }
    if (cond(p, 'to') === 'saturation')
      out.push('Grow to saturation. If a well has not grown, go back to picking or give the '
             + 'shaker more time — do not read a well that did not grow.');
    return out;
  },
};
