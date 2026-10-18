# Dialogue Window & Text Box String Decoder Engine ($8C:CCF5, $8C:CD35, $91:D000)

> **Subsystem**: Dialogue Window & String Key Decompression Subsystem  
> **ROM Addresses**: `$8C:CCF5` (`decode_dialogue_string_key`), `$8C:CD35` (`decode_dialogue_string_key_secondary`), `$91:D000` (String Keys Master Table)  
> **Clean C Module**: `ui/dialogue-window.c`  
> **Recomp Symbol**: `func_CCCCF5_M0X0`  
> **Confidence**: Confirmed

---

## 1. Architectural Role

Secret of Evermore manages all in-game text (NPC dialogue, item descriptions, alchemy names, menu labels) via a dictionary-compressed 3,002-entry string table:
- **String Keys Master Table (`$91:D000`)**:
  - 3 bytes per string key: 24-bit pointer/descriptor.
  - Bit 23 (`0x800000`): Compression flag (1 = dictionary/Huffman compressed, 0 = raw ASCII).
  - Bits 15..22: Target ROM bank index (typically `$C0..$C4`).
  - Bits 0..14: In-bank address offset.
- **Decompression Algorithm (`$8C:CCF5`)**:
  - Unpacks characters into WRAM text buffer `$7F:D81E` for active dialogue windows and font tile blitters.
  - Control Byte Parsing:
    - `0xC0`: Primary word dictionary pointer table (`$91:F46C`), data stream at `$91:F7D5`.
    - `(d & 0xC0) == 0xC0`: Secondary word dictionary table (`$91:F3EC`), data stream at `$91:F66C`.
    - `(d & 0xC0) == 0x40`: Literal plain ASCII string of length `d & 0x3F`.
    - `(d & 0xC0) == 0x80`: 2-byte digraph substitution table (`$91:F32E`).
    - `(d & 0xC0) == 0x00`: Single-character glyph table (`$91:F3AE`).
- **VM Opcode Trigger**: Script VM opcode `0x51` (`dialogue(key)`) invokes this decoder before rendering the dialogue frame and commencing the typewriter tile scroll.

---

## 2. Disassembly Analysis

```assembly
; ==============================================================================
; func_CCCCF5: Decode String Key from Table $91:D000 into Buffer $7F:D81E
; ==============================================================================
$8C:CCF5  8B           PHB
$8C:CCF6  A9 91 00     LDA #$0091       ; String table bank ($91)
$8C:CCF9  85 28        STA $28
$8C:CCFB  A0 00 D0     LDY #$D000       ; Base offset $D000
$8C:CCFE  B7 26        LDA [$26],Y      ; Read 24-bit key descriptor
$8C:CD00  85 2A        STA $2A
$8C:CD02  C8           INY
$8C:CD03  C8           INY
$8C:CD04  B7 26        LDA [$26],Y
$8C:CD06  85 2C        STA $2C
$8C:CD08  A5 2C        LDA $2C
$8C:CD0A  30 18        BMI $CD24        ; If bit 23 set -> compressed string decoder
$8C:CD0C  ...                           ; Plain ASCII copy loop into $7F:D81E
$8C:CD24  22 00 F3 91  JSL $91F300      ; Dictionary expander pass
$8C:CD28  AB           PLB
$8C:CD29  6B           RTL
```

---

## 3. Clean C Implementation

```c
#include <stdint.h>
#include <stdbool.h>
#include <string.h>

#define STRING_KEYS_ROM_ADDR        0x91D000
#define STRING_KEYS_COUNT           3002

#define DICT_PRIMARY_PTRS           0x91F46C
#define DICT_PRIMARY_DATA           0x91F7D5
#define DICT_SECONDARY_PTRS         0x91F3EC
#define DICT_SECONDARY_DATA         0x91F66C
#define DIGRAPH_TABLE_ADDR          0x91F32E
#define SINGLE_CHAR_TABLE_ADDR      0x91F3AE

#define TEXT_BUFFER_WRAM_ADDR       0x7FD81E
#define MAX_DIALOGUE_BUF_LEN        512

typedef struct {
    uint32_t rom_address;
    bool     is_compressed;
} StringKeyDescriptor;

/**
 * Resolves a 24-bit string key from ROM table $91:D000 ($8C:CCF5).
 *
 * @param string_index Index of the dialogue string (0..3001).
 * @return Descriptor with target ROM address and compression flag.
 */
StringKeyDescriptor resolve_string_key(uint16_t string_index) {
    StringKeyDescriptor desc = { 0, false };
    if (string_index >= STRING_KEYS_COUNT) {
        return desc;
    }

    uint32_t entry_addr = STRING_KEYS_ROM_ADDR + (string_index * 3);
    uint32_t b0 = read_rom8(entry_addr);
    uint32_t b1 = read_rom8(entry_addr + 1);
    uint32_t b2 = read_rom8(entry_addr + 2);

    uint32_t raw_val = b0 | (b1 << 8) | (b2 << 16);
    desc.is_compressed = (raw_val & 0x800000) != 0;

    // Resolve physical ROM bus address in bank $C0..$C4
    desc.rom_address = 0xC00000 + (raw_val & 0x7FFF) + ((raw_val & 0x7F8000) << 1);
    return desc;
}

/**
 * Decodes a dictionary-compressed string into the target text buffer ($8C:CCF5 / $91:F300).
 *
 * @param src_addr ROM address containing the compressed stream.
 * @param out_buf  Destination buffer (maps to WRAM $7F:D81E).
 * @param max_len  Maximum capacity of the destination buffer.
 * @return Number of decoded characters written.
 */
size_t decode_compressed_dialogue_string(uint32_t src_addr, char *out_buf, size_t max_len) {
    size_t out_len = 0;
    uint32_t addr = src_addr;
    uint8_t next_plain = 0;

    while (out_len + 1 < max_len) {
        uint8_t d = read_rom8(addr);

        if (next_plain > 0) {
            next_plain--;
            if (d == 0 && next_plain == 0) break;
            out_buf[out_len++] = (char)d;
        } else if (d == 0xC0) {
            // Primary word dictionary lookup
            addr++;
            uint8_t word_idx = read_rom8(addr);
            uint16_t offset = read_rom16(DICT_PRIMARY_PTRS + (word_idx << 1));
            uint32_t word_ptr = DICT_PRIMARY_DATA + offset;

            for (uint8_t c; (c = read_rom8(word_ptr)) != 0; word_ptr++) {
                if (out_len + 1 < max_len) out_buf[out_len++] = (char)c;
            }
        } else if ((d & 0xC0) == 0xC0) {
            // Secondary word dictionary lookup
            uint8_t word_idx = (d << 1) & 0x7E;
            uint16_t offset = read_rom16(DICT_SECONDARY_PTRS + word_idx);
            uint32_t word_ptr = DICT_SECONDARY_DATA + offset;

            for (uint8_t c; (c = read_rom8(word_ptr)) != 0; word_ptr++) {
                if (out_len + 1 < max_len) out_buf[out_len++] = (char)c;
            }
        } else if ((d & 0xC0) == 0x40) {
            // Literal plain ASCII run length
            next_plain = d & 0x3F;
        } else if ((d & 0xC0) == 0x80) {
            // Digraph 2-byte substitution
            uint8_t dig_idx = d << 1;
            char c1 = (char)read_rom8(DIGRAPH_TABLE_ADDR + dig_idx);
            out_buf[out_len++] = c1;

            char c2 = (char)read_rom8(DIGRAPH_TABLE_ADDR + dig_idx + 1);
            if (c2 == '\0') break;
            if (out_len + 1 < max_len) out_buf[out_len++] = c2;
        } else {
            // Single character table substitution
            char c = (char)read_rom8(SINGLE_CHAR_TABLE_ADDR + d);
            if (c == '\0') break;
            out_buf[out_len++] = c;
        }

        addr++;
    }

    out_buf[out_len] = '\0';
    return out_len;
}

/**
 * High-level dialogue string unpacking API called by Script VM opcode 0x51 ($8C:CCF5).
 *
 * @param string_index Dialogue string ID.
 * @return Pointer to decoded null-terminated string in WRAM.
 */
const char* decode_dialogue_string_key(uint16_t string_index) {
    static char s_dialogue_buffer[MAX_DIALOGUE_BUF_LEN];
    StringKeyDescriptor desc = resolve_string_key(string_index);

    if (desc.rom_address == 0) {
        s_dialogue_buffer[0] = '\0';
        return s_dialogue_buffer;
    }

    if (desc.is_compressed) {
        decode_compressed_dialogue_string(desc.rom_address, s_dialogue_buffer, sizeof(s_dialogue_buffer));
    } else {
        // Plain ASCII copy
        size_t i = 0;
        uint32_t addr = desc.rom_address;
        for (char c; (c = (char)read_rom8(addr)) != '\0' && i + 1 < sizeof(s_dialogue_buffer); addr++) {
            s_dialogue_buffer[i++] = c;
        }
        s_dialogue_buffer[i] = '\0';
    }

    return s_dialogue_buffer;
}
```
