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

## Extended map: what it follows

The layers drawn round the screen (map, entities, foreground) read the engine's
own state each frame (`samplePreLoopState` in `panel-webview.js`):

| WRAM | What | Used for |
|---|---|---|
| `$7E0112/$0114` | BG2 (terrain) scroll shadow = camera (V is camera - 1) | map, entities, triggers |
| `$7E010E/$0110` | BG1 (canopy) scroll shadow | parallax: room effect 2 (`$D09BA7`: BG1 = camera x `$22FA`/16 + `$241B`; Podunk 1965, jungles, dark forest) and the Oglin cave lantern feed BG1 from elsewhere. Once BG1 leaves the camera the host sends each layer split by priority (`renderRoomLayers`) and the webview draws BG2.0, BG1.0 / sprites / BG2.1, BG1.1 at their own scrolls. Animated cells keep their first frame there. |
| `$7E0106` | INIDISP shadow (bit 7 forced blank, low nibble brightness) | room loads, `fade_in()`/fade out, dying: CSS brightness on the extended canvases |
| `$7E6187` | CGRAM mirror, 512 bytes | BG half vs the room palette gives the ring menu's dimming (it halves the colours, no colour math); OBJ half is what entity sprites are coloured from (slot `+0x0C`, chunk palette bits add 1) |

`#` toggles speed-up (4 frames per display frame, the TAS replay path).

## Core Path Remapping

`panel.js` defines `LEGACY_CUSTOM_CORE_DIRS` to remap any user-configured paths from:
- `debugger/core/snes9x2005-wasm` (pre-v0.6.0 location)
- `src/emulator/core/snes9x2005-wasm` (current location)

## Dependency Rules

- May depend on `../shared/`
- No dependency on `../memory/`, `../rooms/`, or `../debugger/`
