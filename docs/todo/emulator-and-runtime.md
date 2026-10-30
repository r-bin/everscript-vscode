# Emulator Subsystem & Runtime — Open Tasks & Roadmap

> Domain: Embedded SNES Emulator (`src/core/emulator/`, `src/games/evermore/debugger/`)
> Shipped features reference: [`docs/emulator-and-debugging.md`](../emulator-and-debugging.md)
> Status key: 🔴 blocking / bug · 🟡 feature gap · 🟢 designed, not yet built

---

## 1. Active Open Tasks

### 1.0 Long recording sessions (Windows tester, v0.353.5, 2026-10-25)
- **Status: 🔴 partly fixed in v0.355.2**
- What happened: a 5 h session kept 1 h. The extension host hung at 19:43 and restarted at 19:57
  (exit code 0, cause unknown); the emulator page played on for 4 h with nothing on the other end.
  Fixed: heartbeat + the page pauses itself (`page/05-host-watch.js`), a restarted host offers to
  reopen (`session-watch.ts`), loud save failures, CDL drains on blur/close (host memory) and is written once a minute,
  deactivate saves, the replay check ships and hides its console, sound back in time after fast forward.
- 🔴 **Replay desync after an injected script lands one frame late.** The tester's movie
  (`…_2026-10-25_19-24-07.evsmv`) recorded a right-click walk (`injectEverscript`: bytecode `W|7FFF00…`, slot
  `$7E299A`, run list `$7E2F2A`, `$86`) before frame 79887 and desyncs at 79920. Moving that W block one frame
  later (before 79888) replays in sync to 82000 (85 checksums); -2, -1, +2, +3 do not. The page's own order
  (W flushed before the F line, replay applies W before the frame) looks right on paper and in the fake-core
  test, so the lost frame is somewhere live: record an injection with the page on the real core, replay it.
  Reproduce: `tools/cdl/replay.js <movie> <rom> --from-frame 79500 --until 82000`.
- 🟡 **Collision overlay blank "after a while":** not reproduced. Two weak spots: a room-map request that fails
  or gets no answer is never repeated (`06-inidisp-shadow.js` asks only when room / objects / cut grass
  change); after a replay desync the game is in states nobody played. Fixed: the menu's room fallback read
  the word at `$7E0B3C` (requests for room 3072) instead of `$7E0ADB`.
- 🟡 **Stat word names disagree:** `$0A3F` / `$0A41` (Boy, `$0A89` / `$0A8B` Dog, $4A apart) are attack /
  defence in the compiler's `BOY_STATS` layout (knowledge ram/7e0a26.md), evade / magic defence in
  `docs/disassembly/combat/defense-buffs.md` and `$8F:8398`, magic / physical defence in
  `companion-form-stats.md` and `$8F:866B` (whose code only adds +80 / +250). Settle it against the game.
- 🟡 **"4x looks like 10x on a 144 Hz screen":** not reproduced; the pacing simulates to 4.00x at 144 and
  165 Hz with frames up to 4 ms. The `Pace:` line in the Emulator log (once a minute) will tell.
- ✅ CDL survives a dead host (v0.355.5): deltas kept until written, parked in the page's IndexedDB, handed
  over by the next page, merged exactly once. Still lost: a crash of the webview or the PC (≤5 s / ≤60 s).
- 🟡 **The replay (TAS) has no such rescue:** frames in flight when the host dies are lost; Continue resumes
  from the last snapshot (≤30 s back). Same pattern would fit (`tasRecFrames` numbered, parked, handed over).
- 🔴 **WRAM-only desync in a hand-played session (2026-10-30, v0.384.5, core `4a0381e352e0abe3`).**
  `…_2026-10-30_08-40-18.evsmv` desyncs at 97800 (97740 matches; at 97800 VRAM/CGRAM/OAM/ARAM still match, only
  WRAM differs) and again at 140700 from the live state at 109800. Ruled out headless: the Infinite HP cheat's W
  lines (all recorded, HP trace agrees; shifting them ±3 frames does not match), a dropped or doubled frame,
  taking rewind states at the K markers, debugger reads (EVS_TAS peeks), the sound / script-debugger breakpoint
  callbacks (always `false`). From the Z state at 99000 the rest syncs. Next: when the check fails, write the
  page's rewind states around the frame to disk and diff WRAM (they are kept 2 min; this check ran 3.7 min late).
  The host stopped saving resume snapshots and Z lines after a desync, so Continue fell back 75,600 frames and
  replayed into the second desync (fixed v0.384.15; the session was recovered by hand at 140640, the last exact
  frame). A whole-game replay can be rebuilt: an `L|<unused n>|<Z data>` line at the Z frame, no S/T lines in the gap.
- ✅ **The CDL Export no longer blocks the host** (v0.384.14): a worker thread (`games/evermore/cdl/export-job.ts`).
- 🟡 **Flushing the library blocks the host** (~0.4 s for 2.2 M script xrefs on a Mac, slower on Windows).
- 🔴 **Sound-driver deadlock in the core (2026-10-27):** a music change can hang the game for good when the
  driver polls ENVX of a voice that already ended (the core keeps its stale envelope; real DSP reads 0).
  Evidence and addresses: `docs/disassembly/audio/spc-block-uploader.md` (Trap). A one-line `apu.c` fix
  (ENVX 0 when `SOUND_SILENT`) was checked in a scratch build: the stuck state loads the music and the
  cutscene goes on. **Not applied: the owner decides core changes** (new core id: old snapshots do not
  load, old recordings may desync). Workaround: rewind and replay the moment differently.

### 1.1 Live Painting from Map Editor into Running Game
- **Status: 🟡 planned, not started**
- **Goal:** Drawing metatiles in the Map Editor writes them straight into the running game without rebuilding the ROM or restarting emulation.
- **Three-tier write architecture:**
  - *WRAM:* Grid cell at `$7F0000 + (y*W + x)*2` plus dictionary entry for new stamp. Collision updates immediately; tiles render on next stream.
  - *VRAM:* BG1/BG2 tilemap words of the four 8×8 tiles on screen (immediate visual feedback without walking offscreen).
  - *ROM:* Room blob in loaded image so change survives leaving and re-entering the room.
- **Phased Strategy:**
  - Phase A: Rebuild & reload fallback (save state, rebuild export ROM, reload, restore state).
  - Phase B: Live WRAM writes via custom core bus writes.
  - Phase C: In-place VRAM redraw via engine routine `$909460` / opcode `0x62`.

### 1.2 The Emulator on the Map Editor Canvas
- **Status: 🟡 planned, not started**
- **Goal:** Render the emulator's camera viewport directly over the Map Editor canvas.
- Using the verified camera coordinates at `$7E0112/$0114`, draw a 256×224 px box (`32×28` map units) over the active editor room, hiding the box when the game is in a different room.

### 1.3 Interactive Everscript REPL / Console
- **Status: 🟡 feature gap**
- In-panel CLI console inside the emulator panel allowing developers to execute arbitrary Everscript statements live:
  - `teleport(MAP.BUG_MOUND, 12, 14)`
  - `give_item(ITEM.JAGUAR_RING)`
  - `damage(ACTIVE, 50)`
  - `<0x2258> = 1`

### 1.4 Save State Scrubbing & Rewind
- **Status: 🟡 feature gap**
- Visual timeline slider for stepping backward/forward through recent game states in the emulator panel.

### 1.5 Recordings: saves across sessions, saves in exports, a state per room
- **Status: 🟡 feature gap** (asked 2026-10-19, after the pause-desync fix of v0.314.4)
- **SRAM across sessions:** the in-game saves survive closing the ROM. Today every power-on zeroes SRAM
  so every movie starts from an empty save (`tas/README.md`). Keeping SRAM means a movie must name the
  SRAM it started from (a header line with its CRC and the bytes in a side file), or replays desync.
- **Export with SRAM:** an exported recording carries that starting SRAM and the SRAM at its end, so
  someone else sees the player's save files.
- **A state per room:** while recording (or on replay), save a state at every room change so a replay
  can start in a chosen room. The headless half exists (`tools/cdl/replay-states.js`, `--states`);
  the panel has none.

