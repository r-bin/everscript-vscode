/*
 * Routine: $8CCD33 (dialogue_text_decoder)
 * Bank: $8C (ROM Offset: $0CCD33)
 * Source: docs/disassembly/ui/dialogue-text-decoder.md
 */

/**
 * @file dialogue-text-decoder.c
 * @brief Secret of Evermore Dialogue String Key Resolver & DTE/MTE Text Decompressor
 * 
 * Reconstructed from 65816 assembly ($8C:CD33 – $8C:CE29).
 */

#include <stdint.h>
#include <stdbool.h>

#define TEXT_BUFFER_BASE_ADDR   0xDC1E
#define TEXT_CHUNK_SIZE         80
#define TEXT_BUFFER_TOTAL_SIZE  640     /* 8 chunks of 80 bytes */

#define BANK_91_BASE            0x910000
#define STRING_KEYS_ADDR        0xF24A
#define DTE_TABLE_ADDR          0xF32E
#define SINGLE_CHAR_TABLE_ADDR  0xF3AE
#define MTE_OFFSET_TABLE_ADDR   0xF3EC
#define DICT_OFFSET_TABLE_ADDR  0xF46C
#define MTE_BASE_STRING_ADDR    0xF66C
#define DICT_BASE_STRING_ADDR   0xF7D5

typedef struct {
    uint16_t offset;
    uint8_t  bank;
} FarPointer;

typedef struct {
    uint16_t text_buf_cursor;   /* $7E:3BBF */
    uint8_t  wram_bank7f[65536]; /* $7F:0000..$7F:FFFF */
} TextEngineState;

/* External ROM memory reader helper */
extern uint8_t  snes_read_rom_byte(uint8_t bank, uint16_t address);
extern uint16_t snes_read_rom_word(uint8_t bank, uint16_t address);

/**
 * @brief Decompresses 5-tier compressed text bitstream into WRAM ($8C:CD84).
 * 
 * @param state Pointer to engine WRAM state
 * @param src   Far ROM pointer to compressed text
 * @param dest_offset Destination offset within WRAM Bank $7F
 */
void dialogue_text_dte_mte_decoder(TextEngineState *state, FarPointer src, uint16_t dest_offset) {
    uint16_t src_addr = src.offset;
    uint8_t  src_bank = src.bank;
    uint16_t dst = dest_offset;

    while (true) {
        uint8_t token = snes_read_rom_byte(src_bank, src_addr);

        if ((token & 0x80) == 0) {
            /* Tiers 1 & 2: Bit 7 is 0 */
            if ((token & 0x40) == 0) {
                /* Tier 1: Single Decoded Character from Table */
                uint8_t char_code = token & 0x3F;
                uint8_t decoded_char = snes_read_rom_byte(0x91, SINGLE_CHAR_TABLE_ADDR + char_code);
                state->wram_bank7f[dst++] = decoded_char;

                if (decoded_char == 0x00) {
                    break; /* End of string */
                }
            } else {
                /* Tier 2: Literal Raw ASCII Run */
                uint8_t run_len = token & 0x3F;
                uint8_t last_char = 0;

                while (run_len > 0) {
                    src_addr++;
                    last_char = snes_read_rom_byte(src_bank, src_addr);
                    state->wram_bank7f[dst++] = last_char;
                    run_len--;
                }

                if (last_char == 0x00) {
                    break; /* Terminated mid-run */
                }
            }
        } else {
            /* Tiers 3, 4 & 5: Bit 7 is 1 */
            if ((token & 0x40) == 0) {
                /* Tier 3: Dual Tile Encoding (DTE) Digram */
                uint8_t dte_index = (token & 0x3F) << 1;
                uint8_t ch1 = snes_read_rom_byte(0x91, DTE_TABLE_ADDR + dte_index);
                state->wram_bank7f[dst++] = ch1;

                uint8_t ch2 = snes_read_rom_byte(0x91, DTE_TABLE_ADDR + dte_index + 1);
                state->wram_bank7f[dst++] = ch2;

                if (ch2 == 0x00) {
                    break;
                }
            } else {
                /* Tiers 4 & 5: MTE Word or Extended Dictionary Phrase */
                uint8_t sub_selector = token & 0x7E;

                if (sub_selector != 0) {
                    /* Tier 4: Multi-Tile Encoding (MTE) Word String */
                    uint16_t mte_word_rel = snes_read_rom_word(0x91, MTE_OFFSET_TABLE_ADDR + sub_selector);
                    uint16_t mte_addr = MTE_BASE_STRING_ADDR + mte_word_rel;

                    while (true) {
                        uint8_t mte_ch = snes_read_rom_byte(0x91, mte_addr++);
                        if (mte_ch == 0x00) {
                            break;
                        }
                        state->wram_bank7f[dst++] = mte_ch;
                    }
                } else {
                    /* Tier 5: Extended Dictionary Phrase Expansion */
                    src_addr++;
                    uint8_t phrase_idx = snes_read_rom_byte(src_bank, src_addr);
                    uint16_t phrase_rel = snes_read_rom_word(0x91, DICT_OFFSET_TABLE_ADDR + ((uint16_t)phrase_idx << 1));
                    uint16_t phrase_addr = DICT_BASE_STRING_ADDR + phrase_rel;

                    while (true) {
                        uint8_t phrase_ch = snes_read_rom_byte(0x91, phrase_addr++);
                        if (phrase_ch == 0x00) {
                            break;
                        }
                        state->wram_bank7f[dst++] = phrase_ch;
                    }
                }
            }
        }

        src_addr++;
    }
}

/**
 * @brief Resolves script string key, manages buffer chunk, and executes decoding ($8C:CD33).
 * 
 * @param state      Pointer to engine WRAM state
 * @param string_key 16-bit key from script instruction
 * @return FarPointer Pointer to resolved/decompressed ASCII string
 */
FarPointer string_resolve_and_decompress(TextEngineState *state, uint16_t string_key) {
    /* Read string descriptor from table at $91:F24A */
    uint16_t key_offset = string_key * 3;
    uint16_t desc_word  = snes_read_rom_word(0x91, STRING_KEYS_ADDR + key_offset);
    uint8_t  desc_bank  = snes_read_rom_byte(0x91, STRING_KEYS_ADDR + key_offset + 2);

    bool is_compressed = (desc_word & 0x8000) != 0;
    uint16_t text_offset = desc_word & 0x7FFF;
    uint8_t  rom_bank    = 0xC0 + (desc_bank & 0xFF);

    FarPointer result;

    if (!is_compressed) {
        /* Uncompressed ROM String: Return direct far pointer */
        result.offset = text_offset;
        result.bank   = rom_bank;
        return result;
    }

    /* Compressed String: Allocate cyclic buffer chunk */
    uint16_t cursor = state->text_buf_cursor + TEXT_CHUNK_SIZE;
    if (cursor >= TEXT_BUFFER_TOTAL_SIZE) {
        cursor = 0;
    }
    state->text_buf_cursor = cursor;

    uint16_t dst_wram_offset = TEXT_BUFFER_BASE_ADDR + cursor;

    /* Execute decompression */
    FarPointer src;
    src.offset = text_offset;
    src.bank   = rom_bank;

    dialogue_text_dte_mte_decoder(state, src, dst_wram_offset);

    /* Return pointer to decompressed string in WRAM Bank $7F */
    result.offset = dst_wram_offset;
    result.bank   = 0x7F;
    return result;
}
