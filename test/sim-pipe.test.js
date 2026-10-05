// C6-SIM'S JSON SURVIVES A PIPE. It ended in `process.exit()`, which discards whatever is still
// queued on stdout, and stdout to a pipe is asynchronous in Node, so `c6-sim --json | anything`
// lost everything past the 64 KB pipe buffer and handed the reader JSON that stopped mid-token.
// From a terminal it looked fine. Found 2026-10-04 on a 180-member library, whose --json is
// ~690 KB and arrived as exactly 65536 bytes. c6-plan learned the same lesson on 2026-09-11.
//
// execFileSync reads through a pipe, which is exactly the consumer that was losing data.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'c6-sim');
const STEPS = 2000;

// A non-repeating template, so each primer has one site.
let x = 2463534242;
const next = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
const SEQ = Array.from({ length: 1200 }, () => 'ACGT'[next() % 4]).join('');
const RC = (s) => s.split('').reverse().map((c) => ({ A: 'T', T: 'A', G: 'C', C: 'G' }[c])).join('');

let root;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'c6-pipe-'));
  const lines = [];
  for (let i = 0; i < STEPS; i++) lines.push(`PCR\tfwd\trev\tpBig\tamp${String(i).padStart(5, '0')}`);
  fs.writeFileSync(path.join(root, 'cf.txt'), lines.join('\n') + '\n');
  fs.writeFileSync(path.join(root, 'big_oligos.txt'),
    `fwd\t${SEQ.slice(100, 124)}\nrev\t${RC(SEQ.slice(700, 724))}\n`);
  const origin = [];
  for (let i = 0; i < SEQ.length; i += 60) {
    origin.push(`${String(i + 1).padStart(9)} ${SEQ.slice(i, i + 60).match(/.{1,10}/g).join(' ')}`);
  }
  fs.writeFileSync(path.join(root, 'pBig.gb'),
    `LOCUS       pBig                  ${SEQ.length} bp    DNA        circular     05-OCT-2026\n`
    + `DEFINITION  .\nFEATURES             Location/Qualifiers\nORIGIN\n${origin.join('\n')}\n//\n`);
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe('c6-sim --json through a pipe', () => {
  it('delivers all of a result larger than the 64 KB pipe buffer', () => {
    const out = execFileSync(process.execPath,
      [BIN, path.join(root, 'cf.txt'), '--project', root, '--json', '--maps'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    expect(out.length).toBeGreaterThan(65536);
    const result = JSON.parse(out);
    expect(result.products).toHaveLength(STEPS);
    expect(result.products[STEPS - 1]).toEqual(expect.objectContaining({ name: `amp${String(STEPS - 1).padStart(5, '0')}`, bp: 624 }));
  });
});
