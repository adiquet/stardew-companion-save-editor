import { useEffect, useState } from 'react';
import { levelToMinXp, XP_THRESHOLDS, type Edit, type SkillInfo } from '@sdvse/core';
import type { SaveState } from '../backend.ts';

const SKILL_ICONS: Record<string, string> = {
  farming: '🌱',
  fishing: '🎣',
  foraging: '🍂',
  mining: '⛏️',
  combat: '⚔️',
  luck: '🍀',
};

export function SkillsTab({
  state,
  onEdit,
}: {
  state: SaveState;
  onEdit: (edits: Edit[]) => void;
}) {
  return (
    <div className="tab-body">
      <section className="card">
        <h3>Skills</h3>
        <p className="muted">
          The save stores XP; level is derived. Edit either one — setting a level gives the
          minimum XP for that level.
        </p>
        {state.skills.map((s) => (
          <SkillRow key={s.skill} info={s} onEdit={onEdit} />
        ))}
      </section>
    </div>
  );
}

function SkillRow({ info, onEdit }: { info: SkillInfo; onEdit: (edits: Edit[]) => void }) {
  const [xpDraft, setXpDraft] = useState(String(info.xp));
  useEffect(() => setXpDraft(String(info.xp)), [info.xp]);

  const nextThreshold = info.level < 10 ? XP_THRESHOLDS[info.level] : null;
  const prevThreshold = info.level > 0 ? XP_THRESHOLDS[info.level - 1] : 0;
  const progress = nextThreshold
    ? Math.min(100, ((info.xp - prevThreshold) / (nextThreshold - prevThreshold)) * 100)
    : 100;

  const commitXp = () => {
    const xp = Number(xpDraft);
    if (Number.isInteger(xp) && xp !== info.xp) {
      onEdit([{ kind: 'skill', skill: info.skill, xp }]);
    } else {
      setXpDraft(String(info.xp));
    }
  };

  return (
    <div className="skill-row">
      <span className="skill-name">
        {SKILL_ICONS[info.skill]} {info.skill[0].toUpperCase() + info.skill.slice(1)}
      </span>
      <label>
        Level
        <select
          value={info.level}
          onChange={(e) =>
            onEdit([{ kind: 'skill', skill: info.skill, xp: levelToMinXp(Number(e.target.value)) }])
          }
        >
          {Array.from({ length: 11 }, (_, lvl) => (
            <option key={lvl} value={lvl}>
              {lvl}
            </option>
          ))}
        </select>
      </label>
      <label>
        XP
        <input
          type="number"
          min={0}
          value={xpDraft}
          onChange={(e) => setXpDraft(e.target.value)}
          onBlur={commitXp}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </label>
      <div className="skill-progress" title={nextThreshold ? `${info.xp} / ${nextThreshold} XP` : 'Max level'}>
        <div className="skill-progress-fill" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
