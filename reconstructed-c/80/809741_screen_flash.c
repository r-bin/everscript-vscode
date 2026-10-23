/*
 * Routine: $809741 (screen_flash)
 * Bank: $80 (ROM Offset: $009741)
 * Source: docs/disassembly/engine-core/screen-flash.md
 */

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
