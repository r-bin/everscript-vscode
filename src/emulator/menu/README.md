# Emulator Menu Subsystem

Owns the on-screen display (OSD) Quick Menu for the embedded SNES emulator.

## Responsibilities

- **`menu-view.js`**: HTML template, CSS styling, and client script injection for the modal OSD. Provides 3 tabs paged with L and R shoulders (Overlays, Emulation, Controls), full mouse and controller/keyboard parity, and an interactive keybinding remapper.
- **`menu-sound.js`**: Web Audio API synthesis for authentic Secret of Evermore sound effects (SFX 0x02 Wheel Turn, 0x04 Wheel Open, 0x06 Wheel Close, 0x38 Click 1, 0x3A Click 2, 0x44 Click 3 / Loot).

## Invariants

- Strictly ASCII-only (no Unicode symbols or non-ASCII characters).
- Gated Start button interception: Start opens the menu only when the player character is actively controllable (`isPlayerControllable()`), preserving in-game Start functionality during the cinematic intro, demo showcase, and name entry screen.

