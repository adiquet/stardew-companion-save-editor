# Stardew Companion Save Editor

View and edit Stardew Valley save files — as a local app with direct access to your
Saves folder, or fully in the browser at stardewcompanion.com (nothing uploaded).

**Fan-made tool, not affiliated with ConcernedApe. Always keep backups.**

## Status

Early development. Basic (player-focused) editor works end-to-end:
identity, money, vitals, skills (XP ↔ level), inventory (edit / add / remove /
raw-XML), relationships, date & weather. Full World Editor is planned.

## Run locally (from source)

Requires Node.js 24+.

```
npm install
npm run build -w @sdvse/ui     # build the browser UI once
npm run dev                    # start the local server
```

Then open http://127.0.0.1:5980 — your saves are discovered automatically from
`%APPDATA%\StardewValley\Saves`. Every save writes a timestamped backup to
`<save folder>\sdvse-backups\` first.

Close Stardew Valley (and pause Steam Cloud / GOG Galaxy sync) before saving edits.

## How it stays safe

- The save XML is edited as a DOM patch: only the values you change are touched.
  An untouched save re-serializes **byte-for-byte identical** (verified in tests),
  so unknown/modded data is never dropped.
- Every edit is validated (ranges, enums); malformed raw-XML edits are rejected.
- A review screen shows exactly what changed before anything is written.
- Automatic timestamped backups before every write.

## Packages

- `packages/core` — sdv-save-core: parse/serialize, accessors, validation, diff
- `packages/server` — local web app server (localhost only)
- `packages/ui` — React UI shared by the local app and the web version
- `tools/` — dev-time extractors (item database from the game's own data files)

## Regenerating the item database

```
node tools/extract-items.mjs "<your Stardew Valley install folder>"
```

## License

MIT
