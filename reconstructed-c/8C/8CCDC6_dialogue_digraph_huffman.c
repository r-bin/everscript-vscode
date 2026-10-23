/*
 * Routine: $8CCDC6 (dialogue_digraph_huffman)
 * Bank: $8C (ROM Offset: $0CCDC6)
 * Source: docs/disassembly/ui/dialogue-digraph-huffman.md
 */

#include <stdint.h>
#include <stdbool.h>
#include <string.h>

extern const char g_single_char_table[64];         // $91:F3AE
extern const char g_dte_digraph_table[64][2];      // $91:F32E
extern const uint16_t g_mte_word_offsets[64];      // $91:F3F0
extern const uint16_t g_phrase_offsets[256];       // $91:F46C
extern const char g_dictionary_text_pool[];        // $91:F66C

/**
 * Expands a 2-character DTE digraph pair into the destination buffer.
 */
static inline void dialogue_dte_digraph_expand(uint8_t token, char** dest) {
    uint8_t idx = (token - 0x80) & 0x3F;
    *(*dest)++ = g_dte_digraph_table[idx][0];
    *(*dest)++ = g_dte_digraph_table[idx][1];
}

/**
 * Expands a common null-terminated dictionary word into the destination buffer.
 */
static inline void dialogue_mte_word_expand(uint8_t token, char** dest) {
    uint8_t word_idx = (token & 0x7E) >> 1;
    uint16_t text_offset = g_mte_word_offsets[word_idx];
    const char* word = &g_dictionary_text_pool[text_offset];

    while (*word) {
        *(*dest)++ = *word++;
    }
}

/**
 * Expands a multi-word phrase from the 256-entry extended dictionary.
 */
static inline void dialogue_extended_phrase_expand(uint8_t phrase_idx, char** dest) {
    uint16_t phrase_offset = g_phrase_offsets[phrase_idx];
    const char* phrase = &g_dictionary_text_pool[phrase_offset];

    while (*phrase) {
        *(*dest)++ = *phrase++;
    }
}

/**
 * Master multi-tier dialogue decompressor.
 * Expands a variable-length token stream from ROM into output buffer.
 *
 * @param src Far pointer to compressed string data in ROM
 * @param out_buffer Destination string buffer in RAM
 * @param max_capacity Output buffer limit
 * @return Total expanded character count
 */
uint16_t dialogue_string_stream_decoder(const uint8_t* src, char* out_buffer, uint16_t max_capacity) {
    char* dest = out_buffer;
    char* limit = out_buffer + max_capacity - 1;

    while (dest < limit) {
        uint8_t token = *src++;
        if (token == 0x00) break; // End of string

        // Tier 1: Single character
        if (token < 0x40) {
            *dest++ = g_single_char_table[token];
            continue;
        }

        // Tier 2: Literal character run
        if (token < 0x80) {
            uint8_t count = token - 0x40;
            while (count-- && dest < limit) {
                *dest++ = (char)*src++;
            }
            continue;
        }

        // Tier 3: DTE Digram pair
        if (token < 0xC0) {
            dialogue_dte_digraph_expand(token, &dest);
            continue;
        }

        // Tier 5: 256-Phrase Extended Dictionary Escape
        if (token == 0xFF) {
            uint8_t phrase_idx = *src++;
            dialogue_extended_phrase_expand(phrase_idx, &dest);
            continue;
        }

        // Tier 4: MTE Common Word Bank
        dialogue_mte_word_expand(token, &dest);
    }

    *dest = '\0';
    return (uint16_t)(dest - out_buffer);
}
