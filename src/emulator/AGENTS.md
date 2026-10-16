# src/emulator — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).
Related skills: `emulator-subsystem`, `cdl-recorder`, `webview-dom-safety`, `debugger-protocol`

## Owns
- The emulator WebviewPanel (`panel.js`, `panel-webview.js`, `webview/index.html`), the
  snes9x2005-wasm cores (`core/`, git submodules), the bottom-bar tabs (CDL, REPLAYS, …),
  the script-debug hook (`script-debug-host.js` / `script-debug-view.js`) and the
  sound-chip stream for the Music tab (`apu-stream.js` / `apu-stream-view.js`).
- Sub-folders with their own READMEs: `cdl/`, `tas/`, `menu/`. `webview/` holds the page's files
  that are loaded as files (`rom-game.js`, `emulator-profile.js` / `.css`): new page code goes there.
- The two profiles (full Everscript, SNES CDL Recorder) and the Evermore gating: README "Profiles and games".

## Dependencies
- Allowed: libraries (`../shared/`, `../maps/`, `../script/`, `../localizations/`) and
  platform read APIs (`soe://`).
- No dependency on `../memory/`, `../rooms/`, `../debugger/` or any other feature. The ROM,
  Music and soe:// domains get emulator data injected by `src/extension.js`
  (`.depcruise.js`: `no-rom-to-emulator`, `no-music-to-emulator`, `no-resources-to-emulator`).
- Existing exceptions (do not add more):
  - `panel.js` → `../rooms/data/item-icons` (feature → feature; should move to `maps/` or `soe://`).

## State owned
- `panel.js` (module-local, per panel): the active `WebviewPanel`, pending ROM, current ROM
  buffer/name, active draft, `_cdl` (CdlHost), `_tas` (TasHost), ready/ROM timeouts; per extension:
  `_options` (`configureEmulator`). `globalState`: `everscript.emulator.settings` (the page's),
  `.keepFocusOnBreak`, `.cdlWanted`; `everscript.recorder.installId` (`bundle-commands.js`).
- `apu-stream.js` (`ApuStream._on`): on only while the Music tab shows the Emulator source.
- `script-debug-host.js`: one per extension, outlives the panel (breakpoints, step, reads).

## Invariants
- A feature that needs Secret of Evermore (its RAM, its ROM tables) is marked `data-needs="evermore"`
  and its per-frame work checks `emuEvermore`; one that only Everscript has is `data-needs="full"`
  (and `emuScriptHook` for the script hook). The recorder's package is the `require()` closure of
  `src/recorder/extension.js`: editor / debugger code reaches the panel only through
  `configureEmulator` from `src/extension.js`, never by a `require` here.
- Every optional feature starts off; what the user changes is saved (README "Profiles and games").
- Do not add new client code inside template strings (`*-view.js`, `panel-webview.js`);
  new webview code goes in real files (guide §3.5).
- Per-frame work runs only when its output is visible; no per-frame round trip to the
  extension host (batch to ≥ 100 ms); send typed arrays over `postMessage`, never
  `Array.from` of memory (guide §3.11).
- Core path remapping: `panel.js`'s `LEGACY_CUSTOM_CORE_DIRS` remaps user-configured core
  paths from `debugger/core/snes9x2005-wasm` (pre-v0.6.0 location) to
  `src/emulator/core/snes9x2005-wasm` (current location). Keep it when moving cores.
- Core build, licensing, audio sync, display scaling and keybinds: `emulator-subsystem` skill.

## Tests
- Unit (`npm test`): `tests/debugger/script-debug-hook.test.js`, `snes-rom-header-model.test.js`,
  `script-trace.test.js`, `trigger-overlay.test.js`, `everscript-inject.test.js`,
  `emulator-bottom-bar.test.js`, `cdl.test.js`, `cdl-recomp.test.js`, `emulator-menu.test.js`,
  `tas.test.js` (its core test needs a ROM: `$EVS_ROM` or `../everscript/`), `recorder.test.js`
  (profiles and Evermore gating in headless Chromium, bundles, the recorder's file list).
- Emulator (built cores): `tests/debugger/emulator-health.test.js` (`npm run test:emulator-runtime`),
  `tests/debugger/emulator-runtime.test.js` (headless Chromium; stale: waits for `ss-hook-btn` / `ss-hook-all-btn`,
  which the page no longer has, and the pause / resume buttons removed in v0.219.0).
- Not in any script yet: `tests/debugger/emulator-map-overlays.test.js`,
  `tests/debugger/rom-history.test.js`.
- DOM: `tests/memory/music-tab.test.js` (APU stream into the Music tab).

## Pitfalls
- `window.prompt` / `confirm` / `alert` are inert in a VS Code webview (no throw); use an
  inline form (`webview-dom-safety` §3). Verify click bugs in a real headless browser (§5).
- `panel-webview.js` is one big script: a `let` read before its declaration (even via
  `typeof`) throws and kills everything after it — dead launcher buttons, no focus, no
  `loadRom` listener (v0.201.26). Code that runs during boot (`renderRomOffer`,
  `loadCoreScript`, crash reporting) may only touch state declared above it; the ROM state
  lives next to `romStage`. Check `pageerror` in headless Chromium: `setContent` + an inline
  `acquireVsCodeApi` stub in `<head>` (`addInitScript` does not run for `setContent`).
