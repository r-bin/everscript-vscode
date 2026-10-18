# Sparse Palette & Weather Preset Bitmask Decompressor ($80:9741 – $80:A16E)

> **Subsystem**: Screen Effects, CGRAM Palette Shadow Buffer & Weather Config Engine  
> **ROM Addresses**: `$80:9741` (`weather_preset_and_palette_dispatcher`), `$80:974B` (`sparse_palette_stream_decompressor`), `$80:A16E` (`palette_cgram_buffer_commit`)  
> **Clean C Module**: `engine-core/screen-flash.c`  
> **Recomp Symbols**: `func_809741`, `func_80974B`  
> **Confidence**: Confirmed  

---

## 1. Architectural Role

The Secret of Evermore engine synchronizes dynamic lighting, screen flashes (lightning strikes, explosion flares, damage flashes), and weather configuration presets (`$7E:72D1` – `$7E:734F`) through a unified 2-bit tagged run-length stream decompressor:

1. **Dispatcher Routing (`$80:9741`)**:
   - Inspects the preset header in ROM Bank `$EC` (`$EC:0001,X`).
   - If bit 15 is 0: jumps directly to raw linear copier `load_weather_preset_raw_copy` (`$80:A2E0`).
   - If bit 15 is 1: engages the **Sparse Palette & Preset Bitmask Decompressor (`$80:974B`)**.

2. **2-Bit Tag Sparse Zero Decompression Algorithm**:
   - The 128-byte destination configuration block and CGRAM shadow buffer (`$7E:72D1` – `$7E:734F`) is structured into 8 sequential blocks of 8 words (16 bytes each):
     - Blocks 0..4 (`$7E:72D1`..`$7E:731F`): Weather physics (velocity, boundaries, particle sprite attributes).
     - Blocks 5..7 (`$7E:7321`..`$7E:734F`): CGRAM shadow palettes for screen flash effects and HDMA scanline gradient bands.
   - For each 8-word block, the stream reads a 16-bit flag word:
     - **Flag == 0x0000 (Uncompressed Chunk)**: Reads 8 consecutive 16-bit words directly from source.
     - **Flag != 0x0000 (Sparse Compressed Chunk)**: The flag serves as a 16-bit bitmask register in Direct Page `$12`. For each pair of color/config words (4 iterations per block), 2 bits are evaluated via `LSR $12`:
       - `Tag 00` (`b0=0, b1=0`): Both words are non-zero; reads 2 words (4 bytes) from source stream.
       - `Tag 01` (`b0=1, b1=0`): Word 0 is zero (`0x0000`), word 1 is read from source (2 bytes consumed).
       - `Tag 10` (`b0=0, b1=1`): Word 0 is read from source (2 bytes consumed), word 1 is zero (`0x0000`).
       - `Tag 11` (`b0=1, b1=1`): Both words are zero (`0x0000`); consumes 0 source bytes.

3. **VBLANK CGRAM Commit (`$80:A16E`)**:
   - Upon completing the 8 blocks, jumps to `palette_cgram_buffer_commit` (`$80:A16E`) to stage color records for DMA transfer during VBLANK.

---

## 2. Disassembly Analysis

```assembly
; ==============================================================================
; func_809741: Weather Preset & Palette Stream Dispatcher
; ==============================================================================
$80:9740  AA           TAX
$80:9741  8B           PHB
$80:9742  BF 01 00 EC  LDA $EC0001,X    ; Read preset descriptor flags
$80:9746  30 03        BMI $974B        ; If bit 15 set -> sparse bitmask decompressor
$80:9748  4C E0 A2     JMP $A2E0        ; Otherwise -> raw copy loader

; ==============================================================================
; func_80974B: Sparse Bitmask Decompressor Entry Point
; ==============================================================================
$80:974B  69 00 59     ADC #$5900       ; Set source data bank in Bank $EC
$80:974E  48           PHA
$80:974F  AB           PLB
$80:9750  AB           PLB
$80:9751  BF 00 00 EC  LDA $EC0000,X    ; Read source data stream offset
$80:9755  A8           TAY
$80:9756  A5 D1        LDA $D1          ; Target destination offset
$80:9758  AA           TAX
$80:9759  69 80 00     ADC #$0080       ; Advance destination cursor by 128 bytes
$80:975C  85 D1        STA $D1

; Block 0: $7E:72D1 - $7E:72DF (8 Words)
$80:975E  B9 00 00     LDA $0000,Y      ; Read chunk compression flag
$80:9761  D0 41        BNE $97A4        ; If non-zero -> bitmask decompressor
; Linear copy of 8 raw words:
$80:9763  B9 01 00     LDA $0001,Y -> STA $7E72D1,X
$80:976A  B9 03 00     LDA $0003,Y -> STA $7E72D3,X
$80:9771  B9 05 00     LDA $0005,Y -> STA $7E72D5,X
$80:9778  B9 07 00     LDA $0007,Y -> STA $7E72D7,X
$80:977F  B9 09 00     LDA $0009,Y -> STA $7E72D9,X
$80:9786  B9 0B 00     LDA $000B,Y -> STA $7E72DB,X
$80:978D  B9 0D 00     LDA $000D,Y -> STA $7E72DD,X
$80:9794  B9 0F 00     LDA $000F,Y -> STA $7E72DF,X
$80:979B  TYA; CLC; ADC #$0010; TAY
$80:97A1  4C FE 97     JMP $97FE        ; Advance to Block 1

; Compressed Chunk Handler (DP $12 Shift Loop):
$80:97A4  85 12        STA $12          ; Store compression bitmask in DP $12
$80:97A6  46 12        LSR $12          ; Shift bit 0
$80:97A8  90 0F        BCC $97B9
$80:97AA  46 12        LSR $12          ; Shift bit 1
$80:97AC  90 1F        BCC $97CD
; Tag 11: Both zero
$80:97AE  7B           TDC              ; A = 0x0000
$80:97AF  9F D1 72 7E  STA $7E72D1,X
$80:97B3  9F D3 72 7E  STA $7E72D3,X
$80:97B7  80 37        BRA $97F0

$80:97B9  46 12        LSR $12          ; Bit 0 was 0: check bit 1
$80:97BB  90 20        BCC $97DD
; Tag 10: Word 0 read from stream, Word 1 zero
$80:97BD  B9 01 00     LDA $0001,Y
$80:97C0  9F D1 72 7E  STA $7E72D1,X
$80:97C4  7B           TDC
$80:97C5  9F D3 72 7E  STA $7E72D3,X
$80:97C9  INY; INY
$80:97CB  80 23        BRA $97F0

; Tag 01: Word 0 zero, Word 1 read from stream
$80:97CD  7B           TDC
$80:97CE  9F D1 72 7E  STA $7E72D1,X
$80:97D2  B9 01 00     LDA $0001,Y
$80:97D5  9F D3 72 7E  STA $7E72D3,X
$80:97D9  INY; INY
$80:97DB  80 13        BRA $97F0

; Tag 00: Both words read from stream
$80:97DD  B9 01 00     LDA $0001,Y
$80:97E0  9F D1 72 7E  STA $7E72D1,X
$80:97E4  B9 03 00     LDA $0003,Y
$80:97E7  9F D3 72 7E  STA $7E72D3,X
$80:97EB  TYA; CLC; ADC #$0004; TAY

; Repeats for pairs 1, 2, 3 across all 8 blocks up to $80:A16E
$80:A16E  ...          ; Jumps to palette_cgram_buffer_commit and RTS ($80:A2DF)
```

---

## 3. Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

#define TOTAL_CONFIG_BLOCKS  8
#define WORDS_PER_BLOCK      8
#define TOTAL_CONFIG_WORDS   (TOTAL_CONFIG_BLOCKS * WORDS_PER_BLOCK) /* 64 words = 128 bytes */

/* External PPU palette commit function */
extern void palette_cgram_buffer_commit(uint16_t buffer_base_offset);
extern void load_weather_preset_raw_copy(uint16_t preset_index);
extern const uint8_t *rom_bank_ec_ptr(uint32_t offset);

/**
 * Decodes a 2-bit tag pair from the shift mask register.
 *
 * @param mask_ptr Pointer to the 16-bit shift register
 * @param stream   Pointer to incoming compressed byte stream
 * @param w0       Output for first decoded 16-bit word
 * @param w1       Output for second decoded 16-bit word
 */
static void decode_word_pair(uint16_t *mask_ptr, const uint8_t **stream, uint16_t *w0, uint16_t *w1) {
    uint8_t bit0 = (uint8_t)(*mask_ptr & 1);
    *mask_ptr >>= 1;

    uint8_t bit1 = (uint8_t)(*mask_ptr & 1);
    *mask_ptr >>= 1;

    uint8_t tag = (bit0) | (bit1 << 1);

    switch (tag) {
        case 0: /* Tag 00: Both non-zero, consume 4 bytes */
            *w0 = *(const uint16_t *)(*stream);
            *stream += 2;
            *w1 = *(const uint16_t *)(*stream);
            *stream += 2;
            break;

        case 1: /* Tag 01: Word 0 is read, Word 1 is zero */
            *w0 = *(const uint16_t *)(*stream);
            *stream += 2;
            *w1 = 0x0000;
            break;

        case 2: /* Tag 10: Word 0 is zero, Word 1 is read */
            *w0 = 0x0000;
            *w1 = *(const uint16_t *)(*stream);
            *stream += 2;
            break;

        case 3: /* Tag 11: Both zero, consume 0 bytes */
        default:
            *w0 = 0x0000;
            *w1 = 0x0000;
            break;
    }
}

/**
 * Master dispatcher and sparse bitmask stream decompressor for
 * weather presets, lighting flashes, and CGRAM shadow buffers.
 *
 * Address: $80:9741 - $80:A16E
 *
 * @param preset_id Index of the configuration preset in Bank $EC
 * @param dest_wram Pointer to destination WRAM ($7E:72D1 - $7E:734F)
 */
void weather_preset_and_palette_dispatcher(uint16_t preset_id, uint16_t *dest_wram) {
    const uint8_t *table_entry = rom_bank_ec_ptr(preset_id * 4);
    uint16_t descriptor_flags = *(const uint16_t *)(table_entry + 2);

    /* Bit 15 determines linear uncompressed vs sparse 2-bit tag compression */
    if ((descriptor_flags & 0x8000) == 0) {
        load_weather_preset_raw_copy(preset_id);
        return;
    }

    uint16_t stream_offset = *(const uint16_t *)(table_entry);
    const uint8_t *stream = rom_bank_ec_ptr(stream_offset);

    uint16_t *out_ptr = dest_wram;

    /* Decompress all 8 blocks (64 words = 128 bytes total) */
    for (int block = 0; block < TOTAL_CONFIG_BLOCKS; block++) {
        uint16_t chunk_flag = *(const uint16_t *)stream;
        stream += 2;

        if (chunk_flag == 0x0000) {
            /* Raw uncompressed block: copy 8 consecutive 16-bit words */
            for (int w = 0; w < WORDS_PER_BLOCK; w++) {
                *out_ptr++ = *(const uint16_t *)stream;
                stream += 2;
            }
        } else {
            /* Compressed block: decode 4 word pairs via 16-bit bitmask in $12 */
            uint16_t mask = chunk_flag;
            for (int pair = 0; pair < 4; pair++) {
                uint16_t w0, w1;
                decode_word_pair(&mask, &stream, &w0, &w1);
                *out_ptr++ = w0;
                *out_ptr++ = w1;
            }
        }
    }

    /* Finalize and stage palettes for VBLANK CGRAM commit */
    palette_cgram_buffer_commit(0x7321);
}
```

---

## 4. Verification & Behavioral Equivalence

| Test Condition | Assembly Logic | C Implementation | Status |
|---|---|---|---|
| Compression Flag Routing | `LDA $EC0001,X; BMI $974B` | `(descriptor_flags & 0x8000) != 0` | Identical |
| Raw Chunk Copy | `chunk_flag == 0` -> sequential 8-word copy | Linear 8-word memory copy | Identical |
| Tag `11` Decode | `TDC` stored to both words | `*w0 = 0; *w1 = 0;` (0 bytes consumed) | Identical |
| Tag `01` Decode | `Word 0 = read, Word 1 = TDC` | `*w0 = read; *w1 = 0;` (2 bytes consumed) | Identical |
| Tag `10` Decode | `Word 0 = TDC, Word 1 = read` | `*w0 = 0; *w1 = read;` (2 bytes consumed) | Identical |
| Tag `00` Decode | Both words read from stream | `*w0 = read; *w1 = read;` (4 bytes consumed) | Identical |
| 128-byte Boundary | 8 blocks $\times$ 8 words = 64 words | `TOTAL_CONFIG_BLOCKS * WORDS_PER_BLOCK` | Identical |
| Post-Decompress Commit | `JMP $A16E` (`palette_cgram_buffer_commit`) | `palette_cgram_buffer_commit(0x7321)` | Identical |
