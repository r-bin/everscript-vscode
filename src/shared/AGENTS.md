# src/shared — agent rules

Kind: **library** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- Cross-domain utilities used by several domains: settings model (`config.js`), pure
  parsing (`radar-utils.js`), ROM file reading (`rom-readers.js`), `soe://` URI helpers
  (`resource-uri.js`), `zip.js`, `opcodes-65816.js`, and the radar webview assets
  (`shared.js`, `shared.css`).
- `webview/map-view/`: the map views' shared webview pieces — filter-bar chip builders
  (`view-chips.js`), their look and the design tokens (`map-view.css`), and the tile
  animation player (`tile-animation.js`). Used by the Evermore Rooms tab (bundled by
  `src/memory/webview/index.js`) and the Secret of Mana Maps panel (loaded as files).
  Game-neutral: no Evermore or Mana knowledge in them.
- `webview/map-editor-core/`: the game-neutral editor core (undo history, sessions, the "not saved"
  notice, tool keys). Its own [AGENTS.md](webview/map-editor-core/AGENTS.md).
- `webview/map-editor-shell/`: the editor page both games are built from (frame, rail, canvas column,
  pill, status bar, dock, layout, zoom/pan, their CSS). Its own [AGENTS.md](webview/map-editor-shell/AGENTS.md).
- Planned canonical homes (guide §3.6, not created yet): SNES addressing and byte reads →
  `shared/snes-addr`; other webview helpers (`escH`, hex format, tab strip, CSP shell) →
  `shared/webview/`.

## Dependencies
- Depends on nothing: no imports from other `src/` domains.
- No `require('vscode')` (`.depcruise.js` rule `no-shared-to-vscode`).

## Invariants
- No domain-specific logic.
- Pure functions preferred; all exports are tested.

## Tests
- Unit: `tests/memory/radar.test.js`, `smoke.test.js` (`radar-utils`);
  `activation.test.js`, `rebuild-invalidation.test.js` (`rom-readers`);
  `tests/debugger/settings-model.test.js` (`config`).
- ROM (skip without one): `tests/memory/soe-resources.test.js`, `soe-tags.test.js`
  (`resource-uri`, `rom-readers`); `custom-maps.test.js` (`zip`).
- `webview/map-view/`: `tests/memory/map-editor-dom.test.js` (Rooms) and
  `tests/mana/mana-panel-dom.test.js` (Mana) run them in headless Chromium.
