# Dialogue Window Font Glyph Rasterizer & VRAM Tile Streaming

## Overview
In Secret of Evermore, when dialogue, menu text, or NPC conversations are displayed, unpacked character streams from WRAM buffer `$7F:D81E` are rendered into 2bpp SNES tile graphics and streamed into VRAM through a dedicated pipeline:

1. **Character Glyph Rasterizer (`$8C:A5AC` — `dialogue_glyph_render_char`)**:
   - Fetches character row bitplanes from the master font bitmap table in Bank `$C4` (`$C4:0000`).
   - Calculates the sub-pixel horizontal offset `(cursor_x & 7) * 2`.
   - Uses a jump table of bit-shift sequences (`$8C:A619`) to dynamically span character glyphs across tile boundaries.
   - Blends foreground and shadow bitplanes into the active 2bpp tile buffer at `$7F:A000`.
2. **VRAM Tile Streaming Commit (`$8C:A753` — `dialogue_glyph_stream_vram`)**:
   - Calculates the destination VRAM address for the current line and tile column.
   - Prepares DMA parameters and invokes `$80:8650`.
   - Advances the window text cursor X position by querying the proportional character width table `$C4:0C02`.
3. **Hardware DMA Tile Block Uploader (`$80:8650` — `vram_dma_upload_tile_block`)**:
   - Acquires the VRAM lock (`$7E:0F3A++`) to prevent collisions with the VBLANK NMI handler.
   - Programs PPU `VMAIN` (`$2115 = 0x80`) and `VMADD` (`$2116`).
   - Initiates DMA channel 1 (`$420B = 0x02`) transferring the rendered tile bytes to `$2118`.
   - Releases the VRAM lock (`$7E:0F3A--`).

---

## Memory Map & Registers

### Direct Page Variables
- `DP $02`: Tile buffer row byte offset / pointer
- `DP $04`: Character color / shadow mask flag
- `DP $06`: Sub-pixel horizontal shift index `(cursor_x & 7) * 2`
- `DP $08`: Glyph character code / index
- `DP $0A`: Current tile column base address in `$7F` buffer
- `DP $0C`: Next tile column base address in `$7F` buffer
- `DP $0E`: Shifted 16-bit primary bitplane word
- `DP $10`: Shifted 16-bit secondary bitplane word (shadow)
- `DP $12`: Glyph vertical row offset
- `DP $26`: DMA source memory address (in Bank `$7F`)
- `DP $28`: DMA source memory bank (`0x7F`)
- `DP $2E`: DMA destination VRAM word address
- `DP $32`: Glyph row countdown counter (height in pixels)
- `DP $42`: Character width in pixels
- `DP $46`: Window cursor X position
- `DP $48`: Window cursor Y position

### WRAM Globals
- `$7E:0F3A`: VRAM DMA lock counter (non-zero halts NMI VRAM transfers)
- `$7E:0106`: System edge state and display mode flags
- `$7E:0B3D`: Dialogue window glyph height in rows (typically 8 or 12)
- `$7E:0B3F`: Dialogue window line stride in bytes
- `$7E:0B41`: Dialogue window tile buffer base offset
- `$7F:A000`: 2bpp dialogue tile rasterization buffer

### PPU & DMA Hardware Registers
- `$2115` (`VMAIN`): Video port control (`0x80` = increment on write to `$2119`)
- `$2116` (`VMADDL`/`VMADDH`): VRAM address register
- `$2118` (`VMDATAL`/`VMDATAH`): VRAM data write register
- `$4310` (`DMAP1`/`BBAD1`): DMA channel 1 control and PPU target register
- `$4312` (`A1T1L`/`A1T1H`): DMA channel 1 source address
- `$4314` (`A1B1`): DMA channel 1 source bank
- `$4315` (`DAS1L`/`DAS1H`): DMA channel 1 byte count
- `$420B` (`MDMAEN`): DMA channel enable register

---

## Decompiled C Code

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8C/8CA5AC_dialogue_glyphs.c`](../../../reconstructed-c/8C/8CA5AC_dialogue_glyphs.c).
> [View in VFS: soe://rom/code/8CA5AC](soe://rom/code/8CA5AC?c=1&asm=0)

