// Whether an experiment needs a stock-making session before it can start.
//
// A 1000× antibiotic stock is not something you fetch, it is something somebody makes on an
// earlier day. Whether that day is needed depends on what is already in the freezer, and the cost
// of being wrong is asymmetric: an unnecessary session wastes an hour, and a missing one stops the
// week at the media prep.
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

// name:  held
// when:  the inventory shows a stock under any spelling of the name
// then:  the ones it has
// why:   The inventory writes what is on the tube — "Erm", "erythromycin", "Amp" — so a lookup
//        tries the name as given and its obvious short form.
//
//        A miss means the sheet says to make it, which is the safe direction: making a stock that
//        already exists costs an hour, and assuming one that does not exist stops the week at the
//        media prep.
// source: inferred — a toolkit decision about which way to fail
export const held = {
  of: ({ wanted: w, stockIn }) => (w || []).filter((x) => !!stockIn(x.name)),
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

// name:  the freezer has them all
// when:  every antibiotic this experiment needs is already in the inventory
// then:  no stock session
// why:   The ordinary case for a lab that keeps its common stocks made up.
// source: inferred
// eg:    amp, held
export const freezerHasThem = {
  alone: true,
  applies: ({ wanted, held }) => wanted.length > 0 && held.length === wanted.length,
  decide: () => ({ inject: [] }),
  says: () => null,
};

// name:  make what is missing, first of everything
// when:  the inventory cannot be shown to hold one of them
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
// eg:    erm, missing
export const makeWhatIsMissing = {
  applies: () => true,
  decide: ({ wanted, held }) => ({ inject: wanted.filter((w) => !held.includes(w)) }),
  says: ({ wanted, held }) => {
    const missing = wanted.filter((w) => !held.includes(w));
    return `No ${missing.map((m) => m.name).join(' or ')} stock is in the inventory, so one is `
      + 'made first — before the media session that pours the plates, not merely before the step '
      + 'that uses it.';
  },
};


export const FACTS = named({ wanted, held });

export const RULES = named({ nothingSelects, freezerHasThem, makeWhatIsMissing });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES, TITLE }, facts);

/** What a `// eg:` means here: `<antibiotic>, held` or `<antibiotic>, missing`, or `none`. */
export const egFacts = (eg) => {
  const s = String(eg).trim();
  if (s === 'none') return { antibiotics: [], stockIn: () => null };
  const [name, state] = s.split(',').map((x) => x.trim());
  return { antibiotics: [{ name }], stockIn: () => (state === 'held' ? { construct: name } : null) };
};
