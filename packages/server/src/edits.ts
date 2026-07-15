/**
 * Server-side edit application: reuses the shared core logic, plus mirrors
 * player-scoped edits into SaveGameInfo so the game's load screen (which
 * reads that file) matches the edited state. World-structure edits return a
 * change-log description; the session records it for the review screen.
 */
import { applyEditToDoc, WORLD_EDIT_KINDS, type Edit, type EditResult } from '@sdvse/core';
import type { LoadedSave } from './saves.ts';

export type { Edit, EditResult };

export function applyEdits(save: LoadedSave, edits: Edit[]): EditResult[] {
  return edits.map((edit, index) => {
    try {
      const description = applyEditToDoc(save.main, edit);
      if (description) save.worldChangeLog.push(description);
      // World data doesn't exist in SaveGameInfo; player data does. If the
      // mirror fails, the main doc is authoritative — don't fail the edit.
      if (save.info && !WORLD_EDIT_KINDS.has(edit.kind)) {
        try {
          applyEditToDoc(save.info, edit);
        } catch {
          /* main file remains the source of truth */
        }
      }
      return { index, ok: true, description };
    } catch (err) {
      return { index, ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });
}
