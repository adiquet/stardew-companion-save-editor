/**
 * One UI, two I/O layers.
 *
 * LocalBackend  — talks to the local server, which reads/writes the Saves
 *                 folder directly and holds the edited document.
 * BrowserBackend — for stardewcompanion.com: the file never leaves the
 *                 browser; @sdvse/core runs right here and "save" means
 *                 downloading the edited file.
 *
 * Mode is detected at startup by probing /api/health.
 */
import {
  SaveDocument,
  applyEditsToDoc,
  diffSnapshots,
  getFriendships,
  getInventory,
  getPlayerField,
  getSkills,
  getWorldField,
  snapshot,
  PLAYER_FIELDS,
  WORLD_FIELDS,
  child,
  childElements,
  type Change,
  type Edit,
  type EditResult,
  type FieldSpec,
  type FriendshipInfo,
  type InventoryItem,
  type SaveSnapshot,
  type SkillInfo,
  type VersionInfo,
} from '@sdvse/core';

export interface SaveState {
  id: string;
  version: VersionInfo;
  player: Record<string, string | null>;
  fieldSpecs: Record<string, FieldSpec>;
  worldSpecs: Record<string, FieldSpec>;
  skills: SkillInfo[];
  inventory: InventoryItem[];
  friendships: FriendshipInfo[];
  world: Record<string, string | null>;
  farmhandCount: number;
  changes: Change[];
}

export interface SaveListing {
  id: string;
  farmerName: string;
  farmName: string;
  gameVersion: string | null;
  lastModified: number;
}

export interface WriteResult {
  written: boolean;
  backups?: string[];
  downloadName?: string;
}

export interface Backend {
  mode: 'local' | 'web';
  listSaves(): Promise<SaveListing[]>;
  openSave(id: string): Promise<SaveState>;
  openFile(file: File): Promise<SaveState>;
  applyEdits(edits: Edit[]): Promise<{ results: EditResult[]; state: SaveState }>;
  write(): Promise<WriteResult>;
  discard(): Promise<SaveState>;
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) throw new Error((body as { error?: string }).error ?? res.statusText);
  return body as T;
}

class LocalBackend implements Backend {
  mode = 'local' as const;
  private saveId: string | null = null;

  async listSaves(): Promise<SaveListing[]> {
    return json(await fetch('/api/saves'));
  }
  async openSave(id: string): Promise<SaveState> {
    const state = await json<SaveState>(await fetch(`/api/save/${encodeURIComponent(id)}`));
    this.saveId = id;
    return state;
  }
  openFile(): Promise<SaveState> {
    throw new Error('Local mode loads saves from the Saves folder, not from file uploads.');
  }
  private id(): string {
    if (!this.saveId) throw new Error('No save is open');
    return this.saveId;
  }
  async applyEdits(edits: Edit[]): Promise<{ results: EditResult[]; state: SaveState }> {
    return json(
      await fetch(`/api/save/${encodeURIComponent(this.id())}/edits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(edits),
      })
    );
  }
  async write(): Promise<WriteResult> {
    return json(
      await fetch(`/api/save/${encodeURIComponent(this.id())}/write`, { method: 'POST' })
    );
  }
  async discard(): Promise<SaveState> {
    return json(
      await fetch(`/api/save/${encodeURIComponent(this.id())}/discard`, { method: 'POST' })
    );
  }
}

/** Size above which we show a heads-up (real saves are single-digit MB). */
export const LARGE_FILE_BYTES = 50 * 1024 * 1024;

class BrowserBackend implements Backend {
  mode = 'web' as const;
  private doc: SaveDocument | null = null;
  private baseline: SaveSnapshot | null = null;
  private fileName = 'save';

  listSaves(): Promise<SaveListing[]> {
    return Promise.resolve([]);
  }
  openSave(): Promise<SaveState> {
    throw new Error('Web mode opens saves from a file you choose.');
  }
  async openFile(file: File): Promise<SaveState> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    this.doc = SaveDocument.fromBytes(bytes);
    this.baseline = snapshot(this.doc);
    this.fileName = file.name;
    return this.state();
  }
  private state(): SaveState {
    const doc = this.doc!;
    const player: Record<string, string | null> = {};
    for (const key of Object.keys(PLAYER_FIELDS)) player[key] = getPlayerField(doc, key);
    const world: Record<string, string | null> = {};
    if (doc.kind === 'full') {
      for (const key of Object.keys(WORLD_FIELDS)) world[key] = getWorldField(doc, key);
    }
    const farmhandsEl = doc.kind === 'full' ? child(doc.root, 'farmhands') : null;
    return {
      id: this.fileName,
      version: doc.version(),
      player,
      fieldSpecs: PLAYER_FIELDS,
      worldSpecs: doc.kind === 'full' ? WORLD_FIELDS : {},
      skills: getSkills(doc),
      inventory: getInventory(doc),
      friendships: getFriendships(doc),
      world,
      farmhandCount: farmhandsEl ? childElements(farmhandsEl).length : 0,
      changes: diffSnapshots(this.baseline!, snapshot(doc)),
    };
  }
  async applyEdits(edits: Edit[]): Promise<{ results: EditResult[]; state: SaveState }> {
    if (!this.doc) throw new Error('No save is open');
    const results = applyEditsToDoc(this.doc, edits);
    return { results, state: this.state() };
  }
  async write(): Promise<WriteResult> {
    if (!this.doc) throw new Error('No save is open');
    const bytes = this.doc.toBytes();
    const blob = new Blob([bytes.buffer.slice(0) as ArrayBuffer], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.fileName;
    a.click();
    URL.revokeObjectURL(url);
    this.baseline = snapshot(this.doc);
    return { written: true, downloadName: this.fileName };
  }
  async discard(): Promise<SaveState> {
    throw new Error('Web mode: re-open the file to discard changes.');
  }
}

export async function detectBackend(): Promise<Backend> {
  try {
    const res = await fetch('/api/health');
    if (res.ok) {
      const body = (await res.json()) as { app?: string };
      if (body.app === 'stardew-companion-save-editor') return new LocalBackend();
    }
  } catch {
    /* no local server — web mode */
  }
  return new BrowserBackend();
}
