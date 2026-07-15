/**
 * Inventory accessors. Common fields (name/itemId/quality/stack) are edited
 * in place; anything type-specific goes through the raw-XML fallback so
 * unrecognized (including modded) items are never dropped or blanked.
 */
import type { SaveDocument } from './document.ts';
import { child, childElements, resolvePath, setText, textOf } from './dom.ts';
import { parseXml, serializeXml, type XmlElement } from './xml.ts';

export const VALID_QUALITIES = [0, 1, 2, 4] as const;
export const MAX_STACK = 999;

export interface InventoryItem {
  slot: number;
  /** true = empty slot (<Item xsi:nil="true" />) */
  empty: boolean;
  /** xsi:type, e.g. "Object", "MeleeWeapon"; null for empty slots */
  type: string | null;
  name: string;
  itemId: string;
  category: number | null;
  quality: number | null;
  stack: number | null;
  /** full element XML for the advanced editor */
  rawXml: string;
}

function itemsContainer(save: SaveDocument): XmlElement {
  const el = resolvePath(save.player, 'items');
  if (!el) throw new Error('Save file has no <items> element.');
  return el;
}

function slotElement(save: SaveDocument, slot: number): XmlElement {
  const slots = childElements(itemsContainer(save), 'Item');
  const el = slots[slot];
  if (!el) throw new Error(`No inventory slot ${slot} (save has ${slots.length} slots)`);
  return el;
}

function isNil(el: XmlElement): boolean {
  return el.getAttribute('xsi:nil') === 'true';
}

export function getInventory(save: SaveDocument): InventoryItem[] {
  return childElements(itemsContainer(save), 'Item').map((el, slot) => {
    if (isNil(el)) {
      return {
        slot,
        empty: true,
        type: null,
        name: '',
        itemId: '',
        category: null,
        quality: null,
        stack: null,
        rawXml: serializeElement(el),
      };
    }
    const num = (tag: string): number | null => {
      const c = child(el, tag);
      return c ? Number(textOf(c)) : null;
    };
    return {
      slot,
      empty: false,
      type: el.getAttribute('xsi:type'),
      name: textOf(child(el, 'name')),
      itemId: textOf(child(el, 'itemId')),
      category: num('category'),
      quality: num('quality'),
      stack: num('stack'),
      rawXml: serializeElement(el),
    };
  });
}

export function setItemField(
  save: SaveDocument,
  slot: number,
  field: 'name' | 'itemId' | 'quality' | 'stack',
  value: string
): void {
  const el = slotElement(save, slot);
  if (isNil(el)) throw new Error(`Slot ${slot} is empty`);
  if (field === 'quality') {
    const q = Number(value);
    if (!VALID_QUALITIES.includes(q as (typeof VALID_QUALITIES)[number])) {
      throw new Error('Quality must be 0 (normal), 1 (silver), 2 (gold), or 4 (iridium)');
    }
  }
  if (field === 'stack') {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > MAX_STACK) {
      throw new Error(`Stack must be a whole number between 1 and ${MAX_STACK}`);
    }
  }
  if (field === 'name' && value === '') throw new Error('Item name cannot be empty');
  const target = child(el, field);
  if (!target) throw new Error(`This item has no <${field}> field; use the advanced editor`);
  setText(target, value);
}

/** Empty a slot by replacing the item with the game's nil marker. */
export function clearSlot(save: SaveDocument, slot: number): void {
  const el = slotElement(save, slot);
  const doc = save.doc;
  const nil = doc.createElement('Item');
  nil.setAttribute('xsi:nil', 'true');
  const container = itemsContainer(save);
  container.insertBefore(nil, el);
  container.removeChild(el);
}

/**
 * Replace a slot's entire item element with hand-edited XML (advanced
 * editor). The XML is parsed first so a malformed edit is rejected instead
 * of corrupting the save, and the root must be an <Item>.
 */
export function setSlotRawXml(save: SaveDocument, slot: number, xml: string): void {
  // Wrap with the xsi/xsd namespaces the fragment inherits inside the save.
  const wrapped = `<wrapper xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${xml}</wrapper>`;
  let parsed;
  try {
    parsed = parseXml(wrapped);
  } catch {
    throw new Error('That XML is not well-formed; the slot was left unchanged.');
  }
  const items = childElements(parsed.documentElement);
  if (items.length !== 1 || items[0].tagName !== 'Item') {
    throw new Error('The XML must contain exactly one <Item> element.');
  }
  const replacement = rebuildInDocument(save, items[0]);
  const el = slotElement(save, slot);
  const container = itemsContainer(save);
  container.insertBefore(replacement, el);
  container.removeChild(el);
}

/** Copy the item in `fromSlot` into `toSlot` (which must be empty). */
export function copySlot(save: SaveDocument, fromSlot: number, toSlot: number): void {
  const from = slotElement(save, fromSlot);
  if (isNil(from)) throw new Error(`Slot ${fromSlot} is empty`);
  const to = slotElement(save, toSlot);
  if (!isNil(to)) throw new Error(`Slot ${toSlot} already has an item`);
  const clone = rebuildInDocument(save, from);
  const container = itemsContainer(save);
  container.insertBefore(clone, to);
  container.removeChild(to);
}

/**
 * Field-complete template for a plain Object item, mirroring the exact
 * element order the game writes (XmlSerializer reads sequentially, so order
 * is preserved rather than risked).
 */
export function addObjectItem(
  save: SaveDocument,
  slot: number,
  item: { itemId: string; name: string; stack?: number; quality?: number; price?: number; edibility?: number; category?: number }
): void {
  const target = slotElement(save, slot);
  if (!isNil(target)) throw new Error(`Slot ${slot} already has an item`);
  const stack = item.stack ?? 1;
  const quality = item.quality ?? 0;
  if (!Number.isInteger(stack) || stack < 1 || stack > MAX_STACK)
    throw new Error(`Stack must be between 1 and ${MAX_STACK}`);
  if (!VALID_QUALITIES.includes(quality as (typeof VALID_QUALITIES)[number]))
    throw new Error('Quality must be 0, 1, 2, or 4');
  // parentSheetIndex only makes sense for numeric ids; harmless at 0 otherwise
  const psi = /^\d+$/.test(item.itemId) ? item.itemId : '0';
  const xml =
    `<Item xsi:type="Object"><isLostItem>false</isLostItem>` +
    `<category>${item.category ?? 0}</category>` +
    `<hasBeenInInventory>true</hasBeenInInventory>` +
    `<name>${escapeXml(item.name)}</name>` +
    `<parentSheetIndex>${psi}</parentSheetIndex>` +
    `<itemId>${escapeXml(item.itemId)}</itemId>` +
    `<specialItem>false</specialItem><isRecipe>false</isRecipe>` +
    `<quality>${quality}</quality><stack>${stack}</stack>` +
    `<SpecialVariable>0</SpecialVariable>` +
    `<tileLocation><X>0</X><Y>0</Y></tileLocation>` +
    `<owner>0</owner><type>Basic</type>` +
    `<canBeSetDown>true</canBeSetDown><canBeGrabbed>true</canBeGrabbed>` +
    `<isSpawnedObject>false</isSpawnedObject><questItem>false</questItem>` +
    `<isOn>true</isOn><fragility>0</fragility>` +
    `<price>${item.price ?? 0}</price><edibility>${item.edibility ?? -300}</edibility>` +
    `<bigCraftable>false</bigCraftable><setOutdoors>false</setOutdoors>` +
    `<setIndoors>false</setIndoors><readyForHarvest>false</readyForHarvest>` +
    `<showNextIndex>false</showNextIndex><flipped>false</flipped>` +
    `<isLamp>false</isLamp><minutesUntilReady>0</minutesUntilReady>` +
    `<boundingBox><X>0</X><Y>0</Y><Width>0</Width><Height>0</Height>` +
    `<Location><X>0</X><Y>0</Y></Location><Size><X>0</X><Y>0</Y></Size></boundingBox>` +
    `<scale><X>0</X><Y>0</Y></scale><uses>0</uses>` +
    `<destroyOvernight>false</destroyOvernight></Item>`;
  setSlotRawXml(save, slot, xml);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function serializeElement(el: XmlElement): string {
  // Reuse the document serializer on a single element by faking a doc shape.
  const fake = { documentElement: el } as Parameters<typeof serializeXml>[0];
  return serializeXml(fake).replace('<?xml version="1.0" encoding="utf-8"?>', '');
}

/**
 * Recreate a parsed/foreign element inside the save's own document so DOM
 * implementations never get mixed (browser DOM rejects cross-document nodes
 * without importNode; rebuilding avoids the issue everywhere).
 */
function rebuildInDocument(save: SaveDocument, source: XmlElement): XmlElement {
  const doc = save.doc;
  const clone = doc.createElement(source.tagName);
  const attrs = source.attributes;
  if (attrs) {
    for (let i = 0; i < attrs.length; i++) {
      const a = attrs[i];
      if (a.name.startsWith('xmlns')) continue; // inherited inside the save
      clone.setAttribute(a.name, a.value);
    }
  }
  const kids = source.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (k.nodeType === 1) clone.appendChild(rebuildInDocument(save, k as XmlElement));
    else if (k.nodeType === 3) clone.appendChild(doc.createTextNode(k.nodeValue ?? ''));
  }
  return clone;
}
