/*
 * Routine: $8CCCF5 (dialogue_window)
 * Bank: $8C (ROM Offset: $0CCCF5)
 * Source: docs/disassembly/ui/dialogue-window.md
 */

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
