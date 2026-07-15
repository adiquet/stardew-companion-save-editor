/**
 * Server-side edit application: reuses the shared core logic, plus mirrors
 * player-scoped edits into SaveGameInfo so the game's load screen (which
 * reads that file) matches the edited state.
 */
import { applyEditToDoc, type Edit, type EditResult } from '@sdvse/core';
import type { LoadedSave } from './saves.ts';

export type { Edit, EditResult };

export function applyEdits(save: LoadedSave, edits: Edit[]): EditResult[] {
  return edits.map((edit, index) => {
    try {
      applyEditToDoc(save.main, edit);
      // World data doesn't exist in SaveGameInfo; player data does. If the
      // mirror fails, the main doc is authoritative — don't fail the edit.
      if (save.info && edit.kind !== 'world') {
        try {
          applyEditToDoc(save.info, edit);
        } catch {
          /* main file remains the source of truth */
        }
      }
      return { index, ok: true };
    } catch (err) {
      return { index, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
