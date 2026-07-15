import { useMemo, useState } from 'react';
import { searchItems, type ItemRef } from '../items-db.ts';
import { ItemIcon } from './ItemIcon.tsx';
import { spriteForRef } from '../sprites.ts';

export function ItemPicker({
  onPick,
  onClose,
}: {
  onPick: (item: ItemRef, stack: number, quality: number) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ItemRef | null>(null);
  const [stack, setStack] = useState(1);
  const [quality, setQuality] = useState(0);
  const results = useMemo(() => searchItems(query), [query]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Add an item</h3>
        <input
          autoFocus
          className="search"
          placeholder="Search 800+ items — try “prismatic”, “ancient fruit”, “iridium ore”…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
          }}
        />
        <ul className="picker-results">
          {results.map((item) => (
            <li key={`${item.type}-${item.id}`}>
              <button
                className={selected?.id === item.id ? 'picker-row selected' : 'picker-row'}
                onClick={() => setSelected(item)}
              >
                <span className="picker-name">
                  <ItemIcon sprite={spriteForRef(item)} scale={1.5} />
                  {item.name}
                </span>
                <span className="muted">
                  id {item.id}
                  {item.price ? ` · ${item.price}g` : ''}
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && <li className="muted empty">No matches</li>}
        </ul>
        <div className="picker-options">
          <label>
            Stack
            <input
              type="number"
              min={1}
              max={999}
              value={stack}
              onChange={(e) => setStack(Math.max(1, Math.min(999, Number(e.target.value) || 1)))}
            />
          </label>
          <label>
            Quality
            <select value={quality} onChange={(e) => setQuality(Number(e.target.value))}>
              <option value={0}>Normal</option>
              <option value={1}>Silver</option>
              <option value={2}>Gold</option>
              <option value={4}>Iridium</option>
            </select>
          </label>
        </div>
        <div className="modal-actions">
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            disabled={!selected}
            onClick={() => selected && onPick(selected, stack, quality)}
          >
            Add {selected ? selected.name : 'item'}
          </button>
        </div>
        <p className="muted">
          v1 adds standard objects (crops, minerals, resources, food…). Weapons, tools and
          clothing can be edited on existing items via their XML view.
        </p>
      </div>
    </div>
  );
}
