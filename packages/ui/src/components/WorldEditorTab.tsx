import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Edit, LocationDetail, LocationSummary } from '@sdvse/core';
import type { Backend } from '../backend.ts';
import { ItemPicker } from './ItemPicker.tsx';
import { ItemIcon } from './ItemIcon.tsx';
import { spriteForItem } from '../sprites.ts';

export function WorldEditorTab({
  backend,
  onEdit,
}: {
  backend: Backend;
  onEdit: (edits: Edit[]) => Promise<void>;
}) {
  const [locations, setLocations] = useState<LocationSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<LocationDetail | null>(null);
  const [filter, setFilter] = useState('');
  const [section, setSection] = useState<'objects' | 'terrain' | 'buildings'>('objects');
  const [adding, setAdding] = useState(false);
  const [rawEntry, setRawEntry] = useState<{
    kind: 'worldObjectXml' | 'terrainXml' | 'buildingXml';
    index: number;
    xml: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    backend.listLocations().then(setLocations);
  }, [backend]);

  const refresh = useCallback(async () => {
    if (!selected) return;
    setDetail(await backend.locationDetail(selected));
    setLocations(await backend.listLocations());
  }, [backend, selected]);

  useEffect(() => {
    if (selected) backend.locationDetail(selected).then(setDetail);
    else setDetail(null);
  }, [backend, selected]);

  const edit = async (edits: Edit[]) => {
    await onEdit(edits);
    await refresh();
  };

  const shown = useMemo(
    () =>
      locations.filter(
        (l) => !filter || l.name.toLowerCase().includes(filter.toLowerCase())
      ),
    [locations, filter]
  );

  if (!selected || !detail) {
    return (
      <div className="tab-body">
        <section className="card">
          <h3>World Editor — choose a location</h3>
          <p className="muted">
            Structured editing of everything placed in the world. This is powerful — deleting the
            wrong thing can break progression, so review the change list before saving.
          </p>
          <input
            className="search"
            placeholder={`Filter ${locations.length} locations…`}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <table className="friend-table">
            <thead>
              <tr>
                <th>Location</th>
                <th>Objects</th>
                <th>Terrain</th>
                <th>Buildings</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l.name} className="loc-row" onClick={() => setSelected(l.name)}>
                  <td>
                    <button className="link">{l.name || '(unnamed)'}</button>
                    {l.type && <span className="muted"> {l.type}</span>}
                  </td>
                  <td>{l.objects}</td>
                  <td>{l.terrainFeatures}</td>
                  <td>{l.buildings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    );
  }

  return (
    <div className="tab-body">
      <section className="card">
        <div className="loc-header">
          <button className="ghost" onClick={() => setSelected(null)}>
            ← All locations
          </button>
          <h3>{detail.name}</h3>
          <nav className="subtabs">
            {(['objects', 'terrain', 'buildings'] as const).map((s) => (
              <button
                key={s}
                className={s === section ? 'tab active' : 'tab'}
                onClick={() => setSection(s)}
              >
                {s === 'objects'
                  ? `Objects (${detail.objects.length})`
                  : s === 'terrain'
                    ? `Terrain (${detail.terrainFeatures.length})`
                    : `Buildings (${detail.buildings.length})`}
              </button>
            ))}
          </nav>
        </div>

        {section === 'objects' && (
          <>
            <button className="primary small" onClick={() => setAdding(true)}>
              + Place an object…
            </button>
            <table className="friend-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Tile</th>
                  <th>Stack</th>
                  <th>Ready in</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {detail.objects.map((o) => (
                  <tr key={`${o.index}-${o.x}-${o.y}`}>
                    <td>
                      <ItemIcon sprite={spriteForItem('Object', o.itemId)} scale={1.5} />
                    </td>
                    <td>{o.name}</td>
                    <td className="muted">{o.type}</td>
                    <td>
                      ({o.x}, {o.y})
                    </td>
                    <td>{o.stack ?? ''}</td>
                    <td>{o.minutesUntilReady ? `${o.minutesUntilReady} min` : ''}</td>
                    <td className="row-actions">
                      <button
                        className="ghost small"
                        onClick={() =>
                          setRawEntry({
                            kind: 'worldObjectXml',
                            index: o.index,
                            xml: o.rawXml,
                            title: `${o.name} at (${o.x}, ${o.y})`,
                          })
                        }
                      >
                        XML
                      </button>
                      <button
                        className="ghost small danger"
                        title="Delete this object"
                        onClick={() =>
                          edit([{ kind: 'worldObjectDelete', location: detail.name, index: o.index }])
                        }
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {section === 'terrain' && (
          <table className="friend-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Tile</th>
                <th>Details</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {detail.terrainFeatures.map((t) => (
                <tr key={`${t.index}-${t.x}-${t.y}`}>
                  <td>{t.type}</td>
                  <td>
                    ({t.x}, {t.y})
                  </td>
                  <td className="muted">{t.summary}</td>
                  <td className="row-actions">
                    <button
                      className="ghost small"
                      onClick={() =>
                        setRawEntry({
                          kind: 'terrainXml',
                          index: t.index,
                          xml: t.rawXml,
                          title: `${t.type} at (${t.x}, ${t.y})`,
                        })
                      }
                    >
                      XML
                    </button>
                    <button
                      className="ghost small danger"
                      title="Delete this terrain feature"
                      onClick={() =>
                        edit([{ kind: 'terrainDelete', location: detail.name, index: t.index }])
                      }
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {section === 'buildings' && (
          <table className="friend-table">
            <thead>
              <tr>
                <th>Building</th>
                <th>Type</th>
                <th>Tile</th>
                <th>Construction</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {detail.buildings.map((b) => (
                <tr key={b.index}>
                  <td>{b.buildingType}</td>
                  <td className="muted">{b.type}</td>
                  <td>
                    ({b.tileX}, {b.tileY})
                  </td>
                  <td>{b.daysOfConstructionLeft > 0 ? `${b.daysOfConstructionLeft} days left` : 'done'}</td>
                  <td className="row-actions">
                    <button
                      className="ghost small"
                      onClick={() =>
                        setRawEntry({
                          kind: 'buildingXml',
                          index: b.index,
                          xml: b.rawXml,
                          title: b.buildingType,
                        })
                      }
                    >
                      XML
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {adding && (
        <PlaceObjectModal
          onPlace={async (itemId, name, x, y, price, edibility, category) => {
            await edit([
              {
                kind: 'worldObjectAdd',
                location: detail.name,
                x,
                y,
                itemId,
                name,
                price,
                edibility,
                category,
              },
            ]);
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      )}

      {rawEntry && (
        <div className="modal-backdrop" onClick={() => setRawEntry(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h3>Advanced: raw XML — {rawEntry.title}</h3>
            <p className="muted">
              Full entry as stored in the save. Malformed XML is rejected without changes.
            </p>
            <textarea
              value={rawEntry.xml}
              onChange={(e) => setRawEntry({ ...rawEntry, xml: e.target.value })}
              rows={14}
              spellCheck={false}
            />
            <div className="modal-actions">
              <button className="ghost" onClick={() => setRawEntry(null)}>
                Cancel
              </button>
              <button
                className="primary"
                onClick={async () => {
                  await edit([
                    {
                      kind: rawEntry.kind,
                      location: detail.name,
                      index: rawEntry.index,
                      xml: rawEntry.xml,
                    },
                  ]);
                  setRawEntry(null);
                }}
              >
                Apply XML
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlaceObjectModal({
  onPlace,
  onClose,
}: {
  onPlace: (
    itemId: string,
    name: string,
    x: number,
    y: number,
    price?: number,
    edibility?: number,
    category?: number
  ) => void;
  onClose: () => void;
}) {
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  return (
    <div className="place-modal">
      <ItemPicker
        onPick={(ref) => onPlace(ref.id, ref.name, x, y, ref.price, ref.edibility, ref.category)}
        onClose={onClose}
        extra={
          <div className="picker-options">
            <label>
              Tile X
              <input
                type="number"
                min={0}
                max={999}
                value={x}
                onChange={(e) => setX(Number(e.target.value) || 0)}
              />
            </label>
            <label>
              Tile Y
              <input
                type="number"
                min={0}
                max={999}
                value={y}
                onChange={(e) => setY(Number(e.target.value) || 0)}
              />
            </label>
          </div>
        }
      />
    </div>
  );
}
