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
- Only the extension's own recordings are supported. Movies from other emulators
  (lsnes `.lsmv`) were tried in v0.161.0 and dropped: their lag frames differ from
  snes9x2005's, so they desync.

## Determinism invariants (break one and replays desync)

- The custom core's `EVS_TAS` build (`source/evs-tas.h`, on by default) makes a ROM
  restart a power-on and debugger reads side-effect-free. With `-DEVS_TAS=0` or the
  vanilla core a replay starts from a reset and the tab warns that it may desync.
- Nothing outside the frame loop may change emulation; cheats are not maintained
  during a replay (a recording made with cheats on is marked `# cheats: yes`).
- The joypad is set only by `tasApplyInput()`, once per `_mainLoop()`.
