# SNES CDL Recorder

An SNES emulator inside VS Code that records what your game does while you play it.

- **CDL (Code/Data Log):** which ROM bytes run as code, which are read as data, who
  calls which function, and who reads or writes each WRAM address. The recording
  grows with every session and is kept per ROM.
- **Replays:** every session's joypad input, frame by frame, so it can be played back exactly.

Recording starts on. Bring your own ROM: the extension contains no game data.

## Use it

1. `CDL Recorder: Open Emulator`, then load a `.smc` / `.sfc` file (or drop it on the panel).
   The last ROM opens by itself the next time.
2. Play. The **CDL** tab shows the coverage growing; **REPLAYS** lists your sessions.
3. `CDL Recorder: Export Recording Bundle` (or **export bundle** in the CDL tab) writes one
   zip with the ROM's recording and its replays. It holds no ROM bytes. Send it to whoever
   collects the recordings; they merge it with `Everscript: Import Recording Bundle`.

**Esc** pauses and opens the menu: emulation speed, audio, keep focus, reset, controls.
Everything optional starts off. What you change there is remembered.

`CDL Recorder: Open Data Folder` shows where the recordings live.

For Secret of Evermore (U) and ROMs built on it, the menu also has the map overlays,
objects, loot and cheats.

Part of [Everscript](https://github.com/rbin/everscript-vscode). MIT licensed; the
emulator core is snes9x2005: non-commercial, see the `copyright` file next to the core.
