/**
 * Does every program a labsheet names actually exist, and is it defined?
 *
 * **Nothing checked this before.** `src/labplanner/data/thermocycler_programs/` held one
 * file and was imported by nothing; meanwhile labpackets named PG6K55 thirteen times,
 * PG8K55 five, GIB2 three and PG6K45 twice, none of them defined anywhere. The failure
 * surfaced on 2026-10-14 as a student at a bench: "what is the gibson thermocycler setting
 * you'd like us to use? Since there is no gibson setting in the thermocyclers."
 *
 * TWO FINDINGS, NOT ONE, AND THEY LEAD SOMEWHERE DIFFERENT:
 *
 *   · UNKNOWN  — the labsheet names a program nothing defines. That is an error: the name
 *                is probably a typo or a program that was never written down, and issuing
 *                the sheet sends somebody to a machine to look for it.
 *   · INCOMPLETE — the program exists and its conditions are not recorded (GIB2 today).
 *                That is a WARNING, not an error. Three labpackets already name GIB2 and
 *                already compile; failing them would punish the sheets for a gap in the
 *                data, and the gap is the thing to fix.
 *
 * Collapsing those two into "invalid" would either break working labsheets or let a typo
 * through, depending on which way it was collapsed.
 */

import { PROGRAMS } from '../data/thermocycler_programs/index.js';

/** Program names referenced anywhere in a labpacket. */
export function namesIn(packet) {
  const out = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const p = node.metadata && node.metadata.program;
    if (typeof p === 'string' && p) out.add(p);
    Object.values(node).forEach(walk);
  };
  walk(packet);
  return [...out].sort();
}

/**
 * -> { ok, unknown: [name], incomplete: [{name, unknown}] }
 *
 * `ok` is false only for UNKNOWN. An incomplete program is reported and does not fail.
 */
export function checkPacket(packet) {
  const unknown = [];
  const incomplete = [];
  for (const name of namesIn(packet)) {
    const p = PROGRAMS[name];
    if (!p) { unknown.push(name); continue; }
    if (p.incomplete) incomplete.push({ name, unknown: p.unknown || ['unspecified'] });
  }
  return { ok: unknown.length === 0, unknown, incomplete };
}

export default checkPacket;
