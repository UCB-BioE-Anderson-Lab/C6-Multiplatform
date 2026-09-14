// The outgrowth after a transformation, and the controls that make a blank plate readable.
//
// A plate with no colonies has four possible causes — a bad plate, dead cells, a failed assembly,
// a failed transformation — and on its own it cannot tell you which. These rules decide whether
// the cells get an outgrowth first, and which control plates go beside the one you care about.
//
// Rules are tried in order and the first that applies wins. `c6-rules transform` prints this file.
// Who settled what is in `docs/DECISIONS.md`.
import { apply, named } from './lib.js';

export const TITLE = 'Outgrowth and controls for a transformation';

// The antibiotics that need no outgrowth — the ones that do not attack translation. Carbenicillin
// is the standard replacement for ampicillin and both target cell wall biosynthesis.
export const NO_RESCUE = ['carb'];


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════

// name:  antibiotic
// when:  the construction file names what this transformation selects for
// then:  the normalised name, or null where no field could be read
// why:   One field of the construction file decides everything below it. Where the field is
//        missing or unreadable the answer is null and not a guess, because every default here is
//        wrong in a way that costs a plate.
// source: inferred — a toolkit decision about refusing rather than guessing
export const antibiotic = {
  of: ({ ab }) => ab || null,
};

// name:  stockedPlates
// when:  the lab keeps a standing stock of plates for this antibiotic
// then:  true for carb, false for everything else
// why:   Carb plates are poured in bulk under a steward role, so a plate off that stack has been
//        made the same way many times and the batch is not in question.
//
//        Every other antibiotic plate is poured for the experiment that needs it. The plate is
//        then an untested variable, which is why the three-plate set rides with them.
//
//        That this tracks the outgrowth question exactly is a coincidence of which plates this lab
//        stocks, not a law. They are separate facts because a lab that stocked erythromycin plates
//        would still need the outgrowth and would not need the plate control.
// source: stated 2026-09-13 — the lab pours its own plates and stocks carb only, under a steward
//         role
export const stockedPlates = {
  of: ({ ab }) => (ab ? NO_RESCUE.includes(ab) : null),
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════

// name:  antibiotic unreadable
// when:  no antibiotic field could be read from the construction file
// then:  no rescue decision and no controls; the sheet carries the question
// why:   An antibiotic nobody could read is not amp. Defaulting to the no-rescue case would plate
//        kanamycin cells straight after heat shock, which fails completely and silently — the
//        plate is simply blank, and nothing on the sheet would ever mention the missing step.
// source: inferred — a toolkit decision
// eg:    unreadable
export const unreadable = {
  alone: true,
  applies: ({ antibiotic }) => !antibiotic,
  decide: () => ({ rescue: null, controls: [] }),
  says: () =>
    'Could not read which antibiotic this transformation selects for, so whether it needs an '
    + 'outgrowth step and which controls belong beside it are both undecided. Settle them by hand '
    + 'before this sheet is used.',
};

// name:  the antibiotic is slow, so the plate is the outgrowth
// when:  the selection is carbenicillin or ampicillin
// then:  plate straight after the heat shock, and inject no controls
// why:   Amp and carb block cell wall biosynthesis, and a cell thawing out of a heat shock is not
//        building wall yet — it spends the first couple of hours waking up. By the time it needs
//        to make wall it has been translating for a while and is already resistant. The outgrowth
//        still happens; it happens on the plate.
//
//        Carb is also the one antibiotic this lab keeps a standing stock of plates for, poured in
//        bulk under a steward role, so the batch is not an untested variable and the three-plate
//        set is not injected. Controls remain worth a conversation; they are just not automatic.
// source: stated 2026-09-13 — cell wall biosynthesis, and cells waking from a freeze are not
//         building wall for hours
// eg:    carb
export const noOutgrowth = {
  applies: ({ stockedPlates }) => stockedPlates === true,
  decide: () => ({ rescue: false, controls: [] }),
  says: () =>
    'Amp and carb act on cell wall biosynthesis, which these cells will not be doing for the '
    + 'first couple of hours after a heat shock — so they are already resistant by the time it '
    + 'matters. Plate them straight away; no outgrowth step is needed.',
};

// name:  outgrowth and three controls
// when:  the selection is anything else
// then:  outgrow in rich medium first, and plate three controls beside the real one
// why:   Every other antibiotic this lab selects with attacks TRANSLATION — erythromycin,
//        kanamycin, chloramphenicol, spectinomycin and tetracycline all hit the ribosome. Plate
//        straight away and the cell can never translate the resistance gene that has just entered
//        it, because the thing it would need to do that is the thing being blocked. The cells
//        simply die and the plate is blank.
//
//        So the gene has to be expressed BEFORE the antibiotic is applied, which is what the
//        outgrowth in rich medium buys.
//
//        These plates are also poured for the experiment rather than taken off a stocked stack, so
//        three questions have to be answered separately. The
//        positive control transforms a known plasmid into THIS batch of competent cells and
//        answers whether the cells took up DNA. The negative adds no DNA and answers whether the
//        plate is simply growing untransformed cells. The restreak puts control CELLS, which
//        already carry the resistance, onto a plate from the same batch, and answers whether
//        anything could have grown on those plates at all.
//
//        The restreak is not the positive control and must not be folded into it. A batch poured
//        with dead antibiotic looks exactly like a failed transformation on both of the others.
// source: stated 2026-09-13 for the translation mechanism; stated 2026-09-10 and 09-12 for the
//         three controls and what each answers
// eg:    erm; kan
export const outgrowthAndControls = {
  applies: ({ stockedPlates }) => stockedPlates === false,
  decide: ({ antibiotic, named: n, stock, where }) => ({
    rescue: true,
    controls: [
      { kind: 'positive', construct: n, dna: `${n} plasmid`, strain: null, stock,
        what: `transform the same competent cells with the ${n} plasmid`,
        answers: 'the cells are competent and took up DNA' },
      { kind: 'negative', construct: '(none)', dna: 'none — no DNA added', strain: null,
        what: 'the same competent cells with no DNA added',
        answers: 'the plate is not simply growing untransformed cells' },
      { kind: 'restreak', construct: n, dna: 'none — streak the cells', strain: `${n} cells`,
        stock, from: where,
        what: `streak ${n} cells from ${where} onto an ${antibiotic} plate from the same batch`,
        answers: `anything could have grown on this batch of ${antibiotic} plates — a badly `
               + 'poured one looks exactly like a failed transformation' },
    ],
  }),
  says: ({ antibiotic }) =>
    `${antibiotic} acts on translation, so a cell plated straight away can never make the `
    + 'resistance protein it has just been given, and it dies. Grow the cells in rich medium '
    + 'first, so the gene is expressed before the antibiotic is applied.',
};


export const FACTS = named({ antibiotic, stockedPlates });

export const RULES = named({ unreadable, noOutgrowth, outgrowthAndControls });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES, TITLE }, facts);

/** What a `// eg:` means here: the antibiotic a construction file named. */
export const egFacts = (eg) => {
  const ab = String(eg).trim();
  const base = { named: 'the control plasmid', stock: null, where: 'the control stocks box' };
  return ab === 'unreadable' ? { ...base, ab: null } : { ...base, ab };
};
