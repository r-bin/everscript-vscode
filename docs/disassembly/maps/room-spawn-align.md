# Room Entrance Character Orientation, Spawn Scripting, and Audio Fade Engine ($8E:E508 – $8E:E630)

## 1. Subsystem Architecture Overview

When transitioning into a new room, Secret of Evermore synchronizes entity script initialization, geometry validation, and smooth audio fading through a dedicated coordination loop in Bank `$8E`:

1. **Pre-Roll Frame Loop & Character Script Spawn (`$8E:E508` – `$8E:E567`)**:
   - Evaluates spawn dispatch trigger bits in `$7E:05A9`:
     - Bit 1 (`0x0002`): Resets bit and spawns Boy initialization script (`0x4E89`) using script engine thread spawner `$8E:A091`.
     - Bit 2 (`0x0004`): Resets bit and spawns Dog initialization script (`0x4F37`) using thread spawner `$8E:A091`.
   - Advances room physics and script VMs by calling `per_frame_field_tick` (`$8E:E41E`).
   - Polls room readiness tri-state flags in `$7E:22EA`:
     - Bit 3 (`0x0008`): Map metatile and collision planes decompressed and active.
     - Bit 4 (`0x0010`): Character entity records allocated and initial coordinates aligned.
     - Bit 5 (`0x0020`): Palette DMA gradient initialized.
   - Loops until all 3 bits are simultaneously asserted.

2. **Room Transition Audio Fade-Out & DSP Reset (`$8E:E592` – `$8E:E5C1`)**:
   - Reads current master volume attenuation level from `$7E:0106` bits 3..0.
   - Sequentially steps down volume frame-by-frame:
     - Waits for V-Blank interrupt via `$80:858C`.
     - Multiplies attenuation level by 16 (`ASL` $\times 4$) into register `Y`.
     - Dispatches APU master attenuation command `0x0028` via handshake spinlock.
     - Decrements volume counter `$7E:0B7F` until zero.
   - Issues APU command `0x001A` (sound effect fade/silence) with `Y = 0`.
   - Issues APU command `0x001C` (DSP stereo echo reset) with `Y = 0x8000`.
   - Resets per-room sound latch via `$80:85D8`.

3. **Per-Frame Dynamic Master Volume Fader (`$8E:E5FC` – `$8E:E630`)**:
   - Runs every frame during `per_frame_field_tick` (`$8E:E470`).
   - Checks mute / master override bit 7 in `$7E:0106`; if set, bypasses fade.
   - Evaluates target volume latch `$7E:0B83`:
     - If negative (`0xFF`), fading is inactive.
     - If active:
       - Compares target volume `$7E:0B83` against current volume `$7E:0106`.
       - If current $>$ target: decrements `$7E:0106` (smooth fade-out).
       - If current $<$ target: increments `$7E:0106` (smooth fade-in).
       - Upon reaching target: zeroes out latch `$7E:0B83` to finalize fade.

---

## 2. 65816 Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/8EE508](soe://rom/code/8EE508?asm=1&c=0)


---

## 3. Clean C Reconstructed Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8E/8EE508_room_spawn_align.c`](../../../reconstructed-c/8E/8EE508_room_spawn_align.c).
> [View in VFS: soe://rom/code/8EE508](soe://rom/code/8EE508?c=1&asm=0)


---

## 4. Architectural Invariants & Memory Anchors

- **Readiness Bitfield `$7E:22EA`**:
  - Acts as the primary inter-subsystem barrier. The room loader sets bit 3 when decompression of tile layer data completes, bit 4 when player and companion coordinates are snapped to entrance vectors, and bit 5 when color palette buffers are primed for display.
- **Spawn Trigger Register `$7E:05A9`**:
  - Bit 1 (`0x0002`): Triggers creation of the Boy entity's entering animation and state script thread (`$8E:4E89`).
  - Bit 2 (`0x0004`): Triggers creation of the Dog entity's entering script thread (`$8E:4F37`).
  - Both bits are atomically cleared via `TRB` before launching to prevent thread duplicity.
- **APU Communication Protocol**:
  - Command `0x0028` sends volume attenuation in increments of 16 ($0 \dots 240$), producing a smooth perceptual decibel drop over $\approx 15$ frames without audio popping.
  - Commands `0x001A` and `0x001C` ensure no lingering sound effect channels or reverberating DSP delay echoes corrupt the incoming room's musical identity.
