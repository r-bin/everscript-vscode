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
| `script-debug-host.js` / `script-debug-view.js` | VS Code debugger hook: host bridge (outlives the panel) and webview exec breakpoint on the interpreter fetch `$8C:D0A6` (see `src/debugger/README.md`) |
| `apu-stream.js` / `apu-stream-view.js` | Sound-chip stream for the radar's Music tab: host side (on/off, frame listener, ARAM snapshots) and page side (posts the core's `getApuView` + package + voice samples after each frame while on). See `src/music/README.md` |
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
| PPU (`_getPpuView`) | CGRAM, INIDISP, TM, TS, CGWSEL, CGADSUB as the coming frame renders them | fades (room loads, `fade_in()`, dying), the ring menu's dimming (it halves CGRAM, no colour math: BG half vs the room palette), sprite colours (OBJ half, slot `+0x0C`, chunk palette bits add 1), title cards (TM `0x04`: BG1/BG2 off, so the extension shows the backdrop) |
| `$7E0106`, `$7E6187` | INIDISP shadow, CGRAM mirror | fallback when the core has no `_getPpuView`. Both run ahead of the picture: the mirror reaches CGRAM a frame later through the upload queue |
| `$7E241F` | room effect | effect 2 also places plane-0 characters against BG1's scroll (`$8FC7E8`) |

Entities: every one in the active list `$7E3DDF` and the inactive list `$7E3DE1` (the engine parks entities there while they are away from the screen) is drawn (the engine has no "invisible" flag; `+0x10` bit 5 only marks scripted actors), the main sprite `+0x06` unless `+0x12` bit 15, the shadow `+0x09` unless bit 14. Room spawns exist from the enter script on, but one the camera has not reached yet has never run its animation (sprite pointer 0); it is drawn in its record's standing frame (`requestIdleSprites` → `resolveCharacterSprite`, facing `+0x22`) so it does not pop in at the screen edge.

`#` toggles speed-up (4 frames per display frame, the TAS replay path).

## Core Path Remapping

`panel.js` defines `LEGACY_CUSTOM_CORE_DIRS` to remap any user-configured paths from:
- `debugger/core/snes9x2005-wasm` (pre-v0.6.0 location)
- `src/emulator/core/snes9x2005-wasm` (current location)

## Dependency Rules

- May depend on `../shared/`
- No dependency on `../memory/`, `../rooms/`, or `../debugger/`
