# Dialogue DTE Digraph & MTE Word Expansion Engine

**Addresses**:
- `dialogue_dte_digraph_expand`: `$8C:CDC6` – `$8C:CDDD`
- `dialogue_mte_word_expand`: `$8C:CDDE` – `$8C:CE08`
- `dialogue_extended_phrase_expand`: `$8C:CE09` – `$8C:CE48`
- `dialogue_string_stream_decoder`: `$8C:CD84` – `$8C:CDDF`

**ROM Source**: Bank `$8C` / Bank `$91` (US 1.0)  
**Subsystem**: UI / Dialogue String Decompression Subsystem

---

## 1. Overview & Architectural Role

To fit all dialogue and script text within the 3MB/4MB SNES ROM budget, Secret of Evermore uses a 5-tier variable-length text compression scheme combining Dual Tile Encoding (DTE), Multi-Tile Encoding (MTE), and an external Phrase Dictionary in Bank `$91`.

The tokenizer in `dialogue_string_stream_decoder` (`$8C:CD84`) processes a compressed byte stream from ROM/RAM and expands it into an 80-byte cyclic output buffer at `$7F:DC1E`:
1. **Tier 1 — Single Character (`0x00`..`0x3F`)**:
   Looks up 1-byte ASCII glyph code from single character table `tbl_D1F3AE,X`.
2. **Tier 2 — Literal String Run (`0x40`..`0x7F`)**:
   Calculates count $N = \text{token} - 0x40$. Copies $N$ raw, uncompressed ASCII bytes directly from the stream.
3. **Tier 3 — DTE Digram Pairs (`0x80`..`0xBF`, `dialogue_dte_digraph_expand`)**:
   Index $= (\text{token} - 0x80) \times 2$. Emits 2 consecutive English characters from the 64-entry DTE pair table `tbl_D1F32E` (e.g. "th", "er", "in", "ed", "ou").
4. **Tier 4 — MTE Common Word Bank (`0xC0`..`0xFE`, `dialogue_mte_word_expand`)**:
   Index $= \text{token} \ \& \ 0x7E$. Looks up a 16-bit word offset from `data_D1F3F0`, adds base `$F66C`, and emits a null-terminated English word (e.g. "alchemy", "formula", "ingredients", "something", "thanks") from ROM Bank `$91`.
5. **Tier 5 — 256-Phrase Extended Dictionary (`0xFF`, `dialogue_extended_phrase_expand`)**:
   Token `0xFF` indicates a 2-byte escape. The subsequent byte in the stream indexes into the 256-phrase table `tbl_D1F46C`, unpacking multi-word sentences and NPC dialogue fragments.

---

## 2. Data Structures & Memory Layout

```c
// Direct Page Stream Pointers:
// DP $22..$24: 24-bit source pointer to compressed string in ROM
// DP $26..$28: 24-bit far pointer to active dictionary word in Bank $91
// Output buffer register Y: destination offset in WRAM Bank $7F ($7F:DC1E)

// ROM DTE & MTE Tables in Bank $91:
// Bank $91:F32E: 64-entry DTE digraph pair table (128 bytes)
// Bank $91:F3AE: 63-entry single character glyph table
// Bank $91:F3F0: Word bank pointer offset table
// Bank $91:F46C: 256-entry extended phrase pointer table
// Bank $91:F674: Null-terminated English word repository
```

---

## 3. Clean C Decompilation

```c
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
```
