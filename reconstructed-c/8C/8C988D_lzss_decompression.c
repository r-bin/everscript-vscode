/*
 * Routine: $8C988D (lzss_decompression)
 * Bank: $8C (ROM Offset: $0C988D)
 * Source: docs/disassembly/engine-core/lzss-decompression.md
 */

#include <stdint.h>
#include <stdbool.h>

#define LZSS_WINDOW_SIZE 1024
#define LZSS_WINDOW_MASK (LZSS_WINDOW_SIZE - 1)
#define LZSS_INIT_INDEX  0x03BE

extern uint8_t g_lzss_window[LZSS_WINDOW_SIZE]; // $7F:A000..$7F:A3FF

/**
 * Method 0x00: Direct raw memory block copy.
 * Corresponds to $8C:98B1.
 */
void decompress_method_0x00_raw(const uint8_t **src, uint8_t **dst) {
    uint16_t length = *(const uint16_t *)(*src);
    *src += 2;

    for (uint16_t i = 0; i < length; i++) {
        *(*dst)++ = *(*src)++;
    }
}

/**
 * Method 0x03: 1024-byte LZSS circular sliding window decompressor.
 * Corresponds to $8C:98C9.
 */
void decompress_method_0x03_lzss(const uint8_t **src, uint8_t **dst) {
    uint16_t remaining_bytes = *(const uint16_t *)(*src);
    *src += 2;

    uint16_t window_idx = LZSS_INIT_INDEX;
    uint16_t flags = 0;

    while (remaining_bytes > 0) {
        // Shift next control flag bit
        flags >>= 1;
        if ((flags & 0x0100) == 0) {
            // Refill 8-bit flag byte with sentinel in bit 8
            flags = *(*src)++ | 0xFF00;
        }

        if (flags & 1) {
            // Literal byte (Bit == 1)
            uint8_t byte = *(*src)++;
            g_lzss_window[window_idx] = byte;
            window_idx = (window_idx + 1) & LZSS_WINDOW_MASK;

            *(*dst)++ = byte;
            remaining_bytes--;
        } else {
            // Dictionary match reference (Bit == 0)
            uint8_t b1 = *(*src)++;
            uint8_t b2 = *(*src)++;

            // 10-bit window offset, 6-bit match length (min 3 bytes)
            uint16_t match_offset = b1 | ((b2 & 0xC0) << 2);
            uint16_t match_length = (b2 & 0x3F) + 3;

            for (uint16_t k = 0; k < match_length && remaining_bytes > 0; k++) {
                uint8_t byte = g_lzss_window[(match_offset + k) & LZSS_WINDOW_MASK];
                g_lzss_window[window_idx] = byte;
                window_idx = (window_idx + 1) & LZSS_WINDOW_MASK;

                *(*dst)++ = byte;
                remaining_bytes--;
            }
        }
    }
}

/**
 * Master asset decompression dispatcher.
 * Corresponds to $8C:988D.
 */
void decompress_asset_stream(const uint8_t *src, uint8_t *dst) {
    uint8_t method = *src++;

    switch (method) {
        case 0x00:
            decompress_method_0x00_raw(&src, &dst);
            break;
        case 0x03:
            decompress_method_0x03_lzss(&src, &dst);
            break;
        default:
            // Other compression methods (RLE, Huffman, Markov)
            break;
    }
}
