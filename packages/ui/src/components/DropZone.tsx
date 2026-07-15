import { useRef, useState } from 'react';
import { LARGE_FILE_BYTES } from '../backend.ts';

export function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const [sizeNote, setSizeNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const take = (file: File | undefined) => {
    if (!file) return;
    if (file.size > LARGE_FILE_BYTES) {
      setSizeNote(
        `This file is ${(file.size / 1024 / 1024).toFixed(0)} MB — far larger than a normal ` +
          `Stardew save. It may be slow or fail to load in the browser, but you can try.`
      );
    } else {
      setSizeNote(null);
    }
    onFile(file);
  };

  return (
    <div
      className={dragging ? 'dropzone dragging' : 'dropzone'}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files[0]);
      }}
    >
      <h2>Open your save file</h2>
      <p>
        Drag your save file here, or{' '}
        <button className="link" onClick={() => inputRef.current?.click()}>
          browse for it
        </button>
        .
      </p>
      <p className="muted">
        Windows: <code>%AppData%\StardewValley\Saves\&lt;YourFarm_123456789&gt;</code>
        <br />
        Mac &amp; Linux: <code>~/.config/StardewValley/Saves/&lt;YourFarm_123456789&gt;</code>
        <br />
        Pick the file named like the folder (e.g. <code>YourFarm_123456789</code>), not
        SaveGameInfo. On Mac, press <code>Cmd+Shift+G</code> in the file dialog and paste the
        path — the <code>.config</code> folder is hidden by default.
      </p>
      <p className="privacy">
        🔒 Your save is opened and edited entirely in your browser. Nothing is uploaded to any
        server.
      </p>
      {sizeNote && <div className="banner warn">{sizeNote}</div>}
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(e) => take(e.target.files?.[0] ?? undefined)}
      />
    </div>
  );
}
