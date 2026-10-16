# src/shared — agent rules

Kind: **library** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- Cross-domain utilities used by several domains: settings model (`config.js`), pure
  parsing (`radar-utils.js`), ROM file reading (`rom-readers.js`), `soe://` URI helpers
  (`resource-uri.js`), `zip.js`, and the radar webview assets
  (`shared.js`, `shared.css`).
- The map editor's shared pieces moved to `src/core/map-editor/` (v0.241.0); SNES addressing and
  byte reads are `src/platform/snes/`. Still to place (cleanup 4.3): `rom-readers.js` and
  `radar-utils.js` (Evermore) → `games/evermore`; webview helpers (`escH`, hex, tab strip, CSP shell)
  → `core/webview` with cleanup 5.3.

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

