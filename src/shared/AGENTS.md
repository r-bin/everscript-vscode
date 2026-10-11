# src/shared — agent rules

Kind: **library** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).

## Owns
- Cross-domain utilities used by several domains: settings model (`config.js`), pure
  parsing (`radar-utils.js`), ROM file reading (`rom-readers.js`), `soe://` URI helpers
  (`resource-uri.js`), `zip.js`, `opcodes-65816.js`, and the radar webview assets
  (`shared.js`, `shared.css`).
- Planned canonical homes (guide §3.6, not created yet): SNES addressing and byte reads →
  `shared/snes-addr`; webview helpers (`escH`, hex format, tab strip, CSP shell, theme) →
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
