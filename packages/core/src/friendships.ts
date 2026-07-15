/**
 * NPC friendship accessors over the <friendshipData> dictionary:
 * <item><key><string>NPC</string></key><value><Friendship>…</Friendship></value></item>
 */
import type { SaveDocument } from './document.js';
import { child, childElements, resolvePath, setText, textOf } from './dom.js';
import type { XmlElement } from './xml.js';

export const FRIENDSHIP_STATUSES = [
  'Friendly',
  'Dating',
  'Engaged',
  'Married',
  'Divorced',
] as const;
export type FriendshipStatus = (typeof FRIENDSHIP_STATUSES)[number];

/** 250 points per heart; NPC max is 10 hearts (dateable: 14 when married). */
export const MAX_FRIENDSHIP_POINTS = 3750;

export interface FriendshipInfo {
  npc: string;
  points: number;
  hearts: number;
  status: string;
  giftsThisWeek: number;
  talkedToToday: boolean;
}

function entries(save: SaveDocument): { npc: string; friendship: XmlElement }[] {
  const container = resolvePath(save.player, 'friendshipData');
  if (!container) return [];
  const out: { npc: string; friendship: XmlElement }[] = [];
  for (const item of childElements(container, 'item')) {
    const key = child(item, 'key');
    const value = child(item, 'value');
    const npc = key ? textOf(child(key, 'string')) : '';
    const friendship = value ? child(value, 'Friendship') : null;
    if (npc && friendship) out.push({ npc, friendship });
  }
  return out;
}

export function getFriendships(save: SaveDocument): FriendshipInfo[] {
  return entries(save).map(({ npc, friendship }) => {
    const points = Number(textOf(child(friendship, 'Points')) || '0');
    return {
      npc,
      points,
      hearts: Math.floor(points / 250),
      status: textOf(child(friendship, 'Status')) || 'Friendly',
      giftsThisWeek: Number(textOf(child(friendship, 'GiftsThisWeek')) || '0'),
      talkedToToday: textOf(child(friendship, 'TalkedToToday')) === 'true',
    };
  });
}

function friendshipOf(save: SaveDocument, npc: string): XmlElement {
  const found = entries(save).find((e) => e.npc === npc);
  if (!found) throw new Error(`No friendship entry for "${npc}" in this save`);
  return found.friendship;
}

export function setFriendshipPoints(save: SaveDocument, npc: string, points: number): void {
  if (!Number.isInteger(points) || points < 0 || points > MAX_FRIENDSHIP_POINTS) {
    throw new Error(`Friendship points must be between 0 and ${MAX_FRIENDSHIP_POINTS}`);
  }
  const el = child(friendshipOf(save, npc), 'Points');
  if (!el) throw new Error(`Friendship entry for "${npc}" has no <Points>`);
  setText(el, String(points));
}

export function setFriendshipStatus(save: SaveDocument, npc: string, status: string): void {
  if (!FRIENDSHIP_STATUSES.includes(status as FriendshipStatus)) {
    throw new Error(`Status must be one of: ${FRIENDSHIP_STATUSES.join(', ')}`);
  }
  const el = child(friendshipOf(save, npc), 'Status');
  if (!el) throw new Error(`Friendship entry for "${npc}" has no <Status>`);
  setText(el, status);
}
