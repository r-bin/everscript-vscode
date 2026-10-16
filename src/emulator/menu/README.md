# Emulator Menu Subsystem

Owns the on-screen display (OSD) Quick Menu for the embedded SNES emulator.

## Responsibilities

- **`menu-view.js`**: HTML template, CSS styling, and client script injection for the modal OSD. Provides 14 tabs paged with L and R shoulders in the order below (tabs a ROM does not get are skipped). The numbers are the tab ids (`menu-tab-btn-<id>`); L / R walk `MENU_TAB_ORDER`, not the ids:
  - `0: VIEW`: Default tab when opening on pause - the paused screen undistorted, zoom stepper, pan; for Secret of Evermore also the room, coordinates and "center on player".
  - `1: OVERLAYS`: Extended Map, Triggers, Entities, Animated Tiles, Collision, Fog of War, Sound FX Visualization, Zoom, thin HP / stamina bars, Input Display (the pad fed to the core; also the INPUTS chip on the screen, which other ROMs keep since this tab is Evermore-only). All off by default; the choice is saved.
  - `2: OBJECTS`: Section 3 objects list with live states (`0 ... maxState`), stepper writes to WRAM $7E10CE and safely triggers opcode 0x5C.
  - `3: LOOT`: Room pickups (chests, gourds, sniff spots) with item icon previews, LOOTED / UNLOOTED status toggles (WRAM flags and object states), and safe script trigger action.
  - `4: CHEATS`: no clip, invincibility, Atlas, full heal.
  - `7: REPLAYS`: this ROM's recordings (`../tas-view.js`, rows `../webview/replays-list.js`), at the usual card size. Up / down jumps from row to row: "Take over" (only while replaying), "Open recordings folder", then one row per recording (when, how long, synced / desync / not replayed). Left / right choose favourite, play or delete; B does it; play and delete ask first (B again, A cancels). Playing closes the menu first.
  - `8: CDL`, `9: TRACE`, `10: STACK`, `11: ENTITIES`, `12: ALCHEMY`, `13: PALETTES`: the panel in full, with a "Show while playing" row on top (left / right steps hidden, left side bar, right side bar, bottom bar; up / down scrolls the panel). The panel element is moved in while its tab is open (`../webview/emulator-panels.js`). TRACE..PALETTES need the full profile and Evermore.
  - `5: EMULATION`: Playback speed (1/4x, 1/2x, 1x, 2x, 4x), Master Audio (mute, saved), Keep Focus (Tab and debugger stops leave the focus on the emulator, saved), power-cycle ROM, soft reset.
  - `6: CONTROLS`: Interactive keybinding remapper and gamepad listener with Arrow/WASD presets (saved by the extension, not in the page's localStorage).
  - Tabs 1-4 need Secret of Evermore (U) or a ROM built on it (`data-needs="evermore"`, `../webview/emulator-profile.js`).
- **`menu-sound.js`**: Web Audio API synthesis for authentic Secret of Evermore sound effects (SFX 0x02 Wheel Turn, 0x04 Wheel Open, 0x06 Wheel Close, 0x38 Click 1, 0x3A Click 2, 0x44 Loot Chime).

## Keys

- **B** (keyboard B, gamepad bottom face button) is the action button: toggles, "[B] Reset", "[B] Open", play / delete. On VIEW it resumes.
- **A** / Esc / Start: back. On REPLAYS A first drops a pending play / delete question; otherwise it resumes the game.
- L / R tabs, up / down rows, left / right values.

## Invariants

- Strictly ASCII-only (no Unicode symbols or non-ASCII characters).
- Gated Start button interception: Start opens the menu only when the player character is actively controllable (`isPlayerControllable()`), preserving in-game Start functionality during the cinematic intro, demo showcase, and name entry screen. Escape key always toggles pause and opens/resumes the menu.
- Non-looping steppers: value steppers clamp at boundaries rather than looping indefinitely.
- Crash prevention: script execution checks for available script slots and run list bounds (`targetSlot >= 0 && runIdx < 40`).
