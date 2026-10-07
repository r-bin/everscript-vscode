# emulator/ — Embedded SNES Emulator

Embedded snes9x2005 WASM emulator panel integrated into VS Code.

## Files

| File | Description |
|---|---|
| `panel.js` | WebviewPanel host: loads core WASM, dispatches ROMs, forwards messages |
| `panel-webview.js` | Webview HTML generator for the emulator panel |
| `snes-rom-header-model.js` | SNES ROM header parser |
| `webview/index.html` | Emulator webview entry HTML |
| `cdl-view.js` | CDL bottom-bar tab: record toggle, ROM + WRAM strips, last-flush snapshot, Asar/WRAM export, xref lookup |
| `cdl-strips.js` | CDL tab strips: per-chunk painting and hover descriptions |
| `cdl-float.js` | Scrolling-combat-text style floating coverage gains above the active character |
| `cdl/` | CDL library, xref index, 65816 disassembler, Asar + `ram.asm` export (see `cdl/README.md`) |
| `tas-view.js` | REPLAYS bottom-bar tab, input overlay, per-frame joypad feed (`tasApplyInput`) and session recording buffer |
| `fps-meter.js` | Screen chip: frames emulated per second and frames the game read input in (lag), frozen while paused |
| `tas/` | Input recordings: `.evsmv` format, recording files, replay list and pins (see `tas/README.md`) |
| `core/snes9x2005-wasm/` | Custom emulator core (git submodule) |
| `core/snes9x2005-wasm-vanilla/` | Vanilla emulator core (git submodule) |

## Core Path Remapping

`panel.js` defines `LEGACY_CUSTOM_CORE_DIRS` to remap any user-configured paths from:
- `debugger/core/snes9x2005-wasm` (pre-v0.6.0 location)
- `src/emulator/core/snes9x2005-wasm` (current location)

## Dependency Rules

- May depend on `../shared/`
- No dependency on `../memory/`, `../rooms/`, or `../debugger/`
