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

// The antibiotics that need no outgrowth. Carbenicillin is the standard replacement for
// ampicillin and both select for the same enzyme.
export const NO_RESCUE = ['carb'];


// ════ FACTS ═════════════════════════════════════════════════════════════════════════════════════

// name:  antibiotic
// when:  the construction file names what this transformation selects for
// then:  the normalised name, or null where no field could be read
// why:   One field of the construction file decides everything below it. Where the field is
//        missing or unreadable the answer is null and not a guess, because every default here is
//        wrong in a way that costs a plate.
export const antibiotic = {
  of: ({ ab }) => ab || null,
};

// name:  selfPoured
// when:  the plates were poured in the lab rather than bought
// then:  true for anything but carb/amp
// why:   Carb and amp plates are bought and reliable. Everything else is poured here, which means
//        the plates themselves are an untested variable — the same antibiotic that needs an
//        outgrowth is the one whose plates nobody has proved.
//
//        That the two coincide is a convenience, not a law. They are separate facts because a lab
//        that bought its erythromycin plates would want the outgrowth and not the plate control.
export const selfPoured = {
  of: ({ ab }) => (ab ? !NO_RESCUE.includes(ab) : null),
};


// ════ RULES ═════════════════════════════════════════════════════════════════════════════════════

// name:  antibiotic unreadable
// when:  no antibiotic field could be read from the construction file
// then:  no rescue decision and no controls; the sheet carries the question
// why:   An antibiotic nobody could read is not amp. Defaulting to the no-rescue case would plate
//        kanamycin cells straight after heat shock, which fails completely and silently — the
//        plate is simply blank, and nothing on the sheet would ever mention the missing step.
// eg:    unreadable
export const unreadable = {
  alone: true,
  applies: ({ antibiotic }) => !antibiotic,
  decide: () => ({ rescue: null, controls: [] }),
  says: () => 'could not read which antibiotic this selects for — decide the rescue step and the '
            + 'controls by hand.',
};

// name:  secreted enzyme, no outgrowth
// when:  the selection is carbenicillin or ampicillin
// then:  plate straight after the heat shock, and inject no controls
// why:   Carb and amp select for a β-lactamase that acts OUTSIDE the cell, so a cell that has
//        taken up the plasmid is protected by its neighbours' enzyme long before it has expressed
//        its own. There is nothing for an outgrowth to accomplish.
//
//        These plates are bought rather than poured, so the plate itself is not in question and
//        the three-plate set is not injected. Controls remain worth a conversation; they are just
//        not automatic.
// eg:    carb
export const noOutgrowth = {
  applies: ({ selfPoured }) => selfPoured === false,
  decide: () => ({ rescue: false, controls: [] }),
  says: () => 'carb/amp selects for a secreted β-lactamase, so plate straight after heat shock.',
};

// name:  outgrowth and three controls
// when:  the selection is anything else
// then:  outgrow in rich medium first, and plate three controls beside the real one
// why:   Every other resistance acts inside the cell, so the gene has to be expressed before the
//        antibiotic is applied. Without the outgrowth the transformants die and the plate is blank.
//
//        The plates are also poured here, so three questions have to be answered separately. The
//        positive control transforms a known plasmid into THIS batch of competent cells and
//        answers whether the cells took up DNA. The negative adds no DNA and answers whether the
//        plate is simply growing untransformed cells. The restreak puts control CELLS, which
//        already carry the resistance, onto a plate from the same batch, and answers whether
//        anything could have grown on those plates at all.
//
//        The restreak is not the positive control and must not be folded into it. A batch poured
//        with dead antibiotic looks exactly like a failed transformation on both of the others.
// eg:    erm; kan
export const outgrowthAndControls = {
  applies: ({ selfPoured }) => selfPoured === true,
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
    `${antibiotic} selection needs the resistance gene expressed before plating — outgrow in rich `
    + 'medium first.',
};


export const FACTS = named({ antibiotic, selfPoured });

export const RULES = named({ unreadable, noOutgrowth, outgrowthAndControls });

/** The first rule that applies, and what it decided. → `lib.js § apply` */
export const choose = (facts) => apply({ FACTS, RULES }, facts);

/** What a `// eg:` means here: the antibiotic a construction file named. */
export const egFacts = (eg) => {
  const ab = String(eg).trim();
  const base = { named: 'the control plasmid', stock: null, where: 'the control stocks box' };
  return ab === 'unreadable' ? { ...base, ab: null } : { ...base, ab };
};
