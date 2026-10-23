# Weather Effects, Palette Cycling & Screen Shake Engine ($80:9E93, $80:A003, $80:A2E0)

> **Subsystem**: Ambient Environmental Animation, Weather Particles & Screen Shake  
> **ROM Addresses**: `$80:9E93` (`cycle_palette_group_1`), `$80:A003` (`cycle_palette_group_2`), `$80:A2E0` (`weather_tick_and_screen_shake`)  
> **Clean C Module**: `engine-core/weather-palette.c`  
> **Confidence**: Confirmed

---

## 1. Architectural Role

Secret of Evermore maintains real-time atmospheric immersion through three synchronized environmental systems updated during the main frame tick:
- **Animated Palette Cycling (`$80:9E93` / `$80:A003`)**:
  - Dynamically rotates color gradients in WRAM shadow buffers `$7E:7321`..`$7E:732F` and `$7E:7331`..`$7E:733F`.
  - Used for glowing crystals, pulsating acid/swamp rivers, and animated molten lava in Volcano and Underworld maps.
  - Rotated colors are queued for DMA channel 1 transfer directly into PPU CGRAM (`$2122`) during VBLANK (`$80:8616`).
- **Weather Particle Simulation (`$80:A2E0`)**:
  - Simulates falling rain droplets, drifting snow flurries, and volcanic ash embers.
  - Spawns and updates lightweight particle records with sinusoidal drift and downward terminal velocity.
- **Screen Shake Engine (`$7E:2435` / `$7E:2437`)**:
  - Direct Page flag `$C3` enables camera jitter.
  - Alternates horizontal displacement offset `$7E:2435` and vertical displacement offset `$7E:2437` using an oscillating decay curve.
  - Added directly to camera viewport coordinates (`$7E:0F44` / `$7E:0F46`) before metatile clamping.

---

## 2. Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/809E93](soe://rom/code/809E93?asm=1&c=0)


---

## 3. Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/80/809E93_weather_palette.c`](../../../reconstructed-c/80/809E93_weather_palette.c).
> [View in VFS: soe://rom/code/809E93](soe://rom/code/809E93?c=1&asm=0)

