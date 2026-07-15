/**
 * Local web app server: binds to 127.0.0.1 only (this app must never be
 * reachable from the network — it has filesystem access to your saves),
 * serves the UI bundle, and exposes the save-editing API.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getFriendships,
  getInventory,
  getPlayerField,
  getSkills,
  getWorldField,
  PLAYER_FIELDS,
  WORLD_FIELDS,
  childElements,
  child,
} from '@sdvse/core';
import { SaveSession, defaultSavesDir, listSaves, type LoadedSave } from './saves.ts';
import { applyEdits, type Edit } from './edits.ts';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.SDVSE_PORT ?? 5980);
const savesDir = defaultSavesDir();
const session = new SaveSession(savesDir);

const itemsJsonPath = join(here, '..', '..', 'core', 'data', 'items.json');
const uiDist = join(here, '..', '..', 'ui', 'dist');

function saveState(entry: LoadedSave) {
  const doc = entry.main;
  const player: Record<string, string | null> = {};
  for (const key of Object.keys(PLAYER_FIELDS)) player[key] = getPlayerField(doc, key);
  const world: Record<string, string | null> = {};
  for (const key of Object.keys(WORLD_FIELDS)) world[key] = getWorldField(doc, key);
  const farmhandsEl = child(doc.root, 'farmhands');
  return {
    id: entry.id,
    version: doc.version(),
    player,
    fieldSpecs: PLAYER_FIELDS,
    worldSpecs: WORLD_FIELDS,
    skills: getSkills(doc),
    inventory: getInventory(doc),
    friendships: getFriendships(doc),
    world,
    farmhandCount: farmhandsEl ? childElements(farmhandsEl).length : 0,
    changes: session.changes(entry.id),
  };
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(data);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function serveStatic(res: ServerResponse, urlPath: string): void {
  let rel = urlPath === '/' ? '/index.html' : urlPath;
  const file = join(uiDist, rel);
  // path traversal guard + existence check
  if (!file.startsWith(uiDist) || !existsSync(file)) {
    if (!existsSync(join(uiDist, 'index.html'))) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(
        '<h1>Stardew Companion Save Editor</h1><p>UI bundle not built yet — run <code>npm run build -w @sdvse/ui</code>. The API is live at <a href="/api/saves">/api/saves</a>.</p>'
      );
      return;
    }
    // SPA fallback
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(readFileSync(join(uiDist, 'index.html')));
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const path = decodeURIComponent(url.pathname);

  try {
    if (path === '/api/health') {
      return sendJson(res, 200, { ok: true, savesDir, app: 'stardew-companion-save-editor' });
    }
    if (path === '/api/saves' && req.method === 'GET') {
      return sendJson(res, 200, listSaves(savesDir));
    }
    if (path === '/api/items' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return void res.end(readFileSync(itemsJsonPath));
    }

    const saveMatch = path.match(/^\/api\/save\/([^/]+)(\/[a-z]+)?$/);
    if (saveMatch) {
      const id = saveMatch[1];
      const action = saveMatch[2] ?? '';
      if (req.method === 'GET' && action === '') {
        return sendJson(res, 200, saveState(session.load(id)));
      }
      if (req.method === 'POST' && action === '/edits') {
        const entry = session.get(id);
        const edits = JSON.parse(await readBody(req)) as Edit[];
        const results = applyEdits(entry, edits);
        return sendJson(res, 200, { results, state: saveState(entry) });
      }
      if (req.method === 'GET' && action === '/changes') {
        return sendJson(res, 200, session.changes(id));
      }
      if (req.method === 'POST' && action === '/write') {
        const entry = session.get(id);
        const changes = session.changes(id);
        const { backups } = session.write(id);
        return sendJson(res, 200, { written: true, backups, changesApplied: changes.length });
      }
      if (req.method === 'POST' && action === '/discard') {
        return sendJson(res, 200, saveState(session.discard(id)));
      }
    }

    if (path.startsWith('/api/')) {
      return sendJson(res, 404, { error: `No such endpoint: ${req.method} ${path}` });
    }
    serveStatic(res, path);
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : String(err) });
  }
}

createServer((req, res) => void handle(req, res)).listen(PORT, '127.0.0.1', () => {
  console.log(`Stardew Companion Save Editor running at http://127.0.0.1:${PORT}`);
  console.log(`Saves folder: ${savesDir}`);
});
