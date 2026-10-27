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
- 🔴 **Replay desync after a recorded memory write.** The tester's movie (`…_2026-10-25_19-24-07.evsmv`)
  replays in sync up to frame 79887, where it recorded `W|` writes to `$7FFF00…`/`$7E299A…` (an injected
  script, it seems), then desyncs at the checksum of frame 79920. A write recorded at a frame boundary
  that does not land at the same point when replayed: reproduce with `tools/cdl/replay.js --until 79920`.
- 🟡 **"4x looks like 10x on a 144 Hz screen":** not reproduced; the pacing simulates to 4.00x at 144 and
  165 Hz with frames up to 4 ms. The `Pace:` line in the Emulator log (once a minute) will tell.
- 🟡 **A page cut off from its host loses up to 20 s of CDL record streams** (xrefs, hits: deltas). A
  rescue path (the page hands its data to the new host) needs a channel VS Code does not give.
- 🟡 **Flushing the library blocks the host** (~0.4 s for 2.2 M script xrefs on a Mac, slower on Windows).

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

