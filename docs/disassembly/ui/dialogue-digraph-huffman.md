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

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CCDC6_dialogue_digraph_huffman.c`](../../../reconstructed-c/8C/8CCDC6_dialogue_digraph_huffman.c).
> [View in VFS: soe://rom/code/8CCDC6](soe://rom/code/8CCDC6?c=1&asm=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CCDC6_dialogue_digraph_huffman.c`](../../../reconstructed-c/8C/8CCDC6_dialogue_digraph_huffman.c).
> [View in VFS: soe://rom/code/8CCDC6](soe://rom/code/8CCDC6?c=1&asm=0)

