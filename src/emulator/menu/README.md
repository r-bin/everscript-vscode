# Emulator Menu Subsystem

Owns the on-screen display (OSD) Quick Menu for the embedded SNES emulator.

## Responsibilities

- **`menu-view.js`**: HTML template, CSS styling, and client script injection for the modal OSD. Provides 6 tabs paged with L and R shoulders:
  - `0: LENS`: Default tab when opening on pause - undistorted room view, coordinate readouts, zoom stepper, reset pan / center on player.
  - `1: OVERLAYS`: Extended Map, Triggers, Entities, Animated Tiles, Collision, Fog of War, Sound FX Visualization, Zoom.
  - `2: OBJECTS`: Section 3 objects list with live states (`0 ... maxState`), stepper writes to WRAM $7E10CE and safely triggers opcode 0x5C.
  - `3: LOOT`: Room pickups (chests, gourds, sniff spots) with item icon previews, LOOTED / UNLOOTED status toggles (WRAM flags and object states), and safe script trigger action.
  - `4: EMULATION`: Playback speed (1/4x, 1/2x, 1x, 2x, 4x), master audio mute, debugger focus, power-cycle ROM.
  - `5: CONTROLS`: Interactive keybinding remapper and gamepad listener with Arrow/WASD presets.
- **`menu-sound.js`**: Web Audio API synthesis for authentic Secret of Evermore sound effects (SFX 0x02 Wheel Turn, 0x04 Wheel Open, 0x06 Wheel Close, 0x38 Click 1, 0x3A Click 2, 0x44 Loot Chime).

## Invariants

- Strictly ASCII-only (no Unicode symbols or non-ASCII characters).
- Gated Start button interception: Start opens the menu only when the player character is actively controllable (`isPlayerControllable()`), preserving in-game Start functionality during the cinematic intro, demo showcase, and name entry screen. Escape key always toggles pause and opens/resumes the menu.
- Non-looping steppers: value steppers clamp at boundaries rather than looping indefinitely.
- Crash prevention: script execution checks for available script slots and run list bounds (`targetSlot >= 0 && runIdx < 40`).
