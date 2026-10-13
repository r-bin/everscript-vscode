# Emulator Subsystem & Runtime — Open Tasks & Roadmap

> Domain: Embedded SNES Emulator (`src/emulator/`, `src/debugger/`)
> Status key: 🔴 blocking / bug · 🟡 feature gap · 🟢 designed, not yet built · ✅ completed

---

## 1. Verified Completed Features (Removed from Open Backlog)

Several key emulator and debugging capabilities are **already fully shipped**:

- ✅ **VS Code Debug Adapter Protocol (DAP) Integration**:
  - *Implemented in:* [`src/debugger/`](file:///Users/v/Documents/GitHub/everscript-vscode/src/debugger/) and [`src/emulator/script-debug-host.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/emulator/script-debug-host.js)
  - Full DAP server registered under debugger type `everscript`: source breakpoints via compiler source maps, stepping (`F10`/`F11`), VM script stack frame inspection (`$7E28FC..$7E2EEA`), and live WRAM expression evaluation.
- ✅ **Extended Map Multi-Layer Rendering**:
  - *Implemented in:* [`src/emulator/panel-webview.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/emulator/panel-webview.js)
  - Renders 2x pixel-grid canvas surrounding screen: static Mode 1 composite background, Section 2 dynamic animated tiles, foreground canopy occlusions, live WRAM entity sprites (Boy, Dog, NPCs, enemies, projectiles), and trigger overlays.
- ✅ **Live Camera Coordinates Located**:
  - *Documented in:* [`src/emulator/README.md`](file:///Users/v/Documents/GitHub/everscript-vscode/src/emulator/README.md)
  - Live camera position is tracked via BG2 terrain scroll shadow at `$7E0112/$0114` (vertical is camera - 1) and BG1 canopy shadow at `$7E010E/$0110`.
- ✅ **Sound-Chip Telemetry & Streaming**:
  - *Implemented in:* [`src/emulator/apu-stream.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/emulator/apu-stream.js)
  - Feeds live 44.1kHz audio, voice samples, and ARAM snapshots to the Radar Music tab.
- ✅ **TAS Recording & Input Playback**:
  - *Implemented in:* [`src/emulator/tas/`](file:///Users/v/Documents/GitHub/everscript-vscode/src/emulator/tas/)
  - Per-frame joypad input feed, replay overlay, and `.evsmv` recording format.
- ✅ **Runtime Everscript Injection**:
  - *Implemented in:* [`src/emulator/panel-webview.js`](file:///Users/v/Documents/GitHub/everscript-vscode/src/emulator/panel-webview.js)
  - Compiles and injects bytecode into free space (`$C409E4`) and WRAM scratch (`$7EFE00`) for on-the-fly execution.

---

## 2. Active Open Tasks

### 2.1 Live Painting from Map Editor into Running Game
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

### 2.2 The Emulator on the Map Editor Canvas
- **Status: 🟡 planned, not started**
- **Goal:** Render the emulator's camera viewport directly over the Map Editor canvas.
- Using the verified camera coordinates at `$7E0112/$0114`, draw a 256×224 px box (`32×28` map units) over the active editor room, hiding the box when the game is in a different room.

### 2.3 Interactive Everscript REPL / Console
- **Status: 🟡 feature gap**
- In-panel CLI console inside the emulator panel allowing developers to execute arbitrary Everscript statements live:
  - `teleport(MAP.BUG_MOUND, 12, 14)`
  - `give_item(ITEM.JAGUAR_RING)`
  - `damage(ACTIVE, 50)`
  - `<0x2258> = 1`

### 2.4 Save State Scrubbing & Rewind
- **Status: 🟡 feature gap**
- Visual timeline slider for stepping backward/forward through recent game states in the emulator panel.
