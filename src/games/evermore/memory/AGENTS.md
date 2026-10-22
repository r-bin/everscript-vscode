# src/games/evermore/memory — agent rules

Kind: **feature** — the radar host (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder
does: [README.md](README.md).
Related skills: `memory-radar`, `webview-dom-safety`, `memory-map`

## Owns
- The radar panel HTML: `render-radar.js` (tabs, layout, webview entry, the Memory tab's
  Bus | WRAM | ROM bar), `render-memory-tab.ts` (WRAM grid + detail table),
  `webview/wram-view.dom.ts` (the bar, WRAM CDL coverage / word starts, search; page bundle `wram-view`), `webview/index.ts` (loads the tabs'
  webview JS/CSS into the panel), `scope-analysis.ts` (the cursor's scope in an .evs file and the RAM
  it reads and writes; pure).

## Dependencies
- Allowed: libraries (`../shared/` — radar-utils, rom-readers; `../maps/`, `../script/`,
  `../localizations/`) and platform read APIs (`soe://`).
- No dependency on `../debugger/` or `../emulator/` (`.depcruise.js`:
  `no-memory-to-debugger-dap`; the debugger reaches the radar only through `extension.js`).
- Existing exceptions (do not add more) — the radar hosts the other tabs by requiring them:
  - `render-radar.js` → `../docs/render-docs-tab`, `../rooms`, `../sprites`, `../rom`, `../music`.
  - `webview/index.ts` reads files from `../../scaling/webview`, `../../rooms/webview`,
    `../../sprites/webview`, `../../docs`, `../../routes`, `../../rom/webview`,
    `../../music/webview`.
  - Target (guide §3.1): tabs handed to the host as a list of
    `{ id, label, html, css, js, onMessage }` from `extension.js`; a missing tab is skipped.

## State owned
- None module-local. Radar caches (`_radarMapCache`, `_radarRoomTree`, `_radarActiveTab`)
  live in `src/games/evermore/extension.js` (its state is listed at the top of that file).

## Invariants
- `webview/index.ts`'s concatenation is a legacy §3.5 offender: convert when touched, do
  not add to it. New tab code goes in the owning feature's `webview/` as real files.

## Tests
- Unit (`npm test`): `tests/memory/ui.test.js` (`_renderRadarHtml`),
  `tests/memory/radar.test.js` (shared radar-utils), `tests/memory/smoke.test.js`,
  `tests/memory/activation.test.js`.
- DOM (Playwright, skips without a browser): `tests/memory/rooms-rail-dom.test.js`,
  `tests/memory/rom-tab.test.js`, `tests/memory/music-tab.test.js`.

## Pitfalls
- `[hidden]` loses to any author `display` rule, and module-level state leaks across tests
  and re-renders (`webview-dom-safety` §7a, §7c).
