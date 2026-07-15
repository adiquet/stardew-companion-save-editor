/**
 * Apply a batch of edits from the UI to a loaded save. Player-scoped edits
 * are mirrored into SaveGameInfo so the game's load screen stays consistent.
 * Each edit either applies or reports its error; one bad edit never blocks
 * the rest.
 */
import {
  setPlayerField,
  setSkillXp,
  setWorldField,
  setItemField,
  clearSlot,
  setSlotRawXml,
  addObjectItem,
  setFriendshipPoints,
  setFriendshipStatus,
  type SaveDocument,
  type SkillName,
} from '@sdvse/core';
import type { LoadedSave } from './saves.ts';

export type Edit =
  | { kind: 'player'; field: string; value: string }
  | { kind: 'skill'; skill: SkillName; xp: number }
  | { kind: 'world'; field: string; value: string }
  | { kind: 'item'; slot: number; field: 'name' | 'itemId' | 'quality' | 'stack'; value: string }
  | { kind: 'clearSlot'; slot: number }
  | { kind: 'itemRaw'; slot: number; xml: string }
  | {
      kind: 'addItem';
      slot: number;
      itemId: string;
      name: string;
      stack?: number;
      quality?: number;
      price?: number;
      edibility?: number;
      category?: number;
    }
  | { kind: 'friendPoints'; npc: string; points: number }
  | { kind: 'friendStatus'; npc: string; status: string };

export interface EditResult {
  index: number;
  ok: boolean;
  error?: string;
}

function applyOne(doc: SaveDocument, edit: Edit): void {
  switch (edit.kind) {
    case 'player':
      setPlayerField(doc, edit.field, edit.value);
      break;
    case 'skill':
      setSkillXp(doc, edit.skill, edit.xp);
      break;
    case 'world':
      setWorldField(doc, edit.field, edit.value);
      break;
    case 'item':
      setItemField(doc, edit.slot, edit.field, edit.value);
      break;
    case 'clearSlot':
      clearSlot(doc, edit.slot);
      break;
    case 'itemRaw':
      setSlotRawXml(doc, edit.slot, edit.xml);
      break;
    case 'addItem':
      addObjectItem(doc, edit.slot, edit);
      break;
    case 'friendPoints':
      setFriendshipPoints(doc, edit.npc, edit.points);
      break;
    case 'friendStatus':
      setFriendshipStatus(doc, edit.npc, edit.status);
      break;
    default:
      throw new Error(`Unknown edit kind "${(edit as { kind: string }).kind}"`);
  }
}

export function applyEdits(save: LoadedSave, edits: Edit[]): EditResult[] {
  return edits.map((edit, index) => {
    try {
      applyOne(save.main, edit);
      // Mirror player-scoped edits into SaveGameInfo (world data doesn't
      // exist there). If the mirror fails, the main doc is authoritative —
      // report but don't fail the edit.
      if (save.info && edit.kind !== 'world') {
        try {
          applyOne(save.info, edit);
        } catch {
          /* main file remains the source of truth */
        }
      }
      return { index, ok: true };
    } catch (err) {
      return { index, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
