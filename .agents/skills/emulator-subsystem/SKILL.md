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

### CDL recorder in the custom core

`source/cdl.c` / `cdl.h` record code/data coverage, call edges, memory xrefs and WRAM
values seen. Every hook site is wrapped in `#if EVS_CDL` (defined to 1 in `cdl.h`; build
with `-DEVS_CDL=0` to strip it). Hooks: instruction dispatch (`cpuexec.c`, all four main
loops), `S9xGetByte/GetWord/SetByte/SetWord` (`getset.c`), DMA start (`dma.c`), NMI/IRQ
entry (`cpuops.c`). Recording only happens inside `S9xMainLoop` (`cdl.active`), so the
debugger's own `readMemory` calls are never attributed to the game.

`source/cdl-optable.h` is generated: after changing `src/emulator/cdl/opcodes.js`, run
`node tools/gen-cdl-optable.js` (a test fails if they drift). Host side: `src/emulator/cdl/`.
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

## 5. Verification Checklist

Before releasing any changes to `src/emulator/`:
- [ ] Run `npm run test:emulator-runtime` to verify core file integrity and exports.
- [ ] Run `node tests/debugger/emulator-health.test.js`.
- [ ] Verify that `snes9x2005-wasm` builds cleanly without warnings or errors.
- [ ] Check that `.vscodeignore` preserves `copyright` files in the package.
