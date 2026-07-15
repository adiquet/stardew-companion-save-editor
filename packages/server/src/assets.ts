/**
 * Asset access that works in both run-from-source and packaged single-
 * executable (Node SEA) modes. When packaged, items.json and the built UI
 * are embedded as SEA assets; from source they're read off disk.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isSea, getAsset } from 'node:sea';

// import.meta.url is absent in the packaged CJS bundle; that path is only
// taken when running from source as ESM.
const here = (() => {
  try {
    return dirname(fileURLToPath(import.meta.url));
  } catch {
    return process.cwd();
  }
})();

export function isPackaged(): boolean {
  return isSea();
}

/** Read an embedded/bundled asset. Keys: "items.json", "ui/index.html", … */
export function readAsset(key: string): Buffer | null {
  if (isSea()) {
    try {
      return Buffer.from(getAsset(key));
    } catch {
      return null;
    }
  }
  const path =
    key === 'items.json'
      ? join(here, '..', '..', 'core', 'data', 'items.json')
      : join(here, '..', '..', 'ui', 'dist', key.replace(/^ui\//, ''));
  return existsSync(path) ? readFileSync(path) : null;
}
