# Dialogue String Expansion & VRAM Glyph Rasterizer

**Addresses**:
- `string_window_glyph_interpreter`: `$8C:9E03` – `$8C:9F4D`
- `window_text_layout_align`: `$8C:9F4E` – `$8C:A1A6`
- `glyph_font_1bpp_unpacker`: `$8C:A4FE` – `$8C:A590`
- `font_glyph_bitmap_blit`: `$8C:A5A2` – `$8C:A5DF`

**ROM Source**: Bank `$8C` (US 1.0)
**Subsystem**: User Interface / Text Window Engine

---

## 1. Overview & Architectural Role

The Secret of Evermore dialogue formatting pipeline bridges compressed and raw string streams to the SNES tilemap display. While `string_resolve_and_decompress` (`$8C:CD33`) decodes compressed dialogue bytes into intermediate text buffers, `string_window_glyph_interpreter` (`$8C:9E03`) performs the actual typography layout, line wrapping, variable expansion, and glyph blitting into VRAM tile buffers.

Key mechanisms:
1. **Control Code Parsing & Table Dispatch**:
   Byte values $\ge 0x80$ are interpreted as control codes (newline, tab advance, wait for button press, sound effect trigger, or character color switch), jumping through the dispatch table at `$8C:9EFA`. Values $< 0x80$ represent standard ASCII glyphs.
2. **Text Alignment & Centering (`window_text_layout_align`)**:
   Window flags `+$12,Y` define alignment rules:
   - Bit 4 (`0x10`): Center text horizontally: `cursor_x = (window_width - line_width) / 2`.
   - Bit 5 (`0x20`): Right-align text: `cursor_x = window_width - line_width`.
3. **1bpp-to-4bpp Font Glyph Blitter (`font_glyph_bitmap_blit`)**:
   Looks up the 1bpp variable-width font pattern from Bank `$C4` via `$92,X`, calculates the destination tile offset using hardware multiplier registers `$4202` / `$4216`, unpacks bit planes into 2bpp/4bpp format, and advances the cursor X coordinate by the character width plus kerning spacing (`+$06,Y`).

---

## 2. Data Structures & Memory Layout

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8C9E03_dialogue_glyph_streamer.c`](../../../reconstructed-c/8C/8C9E03_dialogue_glyph_streamer.c).
> [View in VFS: soe://rom/code/8C9E03](soe://rom/code/8C9E03?c=1&asm=0)


---

## 3. Clean C Decompilation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8C9E03_dialogue_glyph_streamer.c`](../../../reconstructed-c/8C/8C9E03_dialogue_glyph_streamer.c).
> [View in VFS: soe://rom/code/8C9E03](soe://rom/code/8C9E03?c=1&asm=0)


---

## 4. Verification & Behavioral Equivalence

1. **Alignment Calculation**: Matches assembly `$8C:A187` (`SBC $0C; LSR; STA $0000,Y`): perfectly reconstructs half-delta horizontal centering.
2. **Variable Width Offsets**: Uses table `[$92],Y` accurately for kerning and space metrics.
3. **Planar Bitshift**: Matches sub-pixel horizontal shifting and hardware multiplication across 8x8 font tile boundaries.
