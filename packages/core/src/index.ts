export { parseXml, serializeXml, XmlParseError } from './xml.ts';
export type { XmlDocument, XmlElement, XmlNode } from './xml.ts';
export {
  child,
  childElements,
  resolvePath,
  textOf,
  setText,
  getPathText,
  setPathText,
  makeElement,
} from './dom.ts';
export { SaveDocument, VERIFIED_GAME_VERSIONS } from './document.ts';
export type { SaveKind, VersionInfo } from './document.ts';
export { SKILLS, XP_THRESHOLDS, xpToLevel, levelToMinXp } from './skills.ts';
export type { SkillName } from './skills.ts';
export {
  PLAYER_FIELDS,
  getPlayerField,
  setPlayerField,
  getSkills,
  setSkillXp,
  getProfessions,
} from './player.ts';
export type { FieldSpec, FieldType, SkillInfo } from './player.ts';
export {
  VALID_QUALITIES,
  MAX_STACK,
  getInventory,
  setItemField,
  clearSlot,
  copySlot,
  setSlotRawXml,
  addObjectItem,
} from './inventory.ts';
export type { InventoryItem } from './inventory.ts';
export {
  FRIENDSHIP_STATUSES,
  MAX_FRIENDSHIP_POINTS,
  getFriendships,
  setFriendshipPoints,
  setFriendshipStatus,
} from './friendships.ts';
export type { FriendshipInfo, FriendshipStatus } from './friendships.ts';
export { WORLD_FIELDS, SEASONS, getWorldField, setWorldField } from './world.ts';
export { snapshot, diffSnapshots } from './summary.ts';
export type { SaveSnapshot, Change } from './summary.ts';
export { applyEditToDoc, applyEditsToDoc } from './edits.ts';
export type { Edit, EditResult } from './edits.ts';
