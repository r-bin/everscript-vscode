# emulator/tas/ — input recording and replays

Host side of input recording. The webview half is `../tas-view.js` (REPLAYS tab, input
overlay, `tasApplyInput()` in the frame loop); `../fps-meter.js` shows emulated and
game frame rates.

| File | Role |
|---|---|
| `movie.js` | Pure: `.evsmv` parsing / writing, pad word ⇄ `BYsSudlrAXLR0123` text |
| `host.js` | Panel glue (the only file that needs `vscode`): recording file per session, replay list, pins, load |

## Model

- A **session** starts at every ROM boot (load, or a replay's reboot) and is recorded
  frame by frame: one `F|<pad>` line per emulated frame into
  `<rom>_<YYYY-MM-DD_HH-MM-SS>.evsmv` in `everscript.tas.recordingsDirectory` (default
  `<globalStorage>/tas-recordings`). A session with no button pressed by hand is
  deleted when it ends.
- A **replay** reboots the loaded ROM and feeds the recorded pad; the session it starts
  is recorded too (`# source:`), so taking over mid-replay produces a complete
  recording that branches off the original.
- A recording holds more than the pad (format version 2, `movie.js` documents the lines):
  `W|addr|bytes` memory writes made through `Module.writeMemory` (cheats, object states, menu
  toggles such as loot/flag rows, injected scripts, the script debugger), `R|soft` the console
  reset button, and `S|crc` a CRC-32 of the 128 KB WRAM every 600 frames. A hook on
  `Module.writeMemory` (installed at every boot, `tasInstallWriteHook`) records them; a WRAM
  write that changes nothing is dropped, so a cheat that rewrites every frame costs a line only
  when the game changed the value. Adjacent bytes of one boundary are merged into one line.
- An event belongs to the boundary where it appears in the file (= frames emulated so far). A
  replay applies it before the next frame runs, then compares each `S` line and reports the first
  mismatch as **DESYNC at frame N** (badge, status line, host log). Replays also re-record the
  events, so a branch taken over mid-replay is complete.
- The pause menu (Esc) needs no event: no frame runs while it is open. What is done in it is
  recorded as what it does: flag/cheat/loot toggles are writes, **Soft Reset** (menu EMULATION
  tab, or the REPLAYS bar button) is `R|soft`. **Reset / Power-Cycle ROM** boots a new session
  and recording, as before. Pause/resume, speed, zoom and overlays do not change emulation.
- Version 1 recordings still replay (without events); their cheat warning stays.
- Headless: `node tools/cdl/replay.js <movie> <rom> [--cdl <library root>]` replays on the same
  core, verifies the checksums (exit 2 on desync) and can record the CDL library meanwhile. The
  movie is the source of truth and the CDL library is derived from it.
- Only the extension's own recordings are supported. Movies from other emulators
  (lsnes `.lsmv`) were tried in v0.161.0 and dropped: their lag frames differ from
  snes9x2005's, so they desync.

## Determinism invariants (break one and replays desync)

- The custom core's `EVS_TAS` build (`source/evs-tas.h`, on by default) makes a ROM
  restart a power-on and debugger reads side-effect-free. With `-DEVS_TAS=0` or the
  vanilla core a replay starts from a reset and the tab warns that it may desync.
- Nothing outside the frame loop may change emulation except through `Module.writeMemory`,
  `softReset` and the pad: anything that writes the core's memory another way (a new
  `Module._something` that mutates state) is invisible to the movie and will desync. Cheats are
  not maintained during a replay: their recorded writes are replayed instead.
- A power-on zeroes SRAM (`startWithRom`), so every movie starts from an empty save.
- The joypad is set only by `tasApplyInput()`, once per `_mainLoop()`.
