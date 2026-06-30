# emulator/ — Embedded SNES Emulator

Embedded snes9x2005 WASM emulator panel integrated into VS Code.

## Files

| File | Description |
|---|---|
| `panel.js` | WebviewPanel host: loads core WASM, dispatches ROMs, forwards messages |
| `panel-webview.js` | Webview HTML generator for the emulator panel |
| `room-script-model.js` | Everscript room script opcode parser and interpreter |
| `opcode-registry.js` | Opcode table and metadata |
| `snes-rom-header-model.js` | SNES ROM header parser |
| `webview/index.html` | Emulator webview entry HTML |
| `core/snes9x2005-wasm/` | Custom emulator core (git submodule) |
| `core/snes9x2005-wasm-vanilla/` | Vanilla emulator core (git submodule) |

## Core Path Remapping

`panel.js` defines `LEGACY_CUSTOM_CORE_DIRS` to remap any user-configured paths from:
- `debugger/core/snes9x2005-wasm` (pre-v0.6.0 location)
- `src/emulator/core/snes9x2005-wasm` (current location)

## Dependency Rules

- May depend on `../shared/`
- No dependency on `../memory/`, `../rooms/`, or `../debugger/`
