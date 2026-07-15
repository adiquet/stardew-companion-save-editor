/**
 * Dev-time extractor: builds packages/core/data/items.json (the item picker's
 * reference database) from the game's own Content/Data XNB files.
 *
 * Usage: node tools/extract-items.mjs "F:\SteamLibrary\steamapps\common\Stardew Valley"
 *
 * Note on the xnb loading trick: the published xnb@1.3.0 bundle contains a
 * full reflective-scheme engine for Stardew 1.6 data classes (and its
 * stardewvalley plugin ships the schemes), but the npm build forgot to export
 * the scheme-registration API. We load a runtime-patched copy of the bundle
 * that appends one export line for the internal TypeReader registry. The
 * patched copy lives in the OS temp dir and is never committed; the committed
 * artifact of this script is only items.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

const gameDir = process.argv[2];
if (!gameDir) {
  console.error('Usage: node tools/extract-items.mjs "<Stardew Valley install dir>"');
  process.exit(1);
}
const dataDir = join(gameDir, 'Content', 'Data');

// --- load patched xnb bundle ---------------------------------------------
const xnbCjsPath = require.resolve('xnb/dist/xnb.cjs');
const patched = readFileSync(xnbCjsPath, 'utf-8') + '\nexports.TypeReader = TypeReader;\n';
const patchedPath = join(tmpdir(), 'sdvse-xnb-patched.cjs');
writeFileSync(patchedPath, patched);
const XNB = require(patchedPath);
const sdv = await import('xnb/dist/plugins/stardewvalley/index.module.js');

XNB.addReaders(sdv.readers);
XNB.TypeReader.addSchemes(sdv.schemes);
for (const e of sdv.enums) XNB.TypeReader.enumList.add(e);

// The plugin's schemes lag behind game 1.6.15 — field sets/order verified
// against the DLL metadata itself (tools/dump-gamedata-layout.py).
XNB.TypeReader.addSchemes({
  'StardewValley.GameData.Objects.ObjectData': {
    Name: 'String',
    DisplayName: 'String',
    Description: 'String',
    Type: 'String',
    Category: 'Int32',
    Price: 'Int32',
    $Texture: 'String',
    SpriteIndex: 'Int32',
    ColorOverlayFromNextIndex: 'Boolean', // added mid-1.6
    Edibility: 'Int32',
    IsDrink: 'Boolean',
    $Buffs: ['StardewValley.GameData.Objects.ObjectBuffData'],
    GeodeDropsDefaultItems: 'Boolean',
    $GeodeDrops: ['StardewValley.GameData.Objects.ObjectGeodeDropData'],
    $ArtifactSpotChances: { String: 'Single' },
    CanBeGivenAsGift: 'Boolean', // added mid-1.6
    CanBeTrashed: 'Boolean', // added mid-1.6
    ExcludeFromFishingCollection: 'Boolean',
    ExcludeFromShippingCollection: 'Boolean',
    ExcludeFromRandomSale: 'Boolean',
    $ContextTags: ['String'],
    $CustomFields: { String: 'String' },
  },
  'StardewValley.GameData.Buffs.BuffAttributesData': {
    CombatLevel: 'Single',
    FarmingLevel: 'Single',
    FishingLevel: 'Single',
    MiningLevel: 'Single',
    LuckLevel: 'Single',
    ForagingLevel: 'Single',
    MaxStamina: 'Single',
    MagneticRadius: 'Single',
    Speed: 'Single',
    Defense: 'Single',
    Attack: 'Single',
    AttackMultiplier: 'Single',
    Immunity: 'Single',
    KnockbackMultiplier: 'Single',
    WeaponSpeedMultiplier: 'Single',
    CriticalChanceMultiplier: 'Single',
    CriticalPowerMultiplier: 'Single',
    WeaponPrecisionMultiplier: 'Single',
  },
  'StardewValley.GameData.Objects.ObjectGeodeDropData': {
    $Id: 'String',
    $ItemId: 'String',
    $RandomItemId: ['String'],
    $MaxItems: 'Int32',
    MinStack: 'Int32',
    MaxStack: 'Int32',
    Quality: 'Int32',
    $ObjectInternalName: 'String',
    $ObjectDisplayName: 'String',
    $ObjectColor: 'String', // added mid-1.6
    ToolUpgradeLevel: 'Int32',
    IsRecipe: 'Boolean',
    $StackModifiers: ['StardewValley.GameData.QuantityModifier'],
    StackModifierMode: 'Int32',
    $QualityModifiers: ['StardewValley.GameData.QuantityModifier'],
    QualityModifierMode: 'Int32',
    $ModData: { String: 'String' },
    $PerItemCondition: 'String',
    $Condition: 'String',
    Chance: 'Double',
    $SetFlagOnPickup: 'String',
    Precedence: 'Int32',
  },
  'StardewValley.GameData.Tools.ToolData': {
    ClassName: 'String',
    Name: 'String',
    AttachmentSlots: 'Int32',
    SalePrice: 'Int32',
    DisplayName: 'String',
    Description: 'String',
    Texture: 'String',
    SpriteIndex: 'Int32',
    MenuSpriteIndex: 'Int32',
    UpgradeLevel: 'Int32',
    // ApplyUpgradeLevelToDisplayName was removed from the game class
    $ConventionalUpgradeFrom: 'String',
    $UpgradeFrom: ['StardewValley.GameData.Tools.ToolUpgradeData'],
    CanBeLostOnDeath: 'Boolean',
    $SetProperties: { String: 'String' },
    $ModData: { String: 'String' },
    $CustomFields: { String: 'String' },
  },
});

function unpack(file) {
  const buf = readFileSync(join(dataDir, file));
  const xnb = XNB.bufferToXnb(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  return xnb.content;
}

// --- build the item list ---------------------------------------------------
// type codes follow the game's qualified-id prefixes: (O)bject, (BC), (W)eapon,
// (F)urniture, (B)oots, (H)at, (S)hirt, (P)ants, (T)ool
const items = [];

const objects = unpack('Objects.xnb');
for (const [id, d] of Object.entries(objects)) {
  items.push({
    id,
    name: d.Name,
    type: 'O',
    category: d.Category ?? 0,
    price: d.Price ?? 0,
    edibility: d.Edibility ?? -300,
    sprite: d.SpriteIndex ?? 0,
  });
}

const bigCraftables = unpack('BigCraftables.xnb');
for (const [id, d] of Object.entries(bigCraftables)) {
  items.push({
    id,
    name: d.Name,
    type: 'BC',
    category: -9,
    price: d.Price ?? 0,
    sprite: d.SpriteIndex ?? 0,
  });
}

const weapons = unpack('Weapons.xnb');
for (const [id, d] of Object.entries(weapons)) {
  items.push({ id, name: d.Name, type: 'W', category: -98 });
}

// Furniture/Boots/hats are still classic "slash-delimited string" dictionaries
const furniture = unpack('Furniture.xnb');
for (const [id, s] of Object.entries(furniture)) {
  items.push({ id, name: String(s).split('/')[0], type: 'F', category: -24 });
}

const boots = unpack('Boots.xnb');
for (const [id, s] of Object.entries(boots)) {
  items.push({ id, name: String(s).split('/')[0], type: 'B', category: -97 });
}

const hats = unpack('hats.xnb');
for (const [id, s] of Object.entries(hats)) {
  items.push({ id, name: String(s).split('/')[0], type: 'H', category: -95 });
}

const shirts = unpack('Shirts.xnb');
for (const [id, d] of Object.entries(shirts)) {
  items.push({ id, name: d.Name, type: 'S', category: -100 });
}

const pants = unpack('Pants.xnb');
for (const [id, d] of Object.entries(pants)) {
  items.push({ id, name: d.Name, type: 'P', category: -100 });
}

const tools = unpack('Tools.xnb');
for (const [id, d] of Object.entries(tools)) {
  items.push({ id, name: d.Name, type: 'T', category: -99 });
}

// --- write ------------------------------------------------------------------
const outPath = join(here, '..', 'packages', 'core', 'data', 'items.json');
mkdirSync(dirname(outPath), { recursive: true });
const gameVersion = (() => {
  try {
    // best-effort: read the game version for provenance
    const dll = join(gameDir, 'Stardew Valley.deps.json');
    return JSON.parse(readFileSync(dll, 'utf-8')).targets ? 'installed' : 'unknown';
  } catch {
    return 'unknown';
  }
})();
writeFileSync(
  outPath,
  JSON.stringify({ generatedFrom: 'Content/Data (local game install)', gameVersion, items }) + '\n'
);
console.log(`Wrote ${items.length} items to ${outPath}`);
const byType = {};
for (const i of items) byType[i.type] = (byType[i.type] ?? 0) + 1;
console.log('By type:', JSON.stringify(byType));
