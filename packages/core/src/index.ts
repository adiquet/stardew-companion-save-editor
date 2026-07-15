export { parseXml, serializeXml, XmlParseError } from './xml.js';
export type { XmlDocument, XmlElement, XmlNode } from './xml.js';
export {
  child,
  childElements,
  resolvePath,
  textOf,
  setText,
  getPathText,
  setPathText,
  makeElement,
} from './dom.js';
export { SaveDocument, VERIFIED_GAME_VERSIONS } from './document.js';
export type { SaveKind, VersionInfo } from './document.js';
export { SKILLS, XP_THRESHOLDS, xpToLevel, levelToMinXp } from './skills.js';
export type { SkillName } from './skills.js';
export {
  PLAYER_FIELDS,
  getPlayerField,
  setPlayerField,
  getSkills,
  setSkillXp,
  getProfessions,
} from './player.js';
export type { FieldSpec, FieldType, SkillInfo } from './player.js';
export {
  VALID_QUALITIES,
  MAX_STACK,
  getInventory,
  setItemField,
  clearSlot,
  copySlot,
  setSlotRawXml,
  addObjectItem,
} from './inventory.js';
export type { InventoryItem } from './inventory.js';
export {
  FRIENDSHIP_STATUSES,
  MAX_FRIENDSHIP_POINTS,
  getFriendships,
  setFriendshipPoints,
  setFriendshipStatus,
} from './friendships.js';
export type { FriendshipInfo, FriendshipStatus } from './friendships.js';
export { WORLD_FIELDS, SEASONS, getWorldField, setWorldField } from './world.js';
export { snapshot, diffSnapshots } from './summary.js';
export type { SaveSnapshot, Change } from './summary.js';
