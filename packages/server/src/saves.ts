/**
 * Save discovery + loaded-save session state for the local server.
 *
 * A "save" on disk is a folder under %APPDATA%\StardewValley\Saves containing
 * a main file named after the folder plus a SaveGameInfo. Player edits are
 * applied to BOTH documents so the game's load screen (which reads
 * SaveGameInfo) matches the real state; world edits exist only in the main
 * file. Writing backs up both files first.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import {
  SaveDocument,
  getPathText,
  snapshot,
  diffSnapshots,
  type Change,
  type SaveSnapshot,
} from '@sdvse/core';

export function defaultSavesDir(): string {
  if (process.env.SDVSE_SAVES_DIR) return process.env.SDVSE_SAVES_DIR;
  // Windows: %AppData%\StardewValley\Saves — Mac & Linux: ~/.config/StardewValley/Saves
  const base =
    process.platform === 'win32' && process.env.APPDATA
      ? process.env.APPDATA
      : join(homedir(), '.config');
  return join(base, 'StardewValley', 'Saves');
}

export interface SaveListing {
  id: string;
  farmerName: string;
  farmName: string;
  gameVersion: string | null;
  lastModified: number;
}

export function listSaves(savesDir: string): SaveListing[] {
  if (!existsSync(savesDir)) return [];
  const out: SaveListing[] = [];
  for (const entry of readdirSync(savesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const mainPath = join(savesDir, entry.name, entry.name);
    if (!existsSync(mainPath)) continue;
    try {
      const infoPath = join(savesDir, entry.name, 'SaveGameInfo');
      // SaveGameInfo is ~100KB vs the multi-MB main file — use it for listings
      const source = existsSync(infoPath) ? infoPath : mainPath;
      const doc = SaveDocument.fromBytes(new Uint8Array(readFileSync(source)));
      out.push({
        id: entry.name,
        farmerName: textOrEmpty(doc, 'name'),
        farmName: textOrEmpty(doc, 'farmName'),
        gameVersion: doc.version().gameVersion,
        lastModified: statSync(mainPath).mtimeMs,
      });
    } catch {
      // unreadable/corrupt folder — skip rather than break the whole listing
    }
  }
  return out.sort((a, b) => b.lastModified - a.lastModified);
}

function textOrEmpty(doc: SaveDocument, field: string): string {
  try {
    return getPathText(doc.player, field) ?? '';
  } catch {
    return '';
  }
}

export interface LoadedSave {
  id: string;
  dir: string;
  main: SaveDocument;
  /** SaveGameInfo doc, when present — kept in sync for player edits */
  info: SaveDocument | null;
  baseline: SaveSnapshot;
  /** world-structure edits the snapshot diff can't see (human descriptions) */
  worldChangeLog: string[];
}

export class SaveSession {
  private loaded = new Map<string, LoadedSave>();
  readonly savesDir: string;
  constructor(savesDir: string) {
    this.savesDir = savesDir;
  }

  load(id: string, force = false): LoadedSave {
    if (!force && this.loaded.has(id)) return this.loaded.get(id)!;
    if (!/^[^\\/:*?"<>|]+$/.test(id)) throw new Error('Invalid save id');
    const dir = join(this.savesDir, id);
    const mainPath = join(dir, id);
    if (!existsSync(mainPath)) throw new Error(`No save named "${id}" in ${this.savesDir}`);
    const main = SaveDocument.fromBytes(new Uint8Array(readFileSync(mainPath)));
    const infoPath = join(dir, 'SaveGameInfo');
    const info = existsSync(infoPath)
      ? SaveDocument.fromBytes(new Uint8Array(readFileSync(infoPath)))
      : null;
    const entry: LoadedSave = {
      id,
      dir,
      main,
      info,
      baseline: snapshot(main),
      worldChangeLog: [],
    };
    this.loaded.set(id, entry);
    return entry;
  }

  get(id: string): LoadedSave {
    const entry = this.loaded.get(id);
    if (!entry) throw new Error(`Save "${id}" is not loaded`);
    return entry;
  }

  changes(id: string): Change[] {
    const entry = this.get(id);
    const worldChanges: Change[] = entry.worldChangeLog.map((desc) => ({
      section: 'World' as const,
      label: 'Map edit',
      before: '',
      after: desc,
    }));
    return [...diffSnapshots(entry.baseline, snapshot(entry.main)), ...worldChanges];
  }

  /** Back up both files, then overwrite in place. Returns backup paths. */
  write(id: string): { backups: string[] } {
    const entry = this.get(id);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupDir = join(entry.dir, 'sdvse-backups');
    mkdirSync(backupDir, { recursive: true });
    const backups: string[] = [];

    const mainPath = join(entry.dir, id);
    const mainBackup = join(backupDir, `${id}.${stamp}`);
    copyFileSync(mainPath, mainBackup);
    backups.push(mainBackup);
    writeFileSync(mainPath, entry.main.toBytes());

    if (entry.info) {
      const infoPath = join(entry.dir, 'SaveGameInfo');
      const infoBackup = join(backupDir, `SaveGameInfo.${stamp}`);
      copyFileSync(infoPath, infoBackup);
      backups.push(infoBackup);
      writeFileSync(infoPath, entry.info.toBytes());
    }

    // what's on disk is the new baseline
    entry.baseline = snapshot(entry.main);
    entry.worldChangeLog = [];
    return { backups };
  }

  discard(id: string): LoadedSave {
    return this.load(id, true);
  }
}
