# Web-Based SNES Emulator Integration Plan

## Goal

Embed a SNES emulator directly inside VS Code as a webview panel so that:

1. The developer can launch the game from VS Code without switching windows.
2. The emulator can be paused / stepped by the EVS debugger.
3. Keyboard input works reliably inside the webview.
4. The emulator can stream WRAM state back to the extension host.

## 2026-05-22 Direct-Core Follow-up

Status on the direct `snes9x2005-wasm` webview runtime:

- Fixed: script-stack write hook now uses full `$7Exxxx` bus addresses when arming debugger breakpoints.
- Fixed: audio resume path now runs from user interaction and after ROM load so VS Code webview autoplay suspension does not keep the core muted.
- Fixed: screen canvas scaling now uses explicit transform-based fit-to-panel logic instead of relying on a single CSS size calculation.

Correction after validating the custom debugger source:

- `addWriteBreakpoint()` expects a WRAM offset, not a `$7E` bus address. The emulator panel was updated accordingly.
- Added hook logs for arm/disarm, bridge install, and polled script-slot byte changes so the output channel shows hook activity while testing.
- Audio integration now matches the core's actual buffer contract: `Float32` planar audio with 2048 samples per channel.

---

## Candidate Emulators — Ranked

Rankings are based on four criteria:

| Criterion | Weight |
|-----------|--------|
| License (can be legally bundled in a VS Code extension) | 35% |
| WASM/browser portability (existing web build) | 30% |
| SNES accuracy (correct enough for SoE scripting tests) | 20% |
| Debuggability (expose VM state / memory hooks) | 15% |

---

### 1. ares (formerly bsnes) ★★★★★

| | |
|-|-|
| **Repo** | https://github.com/ares-emulator/ares |
| **License** | MIT — legally cleanest, can be bundled in any extension |
| **Web build** | Community WASM ports exist; official WebAssembly target in progress |
| **Accuracy** | Cycle-accurate SNES; highest accuracy of any available emulator |
| **Debug API** | Memory hooks available in C++ core; WRAM read/write callbacks |
| **Size** | ~8 MB WASM |

**Why it wins**: MIT license means zero legal friction.  Bundling it in the
extension or distributing it alongside is fully permitted.  Highest accuracy
ensures that SoE scripting tests reproduce exactly what real hardware does.

**Barrier**: No official pre-built WASM distributable yet; requires an
Emscripten build from source.

---

### 2. Snes9x ★★★★☆

| | |
|-|-|
| **Repo** | https://github.com/snes9xgit/snes9x |
| **License** | Custom "non-commercial" open-source license — free for non-commercial distribution; **NOT** OSI-approved, but compatible with a free VS Code extension |
| **Web build** | Several community WASM builds (snes9x-wasm on GitHub); no official build |
| **Accuracy** | Very high; best ROM compatibility in practice |
| **Debug API** | Memory read/write hooks in C++ core |
| **Size** | ~4–6 MB WASM |

**Why it is good**: Most ROMs (including SoE) run perfectly.  Multiple community
WASM forks to build from.  Smaller binary than ares.

**Barrier**: Non-commercial license clause requires legal review if the
extension is ever monetized.  No officially maintained WASM build.

---

### 3. Mesen2 ★★★☆☆

| | |
|-|-|
| **Repo** | https://github.com/SourMesen/Mesen2 |
| **License** | GPL-3.0 — copyleft; the extension itself would need to be GPL if it bundles Mesen |
| **Web build** | None currently; C# + C++ codebase, non-trivial Emscripten port |
| **Accuracy** | Highest for NES/SNES; has a built-in debugger with memory breakpoints |
| **Debug API** | Excellent — designed for debugging; has Lua scripting |
| **Size** | Unknown (no WASM build) |

**Why it is attractive**: The built-in debugger would align perfectly with the
EVS debugger goals.  Memory breakpoints are already implemented.

**Barrier**: No WASM build.  GPL-3 copyleft requirement is a significant
legal barrier for a mixed-license extension.

---

### 4. RetroArch / libretro ★★★☆☆

| | |
|-|-|
| **Repo** | https://github.com/libretro/RetroArch |
| **License** | GPL-3.0 (same copyleft issue as Mesen2) |
| **Web build** | Yes — https://web.libretro.com runs WASM cores; snes9x_libretro and bsnes_libretro cores available |
| **Accuracy** | Core-dependent (same as underlying emulator) |
| **Debug API** | No built-in memory hooks; depends on core |
| **Size** | ~5–10 MB WASM per core |

**Why it is good**: The web player at web.libretro.com is a ready-made proof of
concept.  Embedding via iframe is the fastest path to a working POC.

**Barrier**: GPL-3 license.  iframe embedding inside VS Code webviews requires
loosened CSP and is fragile against upstream changes.

---

### 5. JSNES / JSSNES ★★☆☆☆

| | |
|-|-|
| **Repo** | Various (jsnes, snes-emu-js, etc.) |
| **License** | Varies (MIT or GPL) |
| **Web build** | Yes — pure JavaScript |
| **Accuracy** | Low to medium; toy implementations |
| **Debug API** | None or minimal |

**Not recommended** for this project.  Low accuracy would cause SoE scripts to
behave differently from real hardware.

---

## Recommendation

**Short term (POC)**: Use the **RetroArch web player** via iframe to prove that
keyboard input works in a VS Code webview.  This requires no compilation.

**Medium term (v0.3.x)**: Build **Snes9x** to WASM using Emscripten and bundle
the `.wasm` + JS glue in the extension.  Snes9x has the best compatibility and
the community builds show it is feasible.

**Long term (v1.x)**: Switch to **ares** once an official WASM build is
available.  MIT license is the cleanest path and cycle accuracy matters for
subtle SoE timing bugs.

---

## VS Code Webview Architecture

```
VS Code extension host
  ↕ postMessage API
Webview (Chromium iframe)
  ├── emulator.js / emulator.wasm  — the SNES core
  ├── canvas#screen                — video output (512×448 or 256×224)
  ├── AudioContext                 — audio output
  └── keyboard event listeners     — SNES controller input
```

### Keyboard input considerations

VS Code intercepts many key combinations at the window level before they reach
the webview.  Known intercepted keys:

| Key | VS Code action | Workaround |
|-----|----------------|------------|
| Escape | Close panel / cancel | Use `tabindex` + `preventDefault` in webview |
| F5 | Start debugging | Conflicts with SNES reset; remap to Shift+F5 |
| Ctrl+C/V | Clipboard | Captured only when webview has focus |
| Arrow keys | Editor navigation | Safe when webview canvas has focus |

**Solution**: Give the canvas element `tabindex="0"` and call `canvas.focus()`
on click.  Use `e.preventDefault()` on `keydown` inside the webview to prevent
VS Code keybinding propagation.

### WRAM streaming back to extension host

The emulator's JavaScript memory buffer is directly accessible in the webview.
A simple `setInterval` every 16 ms reads the WRAM region (128 KB at the fixed
emulator offset) and posts a delta to the extension host:

```js
const WRAM_OFFSET = 0x7e0000;  // SNES bus address
setInterval(() => {
    const view = new Uint8Array(emulator.memory.buffer, WRAM_OFFSET, 0x20000);
    vscode.postMessage({ command: 'wramDelta', data: Array.from(view.slice(0x2200, 0x2900)) });
}, 16);
```

The extension host passes the delta to the existing `snes9x_wram.py` pipeline
(or replaces it entirely for platforms that do not support Mach VM reads).

---

## Legal Summary

| Emulator | Bundle in extension | Distribute via Marketplace |
|----------|--------------------|-----------------------------|
| ares (MIT) | Yes | Yes |
| Snes9x (custom) | Yes (non-commercial) | Yes (as long as extension is free) |
| Mesen2 (GPL-3) | Only if extension is GPL | Only if extension is GPL |
| RetroArch (GPL-3) | Only if extension is GPL | Only if extension is GPL |

> **Note**: The ROM file (Secret of Evermore) is copyrighted by Square.  The
> extension will never bundle or automatically load the ROM.  The user must
> supply the ROM themselves.

---

## Phase Plan

| Phase | Deliverable | Target version |
|-------|-------------|----------------|
| POC | Keyboard test webview (canvas + key log) | v0.2.50 (this commit) |
| POC-2 | RetroArch iframe embed with ROM picker | v0.2.51 |
| Alpha | Snes9x WASM bundled, ROM loaded from workspace | v0.3.0 |
| Beta | WRAM streaming → Memory Radar live mode | v0.3.x |
| v1 | ares WASM + full debugger integration | v1.0 |
