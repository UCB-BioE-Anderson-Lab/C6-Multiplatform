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

export const inputs = [
  { name: "plasmid", type: "text", label: "Plasmid", default: "plasmid_name" },
  { name: "host", type: "text", label: "Assay host", default: "host_strain" },
  { name: "antibiotics", type: "text", label: "Selection (comma-separated)", default: "" },
  { name: "temperature_C", type: "number", label: "Incubation temperature (°C)", default: 30, step: 1 },
  // THE THREE THAT HAVE NO DEFAULT. An empty string here prints an instruction to find out, and a
  // number prints the number. Neither invents one. → `design/retransform.js § METHODS`
  { name: "cuvette_gap_mm", type: "text", label: "Cuvette gap (mm)", default: "" },
  { name: "field", type: "text", label: "Voltage or field strength", default: "" },
  { name: "recovery_medium", type: "text", label: "Recovery medium", default: "" },
  { name: "product_name", type: "text", label: "Product name", default: "product_name" }
];

export function factory(values = {}) {
  const plasmid = String(values.plasmid ?? "plasmid_name");
  const host = String(values.host ?? "host_strain");
  const antibiotics = String(values.antibiotics ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const tempC = Math.round(Number(values.temperature_C ?? 30));
  const product = String(values.product_name ?? "product_name");

  const gap = String(values.cuvette_gap_mm ?? "").trim();
  const field = String(values.field ?? "").trim();
  const recovery = String(values.recovery_medium ?? "").trim();

  // **ASK, NAMING WHERE THE ANSWER LIVES.** "Ask a supervisor" with no other information is how a
  // student ends up guessing anyway. Each of these says what to ask for and that the sheet cannot
  // supply it, so the gap is actionable instead of merely admitted.
  const ask = (what) => `**not on file — ${what}, and write it on this sheet before you pulse**`;
  const gapSays = gap ? `**${gap} mm**` : ask("ask what gap this host is done in");
  const fieldSays = field ? `**${field}**` : ask("ask what setting this host is pulsed at");
  const recoverySays = recovery ? `**${recovery}**`
    : ask("ask which recovery medium this host needs — for many hosts it is not plain LB");

  const selection = antibiotics.length ? antibiotics.join(", ") : "the selection on your labsheet";
  const missing = [!gap && "cuvette gap", !field && "voltage", !recovery && "recovery medium"]
    .filter(Boolean);

  const name = "Electroporation";
  const description = `Electroporate ${plasmid} into ${host} and plate on ${selection} at ${tempC} °C`;

  const template = `
${missing.length ? `> **Before you start:** ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not recorded for ${host}. The steps below are the procedure; those values are not something this sheet can work out for you. Get them, write them in, and keep the sheet.
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
4. Add **DNA to the cells** on ice and mix by flicking. Leave them together **1–5 min**.
5. Transfer to a chilled cuvette, gap ${gapSays}. **Tap the cuvette down** so the liquid sits in
   the bottom with no bubbles — a bubble is where the arc starts.
6. **Dry the outside of the cuvette** and put it in the chamber. Pulse at ${fieldSays}.
   - **Write down the time constant.** It is the only evidence you have that the pulse was normal.
     A short one means salt, and the next cuvette will arc too.
   - If it arcs: the sample is gone. Do not re-pulse it.
7. **Immediately** — within seconds, not minutes — add **1 mL** of ${recoverySays} to the cuvette,
   pipette up and down once, and transfer to a tube.
   - **This is the step that goes wrong.** The pores reseal in about a minute and the cells are
     dying while they are open. Nothing about a blank plate afterwards will tell you this is what
     happened.
8. **Recover** at **${tempC} °C**, shaking gently, for **1–3 h** before plating. The resistance
   gene has to be expressed before ${selection} means anything.
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
      cuvette_gap_mm: gap || null,
      field: field || null,
      recovery_medium: recovery || null,
      // What the sheet could not say, so a caller can report it rather than rediscovering it.
      missing
    },
    template
  };
}
