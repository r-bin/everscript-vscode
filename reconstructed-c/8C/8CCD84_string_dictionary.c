/*
 * Routine: $8CCD84 (string_dictionary)
 * Bank: $8C (ROM Offset: $0CCD84)
 * Source: docs/disassembly/ui/string-dictionary.md
 */

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#include <string.h>

/* ROM Dictionary Table Addresses (Bank $91) */
#define SOE_ROM_BANK_91_BASE             0x910000
#define SOE_ROM_DIGRAPH_TABLE_ADDR       0x91F32E   /* 32 digraph pairs (64 bytes) */
#define SOE_ROM_SINGLE_CHAR_TABLE_ADDR   0x91F3AE   /* 64 single character mappings */
#define SOE_ROM_DICT_SECONDARY_PTRS      0x91F3EC   /* 64 secondary word pointer offsets */
#define SOE_ROM_DICT_SECONDARY_DATA      0x91F66C   /* Secondary word string storage */
#define SOE_ROM_DICT_PRIMARY_PTRS        0x91F46C   /* 256 primary word pointer offsets */
#define SOE_ROM_DICT_PRIMARY_DATA        0x91F7D5   /* Primary word string storage */

#define SOE_DIALOGUE_BUFFER_WRAM_BASE    0x7F0000
#define SOE_DEFAULT_DIALOGUE_BUF_OFFSET  0xD81E

/* External ROM read abstraction */
extern uint8_t  rom_read8(uint32_t addr);
extern uint16_t rom_read16(uint32_t addr);

/**
 * Expands a 5-tier compressed dialogue string from ROM into the destination buffer.
 *
 * Implements the exact behavioral semantics of func_CCCD84 ($8C:CD84):
 * - Tier 1: Single Character Table ($91:F3AE)
 * - Tier 2: Literal ASCII Run (N bytes)
 * - Tier 3: Digraph Pair ($91:F32E)
 * - Tier 4: Secondary Word Dictionary ($91:F3EC / $91:F66C)
 * - Tier 5: Primary Word Dictionary ($91:F46C / $91:F7D5)
 *
 * @param stream_addr 24-bit ROM address of the compressed token stream (e.g. $C0:xxxx)
 * @param out_buf     Destination buffer in WRAM (receives NUL-terminated string)
 * @param max_len     Maximum buffer capacity (prevent overrun)
 * @return Total number of characters written (excluding NUL terminator)
 */
size_t dialogue_string_dictionary_expand(uint32_t stream_addr, char *out_buf, size_t max_len) {
    if (!out_buf || max_len == 0) {
        return 0;
    }

    size_t out_pos = 0;
    uint32_t ptr = stream_addr;

    while (out_pos + 1 < max_len) {
        uint8_t token = rom_read8(ptr);

        if ((token & 0x80) == 0) {
            /* Bit 7 is 0: Either Single Character (Tier 1) or Literal Run (Tier 2) */
            if ((token & 0x40) == 0) {
                /* Tier 1: Single Character Lookup ($00..$3F) */
                uint8_t glyph = rom_read8(SOE_ROM_SINGLE_CHAR_TABLE_ADDR + token);
                if (glyph == 0x00) {
                    /* NUL terminator: end of string */
                    break;
                }
                out_buf[out_pos++] = (char)glyph;
                ptr++;
            } else {
                /* Tier 2: Literal ASCII Run ($40..$7F) */
                uint8_t run_len = token & 0x3F;
                bool terminated = false;

                for (uint8_t i = 0; i < run_len; i++) {
                    ptr++;
                    uint8_t lit = rom_read8(ptr);
                    if (out_pos + 1 < max_len) {
                        out_buf[out_pos++] = (char)lit;
                    }
                    if (lit == 0x00) {
                        terminated = true;
                        break;
                    }
                }

                if (terminated) {
                    break;
                }
                ptr++;
            }
        } else {
            /* Bit 7 is 1: Digraph (Tier 3) or Word Dictionary (Tier 4 / Tier 5) */
            if ((token & 0x40) == 0) {
                /* Tier 3: Digraph ($80..$BF) */
                uint8_t digraph_idx = (token & 0x3F) << 1;
                uint8_t c1 = rom_read8(SOE_ROM_DIGRAPH_TABLE_ADDR + digraph_idx);
                uint8_t c2 = rom_read8(SOE_ROM_DIGRAPH_TABLE_ADDR + digraph_idx + 1);

                out_buf[out_pos++] = (char)c1;
                if (c2 == 0x00) {
                    /* NUL terminator in second char */
                    break;
                }
                if (out_pos + 1 < max_len) {
                    out_buf[out_pos++] = (char)c2;
                }
                ptr++;
            } else {
                /* Bit 6 is 1 ($C0..$FF): Word Dictionary */
                uint32_t word_addr = 0;

                if (token == 0xC0) {
                    /* Tier 5: Primary Word Dictionary (2-byte token) */
                    ptr++;
                    uint8_t word_idx = rom_read8(ptr);
                    uint16_t offset = rom_read16(SOE_ROM_DICT_PRIMARY_PTRS + ((uint16_t)word_idx << 1));
                    word_addr = SOE_ROM_BANK_91_BASE | (uint16_t)(0xF7D5 + offset);
                    ptr++;
                } else {
                    /* Tier 4: Secondary Word Dictionary (1-byte token $C1..$FF) */
                    uint8_t word_idx = (token << 1) & 0x7E;
                    uint16_t offset = rom_read16(SOE_ROM_DICT_SECONDARY_PTRS + word_idx);
                    word_addr = SOE_ROM_BANK_91_BASE | (uint16_t)(0xF66C + offset);
                    ptr++;
                }

                /* Copy NUL-terminated word into output buffer */
                for (;;) {
                    uint8_t ch = rom_read8(word_addr++);
                    if (ch == 0x00) {
                        break;
                    }
                    if (out_pos + 1 < max_len) {
                        out_buf[out_pos++] = (char)ch;
                    }
                }
            }
        }
    }

    out_buf[out_pos] = '\0';
    return out_pos;
}
