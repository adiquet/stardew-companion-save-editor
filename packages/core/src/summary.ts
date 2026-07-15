/**
 * Snapshot + diff: take a plain-object snapshot of everything the editor
 * can touch, before and after edits, and describe the differences in plain
 * language for the review-before-write screen.
 */
import type { SaveDocument } from './document.ts';
import { getFriendships } from './friendships.ts';
import { getInventory } from './inventory.ts';
import { getPlayerField, getSkills, PLAYER_FIELDS } from './player.ts';
import { getWorldField, WORLD_FIELDS } from './world.ts';

export interface SaveSnapshot {
  player: Record<string, string | null>;
  skills: Record<string, number>;
  world: Record<string, string | null>;
  inventory: Record<number, string>;
  friendships: Record<string, string>;
}

export function snapshot(save: SaveDocument): SaveSnapshot {
  const player: Record<string, string | null> = {};
  for (const key of Object.keys(PLAYER_FIELDS)) player[key] = getPlayerField(save, key);

  const skills: Record<string, number> = {};
  for (const s of getSkills(save)) skills[s.skill] = s.xp;

  const world: Record<string, string | null> = {};
  if (save.kind === 'full') {
    for (const key of Object.keys(WORLD_FIELDS)) world[key] = getWorldField(save, key);
  }

  const inventory: Record<number, string> = {};
  for (const item of getInventory(save)) {
    inventory[item.slot] = item.empty
      ? '(empty)'
      : `${item.name} ×${item.stack ?? 1}${item.quality ? ` q${item.quality}` : ''}|${item.rawXml}`;
  }

  const friendships: Record<string, string> = {};
  for (const f of getFriendships(save)) friendships[f.npc] = `${f.points} pts, ${f.status}`;

  return { player, skills, world, inventory, friendships };
}

export interface Change {
  section: 'Player' | 'Skills' | 'World' | 'Inventory' | 'Friendships';
  label: string;
  before: string;
  after: string;
}

const fmt = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === '' ? '(empty)' : String(v);

export function diffSnapshots(before: SaveSnapshot, after: SaveSnapshot): Change[] {
  const changes: Change[] = [];

  for (const key of Object.keys(PLAYER_FIELDS)) {
    if (before.player[key] !== after.player[key]) {
      changes.push({
        section: 'Player',
        label: PLAYER_FIELDS[key].label,
        before: fmt(before.player[key]),
        after: fmt(after.player[key]),
      });
    }
  }

  for (const skill of Object.keys(before.skills)) {
    if (before.skills[skill] !== after.skills[skill]) {
      changes.push({
        section: 'Skills',
        label: `${skill[0].toUpperCase()}${skill.slice(1)} XP`,
        before: fmt(before.skills[skill]),
        after: fmt(after.skills[skill]),
      });
    }
  }

  for (const key of new Set([...Object.keys(before.world), ...Object.keys(after.world)])) {
    if (before.world[key] !== after.world[key]) {
      changes.push({
        section: 'World',
        label: WORLD_FIELDS[key]?.label ?? key,
        before: fmt(before.world[key]),
        after: fmt(after.world[key]),
      });
    }
  }

  const slots = new Set([
    ...Object.keys(before.inventory).map(Number),
    ...Object.keys(after.inventory).map(Number),
  ]);
  for (const slot of [...slots].sort((a, b) => a - b)) {
    const b = before.inventory[slot];
    const a = after.inventory[slot];
    if (b !== a) {
      // Show the human half of the encoded value, not the raw XML tail.
      const human = (v: string | undefined) => (v ? v.split('|')[0] : '(empty)');
      changes.push({
        section: 'Inventory',
        label: `Slot ${slot + 1}`,
        before: human(b),
        after: human(a),
      });
    }
  }

  for (const npc of new Set([
    ...Object.keys(before.friendships),
    ...Object.keys(after.friendships),
  ])) {
    if (before.friendships[npc] !== after.friendships[npc]) {
      changes.push({
        section: 'Friendships',
        label: npc,
        before: fmt(before.friendships[npc]),
        after: fmt(after.friendships[npc]),
      });
    }
  }

  return changes;
}
