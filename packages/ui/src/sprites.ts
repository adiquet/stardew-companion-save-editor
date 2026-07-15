/**
 * Sprite-sheet info from the local server (real game art, extracted at
 * runtime from the player's own install). In web mode the fetch fails and
 * every icon falls back to the colored chip.
 */
import { ITEMS, type ItemRef } from './items-db.ts';

export interface SheetInfo {
  url: string;
  cols: number;
  cellW: number;
  cellH: number;
}

export interface SpriteInfo {
  available: boolean;
  sheets: Record<string, SheetInfo>;
}

let info: SpriteInfo = { available: false, sheets: {} };

export async function loadSpriteInfo(): Promise<SpriteInfo> {
  try {
    const res = await fetch('/api/sprites/info');
    if (res.ok) info = (await res.json()) as SpriteInfo;
  } catch {
    /* web mode — chips only */
  }
  return info;
}

/** save item xsi:type → sheet type code */
const XSI_TO_SHEET: Record<string, 'O' | 'W' | 'T'> = {
  Object: 'O',
  ColoredObject: 'O',
  MeleeWeapon: 'W',
  Slingshot: 'W',
  Hoe: 'T',
  Axe: 'T',
  Pickaxe: 'T',
  WateringCan: 'T',
  FishingRod: 'T',
  Pan: 'T',
  Wand: 'T',
  GenericTool: 'T',
  MilkPail: 'T',
  Shears: 'T',
};

const spriteIndex = new Map<string, number>();
for (const item of ITEMS) {
  if (item.sprite !== undefined) spriteIndex.set(`${item.type}:${item.id}`, item.sprite);
}

export interface SpriteRef {
  sheet: SheetInfo;
  index: number;
}

export function spriteForItem(xsiType: string | null, itemId: string): SpriteRef | null {
  if (!xsiType) return null;
  const code = XSI_TO_SHEET[xsiType];
  if (!code) return null;
  const sheet = info.sheets[code];
  const index = spriteIndex.get(`${code}:${itemId}`);
  if (!sheet || index === undefined) return null;
  return { sheet, index };
}

export function spriteForRef(item: ItemRef): SpriteRef | null {
  const sheet = info.sheets[item.type];
  if (!sheet || item.sprite === undefined) return null;
  return { sheet, index: item.sprite };
}
