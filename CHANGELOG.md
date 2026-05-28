## [0.3.5] — 2026-05-28

### Fixed
- Restored `RadarCodeLensProvider` class that was accidentally deleted from [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) during the Phase 5 language-providers extraction (v0.3.0). Its absence caused a `ReferenceError` in `activate()`, preventing ALL commands from being registered and producing "command not found" errors at runtime.

### Added
- Added [memory_radar/tests/activation.test.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/tests/activation.test.js): activation smoke test that mocks vscode, calls `activate()`, and asserts every expected command is registered. Also verifies all public exports of `room-data.js`, `room-tree.js`, `rom-readers.js`, and `language-providers.js`. This class of silent activation failure cannot recur without the test catching it.

## [0.3.4] — 2026-05-27

### Changed
- Extracted ROM reader functions into [memory_radar/rom-readers.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/rom-readers.js) (`readRomMapHeader`, `readRomTriggerOffsets`, `readRomCharacters`, `readRomHitLookup`, `detectScaleEnemies`, `readPngDimensions`).
- Extracted room data layer into [memory_radar/room-data.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/room-data.js) (`VANILLA_ROOMS`, `getMapEnum`, `readLuaWatchers`, `readScriptAllTriggers`, `buildVanillaRoomContent`, `buildVanillaRoomDetails`).
- Extracted room tree building and rendering into [memory_radar/room-tree.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/room-tree.js) (`findRoomImage`, `parseRoomContent`, `collectRoomsFromDir`, `buildRoomTree`, `renderVanillaTree`, `renderRoomsTree`, `buildRoomsJson`, `setRoomImageUris`).
- Reduced [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) from 3188 lines (pre-cleanup) to 1280 lines (60% reduction) across this and previous cleanup passes.
- Added `tsconfig.json` with `allowJs: true` scaffold for incremental TypeScript adoption.
- Added `typecheck` script to `package.json`.

## [0.3.3] — 2026-05-27

### Added
- Added a byte-script debugger workflow note in [docs/byte-script-debugging.md](/Users/v/Documents/GitHub/everscript-vscode/docs/byte-script-debugging.md), covering how the emulator, mock `.evs` debugger, and Rooms tab currently attach to one another for both source-level and ROM-byte-script inspection.

### Fixed
- Switched manual emulator-panel breakpoints in [debugger/emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/panel.js) from CPU exec breakpoints to live byte-script `loc` matching, so the addresses shown in the script stack now pause on the intended VM instruction instead of the SNES CPU PC.
- Forwarded active byte-script addresses through [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) into [memory_radar/webview/assets/rooms-tab.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/rooms-tab.js) and [memory_radar/webview/assets/shared.css](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/shared.css), so the current decoded ROM-script row/card can highlight live in the Rooms tab.
- Corrected Rooms map extent sizing in [memory_radar/webview/assets/rooms-tab.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/rooms-tab.js) so the rendered view uses the ROM header's `width * 16` and `height * 16` geometry as the authoritative room size.

### Tests
- Extended [debugger/tests/emulator-health.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-health.test.js) for byte-script breakpoint/focus bridging and [memory_radar/tests/smoke.test.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/tests/smoke.test.js) for live script-focus highlighting plus ROM-header-driven map extents.

## [0.3.2] — 2026-05-27

### Added
- Added manual exec-breakpoint controls to [debugger/emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/panel.js) so the emulator panel can add and remove address breakpoints directly through the custom core bridge.
- Added ROM-backed practical coverage to [debugger/tests/room-script-model.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/room-script-model.test.js) using the local Evermore ROM when available, anchored on room `0x33` / Strong Heart's Exterior.

### Fixed
- Restored shell-derived PATH handling in [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) for `everscript.buildAndRun`, so compiler subprocesses can find external tools like `asar` again while still preferring the project venv.
- Corrected room-script decoding in [debugger/emulator/room-script-model.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/room-script-model.js) for branch sizing and the offset-based `0x08`, `0x09`, `0x0c`, `0x18`, and `0x1b` opcode forms used by real vanilla room scripts.
- Updated the Rooms tab presentation in [memory_radar/webview/assets/rooms-tab.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/rooms-tab.js) and [memory_radar/webview/assets/shared.css](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/shared.css) so decoded script errors are clearer, grid layers are toggleable, map fit/pan is more stable, and selected triggers also highlight their script cards.

## [0.3.1] — 2026-05-27

### Added
- Added [debugger/emulator/snes-rom-header-model.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/snes-rom-header-model.js) with tested HiROM/LoROM cartridge-header parsing based on the SNES internal ROM header.
- Added [debugger/tests/settings-model.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/settings-model.test.js) and [debugger/tests/snes-rom-header-model.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/snes-rom-header-model.test.js) to lock down repo-path autofill behavior and cartridge-header parsing.

### Fixed
- Centralized repo-derived settings resolution in [settings-model.js](/Users/v/Documents/GitHub/everscript-vscode/settings-model.js) and updated [package.json](/Users/v/Documents/GitHub/everscript-vscode/package.json) so `repoPath` now clearly auto-fills compiler, Python, source, patches, and ROM defaults while keeping legacy `patchesPath` compatibility.
- Reworked the Rooms tab in [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js), [memory_radar/webview/assets/rooms-tab.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/rooms-tab.js), and [memory_radar/webview/assets/shared.css](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/shared.css) so vanilla rooms use configured-ROM data, missing-ROM states show explicit errors, the stale placeholder path is gone, and the misleading bottom render block is removed.
- Expanded [debugger/emulator/room-script-model.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/room-script-model.js) to decode a broader set of fixed-width room-script opcodes including text, audio, call, yield, and UI-related instructions.

### Tests
- Updated [memory_radar/tests/smoke.test.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/tests/smoke.test.js) and [memory_radar/tests/ui.test.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/tests/ui.test.js) to assert ROM-backed room details, explicit room errors, and the absence of the removed bottom render block.
- Extended [debugger/tests/room-script-model.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/room-script-model.test.js) with additional fixed-width opcode coverage.

## [0.3.0] — 2026-05-27

### Added
- Added a ROM-backed room-script parser in [debugger/emulator/room-script-model.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/room-script-model.js) that resolves the enter script, step-on trigger scripts, and B-trigger scripts directly from the map data pointer, trigger tables, and script pointer tables.
- Added decoded script tables to the Rooms tab in [memory_radar/webview/assets/rooms-tab.js](/Users/v/Documents/GitHub/everscript-vscode/memory_radar/webview/assets/rooms-tab.js), including opcode, size, raw bytes, script addresses, and termination state in a TilesViewer-style view.

### Fixed
- Moved the debugger feature fully under `debugger/`: the emulator panel now lives in [debugger/emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/emulator/panel.js) and both bundled/custom SNES core paths resolve from `debugger/core/...`.
- Replaced the old `script_all` text scrape in [extension.js](/Users/v/Documents/GitHub/everscript-vscode/extension.js) with the ROM-backed parser so Rooms-tab trigger data comes from the same authoritative source as the map header and payload readers.
- Updated emulator health coverage for the debugger-rooted layout and warning-path mocking in [debugger/tests/emulator-health.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-health.test.js).

### Tests
- Added [debugger/tests/room-script-model.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/room-script-model.test.js) with synthetic ROM fixtures that validate trigger-table lengths, script-id lookup, opcode sizing, coordinate ordering, and trailing `0x00` termination.

## [0.2.79] — 2026-05-26

### Fixed
- Merged emulator/debugger core handling into the top-level `core/` folder: the debugger-enabled fork now lives in `core/snes9x2005-wasm` and the vanilla base in `core/snes9x2005-wasm-vanilla`.
- Removed the obsolete `debugger/core/snes9x` submodule and stopped using `emulator/core/` as a special bundled-core path.
- Added legacy-path remapping in [emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/emulator/panel.js) so existing `everscript.snesCorePath` values that still point at `debugger/core/...` continue to resolve to the debugger core.
- Reworked screen fitting in [emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/emulator/panel.js) to size the canvas with actual fitted width/height values instead of relying on CSS transform scaling.
- Fixed manual ROM reloads to redispatch directly to a ready webview instead of rebuilding the whole panel HTML.

### Restored
- Restored working pause/resume and hook controls with the debugger-enabled core, backed by runtime coverage.
- Restored the script detail panel (`ss-detail`) with current active-slot summary, scheduler-chain view, next-slot column, and `0x0F..0x2E` argument dumps as the next safe v0.2.71 feature slice.

### Tests
- Added top-level core build wrappers via `tools/build_snes_core.sh` and updated `npm test`, `npm run test:emulator-runtime`, and VS Code tasks to build both core variants from the merged layout.
- Extended [debugger/tests/emulator-runtime.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-runtime.test.js) to verify fitted canvas sizing, repeat ROM loads, custom-core debugger controls, and the restored script detail panel.
- Extended [debugger/tests/emulator-health.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-health.test.js) for merged-core paths, legacy-path remapping, and restored detail-panel coverage.

## [0.2.78] — 2026-05-26

### Fixed
- Moved the shell-style build/deploy helpers out of [/.vscode/launch.json](/Users/v/Documents/GitHub/everscript-vscode/.vscode/launch.json) into [/.vscode/tasks.json](/Users/v/Documents/GitHub/everscript-vscode/.vscode/tasks.json), including a dedicated `Test Emulator Runtime` task.
- Restored visible-editor debugger anchoring in [emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/emulator/panel.js) as the first safe v0.2.71 feature reintroduction.

### Tests
- Added [debugger/tests/emulator-runtime.test.js](/Users/v/Documents/GitHub/everscript-vscode/debugger/tests/emulator-runtime.test.js): a browser-backed runtime harness that loads the real panel HTML, boots the core, loads the Evermore ROM, exercises core commands, and records the actually exported API surface.
- The runtime harness now covers bundled-core auto-load, bundled-core manual-load, and custom-core auto-load.
- The runtime harness supports both debugger-core directory layouts: `debugger/core/snes9x2005-wasm` and `debugger/core/snes9x`.
- Verified manually with the harness that current `v0.2.76` passes while historical commit `654df3e` fails with `timed out waiting for webviewBoot`.

## [0.2.76] — 2026-05-26

### Fixed
- Reverted the v0.2.71 emulator panel lifecycle-analysis changes from [emulator/panel.js](/Users/v/Documents/GitHub/everscript-vscode/emulator/panel.js) to reduce the boot script back to the pre-0.2.71 shape while diagnosing ROM startup failures. The panel now returns to raw script-slot rendering and raw write-triggered break handling.

### Removed
- Removed the semantic script lifecycle summary panel, 0x20-byte argument dump, scheduler-chain view, and focus-row highlighting that were added in v0.2.71.
- Removed the visible-editor fallback for emulator debugger sync anchoring; sync now again requires the active editor to be an `.evs` file.

### Tests
- Dropped the health-test assertions that required the removed v0.2.71 lifecycle-detail UI and visible-editor debugger anchoring.

## [0.2.75] — 2026-05-26

### Fixed
- Emulator panel timeout: restored `script-src * blob: data:` wildcard CSP (identical to the working v0.2.70/v0.2.71 configuration). The v0.2.73 change to `script-src 'nonce-${nonce}' ${cspSource}` and the v0.2.74 change to `script-src ${cspSource} 'unsafe-inline'` both broke the inline boot script — `cspSource` evaluates to `https://*.vscode-cdn.net` which uses a single-label wildcard that does not match the multi-level `file+.vscode-resource.vscode-cdn.net` subdomain used by VS Code's resource server, and can interact with VS Code's own CSP enforcement to suppress `'unsafe-inline'` for inline scripts.
- Removing unused `cspSource = webview.cspSource` from `_buildHtml` since the wildcard CSP no longer needs it.

### Tests
- Renamed test `panel.js uses unsafe-inline CSP (no nonce on script tag)` to `panel.js uses wildcard script-src with unsafe-inline (no nonce on script tag)`.
- Added assertion that `script-src * blob: data:` wildcard is present (prevents regression to restrictive `${cspSource}` form).
- Added comment explaining that nonce in `script-src` suppresses `'unsafe-inline'` per CSP spec.

## [0.2.74] — 2026-05-25

### Fixed
- Emulator panel timeout: switched webview `script-src` CSP from nonce-based (`'nonce-${nonce}'`) to `'unsafe-inline'`. The nonce-based policy was silently blocking the inline `<script>` tag in VS Code's webview Chromium context, preventing `acquireVsCodeApi()` from ever running and causing the 30-second "Timeout waiting for webview ready message" on every build.
- Removed unused `nonce` attribute from the `<style>` tag (style-src had no matching nonce directive).

### Changed
- Webview boot sequence restructured: `window.onerror`, `unhandledrejection`, and `securitypolicyviolation` handlers are now registered **before** `acquireVsCodeApi()` so any init-time error is captured. Uses `var vscodeApi` (hoisted) so the handlers can safely reference it before assignment.
- `vscodeApi.postMessage` calls in Module callbacks and `loadCoreScript.onerror` are now null-safe (`if (vscodeApi)`) in case API acquisition fails.
- `_resetPanelHtml` logs a 220-char HTML head snippet to the output channel for future CSP/script-load diagnostics.
- Added `console.log('[EVS webview] boot...')` and `console.error` calls visible in the webview developer tools.

### Tests
- `debugger/tests/emulator-health.test.js` section G: ROM load simulation. Adds static checks for unsafe-inline CSP, onerror-before-acquireVsCodeApi ordering, webviewBoot placement, and gameStarted flow. Also adds a mock-based runtime test: `openEmulatorPanel` → `ready` → `loadRom` dispatched → `gameStarted` processed without errors.

## [0.2.73] — 2026-05-25

### Added
- `memory_radar/models/map-pipeline-model.js`: comprehensive evidence-backed map pipeline model covering all confirmed stages: blob header, trigger tables, tile families, sentinel scan, position table, nibble-packed tilemap, delta decode, EE descriptor lookup, and render script 0x93 structure. Includes trusted pass1/pass2 word constants for map 0x33 from Mesen2 memory snapshots (2nd decompressor invocation, source: `tmp/map_research.md`).
- `tools/map-dump.js`: unified map dump script (replaces scattered root-level dump scripts). Prints a structured 13-section dump of any map blob including 6-byte sub-header layout, decompressor trace evidence summary, and provisional tilemap formula caveat.
- `memory_radar/tests/map-pipeline-model.test.js`: 44 tests covering address conversion, delta decode, nibble tilemap parse, sentinel scan, render script 0x93 structure, and ROM-dependent blob parse (map 0x33 all stages).
- `.vscode/launch.json`: F5 launches Extension Host. Added `Build Core (snes9x2005-wasm)` and `Dump Map 0x33` configs.
- `npm run package`: packages VSIX to `out/` via `vsce --out out/` with clear error message on failure.
- `npm run deploy`: packages VSIX and installs with `code --install-extension --force`, then verifies `rbin.everscript` is present in the extension list. Clear error messages when `code` CLI is not in PATH or install fails.
- `docs/map-0x33-analysis.md`: decompressor section expanded with sub-header byte layout, trace PC signatures, two-invocation structure, and exact list of what disassembly is still needed.

### Changed
- `.gitignore`: now ignores `out/` (entire build output folder) instead of `*.vsix`. VSIX files are always built to `out/` and never committed.
- `.vscode/launch.json`: `Deploy Plugin` renamed to `Deploy Plugin (VSIX)` and now uses `npm run deploy` instead of rsync.
- `memory_radar/models/map-pipeline-model.js` header: `compressedSectionSize` comment corrected (was "4-byte sub-header", now "6-byte sub-header + 158-byte bitstream"). `parseTilemap` comment updated: `family = nibble >> 2` is marked as provisional with caveat about the 62.8% out-of-range tile ratio. TRUSTED_MAPS block comment now cites `tmp/map_research.md` and the Mesen2 trigger number.

### Fixed
- Emulator panel webview no longer fails to parse on startup. Root cause: v0.2.71 introduced box-drawing characters (`\u2500`) inside the HTML template literal as JS/CSS comment dividers; these non-ASCII bytes caused the webview browser to throw `Invalid or unexpected token` before `onRuntimeInitialized` ever fired, so the `ready` message was never sent, and ROM loading appeared silently broken.
- All non-ASCII characters removed from `emulator/panel.js` (ASCII-only enforcement).

### Removed
- Root-level `build`, `deploy`, `dump-map-blob.js`, `decode-rom-tilemap.js`, `dump-map-trace-flow.js`, `dump-map-evidence.js` removed from repo. Functionality is now in `tools/map-dump.js` and `.vscode/launch.json`.

## [0.2.72] — 2026-05-22

### Added
- Added `debugger/core/snes9x` as a tracked git submodule pointing to `https://github.com/r-bin/snes9x2005-wasm.git`.
- Added `docs/snes9x_integration.md` with the full integration playbook (subtree/submodule options, tmp migration strategy, hook patterns, and architecture layout).
- Documented debugger core submodule setup/update workflow and branch handoff steps in `debugger/README.md`.

## [0.2.71] — 2026-05-22

### Updated
- Script-stack breaking now happens on semantic slot lifecycle snapshots instead of the first raw `0x28FC`-region byte write. This gives the panel a complete slot image after creation/activation, including the populated `0x0F..0x2E` argument block.
- Script-stack panel now shows a richer debugger summary: executing slots, current active-slot interpretation, scheduler chain via `next_script`, and a focused 0x20-byte arg dump for the latest lifecycle event.
- Emulator debugger sync can now anchor from a visible `.evs` editor even when the emulator webview has focus, fixing the earlier `open an .evs editor first` failure mode.

## [0.2.70] — 2026-05-22

### Added
- Emulator panel button to break on all observed hook writes, not just debugger callback hits. This pauses the core when any watched script-slot byte changes.
- Emulator panel button to connect the existing VS Code `everscript` debugger. Emulator hook breaks now sync into the mock debug adapter through a new `syncFromEmulator` request so VS Code shows a real `stopped` event.

### Updated
- Added regression coverage for the emulator-to-debugger sync path and the new panel controls.

## [0.2.69] — 2026-05-22

### Fixed
- Script-hook watchpoints now follow the custom debugger contract again: `addWriteBreakpoint()` receives WRAM offsets, not `$7E` bus addresses.
- Added explicit hook lifecycle and observed-write logs in the Everscript Build output so hook activity is visible even before a breakpoint pause is confirmed.
- Audio now reads the core's exported `Float32` planar `2048 + 2048` sample buffer directly instead of treating it as interleaved `Int16`, fixing the loud robotic output.

## [0.2.68] — 2026-05-22

### Fixed
- Emulator script-stack hook now arms write breakpoints with full `$7E` bus addresses instead of raw WRAM offsets. This fixes the non-firing hook in custom debugger builds.
- Audio startup is now tied to a real webview user gesture and explicitly resumes the `AudioContext` after ROM load, fixing muted playback caused by autoplay suspension.
- Screen scaling now uses deterministic transform-based resizing and refreshes on visibility, resize, and frame updates so the game canvas fills the available panel area instead of staying near native size.

## [0.2.67] — 2026-05-22

### Changed
- **Removed EmulatorJS entirely.** The emulator panel now loads `snes9x2005-wasm` (lrusso Emscripten build) directly in the VS Code webview — no libretro wrapper, no `.data` bundles.
- Core files moved to `emulator/core/snes9x_2005.{js,wasm}` (bundled with extension). Old `emulator/vendor/emulatorjs/` archived to `tmp/emulatorjs-vendor/`.
- `everscript.snesCorePath` setting now accepts a path to a custom `snes9x2005-wasm` `.js` file (matching `.wasm` must be in the same directory). Previously it accepted a `.data` EmulatorJS bundle.

### Added
- **Audio**: Web Audio via `ScriptProcessorNode` + ring buffer. `_getSoundBuffer()` is fed into a 16-bit stereo → float32 pipeline at 44100 Hz after each frame.
- **Proper screen scaling**: canvas CSS scales to fill the panel while preserving the 512:448 aspect ratio via `ResizeObserver` and aspect-ratio math.
- **Script stack WRAM fallback** updated: reads from `Module._saveState()` + `Module._getStateSaveSize()` instead of EmulatorJS game manager.

### Updated
- `debugger/tests/emulator-health.test.js` rewritten for the new architecture: checks `emulator/core/` files, WASM magic bytes, required Emscripten exports, no EJS_Runtime, and panel.js sanity (17 tests, 0 xfail).

## [0.2.64] — 2026-05-21

## [0.2.66] — 2026-05-21

### Added
- `debugger/tests/emulator-health.test.js` — validates vendor assets and both core bundles (pre-delivered + custom) before launch. Checks: file existence, 7-zip magic bytes, required bundle contents, `EJS_Runtime` definition. Custom core `EJS_Runtime` check is marked `xfail` (known: snes9x2005-wasm is a standalone Emscripten build, not a libretro wrapper).
- `emulator.min.css` added to vendor dir (copy of `emulator.css`) — stops EmulatorJS console warning about missing minified CSS.

## [0.2.65] — 2026-05-21

### Added
- Webview error forwarding: `window.onerror`, `unhandledrejection`, and a `console.warn` intercept now pipe EmulatorJS errors into the Everscript Build output channel (auto-reveals on error). Removes the VS Code modal popup for emulator errors.


### Added
- `tools/pack_snes_core.py` — script to package a custom snes9x2005-wasm build into an EmulatorJS-compatible `.data` bundle (7-zip). Running it against `tmp/docker/snes9x_2005.js` + `.wasm` produces `tmp/custom-snes9x.data`.
- Script stack header now shows a **core info row** below the button bar displaying the active core filename and full bundle path, or "snes9x (bundled)" with the vendored `.data` path when no custom core is configured.

# [0.2.63] — 2026-05-21

### Added
- **EmulatorJS script-stack debugger panel**: the script stack table now reads directly from the running module when a custom debugger-enabled SNES core is loaded, and falls back to save-state parsing otherwise.
  - Visible **custom API proof** in the panel (`api: custom debugger active`) using `getCPUState()` / `readMemoryRange()` when available.
  - **Pause / resume controls** wired to the custom debugger API.
  - **Script stack hook toggle** arms write breakpoints on key script-slot fields so stack writes can pause the emulator and be resumed from the panel.
  - Fixed the previous stack reader bug where the panel injected `Module.EmulatorJSGetState()` but still called a missing `gm.getState()`, leaving the table stuck on `connecting...`.

# [0.2.62] — 2026-05-21

### Changed
- **SNES custom core path now stays inside EmulatorJS**: `everscript.snesCorePath` now overrides EmulatorJS's SNES core bundle path instead of switching to a separate custom canvas runtime.
  - **Empty setting**: uses the bundled EmulatorJS `snes9x` core exactly as before.
  - **Custom setting**: must point to an EmulatorJS-compatible SNES core bundle (`*.data`). The panel overrides both `snes9x-wasm.data` and `snes9x-legacy-wasm.data` through EmulatorJS `filePaths`, so the normal EmulatorJS UI, settings overlay, input handling, audio path, and lifecycle remain intact.
  - **Incompatible raw `.js` / `.wasm` paths** are now rejected with a warning instead of silently switching to a separate runtime.

# [0.2.59] — 2026-05-21

### Added
- **`everscript.snesCore` setting**: Choose the SNES emulator core used in the embedded emulator panel.
  - **Default (empty)**: uses the bundled EmulatorJS snes9x libretro core — same as before.
  - **Custom path**: point to `snes9x_2005.js` from a custom `snes9x2005-wasm` build (the matching `.wasm` must be in the same directory). The panel then uses a canvas renderer that calls directly into the WASM module, bypassing EmulatorJS entirely. Enables debugger breakpoint APIs (`Module._addExecBreakpoint`, etc.) added in the snes9x2005-wasm build.
  - Changing the setting and re-opening the panel (F5 or `Open Emulator`) auto-detects the new core. If the panel is already open and the core changes, it is automatically recreated with the correct `localResourceRoots`.

# [0.2.58] — 2026-05-21

### Fixed
- **Compiled ROM now actually boots in the emulator**: EmulatorJS uses `fetch()` internally to load the game. VS Code webviews silently block `fetch()` on `data:` URLs, causing EJS to open its file browser instead of booting the ROM. The base64 payload is now converted to a `Blob` URL in the webview before being passed to EmulatorJS.

### Added
- **Emulator launch logging**: Build output channel now shows ROM path, size, blob creation confirmation, and game-started event. Errors from the emulator side (blob conversion failure, etc.) surface as an error notification.

# [0.2.57] — 2026-05-21

### Fixed
- **Compiled ROM now boots in the embedded emulator**: Loading a ROM into an already-open emulator panel now rebuilds the webview first, so EmulatorJS starts from a clean bootstrap and consumes the new ROM instead of dropping into its file browser.
- **Settings command contribution now loads cleanly**: Removed a duplicate `everscript.romPath` manifest key that could interfere with VS Code contribution parsing.

# [0.2.56] — 2026-05-28

### Fixed
- **F5 Python interpreter**: `buildAndRun` now detects the project's `.venv/bin/python3` and uses it instead of the system `python3`. System Python lacks the `injector` package, causing `ModuleNotFoundError`. Fallback chain: `.venv/bin/python3` → `.venv/bin/python` → `venv/bin/python3` → `venv/bin/python` → `python3`.
- **Relative paths in compiler invocation**: `--patches` and input file arguments are now passed as relative paths from the project root (e.g. `./patches`, `in/practice`), matching the working manual command.
- **Exact command logged**: Output channel now shows the full command as it would be typed in a terminal.

### Added
- **`everscript.pythonPath` setting**: Optional override for the Python interpreter path. When empty, auto-detected from the project `.venv`.
- **`Everscript: Open Everscript Settings` command**: Opens VS Code Settings UI pre-filtered to all `everscript.*` settings (Cmd+, equivalent).

### Removed
- **Settings tab from Emulator panel**: Settings belong in VS Code's built-in settings UI (Cmd+, → search "everscript"). The emulator panel is now a pure emulator again.

# [0.2.55] — 2026-05-21

### Added
- **Settings tab in Emulator panel**: New "Settings" tab alongside "Emulator". Fields: Everscript repo path, patches/ folder, compiler binary or script, vanilla ROM, SNES core (snes9x). Auto-fill button (and Enter key on the repo field) probes the repo and pre-populates all other fields. Save persists to VS Code global settings.
- **Python compiler support**: `buildAndRun` (F5) now detects `everscript.py` in the repo root and runs `python3 everscript.py --rom <ROM> --patches <patchesDir> <input.evs>` instead of the binary. Falls back to `dist/everscript_mac` / `dist/everscript.exe` if no Python script found.
- **New settings**: `everscript.repoPath`, `everscript.patchesPath`, `everscript.romPath`. Together with the existing `everscript.compilerPath` override, these replace `everscript.projectRoot`.

### Changed
- `everscript.projectRoot` removed; replaced by `everscript.repoPath`.
- Error messages now point to "Emulator panel → Settings tab" instead of raw setting names.
- Emulator overlay changed from `position:fixed` to `position:absolute` inside its tab pane, so it no longer covers the Settings tab.

# [0.2.54] — 2026-05-28

### Added
- **Real compiler wiring (F5)**: `everscript.buildAndRun` now auto-detects the Everscript compiler binary by walking up from the active `.evs` file looking for `dist/everscript_mac` / `dist/everscript`. Runs `everscript_mac --rom <ROM> <input.evs>` with the project root as `cwd`, reads `out/<ROM>`, and loads it into the emulator automatically. No configuration required for the standard project layout.
- **Script Stack panel**: A compact live panel appears below the emulator once the game starts. Polls the WRAM via EmulatorJS save-state API every 500 ms; parses the 20 script slots at `0x28FC` (each `0x4F` bytes); shows slot#, PC, state (exec/wait/dead), entity, and timer1. Color-coded rows: green = executing, yellow = standby, red = dead.
- **WRAM delta messages**: The webview posts `{ command: 'wramDelta', offset, data }` to the host after each poll for future Memory Radar live-mode integration.
- **New settings**: `everscript.compilerPath` (override compiler binary path) and `everscript.projectRoot` (override project root). Replaces `everscript.buildCommand` / `everscript.buildOutput`.

### Changed
- `everscript.buildCommand` and `everscript.buildOutput` removed; replaced by `everscript.compilerPath` and `everscript.projectRoot`.
- Emulator webview layout changed to flex-column so the script-stack panel sits below the emulator canvas without overlapping it.

# [0.2.51] — 2026-05-21

### Fixed
- **Command registration bug**: Fixed duplicate `commands` block in `package.json` that prevented "Everscript: Open Emulator Panel" from appearing in the Command Palette. Both commands now show up after reload.

### Added
- **Emulator Panel (Phase 1 — keyboard POC)**: `Everscript: Open Emulator Panel` command opens a webview with a SNES-style canvas + live key log. Proves VS Code webview keyboard capture works end-to-end. ROM picker sends the path to the panel; WASM emulator slot documented for Phase 2.
  - `emulator/panel.js` — panel registration, ROM picker, extension↔webview message bridge.
  - `emulator/webview/index.html` — canvas, SNES button map, held-key chips, key event log.
- **Call Log module design**: `call-log/design.md` — full architecture for a live function-call logger: detection strategy, WRAM data sources, `call-decoder.js` / `log-channel.js` / `log-webview.js` module split, VS Code settings, Phase 1 (mock) + Phase 2 (live WRAM) plan.
- **Emulator rankings doc**: `docs/web-emulator-plan.md` — ranked analysis of ares, Snes9x, Mesen2, RetroArch by license, WASM availability, accuracy, and debug API. Legal summary table. Phase plan through v1.0.
- **`DebugConfigurationProvider`**: F5 on a `.evs` file with no `launch.json` now auto-fills the debugger config from the active editor, fixing the "wrong file" (kaizo.evs) problem.
- **Debug activation events** (`onDebugResolve:everscript`, `onDebugAdapterProtocol:everscript`): extension activates before a debug session starts so gutter breakpoints are always clickable.

### Updated
- `docs/embedded-emulator-panel-concept.md` — added emulator-selection table, keyboard findings, and current implementation status table.

# [0.2.49] — 2026-05-21

### Added
- **Debugger (Phase 1 — mock)**: source-level step debugger for `.evs` files using the Debug Adapter Protocol.
  - `debugger/adapter.js` — DAP server (stdin/stdout, no npm dependencies).
  - `debugger/mock-runtime.js` — parses `.evs` function blocks, simulates stepping line-by-line, fires `stopOnEntry`/`stopOnStep`/`stopOnBreakpoint` events.
  - Supports: Launch, Breakpoints, Continue, Step Over, Step Into, Step Out, Call Stack panel, Locals variables (mock WRAM refs), `arg[]` scope.
  - `package.json` gains `"breakpoints"` + `"debuggers"` contributions; F5 on any `.evs` file launches the mock session.
  - `debugger/poc-design.md` — architecture doc, compiler changes needed for Phase 2 (live WRAM), and Phase 3 (full DAP).
  - 10 new tests in `debugger/tests/debugger.test.js`.

# [0.2.48] — 2026-05-21

### Fixed
- **Memory Radar activation**: added explicit command activation for `everscript.openMemoryRadar` so the command is registered even before an `.evs` editor activates the extension.

# [0.2.48] — 2026-05-20

### Changed
- **Modular webview**: extracted all 7 inline webview template literals (CSS, scaling, rooms, docs, route, rng, shared JS) from `extension.js` into `src/webview/*.js` modules. `extension.js` reduced from 5280 to 2852 lines.
- **Dead code removed**: `alchemyWebview*` variable definitions and the `alchemy-model` destructure require removed from `extension.js` top level (now live in each webview module).
- **Models directory**: `models/alchemy-model.js`, `models/radar-utils.js`, `models/map-blob-evidence-model.js`, `models/render-script-model.js` are the authoritative copies; root files are thin shims.

# [0.2.47] — 2026-05-20

### Changed
- **Prophet simulation redesign**: replaced outer-reset-counting model with a single-run model that tracks *prompts* (total prophet interactions) and *resets* (player-initiated story resets) per run.
- **Output format**: now shows `prompts: avg X p50 Y p90 Z | resets: avg A p50 B` (success rate shown only when < 100%).
- **Four profiles replacing three strategies**: `mash` (never reset, can tilt), `reset4chaos` (reset at state 4 or any chaos), `reset4` (reset only at state 4, allows chaos recovery), `metaonly` (reset unless in meta arc 6–8, except state 0).
- Histogram now plots prompts distribution (was reset count).

# [0.2.46] — 2026-05-20

### Changed
- **Prophet RNG tab**: replaced basic 3-column codename table with full 5-column state analysis (State, Codename, Reach 8%, Reach 5%, Next states with odds).
- **Prophet simulation**: replaced simple reset counter with strategy-aware `simProphetStrategy(strategy)` implementing correct arc transitions (prophecy/meta/chaos).
- **Reset strategy dropdown**: Aggressive (reset on any chaos or tilt), Moderate (allow 2 chaos rounds), Full EV (reset only on permanent tilt lock). Description updates on change.
- Arc color-coded table rows (blue=prophecy, green=meta, red=tilt, muted=chaos).

# [0.2.45] — 2026-05-20

### Added
- **RNG tab** — new tab in the Memory Radar panel with three simulation sections:
  - **Naris / Super Heal**: 50/50 coin-flip, average ~2 attempts.
  - **Prophet / Bronze Armor**: State-machine simulation over 20 codename states (DOOM→FUSELAGE); includes full codenames reference table; average ~24 area resets.
  - **Egg / Chocobo Egg**: Pot-purchase simulation (5 or 10 pot run); average ~43 purchases.
- Each section has a "Simulate 10,000×" button, avg/p50/p90/p99 output, and a bar histogram.

# [0.2.44] — 2026-05-20

### Changed
- Project cleanup: moved all map-analysis and R&D files to tmp/, removed dead test/model scripts, updated .gitignore to exclude dependencies/.
- No change to extension output or user-facing features.

# Changelog

## [0.2.43] — 2026-05-14

### Added
- **Mechanics model artifact** — added `docs/rooms-payload-boundary.model` as the single evidence-backed boundary model for room payload parsing, with validated map outcomes and explicit `TODO_EVIDENCE_NEEDED` items for unresolved decompressor semantics.

## [0.2.42] — 2026-05-14

### Fixed
- **Map payload boundary false positives** — `decodeMapPayload` now constrains sentinel candidate scanning to the current map blob (nearest higher map pointer end) instead of scanning far into later ROM data.
- **Blob-bounded payload parsing** — position-table and tilemap reads now also enforce map-blob bounds, preventing cross-blob overreads and accidental decode acceptance.

### Added
- **ROM-backed payload regression** in `test/map-payload-compression.test.js`:
  - verifies decode succeeds for maps `0x33`, `0x34`, `0x51`, `0x5c` under bounded scan rules,
  - verifies map `0x38` correctly fails under the current known sentinel model.
- **Feature dossier update** in `docs/map-renderer-status.md` documenting the new bounded-scan evidence and revised parse snapshot.

## [0.2.41] — 2026-05-14

### Added
- **Model test: room compressed-section vs tile codec** — added `test/map-payload-compression.test.js` to run a direct experiment applying tile-compression framing to real room compressed data (map `0x33`) and compare against trace-backed map expectations.
- **Trace comparison assertions** — added explicit checks showing tile codec framing does not reproduce the observed room tilemap structure/diversity, and that room sentinel boundary semantics are distinct from tile framing.

### Changed
- **Test pipeline** — `npm test` now includes `node test/map-payload-compression.test.js` in the default sequence.

## [0.2.40] — 2026-05-14

### Fixed
- **Map payload sentinel detection** — `decodeMapPayload` now accepts additional observed boundary variants:
  - strict7 core: `x 00 00 00 01 00 FF` where lead byte `x` is not restricted to `0x30`/`0xC8`.
  - short6 core: `x 00 00 01 00 FF` for variant payloads not matching strict7.
- **Candidate guardrail** — sentinel candidates now reject implausible position-table counts (`posCount > 64`) to reduce false-positive boundary picks.
- **Offset correctness** — decode now uses matched sentinel length (6 or 7) when computing position-table and tilemap starts.

### Added
- **Smoke tests** covering both new sentinel variants:
  - strict7 wildcard-lead sentinel acceptance.
  - short6 sentinel variant acceptance.
- **Map renderer status update** documenting current variant findings and tile-compression comparison status.

## [0.2.39] — 2026-05-14

### Added
- **Agent workflow requirement** — both custom agents now require a comprehensive feature dossier markdown file that tracks progress, user evidence requests, handled scope, research findings, blockers, and model dependencies.
- **tmp sampledata policy in agents** — both agents now require sampledata-heavy artifacts (raw bytes, dumps, traces) to be stored under `tmp/` and referenced from dossier docs.
- **Map renderer consolidated status** — added `docs/map-renderer-status.md` as the authoritative evidence-first status page for Rooms map rendering.

### Changed
- **Map docs cleanup** — reduced `docs/payload-byte-plots.md` to an archive pointer and moved heavy raw data to `tmp/map-renderer-payload-bytes.md`.
- **Legacy/speculation cleanup** — converted `docs/payload-deep-analysis.md` to a legacy pointer with explicit speculation policy.
- **Navigation update** — `docs/map-loading.md` now points to `docs/map-renderer-status.md` for consolidated current state.

## [0.2.38] — 2026-05-14

### Added
- **Custom agent: Mechanics Modeler** in `.github/agents/mechanics-modeler.agent.md` for evidence-first reverse engineering into a single `.model` artifact with explicit missing-evidence requests, progress tracking, assumption labeling, and test/log validation against real examples.
- **Custom agent: Everscript Plugin Builder** in `.github/agents/everscript-plugin-builder.agent.md` for useful-first extension feature delivery with strict model-backed mechanics policy, vertical-layout UI guidance, cross-feature linking, robust runtime error handling, and visibility-focused test requirements.

## [0.2.37] — 2026-05-14

### Fixed
- **Sentinel scoring** — `decodeMapPayload` now picks the earliest sentinel candidate (smallest compressed-section offset) instead of sorting by `invalidRefs`. Real tilemaps always contain nibble values 0–15 across all 16 VRAM slots; counting nibbles >= tileCount as "bad" produced meaningless scores that could cause wrong-candidate selection.
- **Removed false `invalidRefs` counter** — the per-map `invalidRefs` field is gone. All nibble values 0–15 are syntactically valid 4-bit indices by definition; "unresolved" (no declared family for a slot) is the correct term for nibbles >= tileCount.

### Added
- **docs/map-0x33-analysis.md** — complete byte-level and tilemap analysis of map 0x33 (Strong Heart Exterior): full 20×16 nibble grid, nibble distribution table, sentinel and position-table layout, and comparison of raw payload / trace / decoder output.
- **Test** — `'decodeMapPayload produces zero out-of-range nibble values on synthetic ROM'` — enforces the invariant that all decoded nibble values are in [0, 15].
- **Test** — updated `'decodeMapPayload picks earliest sentinel candidate on synthetic ROM'` — verifies that the earliest sentinel wins regardless of nibble content.

## [0.2.36] — 2026-05-13

### Added
- **Renderer contract tests** in smoke suite to enforce map draw invariants:
  - decoded map canvas size must match ROM header `mapW/mapH`.
  - canvas must be white-prefilled before map draw.
  - rendered map must be fully covered (no white holes) for valid tile fixtures.
  - draw diagnostics must report sufficient tile diversity (`uniqueRefsCount`) for varied fixtures.
  - per-tile pixel correctness checks now assert exact expected RGB output on-map.
  - draw-count parity checks validate `drawnTiles`, `tileRefs`, and `renderCommandsEstimate` consistency.

### Changed
- **Map draw geometry source** — decoded map rendering now always sizes and iterates from ROM header dimensions (not inferred tilemap array shape) to keep renderer behavior aligned with map metadata.
- **Coverage fill behavior** — invalid/missing tile refs are now substituted with fallback family tile 0 during draw, preventing sparse black gaps and ensuring complete map coverage for diagnostics.
- **Draw robustness and telemetry** — draw pass now wraps exceptions, logs explicit failures, and reports `fallbackSubstitutions` and `uniqueRefsCount`.

### Validation
- Full `npm test` passes with expanded map renderer contract coverage.
- Single-tile parity suite remains green, reinforcing that per-tile decode is correct while map-level placement decoding remains the primary open research area.

## [0.2.35] — 2026-05-13

### Added
- **Single-tile decoder parity test suite** (`test/map-tile.test.js`) with multiple 16x16 map-tile scenarios compared against an independent reference decoder ported from SoETilesViewer `tile.h` logic:
  - uncompressed random fixtures,
  - uncompressed overflow/clamp behavior,
  - compressed copy-only streams,
  - compressed command-mode fixtures (`0..8,13,14,15`),
  - strict 16x16 output/range assertions.
- **Rooms render diagnostics** now report unresolved ratio in UI metadata and include explicit draw diagnostics (`invalidRefs`, `tileRefs`) for trace comparison.

### Fixed
- **Broken garbage decoded-map display** — Rooms tab now rejects low-quality decoded payload renders (high unresolved tile-reference ratio) and falls back to header canvas with an explicit reason, instead of showing misleading sparse/black tile mosaics as successful decode output.
- **Decode quality telemetry** — backend logs now flag suspicious payload decode quality (`unresolvedRatio`) so trace review can focus on map-level opcode decode gaps rather than per-tile decode.

### Validation
- Full `npm test` passes with the new map-tile parity suite and updated smoke assertions.
- Result confirms single-tile 16x16 decode path matches SoETilesViewer behavior; remaining map-level mismatch is in payload/tile placement interpretation, not in tile decompression or pixel unpack.

## [0.2.34] — 2026-05-13

### Fixed
- **Rooms payload sentinel mis-pick** — payload decode no longer accepts the first structurally-valid sentinel match. It now scores all candidates in scan range by tile-reference validity (invalid nibble refs, max nibble) and picks the best fit, which prevents false positives that produced sparse/black broken renders.
- **Large-map decode scan window** — increased sentinel search window for long payloads so more maps resolve to decoded render instead of fallback white canvas.

### Added
- **Trace-grade decode logging** (`[RoomsRender]`) now reports:
  - number of sentinel candidates found,
  - selected sentinel type/address,
  - `posCount`, invalid ref count, max nibble,
  - final decoded stats (`compressedSize`, `invalidRefs`).
- **Render draw stats logging** in Rooms tab now reports per-draw counts (`drawnTiles`, `invalidRefs`, `tileRefs`, `families`) for direct comparison with emulator/tilemap traces.
- **Stronger smoke tests for map render quality**:
  - synthetic ROM test validates sentinel candidate selection prefers low-invalid decode path,
  - multi-map decoded fixtures assert render canvas is created and output is not all-white,
  - decoded-render path test still enforces non-empty pixel writes.

## [0.2.33] — 2026-05-13

### Fixed
- **Rooms payload decode address bug** — sentinel scanning in `decodeMapPayload` now uses absolute ROM offsets (`dataRom + payload offset`) instead of scanning from the ROM root, so maps with valid payloads decode correctly and render the decoded room canvas instead of incorrectly dropping to fallback.
- **Post-sentinel parsing alignment** — position-table and tilemap parsing now read from absolute addresses consistently, preventing false decode-null outcomes caused by mixed relative/absolute indexing.

### Added
- **Canvas render assertions in smoke tests**:
  - verify decoded map rooms create a render canvas (`#rr-canvas`) with expected dimensions.
  - verify decoded render path writes non-empty pixel data to the canvas (not an empty image buffer).

## [0.2.32] — 2026-05-13

### Fixed
- **Rooms tab visibility hardening** — room render section now always shows a canvas block in ROM Map Data:
  - If payload render data is available, draw the decoded room canvas as before.
  - If payload render data is unavailable, draw a **header fallback canvas** (white area) sized from ROM header `map_w_tiles` / `map_h_tiles` so the render area is always visibly present.
- **Payload sentinel scan robustness** — payload decode no longer stops at a short sentinel window; scan range was expanded and candidate validation now checks that the resulting position-table + tilemap region fits map geometry.

### Added
- **Render-path logging** — added `[RoomsRender]` logs for room-detail entry, decoded-room draw pass, fallback draw pass, and payload decode success/failure reasons.
- **Tests for render visibility and logs**:
  - smoke tests now assert rooms-tab fallback canvas markup is injected and render logs are emitted.
  - UI tests now assert rooms-tab render block styles exist and fallback render block appears when payload render data is missing.

## [0.2.31] — 2026-05-13

### Added
- **Rooms tab — ROM-decoded room canvas render**: the ROM Map Data section now includes a full-size room canvas (`map_w_tiles * 16` by `map_h_tiles * 16`) rendered from decoded payload tilemap data and map-tile graphics.
- **SoETilesViewer-compatible tile decode path**: map family tiles are decoded using the same tile-table/data model as SoETilesViewer (`0xEE0000` map-tile pointer table, `tileInfo` compressed/uncompressed decode rules, SNES 4bpp planar unpack to 16x16 indices).
- **Palette selector in render panel**: map render supports the SoETilesViewer 16-color map palettes (including `Jungle 1`, `Hut Int. 1`, `Hut Ext. 1`) and allows switching in-place for visual verification.

### Changed
- **Payload display now includes render trace order**: the room panel documents the exact draw order currently implemented (family list -> tile decode -> row-major tilemap blit) and reports unresolved tile references when payload indices exceed known family entries.

## [0.2.30] — 2026-05-13

### Added
- **Rooms tab — Complete map payload decoder** — the ROM Map Data panel now fully decodes and displays the map blob payload for all maps:
  - **Tile families**: 1-byte count + count × uint16 IDs from payload opcode 0 — shared CHR/VRAM art references.
  - **Position table** (optional): count + uint16 byte offsets; 0 entries in sparse maps (e.g., `0x33`), full entries in dense maps (e.g., `0x01` has 12, `0x51` has 25).
  - **Decoded nibble-packed tilemap**: rendered as a grid preview showing the first 10 rows and 20 tiles per row; each tile is a 4-bit index into the tile-family list (0–15).
  - **Compressed section size**: bytes consumed by the opaque bitstream (likely layer / collision / LZ-encoded data; not yet decoded).
  - Complete walkthrough documented in updated `docs/map-loading.md`.

### Fixed
- **Map format confirmed from binary analysis**: verified all three test maps (`0x01`, `0x33`, `0x51`) decode identically:
  - **Tilemap encoding**: nibble-packed (2 tiles per byte, 4-bit indices).
  - **Payload structure**: tile families → compressed section → sentinel → position table → tilemap.
  - **Sentinel variations**: `0x30 00 00 00 01 00 FF` (maps `0x33`, `0x01`) and `0xC8 00 00 00 01 00 FF` (map `0x51`); sentinel location marks end of compressed data.

## [0.2.29] — 2026-05-13

### Added
- **Rooms tab — ROM Map Data panel** — every map room in the Rooms tab now shows a collapsible "ROM Map Data" section populated directly from the ROM binary:
  - **13-byte header table**: offset, hex value, field name, WRAM/IO destination, and description with confidence level for every header byte — including the provisional `room_effect_family` / `room_effect_variant` fields.
  - **Derived geometry**: map size in tiles and pixels, horizontal/vertical scroll capacity.
  - **Render preset badge**: classifies the room by its 5-byte signature (`bytes 4–8`) into the 11 known groups (default outdoor, indoor, cave, parallax, darkness-style, etc.).
  - **Trigger table layout**: decoded `step_len` / `b_len` with entry counts, payload offset in the blob.
  - **Payload tile families**: count + hex IDs from payload opcode 0 (the tile-set load list).
  - Designed as a foundation for a future map editor; toggle collapses/expands the section.

## [0.2.28] — 2026-05-13

### Docs
- **Map payload opcode stream** — documented that the room payload after trigger tables is a command/script stream, not a flat bitmap. Evidence from cross-map comparison of three Prehistoria hut maps (`0x33`, `0x51`, `0x01`):
  - Command 0: count byte + `N × 2-byte` tile family IDs (map `0x01` shows a perfect sequential run `7..13`).
  - High-entropy compressed middle section (likely LZ/RLE tile placement commands), length proportional to map complexity.
  - Shared 6-byte sentinel `00 00 00 01 00 ff` in all three maps, separating the compressed section from a structured position table.
  - Position table: count byte + `N × 2-byte` row offsets with step of 6 tiles (96 px); gaps in map `0x01` match the empty vertical stretches visible in-game.
  - Added provisional opcode model to `docs/map-loading.md`.


### Fixed
- **Projectile alchemy damage model** — replaced the old `effective_mdef`/shared-RNG approximation with the traced projectile formula: cast-side power now uses the ROM spell-level scale table plus its own RNG bonus, and hit damage applies the traced `(0x40 - magic_defense) / 0x40` multiplier.

### Added
- **`hb1` offensive alchemy regressions** — damage coverage now includes Hard Ball level 1 against Purple/Wimpy Flower (`10–20`) and Mosquito-like `m.def 0` (`21–41`), alongside the traced level-0 regressions.

## [0.2.26] — 2026-05-13

### Changed
- **Traced alchemy spell-level scaling** — the shared offensive-alchemy spell-level helper no longer uses the old `+10%` placeholder. Level `0` keeps the existing grounded base-might path, while levels `1..9` now use the ROM-traced high-level scale table `2, 4, 7, 11, 15, 20, 26, 32, 39, 46`, which yields Hard Ball cast-side power `21` at level 1 before the cast RNG bonus.
- **Docs copy now distinguishes traced spell power from open target-side math** — the spell-level slider text in Docs now describes the traced cast-side power step for leveled casts and keeps the remaining target-side resistance/popup conversion explicitly open.

## [0.2.25] — 2026-05-12

### Added
- **Projectile alchemy research note in Docs** — the Docs tab and markdown alchemy note now record the active projectile-slot layout anchor at `7E3564`, including the `POWER` field at `+0x2A/+0x2B`, so spell-damage tracing context is visible in the extension.

### Changed
- **Alchemy docs now distinguish producer vs hit path** — the docs explicitly note that hit-only traces start after projectile power is already prepared, and that full throw+hit traces are the right source for deriving leveled projectile spell power.

## [0.2.24] — 2026-05-12

### Added
- **Docs alchemy spell-level slider** — the Docs tab offensive-alchemy calculator now exposes spell level directly so manual range checks can be explored without leaving the docs surface.

### Changed
- **Docs alchemy copy now labels spell level as projected** — the calculator and docs note now spell out that spell level currently uses the shared `+10% base might per level` preview helper rather than a grounded ROM-traced growth formula.

## [0.2.23] — 2026-05-12

### Added
- **Dual offensive alchemy Scaling graphs** — alchemy mode now shows a top graph for damage vs spell level and a second graph beneath it for damage vs target level, with dedicated sliders for spell level and target level.

### Changed
- **Projected alchemy preview model** — the new graphs use one shared preview path across Scaling and tests: spell level applies a labeled `+10% base might per level` projection, and scalable target level temporarily reuses the target defense-growth slope for `magic_defense` growth until grounded data is traced.

## [0.2.22] — 2026-05-12

### Fixed
- **SoETilesViewer `m.def` check** — verified against the local C++ source that SoETilesViewer reads `magic_defense` directly from `+0x1d` and displays that raw value, so the extension no longer assumes any hidden `0x40 - m.def` conversion in the viewer.
- **Shared offensive alchemy formula** — Scaling, Docs, and automated tests now all use the same `effective_mdef = floor((magic_defense + 20) / 4)` level-0 helper, which keeps Wimpy Flower at `6–10`, Carltron's Robot at `0–1`, and Mosquito in the `12–20` band instead of the old inflated `15–26` output.

### Added
- **Offensive alchemy RNG histogram** — the Docs alchemy calculator now renders the same damage-vs-RNG histogram style used by the physical damage calculator.
- **Broader alchemy coverage in `npm test`** — `test/damage.test.js` is now part of the main test script, and the UI regression fixture now covers Wimpy Flower, Mosquito, and Carltron's Robot.

## [0.2.21] — 2026-05-12

### Fixed
- **Offensive alchemy resistance model** — replaced the overfit inverted `magic_defense` helper with a direct raw-stat reduction model, so high-`m.def` enemies now take less damage and low-`m.def` enemies no longer collapse to `0–1`.
- **Scaling and Docs consistency** — both surfaces now use the same corrected level-0 alchemy math and no longer drift in formula text or rendered examples.

### Added
- **Broader alchemy regressions** — unit coverage now includes Wimpy Flower (`m.def 32` => `6–10`), Carltron-like high resistance (`m.def 60` => `0–1`), and Mosquito-like low resistance (`m.def 0` => `15–26`), alongside the existing Docs and parser checks.

## [0.2.20] — 2026-05-12

### Fixed
- **Purple/Wimpy Flower alchemy range** — the level-0 alchemy preview now matches the checked Hard Ball case against `m.def = 32`, producing `6–10` in both Scaling and Docs instead of the broken `0–1` range.
- **Live target stat parsing** — the live ROM reader again uses the Purple/Wimpy Flower `magic_defense = 32` value from the vanilla stat record, matching the external enemy viewer.

### Added
- **Regression coverage for the real bug** — the unit test, parser test, and Docs/Scaling UI tests now all assert the same grounded case: Hard Ball level 0 vs Purple/Wimpy Flower = `6–10`.

## [0.2.19] — 2026-05-12

### Fixed
- **ROM stat reader used the evade slot as magic defense** — `readRomCharacters()` now parses `evade` from `+0x1d` and `magic_defense` from `+0x1f`, which fixes live Scaling alchemy targets such as Hard Ball L0 vs Purple Flower/Wimpy Flower.

### Added
- **Parser regression coverage** — `test/scaling-rom.test.js` now feeds a synthetic ROM record through the real `readRomCharacters()` path and asserts that the parsed target produces the grounded Hard Ball L0 `6–10` range.

## [0.2.18] — 2026-05-12

### Fixed
- **Scaling alchemy target mdef lookup** — the Scaling tab now accepts both `magic_defense` and `magicDefense` on target records instead of silently falling back to `0`, which was producing bogus alchemy ranges like Hard Ball L0 `0–1` vs Wimpy Flower.

### Added
- **Hard Ball purple-flower regression test** — `test/ui.test.js` now asserts that Scaling alchemy mode shows Hard Ball L0 vs Wimpy Flower as `6–10`, matching the grounded level-0 model.

## [0.2.17] — 2026-05-12

### Fixed
- **Scaling tab damage-type selector restored to the right place** — the Physical / Offensive Alchemy selector now lives in Scaling, not Docs, and the matching field rows have the IDs that the existing mode-switching JS expects.
- **Scaling tab render crash** — switching or initializing Scaling no longer fails because `updateLevelFields()` can now find `sc-src-field`, `sc-charge-field`, `sc-scale-field`, and `sc-atlas-field`.
- **Docs alchemy entry restored** — Docs again exposes Offensive Alchemy as its own subtab instead of hiding it behind a misplaced dropdown.

### Added
- **Scaling-focused UI tests** — `test/ui.test.js` now validates the Scaling selector, physical/alchemy field visibility changes, note text updates, and the restored Docs alchemy entry.

## [0.2.16] — 2026-05-12

### Added
- **`test/ui.test.js`** — 18 new UI tests covering Docs tab structure and JS behaviour: dropdown element exists, physical/alchemy content visibility in HTML, no stray subnav button, dropdown change toggles both sections, both charts populate at init.
- **`test/smoke.test.js`** now included in `npm test`; fake DOM fixed to support `document.createElement` and persistent element identity so webview JS execution tests pass.

### Fixed
- **`bindLinks(null)` crash** — `bindLinks` in the webview JS now guards against a null root argument; this prevented webview JS from executing cleanly in test sandboxes.

## [0.2.15] — 2026-05-12

### Changed
- **Docs > Damage section** — replaced the separate "Offensive Alchemy" subnav button with a **Damage type** dropdown inside the Damage section (Physical / Offensive Alchemy). Physical is the default; selecting Offensive Alchemy switches to the spell-might + magic-defense interactive graph.

## [0.2.14] — 2026-05-12

### Added
- **Map-loading header tables** — expanded the room-loader docs with a byte-by-byte header table, a blob-region table, and a clearer separation between known fields and unknown header bytes.
- **Reverse-engineering next-step guidance** — added a concrete trace checklist for progressing the room-loader work, with emphasis on capturing the first 13 bytes and the first payload writes.

### Changed
- **Trigger-record caveat clarified** — the docs now state that the 6-byte step-on/B-trigger record layout matches the current in-repo model, while also being explicit that the external SoE tiles viewer C++ source was not freshly re-verified in this workspace.
- **Repo cleanup ignores generated artifacts** — `tmp/`, Python bytecode, and `tools/__pycache__/` are now ignored so slice outputs and cache files stop showing up as pending changes.

## [0.2.13] — 2026-05-12

### Added
- **Docs tab map-loading section** — added a grounded map-loading explainer covering the room-blob layout, the `LDA [$8B],Y` stream-read breakpoint, and the truncation evidence for how the payload turns into the final room picture.
- **Map-loading markdown doc** — added a dedicated docs file that records the current room-loader model and the confirmed Strong Heart exterior example.

### Changed
- **Room-data docs clarified** — the room data-block note now explicitly says that the bytes after the trigger tables are still-observed room payload, even though the exact codec is not fully decoded yet.

## [0.2.12] — 2026-05-12

### Added
- **Level-0 offensive alchemy preview** — the Scaling tab can now switch from physical attacks to offensive alchemy, plotting spell might against enemy `magic_defense` with the current `effective_mdef` model.
- **Docs tab alchemy section** — added an offensive alchemy explainer and interactive preview so the spell-might table and `magic_defense` subtraction are visible inside the extension.
- **Alchemy markdown doc** — added a dedicated docs file for the grounded offensive alchemy model, including the spell might table and the current level-0 range assumptions.

### Changed
- **Scaling and Docs wiring fixed** — restored the alchemy docs button to the Docs tab and removed duplicate hidden Scaling controls that were hijacking the chart bindings.
- **Alchemy placeholders narrowed** — route-planner copy now points at the remaining gap more honestly: route-grade spell-level / 8-cast modeling is still missing, but the per-cast level-0 preview exists.

## [0.2.11] — 2026-05-12

### Changed
- **Document alchemy damage inputs** — the scaling docs now describe the confirmed offensive alchemy inputs: enemy `magic_defense`, the `effective_mdef = max(0, 0x40 - magic_defense)` term, and the base-might table at ROM offset `0x45E6B`.
- **List vanilla alchemy might values** — added the per-spell might table to the docs, including the current caveat that exact charge / level scaling is still not fully traced.

## [0.2.3] — 2026-05-09

### Changed
- **Correct temp region boundary** — temp region is now `0x2834–0x28FF` (matching the linker's TEMP RAM definition in `main.evs`). Was incorrectly `0x2800–0x28FF`.
- **Remove static loot-function address extraction** — `_loot_chest`, `_loot`, `loot`, `retained_object` are dynamically allocated from the compiler memory pool; their call-site arguments do not indicate a fixed address. Removed the spurious write annotations.

### Added
- **T-shape layout** — sticky header (title, filters, region bars), left panel (grid, independent scroll), right panel (detail table, independent scroll). Clicking a grid cell scrolls both.
- **Multi-byte cursor selection** — clicking any cell now highlights ALL cells belonging to the same entry (e.g. all 35 bytes of `BOY_NAME`). Previously only the clicked cell got the cursor outline.
- **Word byte extension** — `Word`-typed entries with a single address in the memory map now automatically cover both bytes (`addr` and `addr+1`). Previously the second byte appeared as an undocumented gap.
- **Group color stripes** — cells belonging to the same multi-byte entry share a colored bottom-border stripe (10-color rotating palette), visually connecting bytes of the same entry across grid rows.

## [0.2.2] — 2025-05-09

### Added
- **Radar auto-update** — when you move the cursor to a different scope or switch to another `.evs` file, the open radar re-renders automatically. The `pin` button stops auto-update.
- **Cursor highlight in grid** — last-clicked cell gets a persistent white border (`.cursor`), separate from the hover highlight.
- **Multi-byte hover highlight** — hovering any cell in a multi-byte entry (e.g. `BOY_NAME` ×35, `FRAME_COUNTER_1` word) highlights all bytes in the entry, not just addr+1.
- **Emoji in cells** — `emoji` button overlays the entry’s first emoji (from name/notes) onto each 9×9 cell. Based on the memory-map emoji legend.
- **Emoji in popup/detail** — emoji shown alongside address in popup header and detail table addr column.
- **Boring row filter** — `boring` button hides rows where no cells are used in the current scope.
- **Follow mode** — `follow` button makes the detail table auto-scroll to the entry when a grid cell is selected.
- **Pin button** — `pin` button locks the radar to the current scope, stopping editor-driven auto-updates.
- **Detail table layout** — columns are now Addr / Name / T / Rgn / Notes / Lines. Line references in the last column jump to the editor. Clicking a row selects the grid cell (no jump to table by default; use `follow` mode).
- **Memory-map hover** — hovering a hex literal (e.g. `0x22d8`) in `.evs` code now shows the memory-map name, lifecycle, and an “Open Memory Radar” command link if the address is documented.
- **Lifecycle priority fix** — temp (0x2800–0x28FF) and session (0x2200–0x27FF) address ranges now take priority over the `[SRAM]` tag, so temp RAM documented as SRAM is correctly shown as temp.
- **Memory-map cache** — `memory-map.md` is parsed once and cached; cache is invalidated when the file changes.
- **Reuse panel** — `openMemoryRadar` reuses the existing panel instead of creating a new one each time.

## [0.2.1] — 2025-05-09

### Fixed
- **Lifecycle regions corrected** — `temp` is now `0x2800–0x28FF`, `session` is `0x2200–0x27FF`, `system` covers everything else (was using wrong threshold `addr < 0x2000`).
- **Radar HTML tags in tooltips** — memory-map notes that contain `<br>` or other HTML are now stripped before display.

### Added
- **System filter button** — new fifth filter to hide/show system-region addresses.
- **Click-to-popup detail panel** — click any lit cell to see structured Vanilla notes, Writes (destructive, red), and Reads (non-destructive, blue). Replaces tooltip-on-hover.
- **Read / write cell coloring** — cells used only as write targets render with a red inset shadow; cells used for both reads and writes render amber.
- **Word-byte pair highlighting** — hovering a `word`-type cell highlights the adjacent +1 byte cell.
- **`tools/snes9x_wram.py`** — macOS Mach VM prototype for reading live Snes9x WRAM. Use `--addr`, `--watch`, `--json` flags. See file header for usage and VS Code integration plan.
- **Filter hides empty rows** — `recomputeRows()` hides entire grid rows when all their cells are filtered out.

## [0.2.0] — 2026-05-09

### Added
- **Memory Radar merged in** — the standalone `everscript-memory-radar` extension is
  discontinued; its visualizer now lives in this extension.
- **`Everscript: Open Memory Radar` command** — opens a compact, sidebar-friendly WRAM
  visualizer beside the active `.evs` file. Accessible via right-click context menu or
  the `◉ Memory Radar` CodeLens shown above every `fun`/`map`/`area`/`group` declaration.
- **CodeLens** — `◉ Memory Radar` appears above each scope declaration for one-click access.
- **WRAM heatmap grid** — 9×9 px cells, 16 per row, covering the full documented address
  range. Color indicates lifecycle: blue = temp (`<0x2000`), amber = session, green = sram.
  Bright = used in current scope, dim = documented but unused, near-invisible = rest
  (undocumented). Hover tooltip shows address, name, type, and usage lines.
- **Region usage bars** — temp/session/sram each show `used/total (%)`.
- **Filter buttons** — toggle temp/session/sram/rest visibility independently. Rest is
  off by default (collapses entirely-undocumented rows).
- **Detail table** — lists every known address with addr, name, type, lifecycle chip, and
  clickable line numbers that navigate back to the usage site in the editor.
- **Bidirectional navigation** — click a grid cell to jump to its detail table row; click
  a line number in the table to reveal that line in the source editor.
- Reads `.github/memory-map.md` from the workspace root for ground-truth address data.

### Notes on WRAM addresses
Addresses in `memory(0xADDR)` and `<0xADDR>` are treated as absolute 16-bit WRAM
addresses (bank `$7E` implied). No offset arithmetic is applied by the parser.

### Snes9x live-memory feasibility
Theoretically possible on macOS via `task_for_pid()` + `mach_vm_read()` (Mach kernel
API), the same mechanism Cheat Engine uses. Requires a native Node.js C++ addon and
appropriate process entitlements — not implementable in pure JS from a VS Code extension.
A future milestone could ship a small helper binary for this.

## [0.1.5] — 2026-05-08

### Changed
- **Annotations redesigned to P5 amber bold** — `@install`, `@inject`, `@async` etc.
  are now rendered in bold amber (`#FF9900`) instead of lilac. Rationale: they are
  ROM linker directives that specify the exact byte offset where code is placed;
  semantically equivalent to `<0x1234>` address literals.
- **`<NAME>` entity refs are now all-amber** — the identifier inside `<BOY>` was
  previously teal (P2); now amber (P5) so the whole `<BOY>` construct reads as one
  cohesive hardware-access token.
- **`object[n]` / `arg[n]` brackets now amber** — `[` and `]` get scope
  `punctuation.section.accessor.evs` → amber, completing the accessor construct.
- **P6 is now preprocessor-only** — `#memory`, `#include`, `#patch` remain lilac.
  Annotations are no longer grouped with preprocessor.
- **Theme structural corruption fixed** — a duplicate orphaned `tokenColors` section
  that existed outside the valid JSON root has been removed. Several scopes (labels,
  `variable.language.evs` italic) were previously dead code in that section.

### Added
- **Binary number highlighting** — `0b1010` tokens now get scope
  `constant.numeric.binary.evs` → light green (P8), matching hex and decimal.
- **Annotation argument coloring** — `@install(0x99aac0)` now colors the `(` and `)`
  amber too; address/number/enum arguments inside are tokenised correctly.

## [0.1.4] — 2026-05-08

### Added
- **Number hover** — hovering `0xFF`, `0d99`, or `0b1010` shows the value in hex,
  decimal, and binary plus the byte size inferred from the digit count.
- **Unqualified enum member hover** — hovering a bare `SOUTH`, `ACT4_DOOR_OPENING`,
  etc. now shows the parent enum name, value, and (when unambiguous) the full
  enum listing with the matched member highlighted.
- **Dead branch dimming** — `if(False)`, `if!(True)`, and `if(ENUM.MEMBER)` / 
  `if!(ENUM.MEMBER)` where the member value is 0 or non-zero respectively are
  detected at document open/edit and the unreachable block is rendered at 35% opacity.

### Fixed
- **Declaration name hover conflict** — hovering the name in `enum entrance {` or
  `fun entrance(...)` no longer shows the `entrance()` function tooltip.
- **Accessor hover conflict** — hovering `object` in `object[door_id]` no longer
  shows the `object()` function tooltip; same for `arg`, `script`, and `time`.
- **Unqualified SOUND members** — enum members used without their prefix (e.g.
  `ACT4_DOOR_OPENING`) now show a tooltip via the reverse member lookup.

## [0.1.3] — 2026-05-08

### Added
- **Go-to definition** (`F12` / cmd+click) — jumps to the `fun`, `map`, `area`,
  `group`, `enum`, or `val` declaration for any identifier in the workspace.
  Also resolves `#include("path")` to the included file.
- **Find all references** (`Shift+F12`) — finds every occurrence of a function
  or variable name across all `.evs` files in the workspace.
- **Workspace index** — all `.evs` declarations are indexed on activation and
  kept live via a file watcher (creates/changes/deletes).
- **Function name completions** — typing any identifier now offers all 521 core
  and native functions as completions with full parameter snippets.
  e.g. `transition` expands to `transition(${1:map}, ${2:x}, ${3:y}, ...)`.
  User-defined workspace functions are also included.
- **Enum name completions** — all 111 enum types appear in the completion list.

---

## [0.1.2] — 2026-05-08

### Added
- **Hover documentation** — hover over any function name to see its full signature
  and whether it is a native (compiler built-in) or core library function.
  Hover over an enum name to see all its members with values and comments.
  Hover over `ENUM.MEMBER` to see the specific member value.
  Hover over special identifiers (`BOY`, `LAST_ENTITY`, `NORTH`, `True`, …)
  to see a plain-English description.
- **Enum member completion** — typing `DIRECTION.` or any `ENUM.` triggers a
  completion list of all members with values. Typing `@` suggests annotation names.
- **Document symbols (Outline panel)** — `fun`, `map`, `area`, `group`, `enum`,
  and `val` declarations appear in the Outline panel and breadcrumbs.
- **Snippets** — `fun`, `map`, `area`, `group`, `enum`, `if`, `if!`, `ife`,
  `while`, `while!`, `for`, `val`, `var`, `#memory`, `#include`, `@install`,
  `@inject`, `@async`, `transition`, `sleep`, `conversation`, `add_enemy`.
- **Problem matcher** (`everscript`) — register in a `.vscode/tasks.json` task to
  get compiler errors in the Problems panel with clickable file/line links.
- **Task definition** (`everscript`) — task type for future build task support.
- `code_highlighter/data/index.json` — 521 function signatures and 111 enum definitions extracted
  from the core library (regenerate with `python3 tools/generate_data.py`).
- `tools/generate_data.py` — data extraction script for dev use.

---

## [0.1.1] — 2026-05-08

### Added
- `.github/copilot-instructions.md` — global agent rules for the plugin repo
  (version bump ritual, file map, test format reference, colour theme policy)
- `docs/future-features.md` — full roadmap: hover docs, auto-completion, diagnostics,
  go-to-definition, signature help, LSP server plan, priority stack

---

## [0.1.0] — 2026-05-08

### Added
- Initial release
- TextMate grammar for `.evs` files (`source.evs`)
- Language configuration (bracket matching, comment toggle, word pattern)
- Bundled Everscript Dark colour theme
- Highlights: keywords, declarations, types, booleans, numbers (hex + 0d-decimal),
  memory addresses, memory ranges, enum access, annotations, preprocessor directives,
  built-in functions, core library functions, user function calls, special identifiers,
  label destinations, operators, strings with in-string placeholders
