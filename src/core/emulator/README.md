# emulator/ — Embedded SNES Emulator

Embedded snes9x2005 WASM emulator panel integrated into VS Code.

## Files

| File | Description |
|---|---|
| `panel.js` | WebviewPanel host: loads core WASM, dispatches ROMs; `configureEmulator` (profile, title, CDL tools, bundle button, reopen last ROM); the API the extension calls |
| `panel-state.js`, `panel-messages.js` | The panel's state and helpers (settings in `globalState`, timeouts, ROM offer); every message the page sends |
| `core-path.ts`, `emulator-log.ts` | Which core loads; the output channels and the crash report |
| `panel-webview.js` | Webview HTML generator for the emulator panel |
| `webview/emulator-profile.js` / `.css` | The page's profile and game gating (`data-needs`), saved settings (overlays, mute, keybinds, panel placement), Keep Focus for Tab |
| `webview/emulator-panels.js` / `.css` | Where each panel is shown: its pause-menu tab, a side bar over the picture, the bottom bar or nowhere (README "Panels") |
| `bundle-commands.js` | Export (recorder) and import (Everscript) of recording bundles: dialogs, which library, which replays |
| `cdl-view.js` | CDL panel: record toggle, ROM + WRAM strips, last-flush snapshot, Asar/WRAM export, xref lookup |
| `cdl-strips.js` | CDL panel strips: per-chunk painting and hover descriptions |
| `cdl-float.js` | Scrolling-combat-text style floating coverage gains above the active character |
| `cdl/` | CDL library, xref index, 65816 disassembler, Asar + `ram.asm` export (see `cdl/README.md`) |
| `tas-view.js` | REPLAYS pause-menu tab (this ROM's recordings) and its REC / PLAY / DESYNC chip on the screen, input overlay, per-frame joypad feed (`tasApplyInput`) and session recording buffer |
| `webview/replays-list.js` | The REPLAYS tab's rows (when, length, sync; no file name) and their keys: Left / Right choose favourite / play / delete, B does it, play and delete ask first |
| `script-debug-host.ts` | VS Code debugger hook, host bridge (outlives the panel); its page side is Evermore's `games/evermore/emulator/script-debug-view.js` (exec breakpoint on the interpreter fetch `$8C:D0A6`, see `src/games/evermore/debugger/README.md`) |
| `apu-stream.js` / `apu-stream-view.js` | Sound-chip stream for the radar's Music tab: host side (on/off, frame listener, ARAM snapshots) and page side (posts the core's `getApuView` + package + voice samples after each frame while on). See `src/games/evermore/music/README.md` |
| (Evermore) | `games/evermore/emulator/`: `overlays-view.js` (screen layer), `stack-view.js` (STACK, TRACE), `script-debug-view.js`, `sound-source-view.js` (who sent each sound effect, the SOUNDS chip), `menu-tabs.js`, `bottom-bar-views.js`: handed in through `host.js` `webview()` |
| `fps-meter.js` | Screen chip: frames emulated per second and frames the game read input in (lag), frozen while paused |
| `tas/` | Input recordings: `.evsmv` format, recording files, replay list and pins (see `tas/README.md`) |
| `core/snes9x2005-wasm/` | Custom emulator core (git submodule) |
| `core/snes9x2005-wasm-vanilla/` | Vanilla emulator core (git submodule) |

## Profiles and games

Two extensions open this panel. `src/extension.js` configures the **full** profile (every tab,
the CDL exports and lookups through `cdl/tools.ts`); `src/recorder/extension.js` the
**recorder** profile (SNES CDL Recorder: CDL in the left side bar and recording, REPLAYS in the
pause menu, the last ROM reopens, "export bundle" in the CDL tab). The profile reaches the page as data (`#emu-config`).

Per ROM, `emuGateRom` (`webview/emulator-profile.js`, at every boot) decides whether the ROM is
the game's (`emuGameRom`, from the game's `gameDetectRom`; Evermore: Secret of Evermore (U) or built on it, its page file
`games/evermore/emulator/webview/rom-game.js`, handed in by `host.js` `webviewFiles()`: header title and
destination, any layout; `src/games/evermore/localizations/knowledge/rom/00ffc0.md`). Without a game (the
recorder) no ROM is. Only then: the overlays, VIEW's room and
coordinates, the inspector click, OBJECTS / LOOT / CHEATS, the sound-source hook, the floating
CDL gains, Start opening the menu; and in the full profile the script stack hook, the trace and
the `.evs` debugger hook (`emuScriptHook`), and TRACE / STACK / ENTITIES / ALCHEMY / PALETTES.
Markup says what it needs with `data-needs="full|recorder|game"` (several words: all must
hold); `webview/emulator-profile.css` hides it. A hidden pause-menu tab hands over to the first
shown one; a hidden panel leaves its side bar or bottom-bar tab (its placement is kept).

The game's part of the page comes from `configureEmulator({ game })`: `game.webviewFiles()` (page files
loaded first; Evermore: its detector and `EvsRom`, the host's sprite and record readers bundled from TypeScript by
`tools/bundle-pages.mts` into `dist/webview/`) and `game.webview()` (markup, CSS and scripts spliced into the page,
each where the emulator's own code once ran: bottom bar, menu tabs 1-4, screen layer, script VM). The page
itself and every part are real files (`webview/page.html`, `page-style/`, `page/`, `menu-style/`, the views' `webview/` folders),
put together by `core/webview/page-file.js` at `//@@name` marks; a folder is one script or style sheet kept as parts. The page
calls the game only behind `typeof` guards, so without one (the recorder) it runs as a plain SNES emulator.
The game gets data built from the ROM on the host with each ROM (`game.romData(buffer)` → the page's
`gameRomData(data, redraw)`; Evermore: the ALCHEMY icons). The hooks: `gameDetectRom`, `gameRomData`, `gameRomReset`, `gameOnRoomMap`, `gameTraceReset`, `gameStartAllowed`, `gameMenuOpened` /
`Closed` / `MapChanged` / `Load` / `Render` / `Step` / `Activate` / `Sync`, `gameLensInfo`, `gameMusicPackage`,
`gameCameraWorld`, plus the panels' own functions (`renderExtendedMapAndOverlays`, `samplePreLoopState`,
`readScriptStackRegion`, `sdbg*`, `snd*`, `maintainCheats`, `refreshActiveBottomTab`, ...).

Everything optional starts off. The page sends its settings (`saveEmuSettings`: the overlay
toggles, Master Audio mute, keybinds, where each panel is shown) and gets them back on open
(`emuSettings`); Keep Focus and the CDL switch are kept by the host. Zoom, speed, panel height
and tabs are not saved.

## Panels

CDL, TRACE, STACK, ENTITIES, ALCHEMY and PALETTES are panels (`#ss-view-<name>`), placed by
`webview/emulator-panels.js`. Each has a pause-menu tab with a "Show while playing" row:
hidden, left side bar, right side bar or bottom bar. Only the bottom bar shows a panel in full;
the menu tab (usual card size, no header, fewer columns, buttons as menu rows, the panel's rows
selectable - see `menu/README.md`) and the side bars are leaner.

- A side bar is drawn over the picture, as narrow as its content and at most a third of the
  screen, in a compact read-only form (`emulator-panels.css`: no buttons, filters, legend or
  lookup, fewer columns). One panel per side: placing another one there hides the first.
  Side bars are hidden while the menu is open.
- The bottom bar has a tab for each panel placed there. With none there is no bottom bar.
- A panel is one element, moved (never copied) into the open menu tab and back, so its update
  code does not care where it is. Per-frame work asks `emuPanelVisible(name)`.
- CDL: only the bottom bar shows its buttons, legend, lookup and
  hover half. Its menu tab: "Recording" (on / off) and "Export"
  (Asar project / WRAM map / bundle, whichever the profile has; B exports) are menu rows, then
  the status line and one row per bank that Up / Down selects and that does nothing (`.menu-pick`).
  In a side bar it has no title, no status and no WRAM: the ROM strips share the full height.
- TRACE has no button bar: it always follows the newest line (nothing arrives while paused, so
  pausing keeps the view; a panel that is shown or moved jumps to the newest line), "Clear" is a
  menu row, and there is no hide-inactive filter or copy any more (the "Everscript Script Trace" output
  channel has every line). Bottom bar: time, slot / entity / event, source, address, script,
  bytes. Menu tab: time, source, script (the trace scrolls inside the card). Side bar: time and
  source on one line, the script on the next, no title.
- STACK, ENTITIES, ALCHEMY, PALETTES have no button bar either: what ENTITIES / ALCHEMY /
  PALETTES list is the menu tab's "Show" row (`panelFilterStep` in `games/evermore/emulator/bottom-bar-views.js`), the
  entity search and its "live" switch are gone (pausing stops the updates). In the menu B on a
  character pings it; the bottom bar keeps its ping column.
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
