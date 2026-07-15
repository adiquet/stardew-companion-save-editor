import type { Change } from '@sdvse/core';

export function ReviewModal({
  changes,
  mode,
  onConfirm,
  onCancel,
}: {
  changes: Change[];
  mode: 'local' | 'web';
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Review changes before {mode === 'local' ? 'saving' : 'downloading'}</h3>
        <table className="review-table">
          <thead>
            <tr>
              <th>Section</th>
              <th>Field</th>
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {changes.map((c, i) => (
              <tr key={i}>
                <td>{c.section}</td>
                <td>{c.label}</td>
                <td className="before">{c.before}</td>
                <td className="after">{c.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted">
          {mode === 'local'
            ? 'A timestamped backup of the original is created automatically before writing.'
            : 'Your original file on disk is untouched — this downloads an edited copy.'}
        </p>
        <div className="modal-actions">
          <button className="ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="primary" onClick={onConfirm}>
            {mode === 'local' ? `Save ${changes.length} change${changes.length === 1 ? '' : 's'}` : 'Download'}
          </button>
        </div>
      </div>
    </div>
  );
}
