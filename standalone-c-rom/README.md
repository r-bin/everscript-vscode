# Standalone C Bootable SNES ROM (`standalone-c-rom`)

A self-contained, standalone bootable SNES ROM (.sfc) compiled **entirely from pure C files** using the Calypsi 65816 C toolchain.

The ROM targets FastROM (Mode 21 HiROM, 3.58 MHz) and autonomously executes the complete **2-minute attract loop (~7,068 frames)** of *Secret of Evermore* with no controller input:
1. **Scene 0 (Squaresoft Logo)**: Mode 1 composite display (BG1 + BG3 layers) on black background.
2. **Scene 1 (Prologue: Mansion)**: Podunk 1965 mansion exterior establishing shot.
3. **Scene 2 (Prologue: Laboratory)**: Abandoned laboratory machinery and electrical coils.
4. **Scene 3 (Title Screen)**: Full Secret of Evermore title logo.
5. **Scene 4 (Demo 1: Prehistoria)**: Gameplay demo in Prehistoria swamp.
6. **Scene 5 (Demo 2: Antiqua)**: Gameplay demo in Antiqua desert / Colosseum.
7. **Scene 6 (Demo 3: Gothica)**: Gameplay demo in Gothica castle halls.
8. **Scene 7 (Demo 4: Omnitopia)**: Gameplay demo in Omnitopia space station.
9. **Seamless Loop**: At frame 7,068, wraps cleanly back to Scene 0 (Squaresoft logo) and repeats indefinitely.

Each scene executes a smooth 30-frame fade-in (`INIDISP = 0x00 -> 0x0F`), holds for its exact vanilla frame count, performs a 30-frame fade-out (`INIDISP = 0x0F -> 0x00`), and streams the next scene's VRAM/CGRAM/PPU state via DMA channel 0 during forced blank.

---

## Toolchain & Compilation

- **Compiler**: `out/toolchains/calypsi-65816-5.18/bin/cc65816`
- **Linker**: `out/toolchains/calypsi-65816-5.18/bin/ln65816`
- **Linker Script**: `out/toolchains/calypsi-65816-5.18/linker-rules/snes-HiROM.scm`
- **Runtime Library**: `out/toolchains/calypsi-65816-5.18/lib/clib-lc-ld-snes.a`
- **Compiler Flags**:
  `--target=snes --core=65816 --code-model=large --data-model=large -O1 --speed --no-cross-call --force-switch=if-else`
- **Hardware Target**: FastROM Mode 21 HiROM (`*MEMSEL = 1` at `$420D`).

---

## Source Components

- `main.c`: Entry point initializing FastROM (`*MEMSEL = 1`), clearing WRAM, initializing SNES PPU, and driving the autonomous replay loop synchronized to V-Blank NMI.
- `snes_hw.h` / `snes_hw.c`: SNES hardware definitions for PPU and CPU/DMA MMIO registers (`$2100–$213F`, `$4200–$4307`), hardware initialization, and FastROM enablement.
- `ppu.h` / `ppu.c`: PPU helper functions to write display brightness (`INIDISP`), upload palettes to CGRAM via DMA channel 0, and upload tile graphics/tilemaps to VRAM via DMA channel 0.
- `nmi.h` / `nmi.c`: Native 65816 V-Blank NMI interrupt handler (`__attribute__((interrupt(0xffea)))`), clearing NMI latch via `$4210` (`RDNMI`) and tracking frame counters.
- `intro_replay.h` / `intro_replay.c`: Autonomous state machine executing all phases of the opening sequence without joypad input.
- `header.c`: SNES cartridge header in section `snesheader` at `$00FFC0` configured for Mode 21 HiROM FastROM.
- `assets.h` / `extract-assets.mts`: Build-time asset extractor that extracts the vanilla opening logo CHR/tilemap/palette and title cutscene graphics from the user's clean ROM (Rule 0.1 compliance).
- `build.mts`: Orchestrates asset extraction, Calypsi compilation, HiROM linking, and Intel-HEX to `.sfc` conversion into `out/intro-replay.sfc`.
- `verify.mts`: Automated headless test runner that boots `out/intro-replay.sfc` in the snes9x-wasm emulator for 350 frames, verifies CPU/NMI sanity, and captures framebuffer snapshots to `out/intro-replay/`.

---

## Building & Verification

```bash
# Build the standalone C ROM (produces out/intro-replay.sfc)
npm run build:c-rom

# Run the automated 2-minute (7,200 frames) headless emulator verification suite
npm run verify:c-rom
```

