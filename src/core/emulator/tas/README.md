# emulator/tas/ — input recording and replays

Host side of input recording. The webview half is `../tas-view.js` (REPLAYS pause-menu tab, input
overlay, `tasApplyInput()` in the frame loop); `../fps-meter.js` shows emulated and
game frame rates.

| File | Role |
|---|---|
| `movie.js` (`src/platform/tas/`) | Pure: `.evsmv` parsing / writing, pad word ⇄ `BYsSudlrAXLR0123` text |
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
  reset button, `S|crc` a CRC-32 of the 128 KB WRAM every 60 frames, and `T|vram=..|cgram=..|oam=..|sram=..|aram=..`
  a CRC-32 of the other memory spaces (the core's `readSpace(id)`) every 600 frames. A hook on
  `Module.writeMemory` (installed at every boot, `tasInstallWriteHook`) records them; a WRAM
  write that changes nothing is dropped, so a cheat that rewrites every frame costs a line only
  when the game changed the value. Adjacent bytes of one boundary are merged into one line.
- An event belongs to the boundary where it appears in the file (= frames emulated so far). A
  replay applies it before the next frame runs, then compares each `S` line and reports the first
  mismatch as **DESYNC at frame N** (badge, status line, host log). Replays also re-record the
  events, so a branch taken over mid-replay is complete.
- **Sync marks** (v0.221.0): what a replay showed is appended to the recording, once, as a
  header-style line (the frames are untouched, the file's date is kept so the list order is too):
  `# desync: <frame> <detail>` at the first lost checksum, `# synced: <date>` after a replay to the
  end with none. A desync is for good: the recording is never marked synced afterwards. Only a fair
  replay marks (EVS_TAS core, same ROM, same core build); a failed headless replay check while
  recording (`verify.js`) writes the desync line into the recording in progress. The REPLAYS tab
  shows "synced", "desync at m:ss" or "not replayed yet".
- The pause menu (Esc) needs no event: no frame runs while it is open. What is done in it is
  recorded as what it does: flag/cheat/loot toggles are writes, **Soft Reset** (menu EMULATION
  tab) is `R|soft`. **Reset / Power-Cycle ROM** boots a new session
  and recording, as before. Pause/resume, speed, zoom and overlays do not change emulation.
- Format version 3 (v0.215.0) adds the `T` lines, `S` every 60 frames, the header lines `# core:` (first 16 hex of
  the core wasm's SHA-256; a replay on another build warns, `tools/cdl/replay.js` refuses without `--force`) and
  `# audio:` (the sample rate), and run-length encoded frame lines (`F|pad*n`, written by `rleFrames` in the host).
  Versions 1 and 2 still load.
- **The sample rate leaks into emulation.** The SPC700 sees DSP state that depends on it: five ARAM bytes differ between
  32040 and 44100 Hz after 1500 frames (WRAM, VRAM, CGRAM, OAM do not). The panel boots at 44100 (`AUDIO_FREQ`), so a
  replay boots at the movie's `# audio:` rate. Tools that replay or compare ARAM must not use 32040 by habit.
- Every way into emulator memory from outside is `Module.writeMemory` (hooked), `softReset` and the pad; audited at v0.215.0
  (`maintainCheats` writes through `writeMemory`; there is no other cheat engine in use; a replay does not run it).
- **Save states and the replay check** (v0.216.0): `tools/cdl/replay.js --states <dir>` saves a state at room changes
  (`replay-states.js`), `--from-state` resumes from one. `verify.js` replays the session being recorded on a headless
  copy every `everscript.tas.verifyEveryMinutes`. A failure after resuming from a state is repeated from power-on.
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
