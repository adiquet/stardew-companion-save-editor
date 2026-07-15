/**
 * The load → serialize (no edits) → byte-identical guarantee is the
 * foundation everything else stands on. These tests run against real save
 * files in fixtures/private when present (never committed), plus a small
 * synthetic sample so CI has coverage without personal data.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { SaveDocument } from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const privateFixtures = join(here, '..', '..', '..', 'fixtures', 'private');

function roundtripBytes(path: string) {
  const original = readFileSync(path);
  const save = SaveDocument.fromBytes(new Uint8Array(original));
  const out = Buffer.from(save.toBytes());
  if (!out.equals(original)) {
    // Locate the first difference to make failures actionable.
    let i = 0;
    const n = Math.min(out.length, original.length);
    while (i < n && out[i] === original[i]) i++;
    const ctx = (b: Buffer) => b.subarray(Math.max(0, i - 60), i + 60).toString('utf-8');
    expect.fail(
      `Round-trip diverged at byte ${i} (original ${original.length}B, output ${out.length}B)\n` +
        `original: …${ctx(original)}…\noutput:   …${ctx(out)}…`
    );
  }
}

describe('byte-identical round-trip', () => {
  it('synthetic sample survives', () => {
    const text =
      '<?xml version="1.0" encoding="utf-8"?><SaveGame xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema"><player><name>A &amp; B &gt; C</name><money>100</money><items><Item xsi:nil="true" /><Item xsi:type="MeleeWeapon"><name>Sword</name></Item></items></player><gameVersion>1.6.15</gameVersion></SaveGame>';
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    const bytes = Buffer.concat([bom, Buffer.from(text, 'utf-8')]);
    const save = SaveDocument.fromBytes(new Uint8Array(bytes));
    expect(Buffer.from(save.toBytes()).equals(bytes)).toBe(true);
  });

  const realFull = join(privateFixtures, 'MrBurns_146087234');
  it.runIf(existsSync(realFull))('real full save survives', () => {
    roundtripBytes(realFull);
  });

  const realFarmer = join(privateFixtures, 'SaveGameInfo');
  it.runIf(existsSync(realFarmer))('real SaveGameInfo survives', () => {
    roundtripBytes(realFarmer);
  });
});

describe('safety', () => {
  it('rejects DOCTYPE (XXE hardening)', () => {
    expect(() =>
      SaveDocument.fromText('<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e "x">]><SaveGame />')
    ).toThrow(/DOCTYPE/);
  });

  it('rejects non-save XML', () => {
    expect(() => SaveDocument.fromText('<html><body>nope</body></html>')).toThrow(
      /Not a Stardew Valley save/
    );
  });

  it('reports version info', () => {
    const save = SaveDocument.fromText(
      '<?xml version="1.0" encoding="utf-8"?><SaveGame><player /><gameVersion>1.6.15</gameVersion></SaveGame>'
    );
    expect(save.version()).toEqual({ gameVersion: '1.6.15', verified: true });
  });
});
