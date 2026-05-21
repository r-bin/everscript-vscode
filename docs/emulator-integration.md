# Emulator Integration — Status Log

> Updated continuously as the integration progresses.

## Goal

Embed a fully working SNES emulator in the VS Code webview panel
(`Everscript: Open Emulator Panel`) so the developer can:

1. Load a ROM (Secret of Evermore) from the workspace.
2. Play with keyboard input captured inside VS Code.
3. Later: expose WRAM stream to the Memory Radar + Call Log.

---

## Candidate Approach

### A — EmulatorJS (current attempt)

| | |
|-|-|
| **Repo** | https://github.com/EmulatorJS/EmulatorJS |
| **License** | LGPL-2.1 (framework); GPL-3 for libretro cores |
| **SNES core** | snes9x (libretro) |
| **Pre-built WASM** | Included in `data/cores/` directory |
| **API** | Simple — `EJS_player`, `EJS_gameUrl`, `EJS_core`, `EJS_pathtodata` |

#### Why chosen over ares

ares has no official WASM build.  Compiling it with Emscripten requires:
- Emscripten 3.x toolchain
- Full C++ build environment
- ~30-minute compile time

EmulatorJS has pre-built WASM for snes9x that runs in any Chromium context —
including VS Code's sandboxed webview.

---

## Integration Architecture

```
VS Code webview
  ├── emulator/vendor/emulatorjs/
  │     ├── loader.js         (EmulatorJS framework entry point)
  │     ├── emulator.min.js   (runtime)
  │     └── cores/
  │           ├── snes9x_libretro.js   (JS glue)
  │           └── snes9x_libretro.wasm (binary core ~4 MB)
  ├── emulator/webview/player.html     (panel HTML)
  └── emulator/panel.js                (VS Code side: panel + ROM picker)
```

### VS Code side

`panel.js` creates the webview panel with:
- `localResourceRoots: [vscode.Uri.file(extensionPath)]` — allows loading
  all files under the extension directory.
- `enableScripts: true`
- CSP: `script-src 'nonce-xxx' 'wasm-unsafe-eval'` — required for WASM.

### ROM loading

1. User clicks "Load ROM" in the panel toolbar.
2. `panel.js` opens a VS Code file picker.
3. Selected ROM file is read with `fs.readFileSync` and sent to the webview as
   a Base64 `data:` URL via `postMessage`.
4. EmulatorJS receives it as `EJS_gameUrl = dataUrl`.

---

## Status

| Step | Status | Notes |
|------|--------|-------|
| Design doc created | ✅ Done | This file |
| EmulatorJS cloned to `tmp/emulatorjs/` | ⏳ In progress | |
| SNES core files copied to `emulator/vendor/` | ⏳ Pending | |
| `player.html` created with EmulatorJS embed | ⏳ Pending | |
| `panel.js` updated (localResourceRoots, ROM Base64) | ⏳ Pending | |
| ROM loads and game runs | ⏳ Pending | |
| Keyboard input confirmed working | ⏳ Pending | |
| WRAM streaming stub added | ⏳ Pending | Phase 2 |

---

## Known VS Code Webview Constraints

| Constraint | Impact | Workaround |
|-----------|--------|-----------|
| `wasm-unsafe-eval` required | WASM won't run without it | Add to CSP meta tag |
| No external URL fetch | Can't load from CDN | Bundle files locally |
| `localResourceRoots` scope | Files outside roots are 403 | Include `extensionPath` |
| Web Worker restrictions | Some cores use Workers | Test; use `noWorker` flag if needed |
| AudioContext needs user gesture | Audio might be muted | Trigger on first key press |
| `SharedArrayBuffer` unavailable | May affect WASM threading | Use single-threaded build |

---

## Fallback Plan (if EmulatorJS fails)

1. **snes9x via Emscripten build**: Download pre-built `.js` + `.wasm` from
   the RetroArch buildbot (`https://buildbot.libretro.com/nightly/emscripten/`).
   Write a minimal libretro frontend in JS (~200 lines).

2. **ares compiled from source**: Requires Emscripten toolchain.  Document
   exact build steps for future.  Time estimate: 1–2 hours to compile.

---

## Next Steps (after working)

1. Post WRAM deltas via `vscode.postMessage` to the extension host.
2. Feed deltas into Memory Radar live mode.
3. Feed call events into Call Log module.
4. Add pause/resume button to sync with the DAP debugger.
