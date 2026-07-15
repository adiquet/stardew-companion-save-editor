/**
 * Full World Editor (Phase A) accessors: structured, table-oriented access
 * to each location's objects, terrain features, and buildings. Entries are
 * addressed by their current DOM index; every mutation returns a human
 * description for the change log (world data has no cheap snapshot).
 */
import type { SaveDocument } from './document.ts';
import { child, childElements, textOf } from './dom.ts';
import { parseXml, serializeXml, type XmlElement } from './xml.ts';

function locationsContainer(save: SaveDocument): XmlElement {
  if (save.kind !== 'full') {
    throw new Error('World data lives in the main save file, not SaveGameInfo.');
  }
  const el = child(save.root, 'locations');
  if (!el) throw new Error('Save file has no <locations> element.');
  return el;
}

function locationByName(save: SaveDocument, name: string): XmlElement {
  for (const loc of childElements(locationsContainer(save), 'GameLocation')) {
    if (textOf(child(loc, 'name')) === name) return loc;
  }
  throw new Error(`No location named "${name}" in this save`);
}

export interface LocationSummary {
  name: string;
  type: string | null;
  objects: number;
  terrainFeatures: number;
  buildings: number;
}

export function listLocations(save: SaveDocument): LocationSummary[] {
  return childElements(locationsContainer(save), 'GameLocation').map((loc) => ({
    name: textOf(child(loc, 'name')),
    type: loc.getAttribute('xsi:type'),
    objects: countOf(loc, 'objects'),
    terrainFeatures: countOf(loc, 'terrainFeatures'),
    buildings: child(loc, 'buildings') ? childElements(child(loc, 'buildings')!, 'Building').length : 0,
  }));
}

function countOf(loc: XmlElement, container: string): number {
  const el = child(loc, container);
  return el ? childElements(el, 'item').length : 0;
}

export interface WorldObjectInfo {
  index: number;
  x: number;
  y: number;
  type: string;
  name: string;
  itemId: string;
  stack: number | null;
  minutesUntilReady: number | null;
  rawXml: string;
}

export interface TerrainFeatureInfo {
  index: number;
  x: number;
  y: number;
  type: string;
  summary: string;
  rawXml: string;
}

export interface BuildingInfo {
  index: number;
  type: string;
  buildingType: string;
  tileX: number;
  tileY: number;
  daysOfConstructionLeft: number;
  rawXml: string;
}

export interface LocationDetail {
  name: string;
  objects: WorldObjectInfo[];
  terrainFeatures: TerrainFeatureInfo[];
  buildings: BuildingInfo[];
}

function keyXY(item: XmlElement): { x: number; y: number } {
  const vec = child(child(item, 'key') ?? item, 'Vector2');
  return {
    x: Number(vec ? textOf(child(vec, 'X')) : 0),
    y: Number(vec ? textOf(child(vec, 'Y')) : 0),
  };
}

/** The payload element inside <value> (e.g. <Object> or <TerrainFeature>). */
function valueElement(item: XmlElement): XmlElement | null {
  const value = child(item, 'value');
  return value ? childElements(value)[0] ?? null : null;
}

function serializeElement(el: XmlElement): string {
  // The serializer only reads documentElement, so a bare wrapper suffices.
  const fake = { documentElement: el } as Parameters<typeof serializeXml>[0];
  return serializeXml(fake).replace('<?xml version="1.0" encoding="utf-8"?>', '');
}

function terrainSummary(el: XmlElement): string {
  const type = el.getAttribute('xsi:type') ?? 'TerrainFeature';
  switch (type) {
    case 'Tree': {
      const stage = textOf(child(el, 'growthStage'));
      const stump = textOf(child(el, 'stump')) === 'true';
      return `stage ${stage}${stump ? ', stump' : ''}`;
    }
    case 'FruitTree': {
      const stage = textOf(child(el, 'growthStage'));
      return `stage ${stage}`;
    }
    case 'HoeDirt': {
      const crop = child(el, 'crop');
      const watered = textOf(child(el, 'state')) === '1';
      return `${crop ? 'crop planted' : 'empty'}${watered ? ', watered' : ''}`;
    }
    case 'Grass':
      return `weight ${textOf(child(el, 'numberOfWeeds'))}`;
    case 'Flooring':
      return `type ${textOf(child(el, 'whichFloor'))}`;
    default:
      return '';
  }
}

export function getLocationDetail(save: SaveDocument, name: string): LocationDetail {
  const loc = locationByName(save, name);

  const objects: WorldObjectInfo[] = [];
  const objectsEl = child(loc, 'objects');
  if (objectsEl) {
    childElements(objectsEl, 'item').forEach((item, index) => {
      const obj = valueElement(item);
      if (!obj) return;
      const { x, y } = keyXY(item);
      objects.push({
        index,
        x,
        y,
        type: obj.getAttribute('xsi:type') ?? 'Object',
        name: textOf(child(obj, 'name')),
        itemId: textOf(child(obj, 'itemId')),
        stack: child(obj, 'stack') ? Number(textOf(child(obj, 'stack'))) : null,
        minutesUntilReady: child(obj, 'minutesUntilReady')
          ? Number(textOf(child(obj, 'minutesUntilReady')))
          : null,
        rawXml: serializeElement(item),
      });
    });
  }

  const terrainFeatures: TerrainFeatureInfo[] = [];
  const terrainEl = child(loc, 'terrainFeatures');
  if (terrainEl) {
    childElements(terrainEl, 'item').forEach((item, index) => {
      const tf = valueElement(item);
      if (!tf) return;
      const { x, y } = keyXY(item);
      terrainFeatures.push({
        index,
        x,
        y,
        type: tf.getAttribute('xsi:type') ?? 'TerrainFeature',
        summary: terrainSummary(tf),
        rawXml: serializeElement(item),
      });
    });
  }

  const buildings: BuildingInfo[] = [];
  const buildingsEl = child(loc, 'buildings');
  if (buildingsEl) {
    childElements(buildingsEl, 'Building').forEach((b, index) => {
      buildings.push({
        index,
        type: b.getAttribute('xsi:type') ?? 'Building',
        buildingType: textOf(child(b, 'buildingType')),
        tileX: Number(textOf(child(b, 'tileX'))),
        tileY: Number(textOf(child(b, 'tileY'))),
        daysOfConstructionLeft: Number(textOf(child(b, 'daysOfConstructionLeft')) || '0'),
        rawXml: serializeElement(b),
      });
    });
  }

  return { name, objects, terrainFeatures, buildings };
}

function nthChild(container: XmlElement, tag: string, index: number): XmlElement {
  const entries = childElements(container, tag);
  const el = entries[index];
  if (!el) throw new Error(`No entry at index ${index} (${entries.length} present)`);
  return el;
}

export function deleteWorldObject(save: SaveDocument, location: string, index: number): string {
  const container = child(locationByName(save, location), 'objects');
  if (!container) throw new Error(`${location} has no objects`);
  const item = nthChild(container, 'item', index);
  const obj = valueElement(item);
  const { x, y } = keyXY(item);
  const label = obj ? textOf(child(obj, 'name')) || 'object' : 'object';
  container.removeChild(item);
  return `${location}: removed ${label} at (${x}, ${y})`;
}

export function deleteTerrainFeature(save: SaveDocument, location: string, index: number): string {
  const container = child(locationByName(save, location), 'terrainFeatures');
  if (!container) throw new Error(`${location} has no terrain features`);
  const item = nthChild(container, 'item', index);
  const tf = valueElement(item);
  const { x, y } = keyXY(item);
  const label = tf ? (tf.getAttribute('xsi:type') ?? 'feature') : 'feature';
  container.removeChild(item);
  return `${location}: removed ${label} at (${x}, ${y})`;
}

/** Shared validated raw-XML replacement for a location entry. */
function replaceEntryXml(
  container: XmlElement,
  tag: string,
  index: number,
  xml: string,
  save: SaveDocument,
  expectRoot: string
): void {
  const wrapped = `<wrapper xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">${xml}</wrapper>`;
  let parsed;
  try {
    parsed = parseXml(wrapped);
  } catch {
    throw new Error('That XML is not well-formed; the entry was left unchanged.');
  }
  const roots = childElements(parsed.documentElement);
  if (roots.length !== 1 || roots[0].tagName !== expectRoot) {
    throw new Error(`The XML must contain exactly one <${expectRoot}> element.`);
  }
  const replacement = rebuild(save, roots[0]);
  const el = nthChild(container, tag, index);
  container.insertBefore(replacement, el);
  container.removeChild(el);
}

export function setWorldObjectXml(
  save: SaveDocument,
  location: string,
  index: number,
  xml: string
): string {
  const container = child(locationByName(save, location), 'objects');
  if (!container) throw new Error(`${location} has no objects`);
  replaceEntryXml(container, 'item', index, xml, save, 'item');
  return `${location}: edited object entry ${index + 1} (raw XML)`;
}

export function setTerrainFeatureXml(
  save: SaveDocument,
  location: string,
  index: number,
  xml: string
): string {
  const container = child(locationByName(save, location), 'terrainFeatures');
  if (!container) throw new Error(`${location} has no terrain features`);
  replaceEntryXml(container, 'item', index, xml, save, 'item');
  return `${location}: edited terrain entry ${index + 1} (raw XML)`;
}

export function setBuildingXml(
  save: SaveDocument,
  location: string,
  index: number,
  xml: string
): string {
  const container = child(locationByName(save, location), 'buildings');
  if (!container) throw new Error(`${location} has no buildings`);
  replaceEntryXml(container, 'Building', index, xml, save, 'Building');
  return `${location}: edited building ${index + 1} (raw XML)`;
}

/** Place a plain Object on a tile (same field-complete template as inventory). */
export function addWorldObject(
  save: SaveDocument,
  location: string,
  x: number,
  y: number,
  item: { itemId: string; name: string; price?: number; edibility?: number; category?: number }
): string {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > 999 || y > 999) {
    throw new Error('Tile coordinates must be whole numbers between 0 and 999');
  }
  const loc = locationByName(save, location);
  const container = child(loc, 'objects');
  if (!container) throw new Error(`${location} has no <objects> container`);
  for (const existing of childElements(container, 'item')) {
    const pos = keyXY(existing);
    if (pos.x === x && pos.y === y) {
      throw new Error(`There is already an object at (${x}, ${y}) in ${location}`);
    }
  }
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const psi = /^\d+$/.test(item.itemId) ? item.itemId : '0';
  const xml =
    `<item><key><Vector2><X>${x}</X><Y>${y}</Y></Vector2></key><value>` +
    `<Object><isLostItem>false</isLostItem>` +
    `<category>${item.category ?? 0}</category>` +
    `<hasBeenInInventory>false</hasBeenInInventory>` +
    `<name>${esc(item.name)}</name>` +
    `<parentSheetIndex>${psi}</parentSheetIndex>` +
    `<itemId>${esc(item.itemId)}</itemId>` +
    `<specialItem>false</specialItem><isRecipe>false</isRecipe>` +
    `<quality>0</quality><stack>1</stack>` +
    `<SpecialVariable>0</SpecialVariable>` +
    `<tileLocation><X>${x}</X><Y>${y}</Y></tileLocation>` +
    `<owner>0</owner><type>Basic</type>` +
    `<canBeSetDown>true</canBeSetDown><canBeGrabbed>true</canBeGrabbed>` +
    `<isSpawnedObject>false</isSpawnedObject><questItem>false</questItem>` +
    `<isOn>true</isOn><fragility>0</fragility>` +
    `<price>${item.price ?? 0}</price><edibility>${item.edibility ?? -300}</edibility>` +
    `<bigCraftable>false</bigCraftable><setOutdoors>false</setOutdoors>` +
    `<setIndoors>false</setIndoors><readyForHarvest>false</readyForHarvest>` +
    `<showNextIndex>false</showNextIndex><flipped>false</flipped>` +
    `<isLamp>false</isLamp><minutesUntilReady>0</minutesUntilReady>` +
    `<boundingBox><X>${x * 64}</X><Y>${y * 64}</Y><Width>64</Width><Height>64</Height>` +
    `<Location><X>${x * 64}</X><Y>${y * 64}</Y></Location><Size><X>64</X><Y>64</Y></Size></boundingBox>` +
    `<scale><X>0</X><Y>0</Y></scale><uses>0</uses>` +
    `<destroyOvernight>false</destroyOvernight></Object></value></item>`;
  const parsed = parseXml(
    `<wrapper xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">${xml}</wrapper>`
  );
  container.appendChild(rebuild(save, childElements(parsed.documentElement)[0]));
  return `${location}: placed ${item.name} at (${x}, ${y})`;
}

/** Rebuild a foreign element inside the save's own document (cross-doc safe). */
function rebuild(save: SaveDocument, source: XmlElement): XmlElement {
  const doc = save.doc;
  const clone = doc.createElement(source.tagName);
  const attrs = source.attributes;
  if (attrs) {
    for (let i = 0; i < attrs.length; i++) {
      const a = attrs[i];
      if (a.name.startsWith('xmlns')) continue;
      clone.setAttribute(a.name, a.value);
    }
  }
  const kids = source.childNodes;
  for (let i = 0; i < kids.length; i++) {
    const k = kids[i];
    if (k.nodeType === 1) clone.appendChild(rebuild(save, k as XmlElement));
    else if (k.nodeType === 3) clone.appendChild(doc.createTextNode(k.nodeValue ?? ''));
  }
  return clone;
}
