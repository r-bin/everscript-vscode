# src/shared — agent rules

Kind: **library** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- `zip.js` and the radar webview assets (`shared.js`, `shared.css`).
- The map editor's shared pieces moved to `src/core/map-editor/` (v0.241.0); SNES addressing and
  byte reads are `src/platform/snes/`. `config.js`, `radar-utils.js`, `rom-readers.js`
  and `resource-uri.js` are Evermore and live in `src/games/evermore/` (v0.242.0). Still to place: webview helpers (`escH`, hex, tab strip, CSP shell)
  → `core/webview` with cleanup 5.3.

## Dependencies
- Depends on nothing: no imports from other `src/` domains.
- No `require('vscode')` (`.depcruise.js` rule `no-shared-to-vscode`).

## Invariants
- No domain-specific logic.
- Pure functions preferred; all exports are tested.

## Tests
- `custom-maps.test.js` (`zip`, ROM tier); the radar DOM tests load `shared.js` / `shared.css`.

