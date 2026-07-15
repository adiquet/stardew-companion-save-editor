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
import {
  addWorldObject,
  deleteTerrainFeature,
  deleteWorldObject,
  setBuildingXml,
  setTerrainFeatureXml,
  setWorldObjectXml,
} from './locations.ts';

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
  | { kind: 'friendStatus'; npc: string; status: string }
  | { kind: 'worldObjectDelete'; location: string; index: number }
  | { kind: 'worldObjectXml'; location: string; index: number; xml: string }
  | {
      kind: 'worldObjectAdd';
      location: string;
      x: number;
      y: number;
      itemId: string;
      name: string;
      price?: number;
      edibility?: number;
      category?: number;
    }
  | { kind: 'terrainDelete'; location: string; index: number }
  | { kind: 'terrainXml'; location: string; index: number; xml: string }
  | { kind: 'buildingXml'; location: string; index: number; xml: string };

/** Edit kinds that touch only world data (never mirrored into SaveGameInfo). */
export const WORLD_EDIT_KINDS: ReadonlySet<string> = new Set([
  'world',
  'worldObjectDelete',
  'worldObjectXml',
  'worldObjectAdd',
  'terrainDelete',
  'terrainXml',
  'buildingXml',
]);

export interface EditResult {
  index: number;
  ok: boolean;
  error?: string;
  /** human change-log line for edits the snapshot diff can't see */
  description?: string;
}

/** Returns a change-log description for world-structure edits, else undefined. */
export function applyEditToDoc(doc: SaveDocument, edit: Edit): string | undefined {
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
    case 'worldObjectDelete':
      return deleteWorldObject(doc, edit.location, edit.index);
    case 'worldObjectXml':
      return setWorldObjectXml(doc, edit.location, edit.index, edit.xml);
    case 'worldObjectAdd':
      return addWorldObject(doc, edit.location, edit.x, edit.y, edit);
    case 'terrainDelete':
      return deleteTerrainFeature(doc, edit.location, edit.index);
    case 'terrainXml':
      return setTerrainFeatureXml(doc, edit.location, edit.index, edit.xml);
    case 'buildingXml':
      return setBuildingXml(doc, edit.location, edit.index, edit.xml);
    default:
      throw new Error(`Unknown edit kind "${(edit as { kind: string }).kind}"`);
  }
  return undefined;
}

/** Apply a batch; one failing edit never blocks the rest. */
export function applyEditsToDoc(doc: SaveDocument, edits: Edit[]): EditResult[] {
  return edits.map((edit, index) => {
    try {
      const description = applyEditToDoc(doc, edit);
      return { index, ok: true, description };
    } catch (err) {
      return { index, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
