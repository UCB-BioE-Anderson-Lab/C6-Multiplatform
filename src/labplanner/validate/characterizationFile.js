/**
 * The Characterization File — what happens to the plasmid after it is built.
 *
 * **A sibling of the construction file, not an extension of it.** JCA, 2026-09-11: *"A
 * construction file is about the chemical structure of the dna, and nothing more is happening in
 * the experiment after that point."* So the CF stops when the molecule is finished, and this
 * says what the experiment then does with it: move it into the organism it was made for, grow
 * it, and measure something.
 *
 * **Same grammar deliberately.** One operation per line, tab- or multi-space separated, input
 * names first and the product last — because a PL who can read a construction file should not
 * have to learn a second syntax. What it adds is `key=value` arguments, which construction
 * files do not need and measurements cannot do without: `ex=483` and `em=525` are not
 * interchangeable and position will not save you.
 *
 *     Retransform   pBET8                 host=L.lactis antibiotic=Erm temp=30 method=electroporation   pBET8_lactis
 *     Pick          pBET8_lactis          n=4                                                           pBET8_clones
 *     Assay         pBET8_clones          reporter=amilGFP ex=483 em=525 bandpass=30 od=600             lactis3_1_assay
 *
 * **Assay is ONE operation carrying BOTH measurements, and that is a scientific constraint
 * rather than a simplification.** JCA: *"fluorescence and absorbance are measured in the same
 * session, and thus are one labsheet. You need to do both simultaneously. If you didn't, they'd
 * be at different times and the cells would change."* LabOP splits them into MeasureFluorescence
 * and MeasureAbsorbance, which is right for a machine executing steps and wrong for a page a
 * person works from: separating them on paper invites doing them apart, and then the OD does not
 * normalise the fluorescence it was read against.
 *
 * The parameter NAMES come from LabOP's measurement primitives — `ex`, `em`, `bandpass`, `gain`
 * abbreviate excitationWavelength, emissionWavelength, emissionBandpassWidth, gain — because
 * that list is a better account of what a reading needs than the one the workbooks use. Taking
 * the field names is not adopting the model; see `docs/ONTOLOGY.md § Appendix`.
 */

/** Operations a characterization file may name. Nothing here changes the DNA. */
export const CHARACTERIZATION_OPERATIONS = ['retransform', 'culture', 'pick', 'assay'];

/** Which argument is the thing being acted on, per operation. */
const SUBJECT = {
  retransform: 'dna', culture: 'inoculum', pick: 'plate', assay: 'samples',
};

const NAMED = /^([a-z][a-z0-9_]*)=(.*)$/i;

/**
 * Parse a characterization file. -> {steps, problems}
 *
 * absence-ok: an empty file yields no steps and no problems. A file of comments is empty.
 */
export function parseCharacterization(text, name = '') {
  const steps = [];
  const problems = [];
  String(text).split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) return;
    const tokens = line.split(/\t+|\s{2,}| /).filter(Boolean);
    const op = tokens[0].toLowerCase();
    if (!CHARACTERIZATION_OPERATIONS.includes(op)) {
      problems.push({ line: i + 1, code: 'UNKNOWN_OPERATION',
        message: `line ${i + 1}${name ? ` of ${name}` : ''} begins with "${tokens[0]}", which a `
          + `characterization file does not know. Known: ${CHARACTERIZATION_OPERATIONS.join(', ')}. `
          + `A step that changes the DNA belongs in a construction file instead.` });
      return;
    }
    const rest = tokens.slice(1);
    const args = {};
    const positional = [];
    for (const t of rest) {
      const m = NAMED.exec(t);
      if (m) args[m[1].toLowerCase()] = m[2];
      else positional.push(t);
    }
    // First positional is the subject, last is the product. A step with only one is a step whose
    // product was never named, and naming it `undefined` downstream is how a dependency edge
    // quietly points at nothing.
    if (positional.length < 2) {
      problems.push({ line: i + 1, code: 'NO_PRODUCT',
        message: `line ${i + 1}${name ? ` of ${name}` : ''} names ${positional.length} unnamed `
          + `value(s); a step needs both a subject and a product so later steps can refer to it.` });
      return;
    }
    const output = positional[positional.length - 1];
    const subject = positional.slice(0, -1);
    steps.push({ _characterization: true, operation: op, output,
                 [SUBJECT[op] || 'inputs']: subject, dnas: subject, args, line: i + 1 });
  });
  return { steps, problems };
}

/** Does this filename look like a characterization file? */
export function isCharacterizationFile(basename) {
  return /characteri[sz]ation.*\.txt$/i.test(String(basename));
}
