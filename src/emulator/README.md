# emulator/ — Embedded SNES Emulator

Embedded snes9x2005 WASM emulator panel integrated into VS Code.

## Files

| File | Description |
|---|---|
| `panel.js` | WebviewPanel host: loads core WASM, dispatches ROMs, forwards messages; `configureEmulator` (profile, title, CDL tools, bundle button, reopen last ROM); keeps the page's settings in `globalState` |
| `panel-webview.js` | Webview HTML generator for the emulator panel |
| `webview/rom-game.js` | `detectEvermore(rom)`: header title + destination of Secret of Evermore (U); loaded by the page as a file and by node |
| `webview/emulator-profile.js` / `.css` | The page's profile and game gating (`data-needs`), saved settings (overlays, mute, keybinds, panel placement), Keep Focus for Tab |
| `webview/emulator-panels.js` / `.css` | Where each panel is shown: its pause-menu tab, a side bar over the picture, the bottom bar or nowhere (README "Panels") |
| `bundle-commands.js` | Export (recorder) and import (Everscript) of recording bundles: dialogs, which library, which replays |
| `snes-rom-header-model.js` | SNES ROM header parser |
| `webview/index.html` | Emulator webview entry HTML |
| `cdl-view.js` | CDL panel: record toggle, ROM + WRAM strips, last-flush snapshot, Asar/WRAM export, xref lookup |
| `cdl-strips.js` | CDL panel strips: per-chunk painting and hover descriptions |
| `cdl-float.js` | Scrolling-combat-text style floating coverage gains above the active character |
| `cdl/` | CDL library, xref index, 65816 disassembler, Asar + `ram.asm` export (see `cdl/README.md`) |
| `tas-view.js` | REPLAYS pause-menu tab (this ROM's recordings) and its REC / PLAY / DESYNC chip on the screen, input overlay, per-frame joypad feed (`tasApplyInput`) and session recording buffer |
| `webview/replays-list.js` | The REPLAYS tab's rows (when, length, sync; no file name) and their keys: Left / Right choose favourite / play / delete, B does it, play and delete ask first |
| `script-debug-host.js` / `script-debug-view.js` | VS Code debugger hook: host bridge (outlives the panel) and webview exec breakpoint on the interpreter fetch `$8C:D0A6` (see `src/debugger/README.md`) |
| `apu-stream.js` / `apu-stream-view.js` | Sound-chip stream for the radar's Music tab: host side (on/off, frame listener, ARAM snapshots) and page side (posts the core's `getApuView` + package + voice samples after each frame while on). See `src/music/README.md` |
| `sound-source-view.js` | Page side, with the SOUNDS chip: while it is on or the Music tab streams, a non-pausing exec breakpoint at `$8C:81FD` records who sent each sound effect (an animation's entity, a script, engine code) into the next frame, and rings that entity on the screen; `apuPoint` marks the entity the Music tab hovers. Pause changes are posted as `apuPaused` |
| `fps-meter.js` | Screen chip: frames emulated per second and frames the game read input in (lag), frozen while paused |
| `tas/` | Input recordings: `.evsmv` format, recording files, replay list and pins (see `tas/README.md`) |
| `core/snes9x2005-wasm/` | Custom emulator core (git submodule) |
| `core/snes9x2005-wasm-vanilla/` | Vanilla emulator core (git submodule) |

## Profiles and games

Two extensions open this panel. `src/extension.js` configures the **full** profile (every tab,
the CDL exports and lookups through `cdl/tools.js`); `src/recorder/extension.js` the
**recorder** profile (SNES CDL Recorder: CDL in the left side bar and recording, REPLAYS in the
pause menu, the last ROM reopens, "export bundle" in the CDL tab). The profile reaches the page as data (`#emu-config`).

Per ROM, `emuGateRom` (`webview/emulator-profile.js`, at every boot) decides whether it is
Secret of Evermore (U) or built on it (`detectEvermore`: header title and destination, any
layout; `src/localizations/knowledge/rom/00ffc0.md`). Only then: the overlays, VIEW's room and
coordinates, the inspector click, OBJECTS / LOOT / CHEATS, the sound-source hook, the floating
CDL gains, Start opening the menu; and in the full profile the script stack hook, the trace and
the `.evs` debugger hook (`emuScriptHook`), and TRACE / STACK / ENTITIES / ALCHEMY / PALETTES.
Markup says what it needs with `data-needs="full|recorder|evermore"` (several words: all must
hold); `webview/emulator-profile.css` hides it. A hidden pause-menu tab hands over to the first
shown one; a hidden panel leaves its side bar or bottom-bar tab (its placement is kept).

Everything optional starts off. The page sends its settings (`saveEmuSettings`: the overlay
toggles, Master Audio mute, keybinds, where each panel is shown) and gets them back on open
(`emuSettings`); Keep Focus and the CDL switch are kept by the host. Zoom, speed, panel height
and tabs are not saved.

## Panels

CDL, TRACE, STACK, ENTITIES, ALCHEMY and PALETTES are panels (`#ss-view-<name>`), placed by
`webview/emulator-panels.js`. Each has a pause-menu tab that shows it in full, with a
"Show while playing" row: hidden, left side bar, right side bar or bottom bar.

- A side bar is drawn over the picture, as narrow as its content and at most a third of the
  screen, in a compact read-only form (`emulator-panels.css`: no buttons, filters, legend or
  lookup, fewer columns). One panel per side: placing another one there hides the first.
  Side bars are hidden while the menu is open.
- The bottom bar has a tab for each panel placed there. With none there is no bottom bar.
- A panel is one element, moved (never copied) into the open menu tab and back, so its update
  code does not care where it is. Per-frame work asks `emuPanelVisible(name)`.
- REPLAYS is a menu tab only, with the usual card size (not a panel). It lists the recordings
  with this ROM's SHA-256 (the host's `romMatch`), one menu row each; playing one closes the
  menu, then reboots. Whether a recording replays in sync is written into it (`tas/README.md`). The chip at the top of the screen
  (REC / PLAY / DESYNC) opens the menu on REPLAYS.
- Defaults: CDL on the left, everything else hidden (both profiles; the recorder also records).

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

## Rules for changing this folder

Dependencies, invariants and tests: [AGENTS.md](AGENTS.md).


`softReset()` (core export, EVS_TAS builds): the console reset button; recorded in movies as `R|soft` (`tas/README.md`).
