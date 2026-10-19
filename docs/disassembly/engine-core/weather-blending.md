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

```c
// HDMA Sky Gradient Band Registers in WRAM ($7E:7341..$7E:734F):
typedef struct HDMASkyGradient {
    uint16_t band0_color;  // $7E:7341: Scanline band 0 base color
    uint16_t band0_scroll; // $7E:7343: Scanline band 0 scroll offset
    uint16_t band1_color;  // $7E:7345: Scanline band 1 base color
    uint16_t band1_scroll; // $7E:7347: Scanline band 1 scroll offset
    uint16_t band2_color;  // $7E:7349: Scanline band 2 base color
    uint16_t band2_scroll; // $7E:734B: Scanline band 2 scroll offset
    uint16_t band3_color;  // $7E:734D: Scanline band 3 base color
    uint16_t band3_scroll; // $7E:734F: Scanline band 3 scroll offset
} HDMASkyGradient;

// Weather Preset Buffer Management:
// DP $12   - 16-bit sparse decompression bitmask
// DP $D1   - Preset buffer cursor in WRAM (advances by 128 bytes)
// $7E:72D1..$7E:734F - Active weather configuration block (128 bytes)
// Bank $EC:0000      - Master weather preset database in ROM
```

---

## 3. Clean C Decompilation

```c
#include <stdint.h>
#include <stdbool.h>

extern HDMASkyGradient g_hdma_sky_gradient; // $7E:7341
extern uint16_t g_weather_buffer_cursor;    // DP $D1
extern uint16_t g_active_weather_block[64]; // $7E:72D1

/**
 * $80:A1B4 - hdma_sky_gradient_sparse_unpack
 * Decompresses 4 HDMA color bands from sparse bitmask stream into $7E:7341..$7E:734F.
 */
void hdma_sky_gradient_sparse_unpack(uint16_t bitmask, const uint16_t* stream_data) {
    uint16_t* dest_bands = (uint16_t*)&g_hdma_sky_gradient;
    uint16_t stream_idx = 4; // Data offset starts after header (at +$08)

    for (int band = 0; band < 4; band++) {
        uint8_t code = bitmask & 0x03;
        bitmask >>= 2;

        if (code == 0) {
            // Both words present in stream
            dest_bands[band * 2 + 0] = stream_data[stream_idx++];
            dest_bands[band * 2 + 1] = stream_data[stream_idx++];
        } else if (code == 1) {
            // Word 1 present, word 2 zeroed
            dest_bands[band * 2 + 0] = stream_data[stream_idx++];
            dest_bands[band * 2 + 1] = 0;
        } else if (code == 2) {
            // Word 1 zeroed, word 2 present
            dest_bands[band * 2 + 0] = 0;
            dest_bands[band * 2 + 1] = stream_data[stream_idx++];
        } else {
            // Both words zeroed
            dest_bands[band * 2 + 0] = 0;
            dest_bands[band * 2 + 1] = 0;
        }
    }
}

/**
 * $80:A2E0 - weather_preset_load_from_rom_database
 * Copies a 128-byte weather preset from Bank $EC into active WRAM staging block.
 */
void weather_preset_load_from_rom_database(uint16_t preset_id) {
    const uint16_t* preset_src = (const uint16_t*)(0xEC0000 + (preset_id * 128));

    // Advance 128-byte circular cursor in WRAM
    g_weather_buffer_cursor += 128;

    // Copy 64 words (128 bytes) into active weather preset config block
    for (int i = 0; i < 64; i++) {
        g_active_weather_block[i] = preset_src[i];
    }
}
```

---

## 4. Verification & Behavioral Equivalence

1. **Sparse 2-Bit Decoding**: Matches assembly `$80:A1B6` – `$80:A200` (`LSR $12; BCC; LSR $12; BCC`) branching to 4 distinct unpacking combinations per band.
2. **HDMA Gradient Register Map**: Accurately maps unpacked words to `$7E:7341`..`$7E:734F`.
3. **Preset Database Source**: Matches `$80:A2E6` indexing Bank `$EC:0000` with 128-byte stride (`ADC #$0080; STA $D1`).
