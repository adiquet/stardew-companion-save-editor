/**
 * World-level basics on the <SaveGame> root: date, weather, misc scalars.
 * Only available for the full save file (kind === 'full').
 */
import type { SaveDocument } from './document.js';
import { getPathText, resolvePath, setText } from './dom.js';
import type { FieldSpec } from './player.js';

export const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;

export const WORLD_FIELDS: Record<string, FieldSpec> = {
  currentSeason: {
    path: 'currentSeason',
    label: 'Season',
    type: 'enum',
    options: [...SEASONS],
  },
  dayOfMonth: { path: 'dayOfMonth', label: 'Day of month', type: 'int', min: 1, max: 28 },
  year: { path: 'year', label: 'Year', type: 'int', min: 1, max: 9999 },
  isRaining: { path: 'isRaining', label: 'Raining', type: 'bool' },
  isLightning: { path: 'isLightning', label: 'Storming', type: 'bool' },
  isSnowing: { path: 'isSnowing', label: 'Snowing', type: 'bool' },
  isDebrisWeather: { path: 'isDebrisWeather', label: 'Windy (debris)', type: 'bool' },
  weatherForTomorrow: { path: 'weatherForTomorrow', label: 'Weather tomorrow', type: 'string' },
  dailyLuck: { path: 'dailyLuck', label: 'Daily luck', type: 'string', readonly: true },
};

function requireFull(save: SaveDocument): void {
  if (save.kind !== 'full') {
    throw new Error('World data lives in the main save file, not SaveGameInfo.');
  }
}

export function getWorldField(save: SaveDocument, key: string): string | null {
  requireFull(save);
  const spec = WORLD_FIELDS[key];
  if (!spec) throw new Error(`Unknown world field "${key}"`);
  return getPathText(save.root, spec.path);
}

export function setWorldField(save: SaveDocument, key: string, value: string): void {
  requireFull(save);
  const spec = WORLD_FIELDS[key];
  if (!spec) throw new Error(`Unknown world field "${key}"`);
  if (spec.readonly) throw new Error(`"${spec.label}" is read-only`);
  if (spec.type === 'int') {
    const n = Number(value);
    if (!Number.isInteger(n)) throw new Error(`${spec.label} must be a whole number`);
    if (spec.min !== undefined && n < spec.min)
      throw new Error(`${spec.label} must be at least ${spec.min}`);
    if (spec.max !== undefined && n > spec.max)
      throw new Error(`${spec.label} must be at most ${spec.max}`);
  }
  if (spec.type === 'bool' && value !== 'true' && value !== 'false') {
    throw new Error(`${spec.label} must be true or false`);
  }
  if (spec.type === 'enum' && spec.options && !spec.options.includes(value)) {
    throw new Error(`${spec.label} must be one of: ${spec.options.join(', ')}`);
  }
  const el = resolvePath(save.root, spec.path);
  if (!el) throw new Error(`Save file has no element at "${spec.path}"`);
  setText(el, value);
}
