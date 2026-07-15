import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  SaveDocument,
  listLocations,
  getLocationDetail,
  deleteWorldObject,
  deleteTerrainFeature,
  setWorldObjectXml,
  addWorldObject,
  applyEditsToDoc,
} from '../src/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const realSave = join(here, '..', '..', '..', 'fixtures', 'private', 'MrBurns_146087234');
const hasReal = existsSync(realSave);

describe.runIf(hasReal)('world locations against the real save', () => {
  let save: SaveDocument;
  beforeEach(() => {
    save = SaveDocument.fromBytes(new Uint8Array(readFileSync(realSave)));
  });

  it('lists locations with counts', () => {
    const locs = listLocations(save);
    expect(locs.length).toBeGreaterThan(50);
    const farm = locs.find((l) => l.name === 'Farm')!;
    expect(farm.objects).toBe(218);
    expect(farm.terrainFeatures).toBe(191);
    expect(farm.buildings).toBe(4);
  });

  it('reads Farm detail with positions and types', () => {
    const detail = getLocationDetail(save, 'Farm');
    expect(detail.objects).toHaveLength(218);
    expect(detail.terrainFeatures).toHaveLength(191);
    expect(detail.buildings).toHaveLength(4);
    const artifactSpot = detail.objects.find((o) => o.name === 'Artifact Spot');
    expect(artifactSpot).toBeDefined();
    expect(artifactSpot!.x).toBeGreaterThanOrEqual(0);
    const shippingBin = detail.buildings.find((b) => b.type === 'ShippingBin');
    expect(shippingBin?.buildingType).toBe('Shipping Bin');
    const tree = detail.terrainFeatures.find((t) => t.type === 'Tree');
    expect(tree?.summary).toMatch(/stage \d+/);
  });

  it('deletes an object and reports it', () => {
    const before = getLocationDetail(save, 'Farm').objects;
    const target = before[0];
    const desc = deleteWorldObject(save, 'Farm', 0);
    expect(desc).toContain('Farm: removed');
    expect(desc).toContain(`(${target.x}, ${target.y})`);
    expect(getLocationDetail(save, 'Farm').objects).toHaveLength(before.length - 1);
    SaveDocument.fromText(save.toText()); // still well-formed
  });

  it('deletes a terrain feature', () => {
    const before = getLocationDetail(save, 'Farm').terrainFeatures.length;
    const desc = deleteTerrainFeature(save, 'Farm', 0);
    expect(desc).toContain('Farm: removed');
    expect(getLocationDetail(save, 'Farm').terrainFeatures).toHaveLength(before - 1);
  });

  it('places a new object on an empty tile and refuses occupied tiles', () => {
    const desc = addWorldObject(save, 'Farm', 1, 1, {
      itemId: '74',
      name: 'Prismatic Shard',
      price: 2000,
    });
    expect(desc).toBe('Farm: placed Prismatic Shard at (1, 1)');
    const detail = getLocationDetail(save, 'Farm');
    const placed = detail.objects.find((o) => o.x === 1 && o.y === 1);
    expect(placed?.name).toBe('Prismatic Shard');
    expect(() =>
      addWorldObject(save, 'Farm', 1, 1, { itemId: '74', name: 'Prismatic Shard' })
    ).toThrow(/already an object/);
    SaveDocument.fromText(save.toText());
  });

  it('rejects malformed raw XML without touching the entry', () => {
    const before = getLocationDetail(save, 'Farm').objects[0].rawXml;
    expect(() => setWorldObjectXml(save, 'Farm', 0, '<item><broken>')).toThrow(/not well-formed/);
    expect(getLocationDetail(save, 'Farm').objects[0].rawXml).toBe(before);
  });

  it('round-trips a raw XML self-replacement byte-identically', () => {
    const original = save.toText();
    const entry = getLocationDetail(save, 'Farm').objects[0];
    setWorldObjectXml(save, 'Farm', 0, entry.rawXml); // replace with itself
    expect(save.toText()).toBe(original);
  });

  it('world edits through the shared batch API return descriptions', () => {
    const results = applyEditsToDoc(save, [
      { kind: 'worldObjectDelete', location: 'Farm', index: 0 },
      { kind: 'worldObjectDelete', location: 'NotARealPlace', index: 0 },
    ]);
    expect(results[0].ok).toBe(true);
    expect(results[0].description).toContain('Farm: removed');
    expect(results[1].ok).toBe(false);
    expect(results[1].error).toContain('No location named');
  });

  it('unknown locations and bad indexes fail loudly', () => {
    expect(() => getLocationDetail(save, 'Atlantis')).toThrow(/No location named/);
    expect(() => deleteWorldObject(save, 'Farm', 99999)).toThrow(/No entry at index/);
  });
});
