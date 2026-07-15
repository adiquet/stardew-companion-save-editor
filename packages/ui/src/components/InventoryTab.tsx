import { useEffect, useState } from 'react';
import { VALID_QUALITIES, type Edit, type InventoryItem } from '@sdvse/core';
import type { SaveState } from '../backend.ts';
import { ItemPicker } from './ItemPicker.tsx';
import { ItemIcon } from './ItemIcon.tsx';
import { spriteForItem } from '../sprites.ts';

const QUALITY_LABELS: Record<number, string> = {
  0: 'Normal',
  1: 'Silver ⭐',
  2: 'Gold ⭐',
  4: 'Iridium ⭐',
};

const CATEGORY_COLORS: Record<string, string> = {
  MeleeWeapon: '#b23a3a',
  Object: '#4a8f3c',
  Hoe: '#8a6d3b',
  Axe: '#8a6d3b',
  Pickaxe: '#8a6d3b',
  WateringCan: '#3b6f8a',
  FishingRod: '#3b6f8a',
  Pan: '#8a6d3b',
  Wand: '#7b4a8a',
  Ring: '#c9a227',
  Boots: '#6d4c2f',
  Hat: '#6d4c2f',
  Clothing: '#6d4c2f',
  Furniture: '#7a5a3a',
  ColoredObject: '#4a8f3c',
  BedFurniture: '#7a5a3a',
  Slingshot: '#b23a3a',
};

export function InventoryTab({
  state,
  onEdit,
}: {
  state: SaveState;
  onEdit: (edits: Edit[]) => void;
}) {
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);
  const [rawSlot, setRawSlot] = useState<number | null>(null);

  return (
    <div className="tab-body">
      <section className="card">
        <h3>Inventory ({state.inventory.filter((i) => !i.empty).length} / {state.inventory.length} slots)</h3>
        <div className="inv-grid">
          {state.inventory.map((item) =>
            item.empty ? (
              <button
                key={item.slot}
                className="inv-slot empty"
                title={`Slot ${item.slot + 1} — empty. Click to add an item.`}
                onClick={() => setPickingSlot(item.slot)}
              >
                +
              </button>
            ) : (
              <ItemCard
                key={item.slot}
                item={item}
                onEdit={onEdit}
                onRaw={() => setRawSlot(item.slot)}
              />
            )
          )}
        </div>
      </section>
      {pickingSlot !== null && (
        <ItemPicker
          onPick={(ref, stack, quality) => {
            onEdit([
              {
                kind: 'addItem',
                slot: pickingSlot,
                itemId: ref.id,
                name: ref.name,
                stack,
                quality,
                price: ref.price,
                edibility: ref.edibility,
                category: ref.category,
              },
            ]);
            setPickingSlot(null);
          }}
          onClose={() => setPickingSlot(null)}
        />
      )}
      {rawSlot !== null && (
        <RawXmlModal
          item={state.inventory[rawSlot]}
          onSave={(xml) => {
            onEdit([{ kind: 'itemRaw', slot: rawSlot, xml }]);
            setRawSlot(null);
          }}
          onClose={() => setRawSlot(null)}
        />
      )}
    </div>
  );
}

function ItemCard({
  item,
  onEdit,
  onRaw,
}: {
  item: InventoryItem;
  onEdit: (edits: Edit[]) => void;
  onRaw: () => void;
}) {
  const [stackDraft, setStackDraft] = useState(String(item.stack ?? 1));
  useEffect(() => setStackDraft(String(item.stack ?? 1)), [item.stack]);

  const color = CATEGORY_COLORS[item.type ?? ''] ?? '#666';
  const stackable = item.type === 'Object' || item.type === 'ColoredObject';

  const sprite = spriteForItem(item.type, item.itemId);

  return (
    <div className="inv-card" style={{ borderTopColor: color }}>
      <div className="inv-title">
        <ItemIcon sprite={sprite} />
        <div>
          <div className="inv-name" title={`${item.name} (id ${item.itemId}, ${item.type})`}>
            {item.name}
          </div>
          <div className="inv-type muted">{item.type}</div>
        </div>
      </div>
      <div className="inv-controls">
        {stackable && (
          <label title="Stack size">
            ×
            <input
              type="number"
              min={1}
              max={999}
              value={stackDraft}
              onChange={(e) => setStackDraft(e.target.value)}
              onBlur={() => {
                if (stackDraft !== String(item.stack)) {
                  onEdit([{ kind: 'item', slot: item.slot, field: 'stack', value: stackDraft }]);
                }
              }}
              onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            />
          </label>
        )}
        {item.quality !== null && (
          <select
            title="Quality"
            value={item.quality}
            onChange={(e) =>
              onEdit([{ kind: 'item', slot: item.slot, field: 'quality', value: e.target.value }])
            }
          >
            {VALID_QUALITIES.map((q) => (
              <option key={q} value={q}>
                {QUALITY_LABELS[q]}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="inv-actions">
        <button className="ghost small" onClick={onRaw} title="Edit this item's raw XML">
          XML
        </button>
        <button
          className="ghost small danger"
          title="Remove this item"
          onClick={() => onEdit([{ kind: 'clearSlot', slot: item.slot }])}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function RawXmlModal({
  item,
  onSave,
  onClose,
}: {
  item: InventoryItem;
  onSave: (xml: string) => void;
  onClose: () => void;
}) {
  const [xml, setXml] = useState(item.rawXml);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h3>
          Advanced: raw XML for slot {item.slot + 1} {item.name && `(${item.name})`}
        </h3>
        <p className="muted">
          Full element as stored in the save. Malformed XML is rejected without touching the save.
          Type-specific fields (weapon stats, ring effects, …) can be edited here.
        </p>
        <textarea value={xml} onChange={(e) => setXml(e.target.value)} rows={14} spellCheck={false} />
        <div className="modal-actions">
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" onClick={() => onSave(xml)}>
            Apply XML
          </button>
        </div>
      </div>
    </div>
  );
}
