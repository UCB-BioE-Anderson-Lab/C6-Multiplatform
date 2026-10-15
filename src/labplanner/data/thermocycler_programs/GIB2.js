/**
 * GIB2 — INCOMPLETE. The isothermal hold's duration is not recorded anywhere.
 *
 * GIB2 is real and in use: three SynThera labpackets (SLIP4-singles, SLIP4-8, SLIP5) name
 * it as the program for their Gibson steps, with a 2X GA Master Mix recipe. But the name is
 * ALL they carry — no conditions, and nothing else in any repository defines it.
 *
 * What is known, from JCA 2026-10-15: "standard gibson conditions followed by a 16degC
 * final hold", and "like 50degC for 1 or 2 hrs".
 *
 * WHY THIS FILE EXISTS WITHOUT ITS STEPS. The alternative was to guess from the vendor
 * protocol — NEB's 2X GA Master Mix says 15 min for 2-3 fragments and 60 min for 4-6, and
 * Gibson's 2009 original was 60 min at 50 C. Any of those would produce a file that looks
 * exactly as authoritative as the transcribed ones and would be this program only by
 * coincidence. A student following it would have no way to tell.
 *
 * So the duration is `null` and `incomplete` is true. The loader surfaces this; the
 * validator warns loudly on a labsheet that references it, and does NOT fail — these three
 * labpackets already exist and already compile, and breaking them would be a worse answer
 * than naming the gap.
 */

const GIB2 = {
  name: 'GIB2',
  incomplete: true,
  unknown: ['the duration of the 50 C isothermal hold'],
  why_unknown: 'recorded nowhere; JCA 2026-10-15 recalls "1 or 2 hrs" but was not certain, '
             + 'and a vendor default would be a guess wearing the same clothes as a fact',
  steps: [
    { kind: 'hold', temp_c: 50, time_s: null },
    { kind: 'hold', temp_c: 16, time_s: 0 }
  ]
};

export default GIB2;
