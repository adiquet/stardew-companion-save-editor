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
