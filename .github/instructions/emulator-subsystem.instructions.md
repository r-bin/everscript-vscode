---
name: emulator-subsystem
description: Rules, build instructions, and release checklist for the embedded snes9x2005-wasm emulator core and webview runner.
applyTo: "src/emulator/**"
---

# Skill: Emulator Subsystem

Use this skill when modifying or releasing the embedded SNES emulator core (`src/emulator/core/`),
the host panel (`src/emulator/panel.js`), or the webview runner (`src/emulator/panel-webview.js`).

---

## 1. Core Architecture & Build Process

The emulator uses `snes9x2005-wasm` compiled with Emscripten (`emcc`).

Two variants are tracked:
- `src/emulator/core/snes9x2005-wasm`: The debugger-enabled fork (`feature/vscode-debugger-integration`).
- `src/emulator/core/snes9x2005-wasm-vanilla`: Upstream vanilla base.

### Building Cores

To compile the cores via `tools/build_snes_core.sh`:

```sh
# Build custom debugger core:
sh tools/build_snes_core.sh custom

# Build vanilla core:
sh tools/build_snes_core.sh vanilla
```

Requirements:
- Emscripten (`emcc`) in PATH (installed via Homebrew or emsdk).
- Output files: `snes9x_2005.js` and `snes9x_2005.wasm` placed directly inside the core folder.

---

## 2. Legal & Packaging Invariants

1. **Non-Commercial Snes9x License**:
   - Snes9x code is strictly non-commercial freeware for personal use.
   - All copies of binary distributions (`.wasm`, `.js`) MUST be accompanied by the `copyright` file.
2. **GNU GPL v2 (NDSSFC/ZSNES)**:
   - Portions derived from NDSSFC and ZSNES require source availability.
3. **Packaging Rules (`.vscodeignore`)**:
   - `src/emulator/core/**/copyright` must **NEVER** be excluded from `.vscodeignore`.
   - The compiled artifacts (`snes9x_2005.js` and `snes9x_2005.wasm`) must always ship alongside their respective `copyright` files.
   - Intermediate object files, sources (`source/`), build scripts (`*.sh`), and submodules (`.git/`) are excluded to keep VSIX bundle sizes lean.

---

## 3. Audio & Video Invariants

1. **Audio Sampling**:
   - Web Audio `AudioContext` defaults to 44,100 Hz (`AUDIO_FREQ = 44100`).
   - `S9xSetPlaybackRate` in `exports.c` must receive the exact requested sample rate (44100 Hz), never a hardcoded lower frequency.
   - `available_samples` per frame in `S9xSoundCallback` must be calculated dynamically:
     `available_samples = Settings.SoundPlaybackRate / 60` (735 samples/frame at 44.1 kHz).
   - Audio ring buffers must be at least 16,384 samples (`SOUND_BUFFER_SAMPLES`). Under-runs must zero-pad rather than repeating old buffers (to prevent robotic buzzing and clicking).
2. **Display Scaling**:
   - In standard SNES low-res mode (256×224), `GFX.Screen` pitch is 512 words.
   - `getScreenBuffer()` must scale 2× horizontally and vertically into the 512×448 RGBA buffer, so the active SNES frame fills the full canvas instead of rendering into the top-left quarter.
   - `#screen-wrap` fits `#screen` using aspect ratio containment, expanding dynamically when the bottom script stack is collapsed.

---

## 4. Controls & Input Mapping

Standard keyboard layout:
- D-Pad: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- Buttons:
  - A: `V` (`v` / `V`)
  - B: `C` (`c` / `C`)
  - X: `D` (`d` / `D`)
  - Y: `X` (`x` / `X`)
  - L: `A` (`a` / `A`)
  - R: `S` (`s` / `S`)
  - Start: `Enter`
  - Select: `Space` (`' '`)
  - Pause / Resume: `Escape`

---

---

## 5. Map Extension Subsystem

The emulator panel can extend the visible world beyond the SNES 256×224 screen boundaries, seamlessly rendering the active room around the active emulator display.

### Multi-Layer Compositing

| Layer | Element ID | Z-Index | Role |
|---|---|---|---|
| 0 | `#extended-map` | 0 | Static Mode 1 background tiles + Section 2 animated tile cycles |
| 1 | `#extended-entities` | 1 | Live WRAM entities (Boy, Dog, enemies, NPCs, projectiles) |
| 2 | `#extended-foreground` | 2 | Priority Mode 1 canopy tiles + animated foreground (occludes Layer 1 entities) |
| 3 | `#screen` | 3 | Core SNES emulator canvas (512×448 RGBA) |
| 4 | `#extended-overlay` | 4 | Step-on triggers (yellow), B-triggers (pink), right-click destination reticles |
| 5 | `#extended-fog` | 5 | Atmospheric darkness / fog-of-war outside the viewport |

### 2× Pixel Grid & Color Quantization

1. **2× Source Map Resolution**: Extended composite and foreground images are rendered at 2× scale (`_scale2x`), matching the core's 512×448 buffer grid (2 buffer pixels per SNES pixel) to prevent pixel jitter at any zoom level.
2. **Green Channel Quantization**: Green channels in rendered map bitmaps are quantized to 6 bits with `&= 0xfc`, matching Snes9x's `((col >> 5) & 0x3F) << 2` DAC conversion and eliminating visible boundary seams.

---

## 6. Live WRAM Entity Tracking & Party Invariants

1. **Entity Stride**: Entity table starts at `$7E4E89` with a **174-byte stride (`$AE`)**.
2. **Boy & Dog Party Slots**:
   - Boy: Slot 0 at `$7E4E89` (OBJ palette 0 `$AD0B`).
   - Dog: Slot 1 at `$7E4F37` (`+0xAE` stride from Boy).
   - **CRITICAL**: Dog is **never** at `$7E4F17` (which overlaps Boy's internal status struct).
   - Active party members MUST bypass the live combat/inactive check (`flags & 0x0020`), which is used by standard NPC/enemy spawns but would improperly clip Boy and Dog when crossing viewport borders.
3. **Act-Specific Dog Palettes**:
   - Act 0 (Podunk Pup): `$B54B`
   - Act 1 (Prehistoria Wolf): `$AE0B`
   - Act 2 (Antiqua Greyhound): `$AE2B`
   - Act 3 (Gothica Poodle): `$AE4B`
   - Act 4 (Omnitopia Toaster): `$AE6B` (sprite bank `$D2`)
4. **Sprite Banks**: Accepted entity sprite banks are `$C0..$DF`.

---

## 7. Projectile Tracking & 3D Elevation

1. **Active Check**: Projectile slots in WRAM `$7E6387` are active when `type !== 0` and sprite bank is in `$C0..$DF`.
2. **Subpixel Scaling**: Coordinate values are divided by 16 (`Math.floor(raw / 16)`), matching SNES engine routine `$90DE88`.
3. **3D Elevation Z-Offset**: Render at `posY - sprite.originY - posZ` (single division). Do not divide `posZ` twice.

---

## 8. Runtime Everscript Injection & Right-Click Walk

1. **Core Debugger Exports**:
   - `writeRomByte(offset, val)` and `readRomByte(offset)` are exposed by `snes9x2005-wasm` debugger exports.
2. **Bytecode Layout**:
   - `walk(ACTIVE, COORDINATE_ABSOLUTE, X, Y)`:
     `[0x9D, 0xD2, 0x84, xLo, xHi, 0x84, yLo, yHi, 0x00]`
3. **Memory Targets**:
   - ROM Free Space: `$C409E4` (file offset `0x409E4`, empty zero-padding in bank `$C4`).
   - WRAM Scratch: `$7EFE00`.
4. **Script Stack Scheduling**:
   - Engine script stack is at `$7E28FC` (20 slots, 79 bytes each).
   - Locate an idle slot (`state === 0`), write the 24-bit pointer to `$C409E4`, and set `state = 0x0002` (executing).
5. **Right-Click Interaction**:
   - Webview intercepts `contextmenu` on `#screen-wrap`, maps mouse client coordinates via `lastLayout` to room coordinates, and fires `injectEverscript('walk(ACTIVE, COORDINATE_ABSOLUTE, X, Y)')`.

---

## 9. Verification Checklist

Before releasing any changes to `src/emulator/`:
- [ ] Run `npm run test:emulator-runtime` to verify core file integrity and exports.
- [ ] Run `node tests/debugger/emulator-health.test.js`.
- [ ] Verify that `snes9x2005-wasm` builds cleanly without warnings or errors.
- [ ] Check that `.vscodeignore` preserves `copyright` files in the package.
- [ ] Verify ASCII-only encoding in `src/emulator/panel.js` and `src/emulator/panel-webview.js`.

