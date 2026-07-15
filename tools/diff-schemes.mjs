// Compare xnb-js plugin schemes against the actual game's data classes
// (from the doc XML that ships with the game).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const gameDir = process.argv[2];
const docXml = readFileSync(join(gameDir, 'StardewValley.GameData.xml'), 'utf-8');
const sdv = await import('xnb/dist/plugins/stardewvalley/index.module.js');

const classes = [
  'StardewValley.GameData.Objects.ObjectData',
  'StardewValley.GameData.Objects.ObjectBuffData',
  'StardewValley.GameData.Objects.ObjectGeodeDropData',
  'StardewValley.GameData.BigCraftables.BigCraftableData',
  'StardewValley.GameData.Weapons.WeaponData',
  'StardewValley.GameData.Weapons.WeaponProjectile',
  'StardewValley.GameData.Shirts.ShirtData',
  'StardewValley.GameData.Pants.PantsData',
  'StardewValley.GameData.Tools.ToolData',
  'StardewValley.GameData.Buffs.BuffAttributesData',
];

for (const cls of classes) {
  const re = new RegExp(`<member name="[PF]:${cls.replace(/\./g, '\\.')}\\.([A-Za-z0-9_]+)"`, 'g');
  const docMembers = new Set([...docXml.matchAll(re)].map((m) => m[1]));
  const scheme = sdv.schemes[cls];
  if (!scheme) {
    console.log(`${cls}: NO SCHEME IN PLUGIN (doc has ${docMembers.size} members)`);
    continue;
  }
  const schemeFields = new Set(Object.keys(scheme).map((k) => k.replace(/^\$/, '')));
  const missing = [...docMembers].filter((m) => !schemeFields.has(m));
  const extra = [...schemeFields].filter((m) => !docMembers.has(m));
  console.log(`${cls}:`);
  if (missing.length) console.log(`  missing from scheme: ${missing.join(', ')}`);
  if (extra.length) console.log(`  in scheme but not in game: ${extra.join(', ')}`);
  if (!missing.length && !extra.length) console.log('  OK');
}
