# Emulator Subsystem & Runtime — Open Tasks & Roadmap

> Domain: Embedded SNES Emulator (`src/emulator/`, `src/games/evermore/debugger/`)
> Shipped features reference: [`docs/emulator-and-debugging.md`](../emulator-and-debugging.md)
> Status key: 🔴 blocking / bug · 🟡 feature gap · 🟢 designed, not yet built

---

## 1. Active Open Tasks

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
