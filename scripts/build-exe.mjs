/**
 * Build the single-file executable:
 *   1. vite-build the UI
 *   2. esbuild-bundle server+core into one CJS file
 *   3. embed items.json + the UI bundle as Node SEA assets
 *   4. inject the SEA blob into a copy of the node binary (postject)
 *
 * Output: dist-exe/StardewCompanionSaveEditor[.exe]
 */
import { execSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
  existsSync,
} from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = join(root, 'build');
const outDir = join(root, 'dist-exe');
const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });

rmSync(buildDir, { recursive: true, force: true });
rmSync(outDir, { recursive: true, force: true });
mkdirSync(buildDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

console.log('[1/4] building UI…');
run('npm run build -w @sdvse/ui');

console.log('[2/4] bundling server…');
run(
  `npx esbuild packages/server/src/server.ts --bundle --platform=node --format=cjs ` +
    `--external:node:sea --outfile=build/server.cjs --log-override:empty-import-meta=silent`
);

console.log('[3/4] generating SEA blob…');
const assets = { 'items.json': join(root, 'packages', 'core', 'data', 'items.json') };
const uiDist = join(root, 'packages', 'ui', 'dist');
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else assets[`ui/${relative(uiDist, full).replace(/\\/g, '/')}`] = full;
  }
})(uiDist);

writeFileSync(
  join(buildDir, 'sea-config.json'),
  JSON.stringify({
    main: join(buildDir, 'server.cjs'),
    output: join(buildDir, 'sea-blob.blob'),
    disableExperimentalSEAWarning: true,
    assets,
  })
);
run(`node --experimental-sea-config "${join(buildDir, 'sea-config.json')}"`);

console.log('[4/4] injecting into node binary…');
const isWin = process.platform === 'win32';
const exeName = isWin ? 'StardewCompanionSaveEditor.exe' : 'StardewCompanionSaveEditor';
const exePath = join(outDir, exeName);
copyFileSync(process.execPath, exePath);
if (process.platform === 'darwin') {
  run(`codesign --remove-signature "${exePath}"`);
}
run(
  `npx postject "${exePath}" NODE_SEA_BLOB "${join(buildDir, 'sea-blob.blob')}" ` +
    `--sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2` +
    (process.platform === 'darwin' ? ' --macho-segment-name NODE_SEA' : '')
);
if (process.platform === 'darwin') {
  run(`codesign --sign - "${exePath}"`);
}

if (!existsSync(exePath)) throw new Error('executable not produced');
console.log(`\nDone: ${exePath} (${(statSync(exePath).size / 1024 / 1024).toFixed(1)} MB)`);
