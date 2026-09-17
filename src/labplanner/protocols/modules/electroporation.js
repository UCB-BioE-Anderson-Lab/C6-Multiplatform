// electroporation.js
// Getting verified plasmid into an assay host with a pulse, parameterized for host, plasmid,
// selection, incubation temperature, and the three electrical/recovery values that are NOT
// universal.
//
// JCA, 2026-09-17, ruling the "no protocol exists" claim FALSE: *"We should make an
// electroporation sheet."*
//
// **THE NUMBERS ARE NOT IN HERE AND WILL NOT BE.** Cuvette gap, field strength and recovery medium
// are properties of an organism and a machine — B. subtilis in a 1 mm cuvette is not L. lactis in a
// 2 mm one, and neither is what somebody else's electroporator calls the same setting. This module
// holds the PROCEDURE, which is the part that is the same everywhere: chill everything, get the
// salt out, pulse, and get the cells into recovery medium within seconds. Where a value has not
// been supplied the sheet says so in the step that needs it, rather than printing a number.
//
// That is the same rule `heat_shock_transformation` broke by defaulting to Amp — a default that
// reads exactly like an answer. A student reading "pulse at 2.5 kV" cannot tell a house value from
// a guess; a student reading "voltage: not on file — ask before you pulse" can.

// Timing — see docs/protocols/TIMING.txt. Minutes.
export const timing = {
  ends_at: "plates into the incubator",
  prep: [
    { label: "cuvettes and cells onto ice", min: 15, gates: "pulsing" },
    { label: "plates warming in the incubator", min: 10, gates: "plating" }
  ],
  work: [
    { label: "wash and resuspend, if cells are not already competent", min: 40, max: 60 },
    { label: "pulse, one cuvette at a time", min: 2, max: 3 }
  ],
  wait: [
    { label: "DNA and cells together on ice", min: 1, max: 5 }
  ],
  limits: [
    {
      step: "into recovery medium after the pulse",
      min: 0,
      max: 1,
      why: "the pores reseal in about a minute and the cells are dying while they are open. Late "
         + "recovery is the single commonest reason an electroporation gives no colonies, and it "
         + "fails silently — the plate is simply blank."
    },
    {
      step: "recovery before plating",
      min: 60,
      max: 180,
      why: "the resistance gene has to express. Shorter and the marker is not on yet; much longer "
         + "and one transformant becomes a lawn of its own descendants, so the colony count stops "
         + "meaning events."
    }
  ],
  unknown: ["wash volumes, which depend on the organism", "plating time per plate"]
};

/**
 * What a construction file must say before this operation is described at all.
 *
 * These three have no generic answer — cuvette gap, field strength and recovery medium are
 * properties of an organism and a machine — so a file that omits them has not described the
 * operation it is asking for, and `planning/cfToJobs.js` refuses it. The bench volumes below are
 * not here: a typical cell volume is typical everywhere, and being 20% off costs efficiency rather
 * than the experiment.
 */
export const REQUIRED = [
  { key: "cuvette_gap_mm", says: "gap=", what: "the cuvette gap, in mm" },
  { key: "field", says: "voltage=", what: "the voltage or field strength to pulse at" },
  { key: "recovery_medium", says: "recovery=", what: "the recovery medium — for many hosts it is not plain LB" },
];

export const inputs = [
  { name: "plasmid", type: "text", label: "Plasmid", default: "plasmid_name" },
  { name: "host", type: "text", label: "Assay host", default: "host_strain" },
  { name: "antibiotics", type: "text", label: "Selection (comma-separated)", default: "" },
  { name: "temperature_C", type: "number", label: "Incubation temperature (°C)", default: 30, step: 1 },

  // THE BENCH QUANTITIES. Every one is a real variable between hosts — L. lactis is not E. coli is
  // not B. subtilis — so they are inputs rather than numbers in the prose. JCA, 2026-09-17: *"you
  // can write a generic electroporation instruction with inputs that are the cell volume, the dna
  // volume, the rescue volume, the size cuvette, etc."*
  //
  // These four carry GENERIC defaults, and the sheet says so wherever it used one. A volume that is
  // 20% off costs efficiency; the three below it cost the whole experiment, which is why they are
  // treated differently.
  { name: "cells_uL", type: "number", label: "Competent cells per reaction (µL)", default: 40, step: 5 },
  { name: "dna_uL", type: "number", label: "DNA per reaction (µL)", default: 1, step: 0.5 },
  { name: "rescue_uL", type: "number", label: "Recovery medium added after the pulse (µL)", default: 1000, step: 100 },
  { name: "recover_min", type: "number", label: "Recovery before plating (min)", default: 120, step: 15 },

  // THE THREE WITH NO GENERIC ANSWER. An empty string prints an instruction to find out; a value
  // prints the value. Neither invents one. → `design/retransform.js § METHODS`
  { name: "cuvette_gap_mm", type: "text", label: "Cuvette gap (mm)", default: "" },
  { name: "field", type: "text", label: "Voltage or field strength", default: "" },
  { name: "recovery_medium", type: "text", label: "Recovery medium", default: "" },

  { name: "product_name", type: "text", label: "Product name", default: "product_name" }
];

/** What each quantity is called on the page, for the "these are generic" banner. */
const LABEL = {
  cells_uL: "the cell volume",
  dna_uL: "the DNA volume",
  rescue_uL: "the recovery volume",
  recover_min: "the recovery time"
};

export function factory(values = {}) {
  const plasmid = String(values.plasmid ?? "plasmid_name");
  const host = String(values.host ?? "host_strain");
  const antibiotics = String(values.antibiotics ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const tempC = Math.round(Number(values.temperature_C ?? 30));
  const product = String(values.product_name ?? "product_name");

  const gap = String(values.cuvette_gap_mm ?? "").trim();
  const field = String(values.field ?? "").trim();
  const recovery = String(values.recovery_medium ?? "").trim();

  // **WHICH NUMBERS ARE THIS HOST'S AND WHICH ARE JUST TYPICAL.** A sheet that prints 40 µL without
  // saying where 40 came from is indistinguishable from one that was told 40, and somebody
  // optimising a poor efficiency needs to know which of these they are allowed to change.
  const given = (k) => values[k] !== undefined && values[k] !== null && values[k] !== "";
  const generic = [];
  const num = (k, fallback) => {
    if (given(k)) return Number(values[k]);
    generic.push(k);
    return fallback;
  };
  const q = {
    cells_uL: num("cells_uL", 40),
    dna_uL: num("dna_uL", 1),
    rescue_uL: num("rescue_uL", 1000),
    recover_min: num("recover_min", 120)
  };

  // **NO FALLBACK TEXT HERE, BECAUSE A COMPILE THAT REACHES THIS PROTOCOL HAS THE VALUES.** An
  // earlier draft printed "not on file — ask what gap this host is done in" in the step that needed
  // each one. JCA, 2026-09-17: *"the right answer is you reject the request, because the
  // characterization operation was not defined. In the LLM interaction, that would be followed up
  // with a discussion of how to describe the operation and then recompiling."*
  //
  // He is right, and it is the same ruling as "Bubba" and the empty antibiotic cell. A sheet that
  // admits its own gaps is still a sheet somebody prints and carries to a bench; the admission does
  // not stop them, it just means the page told them so. The refusal happens in
  // `planning/cfToJobs.js`, and what a person does next is describe the operation and compile
  // again — which is the loop, not an error in it.
  const gapSays = `**${gap} mm**`;
  const fieldSays = `**${field}**`;
  const recoverySays = `**${recovery}**`;

  const selection = antibiotics.length ? antibiotics.join(", ") : "the selection on your labsheet";
  const missing = [!gap && "cuvette gap", !field && "voltage", !recovery && "recovery medium"]
    .filter(Boolean);

  const name = "Electroporation";
  const description = `Electroporate ${plasmid} into ${host} and plate on ${selection} at ${tempC} °C`;

  const template = `
${generic.length ? `> **Volumes on this sheet are generic, not ${host}'s.** ${generic.map((k) => LABEL[k]).join(", ")} ${generic.length === 1 ? "was" : "were"} not recorded for this host, so a typical value is printed. They are a starting point you may change; the values below are not.
` : ""}${"" && missing.length ? `> **Before you start:** ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not recorded for ${host}. The steps below are the procedure; those values are not something this sheet can work out for you. Get them, write them in, and keep the sheet.
` : ""}
**What this is for**
- This is a **retransformation**: the plasmid has already been sequence-verified, so you are moving
  known-good DNA into ${host} to assay it. You need **a few colonies, not a library** — one working
  colony is the point.

**Plates and labeling**
- One plate per reaction, carrying **${selection}**, plus your control plates.
- Warm the plates in the incubator first. **This is the slow step, so start it before anything
  else.** Plates out of the fridge carry condensation and you cannot write on a wet plate.
- Label the **bottom** of each plate with the date, your initials, **${host}**, **${plasmid}**, and
  **${selection}**.
{pouring_petri_dishes}

**Protocol**
1. **Chill everything.** Cuvettes, the DNA, and the cells go on ice. A cuvette at room temperature
   arcs.
2. **Thaw electrocompetent ${host} on ice.** If cells have to be made, they are washed repeatedly
   in cold water or glycerol until the salt is gone — this is the whole difficulty of the method
   and it takes most of the morning.
3. **Salt arcs.** Use DNA that has been cleaned up or ethanol-precipitated; a miniprep eluted in
   EB is usually fine, a ligation or assembly reaction straight from the tube is usually not. If
   you are unsure, dialyse or dilute.
4. Add **${q.dna_uL} µL DNA** to **${q.cells_uL} µL cells** on ice and mix by flicking. Leave them
   together **1–5 min**.
   - Keep the DNA to roughly a tenth of the volume or less. More than that and you are adding the
     elution buffer's salt along with it.
5. Transfer to a chilled cuvette, gap ${gapSays}. **Tap the cuvette down** so the liquid sits in
   the bottom with no bubbles — a bubble is where the arc starts.
6. **Dry the outside of the cuvette** and put it in the chamber. Pulse at ${fieldSays}.
   - **Write down the time constant.** It is the only evidence you have that the pulse was normal.
     A short one means salt, and the next cuvette will arc too.
   - If it arcs: the sample is gone. Do not re-pulse it.
7. **Immediately** — within seconds, not minutes — add **${q.rescue_uL} µL** of ${recoverySays} to
   the cuvette, pipette up and down once, and transfer to a tube.
   - **This is the step that goes wrong.** The pores reseal in about a minute and the cells are
     dying while they are open. Nothing about a blank plate afterwards will tell you this is what
     happened.
8. **Recover** at **${tempC} °C**, shaking gently, for **${q.recover_min} min** before plating. The
   resistance gene has to be expressed before ${selection} means anything.
9. Plate on **${selection}**, spreading with beads, and incubate **inverted** at **${tempC} °C**.
   Plate a **generous volume and a small volume** — you do not know the efficiency in this host and
   a lawn answers nothing.
10. Read the plates against your control plates before picking. → the controls on your labsheet.
`;

  return {
    name,
    description,
    includes: { required: [], optional: ["pouring_petri_dishes"] },
    derived: {
      plasmid,
      host,
      antibiotics,
      incubation_temperature_C: tempC,
      product_name: product,
      ...q,
      // WHICH OF THE FOUR WERE TYPICAL RATHER THAN THIS HOST'S, so a caller can say so rather than
      // recomputing it from the absence of an input.
      generic_defaults: generic,
      cuvette_gap_mm: gap || null,
      field: field || null,
      recovery_medium: recovery || null,
      // What the sheet could not say, so a caller can report it rather than rediscovering it.
      missing
    },
    template
  };
}
