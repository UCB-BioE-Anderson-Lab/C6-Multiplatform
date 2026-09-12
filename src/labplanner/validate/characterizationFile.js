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
 * **An assay subtype IS a protocol, and `protocol=` names it.** JCA, 2026-09-11: *"I think we
 * are writing custom subtypes of assays, that are basically protocols, and we can link back to
 * that ontology in cloning-tutorials to express them."*
 *
 *     Assay  pBET8_clones  protocol=plate_reader_fluorescence ex=483 em=525 od=600  lactis3_1_assay
 *
 * That library already exists — `../protocols/modules/`, vendored into cloning-tutorials for
 * teaching — and `plate_reader_fluorescence` was already in it, already reading fluorescence and
 * OD600 in one pass at 483 nm. The subtype mechanism did not need inventing; it needed naming.
 *
 * **Why subtypes are protocols rather than operations.** There is no closed vocabulary for
 * assays the way there is for cloning: six operations cover essentially all of construction,
 * and nothing covers horse serum protection, LCMS, RNA-Seq and colony counting at once. They
 * share no parameters and no procedure. So `assay` stays one operation — a category marker —
 * and the subtype selects the prose and the parameter set, which is the only layer where they
 * genuinely differ.
 *
 * **An assay returns data, and the data has a shape. What it has no output of is MATERIAL.**
 * JCA: *"An assay returns data, and there is a shape to that data. But there is no material
 * output."* That is why it is terminal in the dependency graph — nothing downstream consumes
 * it — and why being terminal costs nothing: the planner never needs an assay's internals, only
 * its place in the order.
 *
 * ## The two levels, which is the governing idea
 *
 * JCA, 2026-09-11: *"the Characterization File is written at the level of pBET8 — it's telling
 * you how that theoretical plasmid should be assayed. But at the labsheet level it gets
 * documented as a specific sample and clone id."*
 *
 *     characterization file   pBET8          the design. How this plasmid SHOULD be assayed.
 *                                            Written once, before anything exists.
 *     labsheet                pBET8-C        the instance. Which tube, which clone, which box
 *                                            and well. Filled in by a person, after.
 *
 * **Neither level can do the other's job.** The file cannot name a clone because no clone exists
 * when it is written. The labsheet cannot state the design because it is one run of it, and the
 * next student's run is a different sheet and the same design.
 *
 * **The join is the student's own choice**, recorded on the sheet: which clone they took
 * forward, and where they put the tubes. That is why the sheet is static and the person supplies
 * the specificity — and why the returned sheet is what links a measurement back to a particular
 * sample rather than to an abstraction.
 *
 * **Inputs and outputs are heterogeneous in KIND and uniform in MECHANISM**, and that is how it
 * goes. JCA, 2026-09-11: *"So, the shape of the inputs and outputs are heterogeneous. I guess
 * that's how it goes?"*
 *
 * A PCR consumes a plasmid, a Retransform consumes a plasmid and a host, a Pick consumes a
 * plate, a Culture consumes colonies, an Assay consumes cultures. Nothing forces those into one
 * shape and nothing should.
 *
 * What IS uniform is the mechanism, and it is the part that matters:
 *
 *   every input is a NAME       a construct, a strain, a plate — never a tube
 *   the operation says its KIND `SUBJECT` below; a Pick's subject is a plate, an Assay's is
 *                               cultures, and the two are not interchangeable
 *   planning RESOLVES it        against the inventory, to a physical sample, the way
 *                               `chooseTemplateForPCR` already ranks minipreps of a construct
 *
 * **So `Retransform pBET8` names a sequence and not a sample.** JCA: *"It is literally referring
 * to a sequence, in whatever drop of liquid you find in the freezer. It is not a specific
 * sample, and it is not necessarily from mach1. But it should be identifiable, and linked to a
 * source tube in the inventory like with pcr."* The clone identifier — `pBET8-A` — belongs to
 * the tube and appears in the filled-in labsheet, not in the plan.
 *
 * **The risk this creates, so that it is on the record:** while kinds are declared here and
 * checked nowhere, nothing stops a plate being named where a plasmid is meant. The resolution
 * would simply find no sample and report it as missing — which is a true statement about the
 * inventory and a misleading one about the file.
 *
 * The measurement parameter NAMES come from LabOP's primitives — `ex`, `em`, `bandpass`, `gain`
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
