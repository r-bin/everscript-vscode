# src/games/evermore/maps — agent rules

Kind: **library** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- Room/map decode and encode (LZSS, Markov, blob layout, collision, metatiles), Mode 1
  rendering and the feature overlay, sprites/characters, animation VM, projectiles,
  hit tests, room budgets.
- Canonical home for graphics decode: BGR555, 2/4bpp, sprite blocks (guide §3.6).

## Dependencies
- Libraries only (guide §2). Currently requires no other `src/` domain.
- No VS Code API (`.depcruise.js` `no-maps-to-vscode`), no filesystem.
- No webview rendering and no memory-tab UI (`no-maps-to-memory-ui`); the Rooms tab owns
  its own (`src/games/evermore/rooms/rendering/tile-overlay.js`).
- Consumers `require('../maps')` (the facade), never `./dist` directly.
- Existing exceptions (do not add more):
  - `render-script-model.js` requires `fs` and hard-codes a ROM path inside the
    SoETilesViewer checkout (`docs/cleanup.md` step 2).

## Invariants
- Pure: takes a ROM buffer, returns data.
- Every grid is **numbers**, never hex strings; format at render time. Mixing the two
  silently produces wrong results.
- Never interpret a collision word by hand — use `passability()`, `tilePlane()`,
  `driftVector()`, `entityGate()`. The bitfield is not obvious.
- No banners: the port emits no PNG header/legend, so the raster stays exactly the map's
  size and registers with the Rooms tab's SVG layer. `buildSummary()` / `buildLegend()`
  hand that text to the webview as data.
- The decoder is a line-by-line port of the sibling `everscript` repo's Python
  (`tools/dump_room.py`, `collision.py`, `cuttable_grass.py`); `npm run check:maps`
  must keep agreeing with it.
- Do not port or copy code, tables or struct layouts from SoETilesViewer/SoEScriptDumper;
  derive from the ROM with a test (guide §3.8). Known violations to replace, not extend:
  `sprites.ts`, `character-record.ts` (`docs/cleanup.md` step 2).
- `dist/maps/` is gitignored; emitted by `tsconfig.build.json` (`npm run build:ts`), rebuilt by
  `npm test`, `npm run package` and `npm run deploy`.

## Tests
- Unit: `tests/memory/map-units.test.js`, `damage.test.js`.
- ROM (skip without one): `map-parity.test.js` (`check:maps`; also needs the `everscript`
  checkout and its Python; covers `checkSprites`, `checkMetatilePalette`),
  `rom-export.test.js`, `collision-suggest.test.js`, `custom-maps.test.js`,
  `sprites.test.js`, `scaling-rom.test.js`, `render-script-model.test.js` (needs a trace).
- DOM: `tests/memory/map-editor-dom.test.js`.
