/**
 * Skill XP <-> level math. The save stores only XP per skill; level is
 * derived from the game's fixed thresholds.
 */

/** Cumulative XP required to reach level 1..10. */
export const XP_THRESHOLDS = [100, 380, 770, 1300, 2150, 3300, 4800, 6900, 10000, 15000];

/** Order of <int> entries inside <experiencePoints>, per the game's enum. */
export const SKILLS = ['farming', 'fishing', 'foraging', 'mining', 'combat', 'luck'] as const;
export type SkillName = (typeof SKILLS)[number];

export function xpToLevel(xp: number): number {
  let level = 0;
  for (const threshold of XP_THRESHOLDS) {
    if (xp >= threshold) level++;
    else break;
  }
  return level;
}

/** Minimum XP that puts a player at exactly `level`. */
export function levelToMinXp(level: number): number {
  if (level <= 0) return 0;
  return XP_THRESHOLDS[Math.min(level, 10) - 1];
}
