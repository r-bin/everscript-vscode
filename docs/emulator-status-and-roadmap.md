# SNES Emulator Subsystem — Status, Architecture & Roadmap

> Living document tracking the embedded SNES emulator, Map Extension engine, WRAM tracking, and runtime scripting.
> Current version: v0.154.0

---

## 1. Overview & Core Architecture

The Everscript extension embeds a customized `snes9x2005-wasm` SNES emulator directly within a VS Code webview (`Everscript: Open Emulator Panel`).

### Component Map

```text
Host (Node / VS Code Extension)
  ├── src/emulator/panel.js             Host lifecycle, webview creation, ROM loading & Everscript injection dispatch
  └── src/emulator/core/
        ├── snes9x2005-wasm/            Custom debugger fork (builds snes9x_2005.js / .wasm)
        │     └── source/
        │           ├── debugger.c      Memory read/write, ROM patching, execution & write breakpoints
        │           └── exports.c       Screen/sound buffers, joypad input, main loop
        └── snes9x2005-wasm-vanilla/    Upstream baseline

Webview (Chromium Sandbox)
  ├── src/emulator/panel-webview.js     Core runner, audio streamer, input handling, and Map Extension engine
  ├── #screen                           Core emulator canvas (512×448 buffer, rendered low-res SNES output)
  ├── #extended-map                     Layer 0: Mode 1 composite background + Section 2 animated tiles
  ├── #extended-entities                Layer 1: Live WRAM entity sprites (Boy, Dog, NPCs, enemies, projectiles)
  ├── #extended-foreground              Layer 2: Mode 1 priority canopy tiles + animated foreground overlays
  ├── #extended-overlay                 Layer 4: B-triggers, step-on triggers, right-click target pings
  └── #extended-fog                     Layer 5: Viewport darkness / fog-of-war
```

### Direct Core API & Debugger Exports

The custom core exports:
- `_startWithRom(ptr, size)`: Initializes Snes9x with loaded ROM bytes.
- `_mainLoop()`: Executes a single frame tick.
- `_getScreenBuffer()`: Returns pointer to 512×448 RGBA framebuffer.
- `_getSoundBuffer()` / `_getSoundBufferSize()`: Planar Float32 audio samples.
- `_setJoypadInput(port, mask)`: Injects SNES controller button bitmasks.
- `_readMemory(addr)` / `_writeMemory(addr, val)`: Reads/writes WRAM and hardware registers.
- `writeRomByte(offset, val)` / `readRomByte(offset)`: Modifies ROM banks at runtime for on-the-fly script patching.
- `addExecBreakpoint(addr)` / `addWriteBreakpoint(addr)`: Arms hardware debugger hooks.

---

## 2. Audio & Video Invariants

1. **Audio Streaming**:
   - Web Audio `AudioContext` runs at 44,100 Hz.
   - S9x sound callback dynamically generates 735 samples/frame (`44100 / 60`).
   - Underruns zero-pad instead of repeating old samples, preventing robotic distortion.
   - Context is automatically resumed upon first user interaction (mousedown or keydown).

2. **Video & Canvas Scaling**:
   - SNES native 256×224 output is scaled 2× into the core's 512×448 RGBA buffer.
   - High-DPI and fractional browser zoom are handled cleanly via aspect-ratio containment within `#screen-wrap`.

---

## 3. Map Extension Subsystem

The emulator panel can extend the visible world beyond the SNES 256×224 screen boundaries, seamlessly rendering the full room map around the active emulator display.

### Canvas Layer Hierarchy

| Layer | Element ID | Z-Index | Contents |
|---|---|---|---|
| **0** | `#extended-map` | 0 | Static Mode 1 background tiles + Section 2 animated tile cycles |
| **1** | `#extended-entities` | 1 | Live entities (Boy, Dog, enemies, NPCs, projectiles) |
| **2** | `#extended-foreground` | 2 | Mode 1 priority canopy tiles (occludes Layer 1 entities) + animated canopy |
| **3** | `#screen` | 3 | Core SNES emulator canvas (512×448 RGBA) |
| **4** | `#extended-overlay` | 4 | Step-on triggers (yellow), B-triggers (pink), walk destination reticles |
| **5** | `#extended-fog` | 5 | Atmospheric darkness / fog-of-war outside the camera viewport |

### 2× Pixel Grid Resolution & Color Quantization

- Extended map images are generated at **2× resolution** (`_scale2x`) to match `snes9x2005`'s exact 512×448 buffer grid (2 buffer pixels per SNES pixel).
- Green channels in extended map images are quantized to 6 bits with `&= 0xfc`, matching Snes9x's `((col >> 5) & 0x3F) << 2` DAC calculation and eliminating boundary color seams.

### Live WRAM Entity Tracking & Party Rules

- Entity table begins at `$7E4E89` with a **174-byte stride (`$AE`)**.
- **Boy**: Slot 0 at `$7E4E89` (OBJ palette 0 `$AD0B`).
- **Dog**: Slot 1 at `$7E4F37` (offset `+0xAE` from Boy).
  - *Invariant*: Dog is **never** at `$7E4F17` (which lands inside Boy's status structure).
  - *Invariant*: Active party members bypass the live combat/inactive check (`flags & 0x0020`), preventing Boy and Dog from being clipped when crossing the viewport edges.
- **Act-Specific Dog Palettes**:
  - Act 0 (Podunk): `$B54B`
  - Act 1 (Prehistoria): `$AE0B` (Wolf)
  - Act 2 (Antiqua): `$AE2B` (Greyhound)
  - Act 3 (Gothica): `$AE4B` (Poodle)
  - Act 4 (Omnitopia): `$AE6B` (Toaster / sprite bank `$D2`)
- **Sprite Banks**: Extended entities accept sprite banks `$C0..$DF`.

### Projectiles

- Tracked across projectile slots in WRAM `$7E6387`.
- Filter: `type !== 0` and sprite bank in `$C0..$DF`.
- **Subpixel Scaling**: Coordinate values are divided by 16 (`Math.floor(raw / 16)`), matching SNES engine routine `$90DE88`.
- **3D Elevation**: Rendered at `posY - sprite.originY - posZ`, ensuring thrown spears, boomerangs, and spells render at the correct altitude.

### Dynamic Animated Tiles

- Room Section 2 animation channels are parsed and packaged by `buildAnimationGroups`.
- Extended tiles cycle frame graphics dynamically on Layer 0 and Layer 2 according to each group's delay schedule.
- Animated cells are cleared from the foreground image via `clearAnimatedCells` so static frame-0 priority tiles do not occlude active animations.

### Trigger Overlays

- Step-on triggers (yellow rects) and B-triggers (pink rects) are rendered across the extended map.
- Coordinates follow camera scroll offsets in real time.

---

## 4. Runtime Everscript Injection Engine

The emulator allows compiling and injecting Everscript bytecode directly into the live game without reloading the ROM or restarting emulation.

### Execution Workflow

```text
Right-click on Map
  ↓
Calculate Room Coordinates (targetX, targetY)
  ↓
Compile to Everscript Bytecode:
  walk(ACTIVE, COORDINATE_ABSOLUTE, X, Y)
  [0x9D, 0xD2, 0x84, xLo, xHi, 0x84, yLo, yHi, 0x00]
  ↓
Write Bytecode into ROM Free Space ($C409E4) & WRAM Scratch ($7EFE00)
  ↓
Find Free Slot in Engine Script Stack ($7E28FC..$7E2EEA)
  ↓
Set Slot Location = $C409E4, State = 0x0002 (Running)
  ↓
SNES Engine Executes Walk Command on Next Frame Tick!
```

### Memory Addresses

- **ROM Free Space**: `$C409E4` (file offset `0x409E4`), empty zero-padding in bank `$C4`.
- **WRAM Scratch**: `$7EFE00`.
- **Engine Script Stack**: `$7E28FC` (20 slots, 79 bytes / `$4F` per slot).
  - Slot state at `+0x00` (`0x0000` = idle, `0x0002` = running).
  - Script pointer at `+0x08` (3-byte 24-bit address).

---

## 5. Roadmap & Future Work

1. **Interactive Everscript REPL / Console**:
   - CLI input in emulator panel to execute arbitrary Everscript statements:
     - `teleport(MAP.BUG_MOUND, 12, 14)`
     - `give_item(ITEM.JAGUAR_RING)`
     - `damage(ACTIVE, 50)`
     - `<0x2258> = 1`
2. **VS Code Debug Adapter Protocol (DAP) Integration**:
   - Set breakpoints directly in `.evs` source files.
   - Pause emulation at bytecode boundaries.
   - Step over / step into VM script instructions.
   - Inspect local script variables and stack frames.
3. **Save State Scrubbing**:
   - Visual timeline slider for state save/rewind.
   - Export state saves to disk for testing reproducible room scenarios.
4. **Bi-directional WRAM Sync**:
   - Stream live WRAM deltas to Memory Radar tab.
   - Real-time Call Log updates when scripts dispatch.
