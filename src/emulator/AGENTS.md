# src/emulator — agent rules

Kind: **feature** (see `/AI_ARCHITECTURE_GUIDE.md` §2). What the folder does: [README.md](README.md).
Related skills: `emulator-subsystem`, `cdl-recorder`, `webview-dom-safety`, `debugger-protocol`

## Owns
- The emulator WebviewPanel (`panel.js`, `panel-webview.js`), the
  snes9x2005-wasm cores (`core/`, git submodules), the panels (CDL, TRACE, …) and where they are shown
  (`webview/emulator-panels.js`: menu tab, side bar, bottom bar), the REPLAYS menu tab,
  the script-debug hook (`script-debug-host.js` / `script-debug-view.js`) and the
  sound-chip stream for the Music tab (`apu-stream.js` / `apu-stream-view.js`).
- Sub-folders with their own READMEs: `cdl/` (only `host.js` here; the engine is `src/platform/cdl/`), `tas/` (`host.js`; the movie format is `src/platform/tas/`), `menu/`. `webview/` holds the page's files
  that are loaded as files (`rom-game.js`, `emulator-profile.js` / `.css`): new page code goes there.
- The two profiles (full Everscript, SNES CDL Recorder) and the Evermore gating: README "Profiles and games".

## Dependencies
- `platform/` (CDL engine, TAS movie format, ROM library, through `dist/platform` or `../platform/`) and
  `vscode`. **No game** (`.depcruise.js` `emulator-knows-no-game`): the game's host-side half comes in
  through `configureEmulator({ game, cdlTools })` — Evermore's is `src/games/evermore/emulator/host.js`
  (room pictures, idle sprites, alchemy/loot icons, script trace, describing its own test ROMs) and
  `src/games/evermore/cdl/tools.js`. The recorder passes neither, so its package has no game code.
- The ROM, Music and soe:// domains get emulator data injected by `src/games/evermore/extension.js`
  (`.depcruise.js`: `no-rom-to-emulator`, `no-music-to-emulator`, `no-resources-to-emulator`).
- Still Evermore inside: the webview side (`panel-webview.js`, `bottom-bar-views.js`, `menu/`) — the
  ENTITIES / ALCHEMY panels and the pause menu read Evermore WRAM; they move out with cleanup 5.3.

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
  `configureEmulator` from `src/games/evermore/extension.js`, never by a `require` here.
- Every optional feature starts off; what the user changes is saved (README "Profiles and games").
  One exception the user asked for: the CDL panel starts in the left side bar.
- Whether a panel (CDL, TRACE, ENTITIES, ...) can be seen is `emuPanelVisible(name)`
  (`webview/emulator-panels.js`); there is no "current bottom tab" any more. Several panels
  can be visible at once (two side bars, the bottom bar, the menu), so refresh each one that is.
- Do not add new client code inside template strings (`*-view.js`, `panel-webview.js`);
  new webview code goes in real files (guide §3.5).
- Per-frame work runs only when its output is visible; no per-frame round trip to the
  extension host (batch to ≥ 100 ms); send typed arrays over `postMessage`, never
  `Array.from` of memory (guide §3.11).
- Keep `panel.js`'s `LEGACY_CUSTOM_CORE_DIRS` (old core paths users configured) when moving cores.
- Core build, licensing, audio sync, display scaling and keybinds: `emulator-subsystem` skill.

## Tests
- `npm test` runs `tests/debugger/*` for the hook, trace, overlays, bottom bar, menu, CDL, TAS (core test
  needs a ROM from the ROM library), recorder (profiles, gating, bundles, file list), ROM history;
  `tests/memory/music-tab.test.js` covers the APU stream. Built cores: `emulator-health.test.js`
  (`npm run test:emulator-runtime`). Stale, not run: `emulator-runtime.test.js` (waits for removed buttons).

## Pitfalls
- `window.prompt` / `confirm` / `alert` are inert in a VS Code webview (no throw); use an
  inline form (`webview-dom-safety` §3). Verify click bugs in a real headless browser (§5).
- `panel-webview.js` is one big script: a `let` read before its declaration (even via
  `typeof`) throws and kills everything after it — dead launcher buttons, no focus, no
  `loadRom` listener (v0.201.26). Code that runs during boot (`renderRomOffer`,
  `loadCoreScript`, crash reporting) may only touch state declared above it; the ROM state
  lives next to `romStage`. Check `pageerror` in headless Chromium: `setContent` + an inline
  `acquireVsCodeApi` stub in `<head>` (`addInitScript` does not run for `setContent`).
