/** Small helpers for walking/patching the save DOM by element path. */
import type { XmlDocument, XmlElement, XmlNode } from './xml.js';

const ELEMENT_NODE = 1;

export function childElements(el: XmlNode, name?: string): XmlElement[] {
  const out: XmlElement[] = [];
  const kids = el.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (k.nodeType === ELEMENT_NODE && (!name || (k as XmlElement).tagName === name)) {
      out.push(k as XmlElement);
    }
  }
  return out;
}

export function child(el: XmlNode, name: string): XmlElement | null {
  const kids = el.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (k.nodeType === ELEMENT_NODE && (k as XmlElement).tagName === name) {
      return k as XmlElement;
    }
  }
  return null;
}

/** Resolve a dotted path of child element names, e.g. "player.money". */
export function resolvePath(root: XmlNode, path: string): XmlElement | null {
  let cur: XmlNode | null = root;
  for (const seg of path.split('.')) {
    if (!cur) return null;
    cur = child(cur, seg);
  }
  return cur as XmlElement | null;
}

export function textOf(el: XmlNode | null): string {
  if (!el) return '';
  let out = '';
  const kids = el.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (k.nodeType === 3) out += k.nodeValue ?? '';
    else if (k.nodeType === ELEMENT_NODE) out += textOf(k);
  }
  return out;
}

/** Replace an element's content with a single text node (or empty). */
export function setText(el: XmlElement, value: string): void {
  const kids = el.childNodes;
  for (let i = kids.length - 1; i >= 0; i--) el.removeChild(kids[i]);
  if (value !== '') el.appendChild(el.ownerDocument.createTextNode(value));
}

export function getPathText(root: XmlNode, path: string): string | null {
  const el = resolvePath(root, path);
  return el ? textOf(el) : null;
}

/**
 * Set the text of the element at `path`. The element must already exist —
 * we deliberately never invent new nodes on simple scalar writes, so a typo'd
 * path fails loudly instead of quietly adding junk the game ignores.
 */
export function setPathText(root: XmlNode, path: string, value: string): void {
  const el = resolvePath(root, path);
  if (!el) throw new Error(`Save file has no element at path "${path}"`);
  setText(el, value);
}

/** Make a `<name>text</name>` element in one call. */
export function makeElement(doc: XmlDocument, name: string, text?: string): XmlElement {
  const el = doc.createElement(name);
  if (text !== undefined && text !== '') el.appendChild(doc.createTextNode(text));
  return el;
}
