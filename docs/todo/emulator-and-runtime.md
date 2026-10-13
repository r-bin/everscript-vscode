# Emulator Subsystem & Runtime — Open Tasks & Roadmap

> Domain: Embedded SNES Emulator (`src/emulator/`, `src/emulator/core/`, `src/debugger/`)
> Status key: 🔴 blocking / bug · 🟡 feature gap · 🟢 designed, not yet built

---

## 1. Emulator & Map Editor Integration

### 1.1 Live Painting from Map Editor into Running Game
- **Status: 🟡 planned, not started**
- **Goal:** Drawing metatiles in the editor writes them straight into the running game without rebuilding the ROM or restarting emulation.
- **Three-tier write architecture:**
  - **WRAM:** Grid cell at `$7F0000 + (y*W + x)*2` plus dictionary entry for new stamp. Collision updates immediately; tiles render on next stream.
  - **VRAM:** BG1/BG2 tilemap words of the four 8×8 tiles on screen (immediate visual feedback without walking offscreen).
  - **ROM:** Room blob in loaded image so change survives leaving and re-entering the room.
- **Phased Implementation:**
  - *Phase A — Rebuild & Reload (safe fallback):* Debounced (~1s), save state (`_saveState`), rebuild export ROM, load ROM (`_startWithRom`), restore state.
  - *Phase B — WRAM Writes:* Pause core, write grid word and 8-byte dictionary entry into `$7F0000`, resume. (Requires custom core with bus writes, or `"RAM "` block patching in save states).
  - *Phase C — On-screen VRAM Redraw:* Either trigger the engine's in-place metatile redraw routine (used by object-state changes like gourds/doors, opcode `0x62`), or expose core `writeVram` export.
- **Known limits:** New graphics (Block 1 growth), new tile families (CGRAM palettes), and room resizing require full Phase A reload.

### 1.2 The Emulator on the Map Editor
- **Status: 🟡 planned, not started**
- **Goal:** Render the emulator's camera viewport directly on top of the Map Editor canvas in real time.
- **Options & Strategy:**
  - *Option A — Viewport Rectangle (Recommended first step):* Emulator panel reports live camera coordinates (`camX`, `camY`) through host IPC at ~10 Hz; Map Editor draws a 256×224 px box (`32×28` map units) on the SVG canvas.
  - *Option B — Frame Mirroring:* Stream low-fps compressed frames from emulator into the viewport rectangle on the map.
  - *Option C — Embedded Canvas in Radar Webview:* Host snes9x canvas directly inside the Rooms webview (higher complexity, evaluates only if Option B latency is unacceptable).
- **Prerequisites to locate in WRAM:**
  1. Live camera X/Y position in WRAM (diff `readMemoryRange(0x7E0000, ...)` while walking right).
  2. Current room ID in WRAM (hide viewport box when emulator is not in the active editor room).

---

## 2. Runtime Scripting & Debugger (DAP)

### 2.1 Interactive Everscript REPL / Console
- **Status: 🟡 feature gap** (from `docs/emulator-status-and-roadmap.md`)
- **Goal:** Webview CLI console inside the emulator panel allowing developers to execute arbitrary Everscript statements live during emulation:
  - `teleport(MAP.BUG_MOUND, 12, 14)`
  - `give_item(ITEM.JAGUAR_RING)`
  - `damage(ACTIVE, 50)`
  - `<0x2258> = 1`
- **Execution Pipeline:** Leverage the existing Runtime Everscript Injection Engine (`$C409E4` ROM free space / `$7EFE00` WRAM scratch / `$7E28FC` script stack).

### 2.2 VS Code Debug Adapter Protocol (DAP) Integration
- **Status: 🟢 architectural plan** (see `docs/debugger-protocol/`, `src/debugger/`)
- **Capabilities:**
  - Set breakpoints directly in `.evs` source files linked to ROM bytecode offsets via compiler source maps.
  - Pause emulation at Everscript VM bytecode instruction boundaries.
  - Step over (`F10`) / step into (`F11`) VM script instructions.
  - Inspect local script variables, engine script stack frames (`$7E28FC..$7E2EEA`), and event flags.

---

## 3. Emulation State & Memory Inspection

### 3.1 Save State Scrubbing & Rewind
- **Status: 🟡 feature gap**
- Visual timeline slider in emulator panel for stepping backward/forward through recent game states.
- Export/import save state bundles to disk for reproducible test harnesses and bug reporting.

### 3.2 Bi-directional WRAM Sync with Radar
- **Status: 🟡 feature gap**
- Stream live WRAM diffs per frame tick to the Memory Radar tab (`src/memory/`) for real-time memory heatmaps and address lifecycle visualization.
- Real-time Call Log updates when script VM slots dispatch.
