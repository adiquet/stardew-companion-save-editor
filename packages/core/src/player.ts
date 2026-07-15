/**
 * Read/edit accessors for player-level scalar fields and skills.
 * All writes go through a field registry so the UI, validation, and the
 * review-before-write diff all agree on what a field is.
 */
import type { SaveDocument } from './document.js';
import { childElements, getPathText, resolvePath, setText, textOf } from './dom.js';
import { SKILLS, xpToLevel, type SkillName } from './skills.js';

export type FieldType = 'string' | 'int' | 'bool' | 'enum';

export interface FieldSpec {
  /** dotted element path relative to the player element */
  path: string;
  label: string;
  type: FieldType;
  min?: number;
  max?: number;
  options?: string[];
  readonly?: boolean;
}

export const PLAYER_FIELDS: Record<string, FieldSpec> = {
  name: { path: 'name', label: 'Farmer name', type: 'string' },
  farmName: { path: 'farmName', label: 'Farm name', type: 'string' },
  favoriteThing: { path: 'favoriteThing', label: 'Favorite thing', type: 'string' },
  horseName: { path: 'horseName', label: 'Horse name', type: 'string' },
  gender: { path: 'Gender', label: 'Gender', type: 'enum', options: ['Male', 'Female'] },
  money: { path: 'money', label: 'Money', type: 'int', min: 0, max: 2_147_483_647 },
  qiGems: { path: 'qiGems', label: 'Qi gems', type: 'int', min: 0, max: 999_999 },
  clubCoins: { path: 'clubCoins', label: 'Casino club coins', type: 'int', min: 0, max: 2_147_483_647 },
  health: { path: 'health', label: 'Health', type: 'int', min: 1, max: 999 },
  maxHealth: { path: 'maxHealth', label: 'Max health', type: 'int', min: 1, max: 999 },
  stamina: { path: 'stamina', label: 'Stamina', type: 'int', min: 1, max: 999 },
  maxStamina: { path: 'maxStamina', label: 'Max stamina', type: 'int', min: 1, max: 999 },
  totalMoneyEarned: {
    path: 'totalMoneyEarned',
    label: 'Total money earned',
    type: 'int',
    min: 0,
    max: 4_294_967_295,
  },
  deepestMineLevel: {
    path: 'deepestMineLevel',
    label: 'Deepest mine level',
    type: 'int',
    min: 0,
    max: 999,
  },
  millisecondsPlayed: {
    path: 'millisecondsPlayed',
    label: 'Time played',
    type: 'int',
    readonly: true,
  },
};

export function getPlayerField(save: SaveDocument, key: string): string | null {
  const spec = PLAYER_FIELDS[key];
  if (!spec) throw new Error(`Unknown player field "${key}"`);
  return getPathText(save.player, spec.path);
}

export function setPlayerField(save: SaveDocument, key: string, value: string): void {
  const spec = PLAYER_FIELDS[key];
  if (!spec) throw new Error(`Unknown player field "${key}"`);
  if (spec.readonly) throw new Error(`"${spec.label}" is read-only`);
  if (spec.type === 'int') {
    const n = Number(value);
    if (!Number.isInteger(n)) throw new Error(`${spec.label} must be a whole number`);
    if (spec.min !== undefined && n < spec.min)
      throw new Error(`${spec.label} must be at least ${spec.min}`);
    if (spec.max !== undefined && n > spec.max)
      throw new Error(`${spec.label} must be at most ${spec.max}`);
  }
  if (spec.type === 'enum' && spec.options && !spec.options.includes(value)) {
    throw new Error(`${spec.label} must be one of: ${spec.options.join(', ')}`);
  }
  if (spec.type === 'string' && value.trim() === '' && key === 'name') {
    throw new Error('Farmer name cannot be empty');
  }
  const el = resolvePath(save.player, spec.path);
  if (!el) throw new Error(`Save file has no element at "${spec.path}"`);
  setText(el, value);
}

export interface SkillInfo {
  skill: SkillName;
  xp: number;
  level: number;
}

export function getSkills(save: SaveDocument): SkillInfo[] {
  const xpEl = resolvePath(save.player, 'experiencePoints');
  if (!xpEl) throw new Error('Save file has no <experiencePoints> element.');
  const ints = childElements(xpEl, 'int');
  return SKILLS.map((skill, i) => {
    const xp = Number(ints[i] ? textOf(ints[i]) : 0);
    return { skill, xp, level: xpToLevel(xp) };
  });
}

export function setSkillXp(save: SaveDocument, skill: SkillName, xp: number): void {
  if (!Number.isInteger(xp) || xp < 0 || xp > 999_999_999) {
    throw new Error('Skill XP must be a whole number between 0 and 999,999,999');
  }
  const idx = SKILLS.indexOf(skill);
  if (idx === -1) throw new Error(`Unknown skill "${skill}"`);
  const xpEl = resolvePath(save.player, 'experiencePoints');
  if (!xpEl) throw new Error('Save file has no <experiencePoints> element.');
  const ints = childElements(xpEl, 'int');
  if (!ints[idx]) throw new Error(`Save file is missing the XP slot for ${skill}`);
  setText(ints[idx], String(xp));
}

export function getProfessions(save: SaveDocument): number[] {
  const el = resolvePath(save.player, 'professions');
  if (!el) return [];
  return childElements(el, 'int').map((e) => Number(textOf(e)));
}
