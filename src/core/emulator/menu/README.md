# Emulator Menu Subsystem

Owns the on-screen display (OSD) Quick Menu for the embedded SNES emulator.

## Responsibilities

- **`menu-view.ts`**: HTML template, CSS styling, and client script injection for the modal OSD. Provides 14 tabs paged with L and R shoulders in the order below (tabs a ROM does not get are skipped). The numbers are the tab ids (`menu-tab-btn-<id>`); L / R walk `MENU_TAB_ORDER`, not the ids:
  - `0: VIEW`: Default tab when opening on pause - the paused screen undistorted, zoom stepper, pan; for Secret of Evermore also the room, coordinates and "center on player".
  - `1: OVERLAYS`: Extended Map, Triggers, Entities, Animated Tiles, Collision, Fog of War, Sound FX Visualization, Zoom, thin HP / stamina bars, Input Display (the pad fed to the core; also the INPUTS chip on the screen, which other ROMs keep since this tab is Evermore-only). All off by default; the choice is saved.
  - `2: OBJECTS`: Section 3 objects list with live states (`0 ... maxState`), stepper writes to WRAM $7E10CE and safely triggers opcode 0x5C.
  - `3: LOOT`: Room pickups (chests, gourds, sniff spots) with item icon previews, LOOTED / UNLOOTED status toggles (WRAM flags and object states), and safe script trigger action.
  - `4: CHEATS`: no clip, invincibility, Atlas, full heal.
  - `7: REPLAYS`: this ROM's recordings (`../tas-view.ts`, rows `../webview/replays-list.js`), at the usual card size. Up / down jumps from row to row: "Take over" (only while replaying), "Open recordings folder", then one row per recording (when, how long, synced / desync / not replayed). Left / right choose favourite, play or delete; B does it; play and delete ask first (B again, A cancels). Playing closes the menu first.
  - `8: CDL`: the usual card size. Rows: "Show while playing", "Recording" (left / right or B: off / on), "Export" (left / right: Asar project, WRAM map or bundle as the profile allows; B exports), the status line, then one row per WRAM / ROM bank: Up / Down selects it, nothing else (`.menu-pick` rows count for the selection, `cdl-view.ts` `cdlMenuStep` / `cdlMenuActivate`). Flush and the "who?" lookup are only in the bottom bar.
  - `9: TRACE`, `10: STACK`, `11: ENTITIES`, `12: ALCHEMY`, `13: PALETTES`: the usual card size too, with a "Show while playing" row on top (left / right steps hidden, left side bar, right side bar, bottom bar), then the panel without its header and with fewer columns. No button bars: TRACE adds a "Clear" row (B empties the trace) and shows time, source (e.g. `0x12.step[0]`) and script; STACK drops its "active / scheduler / last slot" header; ENTITIES, ALCHEMY and PALETTES add a "Show" row (what to list: all, party / enemies / NPCs, the three alchemy pools, sprite / map palettes; left / right, B steps). The panel's own rows (STACK slots, characters, alchemy slots, palettes) are `.menu-pick` rows Up / Down selects (`menuSelectableRows`: hidden ones are skipped); B on a character pings it on the screen (`tr.onMenuAction`), the others do nothing. TRACE's lines are not rows: Down past the last row scrolls the trace a page per press (the mark moves to the trace, B and left / right do nothing there), Up at its top goes back to the rows (`emuPanelMenuMove`). The panel element is moved in while its tab is open (`../webview/emulator-panels.js`). TRACE..PALETTES need the full profile and Evermore.
  - `5: EMULATION`: Playback speed (1/4x, 1/2x, 1x, 2x, 4x), Master Audio (mute, saved), Keep Focus (Tab and debugger stops leave the focus on the emulator, saved), power-cycle ROM, soft reset.
  - `6: CONTROLS`: Interactive keybinding remapper and gamepad listener with Arrow/WASD presets (saved by the extension, not in the page's localStorage).
  - Tabs 1-4 are the game's (Evermore's: `src/games/evermore/emulator/menu-tabs.ts`, handed in through
    `host.js` `webview()`), and need Secret of Evermore (U) or a ROM built on it (`data-needs="game"`).
    The menu splices their buttons and panels in (`getMenuHtml(parts)`) and calls the game's hooks behind
    `typeof` guards: `gameStartAllowed(m)` (Start opens the menu), `gameMenuOpened` / `Closed` /
    `MapChanged`, `gameMenuLoad`, `gameMenuRender(tab)`, `gameMenuStep(tab, row, delta)`,
    `gameMenuActivate(tab, row)`, `gameMenuSync()`. Without them (the recorder) there are no tabs 1-4.
- **`menu-sound.js`**: Web Audio API synthesis for authentic Secret of Evermore sound effects (SFX 0x02 Wheel Turn, 0x04 Wheel Open, 0x06 Wheel Close, 0x38 Click 1, 0x3A Click 2, 0x44 Loot Chime).

## Keys

- Gameplay gamepad (`gamepadJoypad()`, OR-ed with the keyboard in the frame loop): every connected pad together, read as one SNES pad by `../gamepad.ts` (`EmuPad`, bundled and spliced into this script). Default in SNES layout for a standard-mapping pad — bottom face = B, right = A, left = Y, top = X, shoulders = L/R, Back = Select, Start = Start, D-pad = the cross; the left stick and any hat switch are the cross too, always. A binding is a button index, an axis direction (`a2+`) or a hat direction (`h9up`), so raw-mapping pads (DirectInput, USB SNES replicas: buttons anywhere, D-pad on a hat axis) can be bound fully. The CONTROLS tab has a stepper row "Bindings For" (Keyboard, default | Gamepad, left/right like every pause-menu row) over the SNES buttons plus the emulator actions Rewind (Backspace / pad LT) and Speed Up (# / pad RT); the two pages bind independently (`userKeyMap`, `userPadMap`, both saved); both are live at once and may bind the same SNES button. The banner names the pads seen ("(raw)" = not standard mapping); browsers list a pad only after one of its buttons is pressed. Menu navigation by pad follows the same bindings (B acts, A backs out, L/R tabs). Start is withheld while it opens the menu; buttons held across a menu close stay masked until released.
  - Windows trap (a tester's "no controller works", v0.353.5): the old code read only pad 0 (the menu pads 0-1) with fixed button numbers; Windows often lists an idle or virtual pad first (Steam Input, DS4Windows, vJoy) and DirectInput pads are not in the standard mapping. `getGamepads()` may also throw under a permissions policy: `connectedPads` treats that as no pad.
- **B** (keyboard B, gamepad bottom face button) is the action button: toggles, "[B] Reset", "[B] Open", play / delete. On VIEW it resumes.
- **A** / Esc / Start: back. On REPLAYS A first drops a pending play / delete question; otherwise it resumes the game.
- L / R tabs, up / down rows, left / right values.

## Invariants

- Strictly ASCII-only (no Unicode symbols or non-ASCII characters).
- Start button opens menu (EMULATION tab): toggles whether Start button on keyboard or gamepad opens the menu (doing the same as Esc). Initially forced off for CDL recorder profile so in-game Start functions normally; when turned on, Esc and Start do the same. Escape key always toggles pause and opens/resumes the menu.
- Game specific features (EMULATION tab): toggles game-specific tabs (Overlays, Objects, Loot, Cheats, Trace, Stack, Entities, Alchemy, Palettes) and overlay layers. Forced off initially in CDL recorder mode, otherwise on by default.
- Non-looping steppers: value steppers clamp at boundaries rather than looping indefinitely.
- Crash prevention: script execution checks for available script slots and run list bounds (`targetSlot >= 0 && runIdx < 40`).
