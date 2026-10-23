# HDMA Sky Gradient Sparse Decompressor & Weather Preset Transfer

**Addresses**:
- `hdma_sky_gradient_sparse_unpack`: `$80:A1B4` – `$80:A2DF`
- `weather_preset_load_from_rom_database`: `$80:A2E0` – `$80:A330`

**ROM Source**: Bank `$80` (US 1.0)
**Subsystem**: Boot, Hardware & Weather Subsystem

---

## 1. Overview & Architectural Role

Secret of Evermore achieves atmospheric environmental lighting effects (e.g. desert heat haze, swamp mist, jungle thunderstorms) using SNES HDMA (Horizontal Direct Memory Access) gradient tables that dynamically modulate the background color across scanlines.

Key mechanisms:
1. **2-Bit Sparse Bitmask Decompressor (`hdma_sky_gradient_sparse_unpack`)**:
   Sky gradient presets are stored as compact 2-bit token streams packed into a 16-bit word (`DP $12`). For each of the 4 HDMA color bands:
   - `00`: Full word pair loaded from preset stream (`Y += 4`).
   - `01`: Word 1 loaded, word 2 zeroed (`Y += 2`).
   - `10`: Word 1 zeroed, word 2 loaded (`Y += 2`).
   - `11`: Both words zeroed (`Y += 0`).
   This sparse encoding significantly reduces ROM storage for environmental gradient tables while populating HDMA registers `$7E:7341`..`$7E:734F`.
2. **ROM Preset Database Transfer Engine (`weather_preset_load_from_rom_database`)**:
   Reads weather configurations from the master database located in Bank `$EC:0000`, advances the 128-byte circular buffer pointer in `$D1`, and stages the active preset parameters at `$7E:72D1`..`$7E:734F`.

---

## 2. Data Structures & Memory Layout

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/80/80A1B4_weather_blending.c`](../../../reconstructed-c/80/80A1B4_weather_blending.c).
> [View in VFS: soe://rom/code/80A1B4](soe://rom/code/80A1B4?c=1&asm=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/80/80A1B4_weather_blending.c`](../../../reconstructed-c/80/80A1B4_weather_blending.c).
> [View in VFS: soe://rom/code/80A1B4](soe://rom/code/80A1B4?c=1&asm=0)


---

## 4. Verification & Behavioral Equivalence

1. **Sparse 2-Bit Decoding**: Matches assembly `$80:A1B6` – `$80:A200` (`LSR $12; BCC; LSR $12; BCC`) branching to 4 distinct unpacking combinations per band.
2. **HDMA Gradient Register Map**: Accurately maps unpacked words to `$7E:7341`..`$7E:734F`.
3. **Preset Database Source**: Matches `$80:A2E6` indexing Bank `$EC:0000` with 128-byte stride (`ADC #$0080; STA $D1`).
