# emulator/tas/ — input recording and replays

Host side of TAS support. The webview half is `../tas-view.js` (REPLAYS tab, input
overlay, `tasApplyInput()` in the frame loop).

| File | Role |
|---|---|
| `movie.js` | Pure: `.lsmv` (lsnes zip) and `.evsmv` (our text format) parsing, pad word ⇄ `BYsSudlrAXLR0123` text |
| `host.js` | Panel glue (the only file that needs `vscode`): recording file per session, replay list, pins, import, load |
| `movies/` | Bundled, always-pinned replays (`rbin-secretofevermore-gameend.lsmv`: TASVideos #6617, any% "game end glitch", lsnes / bsnes v085) |

## Model

- A **session** starts at every ROM boot (load, or a replay's reboot) — always a
  power-on — and is recorded frame by frame: one `F|pad1[|pad2|pad3|pad4]` line per
  emulated frame into `<rom>_<YYYY-MM-DD_HH-MM-SS>.evsmv` in
  `everscript.tas.recordingsDirectory` (default `<globalStorage>/tas-recordings`).
  A session with no button pressed by hand is deleted when it ends.
- A **replay** reboots the loaded ROM and feeds the movie's pads; the session that
  replay starts is recorded too (`# source:`), so taking over mid-replay produces a
  complete movie from power-on that branches off the original.
- Pads are the core's four `setJoypadInputs` words: port 1 data1/data2, port 2
  data1/data2 (lsnes Y-cable `ygamepad16` ports). `# ycable: yes` sessions feed all
  four every frame; others use `setJoypadInput` (pad 1).

## Determinism invariants (break one and replays desync)

- Restarting a ROM must equal power-on: the core's `startWithRom` clears CPU, ICPU,
  APU, IAPU and DSP channel state before `S9xReset` (`tests/debugger/tas.test.js`).
- Nothing outside the frame loop may change emulation: the debugger's
  `readMemory`/`readMemoryRange` peek without charging cycles or running I/O
  register handlers; cheats are not maintained during a replay (a recording made
  with cheats on is marked `# cheats: yes`).
- Joypads are set only by `tasApplyInput()`, once per `_mainLoop()`.
- Movies made on other emulators (lsnes / bsnes) desync where their lag frames
  differ: the bundled TAS diverges at about frame 12,250, the first free movement
  in Omnitopia.
