import { useEffect, useState } from 'react';
import type { FieldSpec } from '@sdvse/core';

/**
 * One editable field driven by its FieldSpec. Edits are committed on blur or
 * Enter (not per keystroke) so each commit is one clean entry in the diff.
 */
export function FieldInput({
  spec,
  value,
  onCommit,
}: {
  spec: FieldSpec;
  value: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  if (spec.readonly) {
    const shown =
      spec.label === 'Time played' ? formatPlaytime(Number(value)) : value;
    return (
      <label className="field">
        <span>{spec.label}</span>
        <input value={shown} disabled />
      </label>
    );
  }

  if (spec.type === 'enum' || spec.type === 'bool') {
    const options = spec.type === 'bool' ? ['false', 'true'] : (spec.options ?? []);
    return (
      <label className="field">
        <span>{spec.label}</span>
        <select value={value} onChange={(e) => onCommit(e.target.value)}>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <label className="field">
      <span>{spec.label}</span>
      <input
        type={spec.type === 'int' ? 'number' : 'text'}
        min={spec.min}
        max={spec.max}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
}

function formatPlaytime(ms: number): string {
  if (!Number.isFinite(ms)) return '';
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${minutes}m`;
}
