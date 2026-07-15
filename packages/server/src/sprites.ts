/**
 * Runtime sprite-sheet extraction from the user's own Stardew Valley
 * install. Game art is decoded from the local XNB files on demand and
 * cached in memory — it never enters this repo and is never redistributed.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// Texture2DReader is built into xnb-js — no scheme workarounds needed here.
import { bufferToXnb } from 'xnb';
import { encodePng } from './png.ts';

export interface SheetSpec {
  /** path inside Content/ */
  file: string;
  cellW: number;
  cellH: number;
}

/** item-type code → sheet holding its icons */
export const SHEETS: Record<string, SheetSpec> = {
  O: { file: 'Maps/springobjects.xnb', cellW: 16, cellH: 16 },
  BC: { file: 'TileSheets/Craftables.xnb', cellW: 16, cellH: 32 },
  W: { file: 'TileSheets/weapons.xnb', cellW: 16, cellH: 16 },
  T: { file: 'TileSheets/tools.xnb', cellW: 16, cellH: 16 },
};

const STEAM_SUFFIX = join('steamapps', 'common', 'Stardew Valley');

export function findGameDir(): string | null {
  const candidates: string[] = [];
  if (process.env.SDVSE_GAME_DIR) candidates.push(process.env.SDVSE_GAME_DIR);
  // every Steam library listed in libraryfolders.vdf
  const vdf = 'C:\\Program Files (x86)\\Steam\\steamapps\\libraryfolders.vdf';
  if (existsSync(vdf)) {
    const text = readFileSync(vdf, 'utf-8');
    for (const m of text.matchAll(/"path"\s+"([^"]+)"/g)) {
      candidates.push(join(m[1].replace(/\\\\/g, '\\'), STEAM_SUFFIX));
    }
  }
  candidates.push(
    join('C:\\Program Files (x86)\\Steam', STEAM_SUFFIX),
    'C:\\GOG Games\\Stardew Valley',
    'C:\\Program Files (x86)\\GOG Galaxy\\Games\\Stardew Valley'
  );
  for (const dir of candidates) {
    if (existsSync(join(dir, 'Content', 'Data', 'Objects.xnb'))) return dir;
  }
  return null;
}

interface CachedSheet {
  png: Buffer;
  width: number;
  height: number;
}

const cache = new Map<string, CachedSheet>();
let gameDir: string | null | undefined;

export function spriteGameDir(): string | null {
  if (gameDir === undefined) gameDir = findGameDir();
  return gameDir;
}

export function getSheet(typeCode: string): CachedSheet | null {
  const spec = SHEETS[typeCode];
  const dir = spriteGameDir();
  if (!spec || !dir) return null;
  const hit = cache.get(typeCode);
  if (hit) return hit;
  const path = join(dir, 'Content', spec.file);
  if (!existsSync(path)) return null;
  const buf = readFileSync(path);
  const xnb = bufferToXnb(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)) as {
    content: { export: { width: number; height: number; data: Uint8Array } };
  };
  const tex = xnb.content.export;
  const entry: CachedSheet = {
    png: encodePng(tex.data, tex.width, tex.height),
    width: tex.width,
    height: tex.height,
  };
  cache.set(typeCode, entry);
  return entry;
}

export function spritesInfo(): {
  available: boolean;
  sheets: Record<string, { url: string; cols: number; cellW: number; cellH: number }>;
} {
  const sheets: Record<string, { url: string; cols: number; cellW: number; cellH: number }> = {};
  for (const code of Object.keys(SHEETS)) {
    const sheet = getSheet(code);
    if (sheet) {
      sheets[code] = {
        url: `/api/sprites/${code}.png`,
        cols: Math.floor(sheet.width / SHEETS[code].cellW),
        cellW: SHEETS[code].cellW,
        cellH: SHEETS[code].cellH,
      };
    }
  }
  return { available: Object.keys(sheets).length > 0, sheets };
}
