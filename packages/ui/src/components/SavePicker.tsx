import type { SaveListing } from '../backend.ts';

export function SavePicker({
  saves,
  onOpen,
}: {
  saves: SaveListing[];
  onOpen: (id: string) => void;
}) {
  if (saves.length === 0) {
    return (
      <div className="empty">
        No saves found in your Stardew Valley Saves folder. Play (and save) a game first, or set
        the SDVSE_SAVES_DIR environment variable if your saves live somewhere unusual.
      </div>
    );
  }
  return (
    <div className="save-picker">
      <h2>Choose a save</h2>
      <ul className="save-list">
        {saves.map((s) => (
          <li key={s.id}>
            <button className="save-card" onClick={() => onOpen(s.id)}>
              <span className="save-farmer">{s.farmerName || s.id}</span>
              <span className="save-farm muted">{s.farmName ? `${s.farmName} Farm` : ''}</span>
              <span className="save-meta muted">
                game {s.gameVersion ?? '?'} · last played{' '}
                {new Date(s.lastModified).toLocaleDateString()}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
