/**
 * XML parse + serialize tuned to round-trip Stardew Valley save files
 * byte-for-byte. Saves are written by .NET's XmlWriter: single line, UTF-8
 * BOM, `<tag />` self-closing style (space before `/>`), double-quoted
 * attributes, and .NET's escaping rules (`>` escaped in text, not in
 * attributes; CR/LF/TAB escaped as numeric refs in attributes).
 */
import { DOMParser as XmldomParser } from '@xmldom/xmldom';

// Minimal structural types so the same code works against both the browser
// DOM and @xmldom/xmldom without fighting their incompatible type defs.
export interface XmlNode {
  nodeType: number;
  nodeName: string;
  nodeValue: string | null;
  childNodes: ArrayLike<XmlNode>;
  attributes?: ArrayLike<{ name: string; value: string }> | null;
  parentNode: XmlNode | null;
}
export interface XmlElement extends XmlNode {
  tagName: string;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  appendChild(node: XmlNode): XmlNode;
  insertBefore(node: XmlNode, ref: XmlNode | null): XmlNode;
  removeChild(node: XmlNode): XmlNode;
  ownerDocument: XmlDocument;
}
export interface XmlDocument extends XmlNode {
  documentElement: XmlElement;
  createElement(tagName: string): XmlElement;
  createTextNode(data: string): XmlNode;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

export class XmlParseError extends Error {}

/**
 * Parse save XML. Rejects DOCTYPE outright — game saves never contain one,
 * and refusing it closes off XXE / entity-expansion attacks from untrusted
 * uploads before any parser behavior matters.
 */
export function parseXml(text: string): XmlDocument {
  // Strip BOM if the caller passed it through.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (/<!DOCTYPE/i.test(text.slice(0, 4096))) {
    throw new XmlParseError(
      'This file contains a DOCTYPE declaration, which never appears in real Stardew Valley saves. Refusing to parse it.'
    );
  }
  const NativeParser = (globalThis as Record<string, unknown>).DOMParser as
    | (new () => { parseFromString(s: string, t: string): unknown })
    | undefined;
  if (NativeParser) {
    const doc = new NativeParser().parseFromString(text, 'text/xml') as XmlDocument;
    // Browsers report XML errors as a <parsererror> document instead of throwing.
    const root = doc.documentElement as XmlElement | null;
    if (!root || root.tagName === 'parsererror') {
      throw new XmlParseError('The file is not well-formed XML.');
    }
    return doc;
  }
  let firstError: string | null = null;
  const parser = new XmldomParser({
    onError: (_level, msg) => {
      if (!firstError) firstError = msg;
    },
  });
  const doc = parser.parseFromString(text, 'text/xml') as unknown as XmlDocument;
  if (firstError) throw new XmlParseError(`The file is not well-formed XML: ${firstError}`);
  if (!doc.documentElement) throw new XmlParseError('The file is not well-formed XML.');
  return doc;
}

function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r/g, '&#xD;');
}

function escapeAttribute(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
    .replace(/\r/g, '&#xD;')
    .replace(/\n/g, '&#xA;')
    .replace(/\t/g, '&#x9;');
}

function serializeNode(node: XmlNode, out: string[]): void {
  if (node.nodeType === TEXT_NODE) {
    out.push(escapeText(node.nodeValue ?? ''));
    return;
  }
  if (node.nodeType !== ELEMENT_NODE) return; // saves contain no comments/CDATA/PIs
  const el = node as XmlElement;
  out.push('<', el.tagName);
  const attrs = el.attributes;
  if (attrs) {
    for (let i = 0; i < attrs.length; i++) {
      const a = attrs[i];
      out.push(' ', a.name, '="', escapeAttribute(a.value), '"');
    }
  }
  const kids = el.childNodes;
  if (kids.length === 0) {
    out.push(' />'); // .NET style: space before the slash
    return;
  }
  out.push('>');
  for (let i = 0; i < kids.length; i++) serializeNode(kids[i], out);
  out.push('</', el.tagName, '>');
}

/**
 * Serialize a save document back to the exact on-disk text form the game
 * writes: XML declaration, everything on one line, no trailing newline.
 * The UTF-8 BOM is handled at the byte layer (see SaveDocument), not here.
 */
export function serializeXml(doc: XmlDocument): string {
  const out: string[] = ['<?xml version="1.0" encoding="utf-8"?>'];
  serializeNode(doc.documentElement, out);
  return out.join('');
}
