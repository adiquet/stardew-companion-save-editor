/**
 * Uniform edit descriptions. Both front ends funnel every mutation through
 * applyEditsToDoc, so validation and behavior are identical whether edits
 * run in the local server (Node) or directly in the browser (web version).
 */
import type { SaveDocument } from './document.ts';
import { setPlayerField, setSkillXp } from './player.ts';
import type { SkillName } from './skills.ts';
import { setWorldField } from './world.ts';
import { addObjectItem, clearSlot, setItemField, setSlotRawXml } from './inventory.ts';
import { setFriendshipPoints, setFriendshipStatus } from './friendships.ts';

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

export function applyEditToDoc(doc: SaveDocument, edit: Edit): void {
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

/** Apply a batch; one failing edit never blocks the rest. */
export function applyEditsToDoc(doc: SaveDocument, edits: Edit[]): EditResult[] {
  return edits.map((edit, index) => {
    try {
      applyEditToDoc(doc, edit);
      return { index, ok: true };
    } catch (err) {
      return { index, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
