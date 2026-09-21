// Whether an experiment needs a stock-making session before it can start.
//
// A 1000× antibiotic stock is not something you fetch, it is something somebody makes on an
// earlier day. Whether that day is needed depends on WHICH ANTIBIOTIC, because what makes a stock
// worth its own session is the chemistry of making it.
//
// **IT USED TO ASK THE FREEZER, AND THE FREEZER DOES NOT KNOW.** The test was "the inventory
// cannot be shown to hold one", which read a box inventory. JCA, 2026-09-21: *"1000x carb is a
// reagent not a dna. The boxes inventory dnas. Labsheets should not be looking up location of
// stock reagents."* A DNA box answers questions about DNA; asked about a reagent it says nothing,
// and nothing was being read as no. So Tlib3 opened with a sheet telling students to weigh out
// ampicillin powder, above the line "The inventory does not record a stock of amp, Carb" — which
// was true and meant only that it had been asked the wrong question. Worse, an inventory that
// happened to label a tube "Amp" answered yes, so the trigger turned on whether somebody had once
// written a reagent name in a DNA box.
//
// Rules are tried in order and the first that applies wins. `c6-rules antibiotic` prints this file.
import { apply, named } from './lib.js';

export const TITLE = 'Whether a stock-making session is needed first';


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════

// name:  wanted
// when:  any step of the experiment selects with an antibiotic
// then:  the list of them
// why:   Read off the steps rather than asked for, because a transformation names its antibiotic
//        and nothing else in the experiment has to mention it again.
// source: inferred — a toolkit decision
export const wanted = {
  of: ({ antibiotics }) => antibiotics || [],
};

// name:  tricky
// when:  making this one has something about it a person has to be told
// then:  the ones worth a session
// why:   `protocols/modules/preparation_of_antibiotic_1000x_stock.js` is the only place that holds
//        what makes each one awkward — solvent, light, and the notes against it — so it is asked
//        rather than copied. Ampicillin and carbenicillin go into water with nothing to say;
//        erythromycin does not dissolve in water at all, and a student who has not been told reads
//        that as a failed prep.
//
//        The asymmetry still holds and still points this way: a routine stock any lab has made a
//        hundred times costs an hour of somebody's week to be told about again, and a tricky one
//        nobody warned about costs the experiment.
// source: stated 2026-09-12 for why erythromycin in particular — "that has been a recent
//         historical pitfall for this group" — and stated 2026-09-21 for why not the freezer:
//         "Labsheets should not be looking up location of stock reagents".
export const tricky = {
  of: ({ wanted: w, needsSaying }) => (w || []).filter((x) => !!needsSaying(x.name)),
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════

// name:  nothing selects for anything
// when:  no step of this experiment uses an antibiotic
// then:  no stock session
// why:   Not every experiment plates. A construction file that ends at an assembly needs no
//        selection and no stock.
// source: inferred
// eg:    none
export const nothingSelects = {
  alone: true,
  applies: ({ wanted }) => !wanted.length,
  decide: () => ({ inject: [] }),
  says: () => null,
};

// name:  all of them are routine
// when:  every antibiotic this experiment uses goes into water with nothing to say about it
// then:  no stock session
// why:   The ordinary case, and the one the freezer test got wrong. Ampicillin and carbenicillin
//        are made the same way in every lab that uses them, and a sheet explaining how is a sheet
//        that teaches people the other sheets can be skimmed too.
// source: stated 2026-09-21 — JCA, of an experiment using amp and carb: "No antibiotic stock
//         tab is needed"
// eg:    amp, routine
export const allRoutine = {
  alone: true,
  applies: ({ wanted, tricky }) => wanted.length > 0 && tricky.length === 0,
  decide: () => ({ inject: [] }),
  says: () => null,
};

// name:  say the tricky ones, first of everything
// when:  one of them has something about its preparation a person has to be told
// then:  a stock session, placed before every other session in the experiment
// why:   Not merely before the step that plates. Placing it relative to its consumer put it
//        between the assembly and the transformation — true of the dependency and wrong about the
//        week, because plates are poured days ahead and the stock has to exist before the media
//        session that pours them.
//
//        The session is injected rather than offered because a plan that silently omitted it reads
//        as an experiment that does not need it, and the omission only becomes visible on the day
//        somebody cannot pour plates.
// source: stated 2026-09-12 for why erythromycin in particular — "that has been a recent
//         historical pitfall for this group". Placing it first of everything is a toolkit
//         decision, from having placed it wrongly once.
// eg:    erm, tricky
export const sayTheTrickyOnes = {
  applies: () => true,
  decide: ({ tricky }) => ({ inject: tricky }),
  says: ({ tricky }) =>
    `${tricky.map((m) => m.name).join(' and ')} is not made the way people assume, so it gets its `
    + 'own session first — before the media session that pours the plates, not merely before the '
    + 'step that uses it.',
};


export const FACTS = named({ wanted, tricky });

export const RULES = named({ nothingSelects, allRoutine, sayTheTrickyOnes });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES, TITLE }, facts);

/** What a `// eg:` means here: `<antibiotic>, routine` or `<antibiotic>, tricky`, or `none`. */
export const egFacts = (eg) => {
  const s = String(eg).trim();
  if (s === 'none') return { antibiotics: [], needsSaying: () => false };
  const [name, state] = s.split(',').map((x) => x.trim());
  return { antibiotics: [{ name }], needsSaying: () => state === 'tricky' };
};
