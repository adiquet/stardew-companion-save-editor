import type { Edit } from '@sdvse/core';
import type { SaveState } from '../backend.ts';
import { FieldInput } from './FieldInput.tsx';

const GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Identity', keys: ['name', 'farmName', 'favoriteThing', 'horseName', 'gender'] },
  { title: 'Money', keys: ['money', 'qiGems', 'clubCoins', 'totalMoneyEarned'] },
  { title: 'Vitals', keys: ['health', 'maxHealth', 'stamina', 'maxStamina'] },
  { title: 'Progress', keys: ['deepestMineLevel', 'millisecondsPlayed'] },
];

export function PlayerTab({
  state,
  onEdit,
}: {
  state: SaveState;
  onEdit: (edits: Edit[]) => void;
}) {
  return (
    <div className="tab-body">
      {GROUPS.map((group) => (
        <section key={group.title} className="card">
          <h3>{group.title}</h3>
          <div className="field-grid">
            {group.keys.map((key) => {
              const spec = state.fieldSpecs[key];
              if (!spec) return null;
              return (
                <FieldInput
                  key={key}
                  spec={spec}
                  value={state.player[key] ?? ''}
                  onCommit={(value) => onEdit([{ kind: 'player', field: key, value }])}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
