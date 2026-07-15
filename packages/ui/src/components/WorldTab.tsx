import type { Edit } from '@sdvse/core';
import type { SaveState } from '../backend.ts';
import { FieldInput } from './FieldInput.tsx';

export function WorldTab({
  state,
  onEdit,
}: {
  state: SaveState;
  onEdit: (edits: Edit[]) => void;
}) {
  const keys = Object.keys(state.worldSpecs);
  if (keys.length === 0) {
    return (
      <div className="tab-body">
        <div className="empty">
          World data lives in the main save file. This looks like a SaveGameInfo file — open the
          file named after your farm folder instead.
        </div>
      </div>
    );
  }
  return (
    <div className="tab-body">
      <section className="card">
        <h3>Date &amp; weather</h3>
        <p className="muted">
          Changing the date doesn't re-run daily events — crops, animals, and NPC schedules pick up
          from the new date on load.
        </p>
        <div className="field-grid">
          {keys.map((key) => (
            <FieldInput
              key={key}
              spec={state.worldSpecs[key]}
              value={state.world[key] ?? ''}
              onCommit={(value) => onEdit([{ kind: 'world', field: key, value }])}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
