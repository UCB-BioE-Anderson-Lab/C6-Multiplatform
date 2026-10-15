/**
 * TAQ45 — INCOMPLETE. Named by JCA 2026-10-15 as one of the two Taq programs ("55, 45
 * (those are Taq programs)"), and nothing in any repository records what it runs.
 *
 * NOT ASSUMED TO BE PG45's SHAPE WITH A DIFFERENT POLYMERASE. Taq's extension rate and
 * denaturation temperature differ from PrimeSTAR GXL's, so deriving these from the GXL
 * family would be inventing a protocol rather than recording one.
 *
 * No labsheet currently references it, so nothing is blocked by this being empty.
 */

const TAQ45 = {
  name: 'TAQ45',
  polymerase: 'Taq',
  incomplete: true,
  unknown: ['every step'],
  why_unknown: 'named by the principal; conditions recorded nowhere',
  anneal_c: 45,
  steps: null
};

export default TAQ45;
