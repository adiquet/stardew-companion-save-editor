import { useCallback, useEffect, useState } from 'react';
import type { Edit } from '@sdvse/core';
import {
  detectBackend,
  type Backend,
  type SaveListing,
  type SaveState,
  type WriteResult,
} from './backend.ts';
import { SavePicker } from './components/SavePicker.tsx';
import { DropZone } from './components/DropZone.tsx';
import { PlayerTab } from './components/PlayerTab.tsx';
import { SkillsTab } from './components/SkillsTab.tsx';
import { InventoryTab } from './components/InventoryTab.tsx';
import { RelationshipsTab } from './components/RelationshipsTab.tsx';
import { WorldTab } from './components/WorldTab.tsx';
import { WorldEditorTab } from './components/WorldEditorTab.tsx';
import { ReviewModal } from './components/ReviewModal.tsx';
import { loadSpriteInfo } from './sprites.ts';

const TABS = ['Player', 'Skills', 'Inventory', 'Relationships', 'World', 'World Editor'] as const;
type Tab = (typeof TABS)[number];

export function App() {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [saves, setSaves] = useState<SaveListing[]>([]);
  const [state, setState] = useState<SaveState | null>(null);
  const [tab, setTab] = useState<Tab>('Player');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [writeResult, setWriteResult] = useState<WriteResult | null>(null);

  useEffect(() => {
    detectBackend().then(async (b) => {
      setBackend(b);
      if (b.mode === 'local') {
        setSaves(await b.listSaves());
        await loadSpriteInfo(); // real game art from the local install
      } else {
        // stardewcompanion.com: switch on the site's wood/parchment skin
        document.documentElement.dataset.mode = 'web';
        for (const href of [
          'https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Quicksand:wght@500;600;700&display=swap',
        ]) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = href;
          document.head.appendChild(link);
        }
      }
    });
  }, []);

  const applyEdits = useCallback(
    async (edits: Edit[]) => {
      if (!backend) return;
      try {
        const { results, state: next } = await backend.applyEdits(edits);
        setState(next);
        const failed = results.filter((r) => !r.ok);
        setError(failed.length ? failed.map((f) => f.error).join(' · ') : null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [backend]
  );

  const openSave = async (id: string) => {
    try {
      setState(await backend!.openSave(id));
      setError(null);
      setWriteResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const openFile = async (file: File) => {
    try {
      setState(await backend!.openFile(file));
      setError(null);
      setWriteResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const confirmWrite = async () => {
    try {
      const result = await backend!.write();
      setWriteResult(result);
      setReviewing(false);
      setNotice(
        backend!.mode === 'local'
          ? `Saved. Backup created: ${result.backups?.[0] ?? ''}`
          : `Downloaded ${result.downloadName}. Replace the file in your Saves folder to use it.`
      );
      // refresh state so the diff clears
      if (backend!.mode === 'local' && state) setState(await backend!.openSave(state.id));
      else if (state) setState({ ...state, changes: [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const discard = async () => {
    if (!backend || !state) return;
    if (backend.mode === 'web') {
      setState(null);
      return;
    }
    setState(await backend.discard());
    setNotice('Changes discarded — reloaded from disk.');
  };

  if (!backend) return <div className="loading">Starting…</div>;

  if (!state) {
    return (
      <Shell mode={backend.mode}>
        {backend.mode === 'local' ? (
          <SavePicker saves={saves} onOpen={openSave} />
        ) : (
          <DropZone onFile={openFile} />
        )}
        {error && <div className="banner error">{error}</div>}
      </Shell>
    );
  }

  const dirty = state.changes.length > 0;

  return (
    <Shell mode={backend.mode}>
      <header className="save-header">
        <button className="ghost" onClick={() => setState(null)} title="Close this save">
          ← {backend.mode === 'local' ? 'All saves' : 'Choose another file'}
        </button>
        <div className="save-title">
          <strong>{state.player.name}</strong>
          <span className="muted"> · {state.player.farmName} Farm · game {state.version.gameVersion ?? '?'}</span>
        </div>
        <div className="save-actions">
          {dirty && (
            <span className="badge">
              {state.changes.length} unsaved change{state.changes.length === 1 ? '' : 's'}
            </span>
          )}
          <button className="ghost" onClick={discard} disabled={!dirty}>
            Discard
          </button>
          <button className="primary" onClick={() => setReviewing(true)} disabled={!dirty}>
            {backend.mode === 'local' ? 'Save changes…' : 'Download edited save…'}
          </button>
        </div>
      </header>

      {!state.version.verified && (
        <div className="banner warn">
          This save is from game version {state.version.gameVersion ?? 'unknown'}, which this editor
          hasn't been verified against (built for 1.6). Fields may not read or write correctly —
          keep a backup and proceed carefully.
        </div>
      )}
      {backend.mode === 'local' && (
        <div className="banner info">
          Close Stardew Valley before saving edits, and pause Steam Cloud / GOG Galaxy sync — the
          game or cloud sync can overwrite your edited file.
        </div>
      )}
      {state.farmhandCount > 0 && (
        <div className="banner info">
          This is a multiplayer save with {state.farmhandCount} farmhand cabin
          {state.farmhandCount === 1 ? '' : 's'}. Farmhand editing is coming soon — only the host
          player is editable for now.
        </div>
      )}
      {error && <div className="banner error">{error}</div>}
      {notice && (
        <div className="banner success" onClick={() => setNotice(null)}>
          {notice} <span className="muted">(click to dismiss)</span>
        </div>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? 'tab active' : 'tab'} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>

      {tab === 'Player' && <PlayerTab state={state} onEdit={applyEdits} />}
      {tab === 'Skills' && <SkillsTab state={state} onEdit={applyEdits} />}
      {tab === 'Inventory' && <InventoryTab state={state} onEdit={applyEdits} />}
      {tab === 'Relationships' && <RelationshipsTab state={state} onEdit={applyEdits} />}
      {tab === 'World' && <WorldTab state={state} onEdit={applyEdits} />}
      {tab === 'World Editor' && <WorldEditorTab backend={backend} onEdit={applyEdits} />}

      {reviewing && (
        <ReviewModal
          changes={state.changes}
          mode={backend.mode}
          onConfirm={confirmWrite}
          onCancel={() => setReviewing(false)}
        />
      )}
    </Shell>
  );
}

function Shell({ children, mode }: { children: React.ReactNode; mode?: 'local' | 'web' }) {
  return (
    <div className="shell">
      {mode === 'web' && (
        <a className="back-link" href="../index.html">
          ← Back to Stardew Companion
        </a>
      )}
      <header className="app-header">
        <h1>Stardew Companion Save Editor</h1>
        <span className="muted">fan-made · not affiliated with ConcernedApe · keep backups</span>
      </header>
      <main>{children}</main>
      {mode === 'web' && (
        <footer className="site-footer">
          <p>
            Prefer a desktop app? The same editor is a free download for Windows, Mac and Linux —
            with real item sprites read from your own game install:{' '}
            <a
              href="https://github.com/adiquet/stardew-companion-save-editor/releases"
              target="_blank"
              rel="noopener"
            >
              get it on GitHub
            </a>
            .
          </p>
          <p>
            Open source (MIT) —{' '}
            <a
              href="https://github.com/adiquet/stardew-companion-save-editor"
              target="_blank"
              rel="noopener"
            >
              view the code
            </a>{' '}
            ·{' '}
            <a
              href="https://github.com/adiquet/stardew-companion-save-editor/issues/new/choose"
              target="_blank"
              rel="noopener"
            >
              report a bug
            </a>{' '}
            (please never attach your save file). Fan-made companion — not affiliated with
            ConcernedApe. Works best on desktop browsers.
          </p>
        </footer>
      )}
    </div>
  );
}
