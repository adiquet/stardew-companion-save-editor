import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  SaveDocument,
  getPlayerField,
  setPlayerField,
  getSkills,
  setSkillXp,
  xpToLevel,
  levelToMinXp,
  getInventory,
  setItemField,
  clearSlot,
  addObjectItem,
  setSlotRawXml,
  getFriendships,
  setFriendshipPoints,
  setFriendshipStatus,
  getWorldField,
  setWorldField,
  snapshot,
  diffSnapshots,
} from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const realSave = join(here, '..', '..', '..', 'fixtures', 'private', 'MrBurns_146087234');
const hasReal = existsSync(realSave);

describe('XP <-> level math', () => {
  it('maps thresholds to levels', () => {
    expect(xpToLevel(0)).toBe(0);
    expect(xpToLevel(99)).toBe(0);
    expect(xpToLevel(100)).toBe(1);
    expect(xpToLevel(15000)).toBe(10);
    expect(xpToLevel(704031)).toBe(10);
  });
  it('maps levels to minimum XP', () => {
    expect(levelToMinXp(0)).toBe(0);
    expect(levelToMinXp(1)).toBe(100);
    expect(levelToMinXp(10)).toBe(15000);
    for (let lvl = 0; lvl <= 10; lvl++) expect(xpToLevel(levelToMinXp(lvl))).toBe(lvl);
  });
});

describe.runIf(hasReal)('accessors against the real save', () => {
  let save: SaveDocument;
  beforeEach(() => {
    save = SaveDocument.fromBytes(new Uint8Array(readFileSync(realSave)));
  });

  it('reads known player fields', () => {
    expect(getPlayerField(save, 'name')).toBe('Mr. Burns');
    expect(getPlayerField(save, 'farmName')).toBe('Tiers');
    expect(getPlayerField(save, 'money')).toBe('3876512');
    expect(getPlayerField(save, 'maxHealth')).toBe('155');
  });

  it('writes and re-reads money', () => {
    setPlayerField(save, 'money', '9999999');
    expect(getPlayerField(save, 'money')).toBe('9999999');
    const reparsed = SaveDocument.fromText(save.toText());
    expect(getPlayerField(reparsed, 'money')).toBe('9999999');
  });

  it('rejects invalid money', () => {
    expect(() => setPlayerField(save, 'money', '-5')).toThrow(/at least 0/);
    expect(() => setPlayerField(save, 'money', 'abc')).toThrow(/whole number/);
  });

  it('reads skills with derived levels', () => {
    const skills = getSkills(save);
    expect(skills).toHaveLength(6);
    expect(skills[0]).toEqual({ skill: 'farming', xp: 704031, level: 10 });
    expect(skills[5]).toEqual({ skill: 'luck', xp: 0, level: 0 });
  });

  it('writes skill XP', () => {
    setSkillXp(save, 'luck', 15000);
    expect(getSkills(save).find((s) => s.skill === 'luck')).toEqual({
      skill: 'luck',
      xp: 15000,
      level: 10,
    });
  });

  it('reads inventory with nil slots and types', () => {
    const inv = getInventory(save);
    expect(inv).toHaveLength(36);
    expect(inv[0].type).toBe('MeleeWeapon');
    expect(inv[0].name).toBe('Iridium Scythe');
    expect(inv.some((i) => i.empty)).toBe(true);
  });

  it('edits item stack and quality with validation', () => {
    const inv = getInventory(save);
    const stackable = inv.find((i) => !i.empty && i.type === 'Object')!;
    setItemField(save, stackable.slot, 'stack', '999');
    expect(getInventory(save)[stackable.slot].stack).toBe(999);
    expect(() => setItemField(save, stackable.slot, 'stack', '1000')).toThrow(/between 1 and 999/);
    expect(() => setItemField(save, stackable.slot, 'quality', '3')).toThrow(/Quality/);
  });

  it('clears a slot to nil and round-trips', () => {
    clearSlot(save, 0);
    const inv = getInventory(save);
    expect(inv[0].empty).toBe(true);
    expect(inv).toHaveLength(36);
    SaveDocument.fromText(save.toText()); // still well-formed
  });

  it('adds an Object item into an empty slot', () => {
    const empty = getInventory(save).find((i) => i.empty)!;
    addObjectItem(save, empty.slot, {
      itemId: '74',
      name: 'Prismatic Shard',
      stack: 5,
      price: 2000,
    });
    const item = getInventory(save)[empty.slot];
    expect(item.name).toBe('Prismatic Shard');
    expect(item.stack).toBe(5);
    expect(item.type).toBe('Object');
    // No xmlns junk leaked into the serialized item
    expect(save.toText()).not.toContain('xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><isLostItem>');
  });

  it('rejects malformed raw XML without touching the slot', () => {
    const before = getInventory(save)[0].rawXml;
    expect(() => setSlotRawXml(save, 0, '<Item><broken>')).toThrow(/not well-formed/);
    expect(getInventory(save)[0].rawXml).toBe(before);
  });

  it('reads friendships', () => {
    const lewis = getFriendships(save).find((f) => f.npc === 'Lewis')!;
    expect(lewis.points).toBe(2749);
    expect(lewis.hearts).toBe(10);
    expect(lewis.status).toBe('Friendly');
  });

  it('writes friendship points and status with validation', () => {
    setFriendshipPoints(save, 'Lewis', 3000);
    setFriendshipStatus(save, 'Lewis', 'Friendly');
    expect(getFriendships(save).find((f) => f.npc === 'Lewis')!.points).toBe(3000);
    expect(() => setFriendshipPoints(save, 'Lewis', 99999)).toThrow(/between 0 and/);
    expect(() => setFriendshipStatus(save, 'Lewis', 'BestFriend')).toThrow(/must be one of/);
    expect(() => setFriendshipPoints(save, 'NotARealNpc', 100)).toThrow(/No friendship entry/);
  });

  it('reads and writes world basics', () => {
    expect(getWorldField(save, 'currentSeason')).toBe('winter');
    expect(getWorldField(save, 'dayOfMonth')).toBe('11');
    setWorldField(save, 'currentSeason', 'spring');
    setWorldField(save, 'dayOfMonth', '1');
    expect(getWorldField(save, 'currentSeason')).toBe('spring');
    expect(() => setWorldField(save, 'dayOfMonth', '29')).toThrow(/at most 28/);
    expect(() => setWorldField(save, 'currentSeason', 'monsoon')).toThrow(/must be one of/);
  });

  it('produces a plain-language diff of edits', () => {
    const before = snapshot(save);
    setPlayerField(save, 'money', '5000000');
    setSkillXp(save, 'luck', 100);
    setFriendshipPoints(save, 'Lewis', 250);
    const changes = diffSnapshots(before, snapshot(save));
    expect(changes).toEqual([
      { section: 'Player', label: 'Money', before: '3876512', after: '5000000' },
      { section: 'Skills', label: 'Luck XP', before: '0', after: '100' },
      { section: 'Friendships', label: 'Lewis', before: '2749 pts, Friendly', after: '250 pts, Friendly' },
    ]);
  });

  it('unchanged save still round-trips byte-identically after snapshot reads', () => {
    const original = readFileSync(realSave);
    snapshot(save); // reads must never mutate
    expect(Buffer.from(save.toBytes()).equals(original)).toBe(true);
  });
});
