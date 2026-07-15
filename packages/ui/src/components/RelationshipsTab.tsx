import { useEffect, useState } from 'react';
import {
  FRIENDSHIP_STATUSES,
  MAX_FRIENDSHIP_POINTS,
  type Edit,
  type FriendshipInfo,
} from '@sdvse/core';
import type { SaveState } from '../backend.ts';

export function RelationshipsTab({
  state,
  onEdit,
}: {
  state: SaveState;
  onEdit: (edits: Edit[]) => void;
}) {
  const sorted = [...state.friendships].sort((a, b) => b.points - a.points);
  return (
    <div className="tab-body">
      <section className="card">
        <h3>Relationships</h3>
        <p className="muted">250 points = 1 heart. Regular villagers max at 10 hearts (2,500).</p>
        <table className="friend-table">
          <thead>
            <tr>
              <th>Villager</th>
              <th>Hearts</th>
              <th>Points</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((f) => (
              <FriendRow key={f.npc} info={f} onEdit={onEdit} />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function FriendRow({ info, onEdit }: { info: FriendshipInfo; onEdit: (edits: Edit[]) => void }) {
  const [draft, setDraft] = useState(String(info.points));
  useEffect(() => setDraft(String(info.points)), [info.points]);

  const commit = () => {
    const points = Number(draft);
    if (Number.isInteger(points) && points !== info.points) {
      onEdit([{ kind: 'friendPoints', npc: info.npc, points }]);
    } else {
      setDraft(String(info.points));
    }
  };

  return (
    <tr>
      <td>{info.npc}</td>
      <td>
        <span className="hearts" title={`${info.hearts} hearts`}>
          {'♥'.repeat(Math.min(info.hearts, 14))}
          <span className="hearts-empty">{'♡'.repeat(Math.max(0, 10 - info.hearts))}</span>
        </span>
      </td>
      <td>
        <input
          className="points-input"
          type="number"
          min={0}
          max={MAX_FRIENDSHIP_POINTS}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </td>
      <td>
        <select
          value={info.status}
          onChange={(e) => onEdit([{ kind: 'friendStatus', npc: info.npc, status: e.target.value }])}
        >
          {FRIENDSHIP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          {!FRIENDSHIP_STATUSES.includes(info.status as (typeof FRIENDSHIP_STATUSES)[number]) && (
            <option value={info.status}>{info.status}</option>
          )}
        </select>
      </td>
    </tr>
  );
}
