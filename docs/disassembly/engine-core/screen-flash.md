# Sparse Palette & Weather Preset Bitmask Decompressor ($80:9741 – $80:A16E)

> **Subsystem**: Screen Effects, CGRAM Palette Shadow Buffer & Weather Config Engine  
> **ROM Addresses**: `$80:9741` (`weather_preset_and_palette_dispatcher`), `$80:974B` (`sparse_palette_stream_decompressor`), `$80:A16E` (`palette_cgram_buffer_commit`)  
> **Clean C Module**: `engine-core/screen-flash.c`  
> **Recomp Symbols**: `func_809741`, `func_80974B`  
> **Confidence**: Confirmed  

---

## 1. Architectural Role

The Secret of Evermore engine synchronizes dynamic lighting, screen flashes (lightning strikes, explosion flares, damage flashes), and weather configuration presets (`$7E:72D1` – `$7E:734F`) through a unified 2-bit tagged run-length stream decompressor:

1. **Dispatcher Routing (`$80:9741`)**:
   - Inspects the preset header in ROM Bank `$EC` (`$EC:0001,X`).
   - If bit 15 is 0: jumps directly to raw linear copier `load_weather_preset_raw_copy` (`$80:A2E0`).
   - If bit 15 is 1: engages the **Sparse Palette & Preset Bitmask Decompressor (`$80:974B`)**.

2. **2-Bit Tag Sparse Zero Decompression Algorithm**:
   - The 128-byte destination configuration block and CGRAM shadow buffer (`$7E:72D1` – `$7E:734F`) is structured into 8 sequential blocks of 8 words (16 bytes each):
     - Blocks 0..4 (`$7E:72D1`..`$7E:731F`): Weather physics (velocity, boundaries, particle sprite attributes).
     - Blocks 5..7 (`$7E:7321`..`$7E:734F`): CGRAM shadow palettes for screen flash effects and HDMA scanline gradient bands.
   - For each 8-word block, the stream reads a 16-bit flag word:
     - **Flag == 0x0000 (Uncompressed Chunk)**: Reads 8 consecutive 16-bit words directly from source.
     - **Flag != 0x0000 (Sparse Compressed Chunk)**: The flag serves as a 16-bit bitmask register in Direct Page `$12`. For each pair of color/config words (4 iterations per block), 2 bits are evaluated via `LSR $12`:
       - `Tag 00` (`b0=0, b1=0`): Both words are non-zero; reads 2 words (4 bytes) from source stream.
       - `Tag 01` (`b0=1, b1=0`): Word 0 is zero (`0x0000`), word 1 is read from source (2 bytes consumed).
       - `Tag 10` (`b0=0, b1=1`): Word 0 is read from source (2 bytes consumed), word 1 is zero (`0x0000`).
       - `Tag 11` (`b0=1, b1=1`): Both words are zero (`0x0000`); consumes 0 source bytes.

3. **VBLANK CGRAM Commit (`$80:A16E`)**:
   - Upon completing the 8 blocks, jumps to `palette_cgram_buffer_commit` (`$80:A16E`) to stage color records for DMA transfer during VBLANK.

---

## 2. Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/809741](soe://rom/code/809741?asm=1&c=0)


---

## 3. Clean C Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/80/809741_screen_flash.c`](../../../reconstructed-c/80/809741_screen_flash.c).
> [View in VFS: soe://rom/code/809741](soe://rom/code/809741?c=1&asm=0)


---

## 4. Verification & Behavioral Equivalence

| Test Condition | Assembly Logic | C Implementation | Status |
|---|---|---|---|
| Compression Flag Routing | `LDA $EC0001,X; BMI $974B` | `(descriptor_flags & 0x8000) != 0` | Identical |
| Raw Chunk Copy | `chunk_flag == 0` -> sequential 8-word copy | Linear 8-word memory copy | Identical |
| Tag `11` Decode | `TDC` stored to both words | `*w0 = 0; *w1 = 0;` (0 bytes consumed) | Identical |
| Tag `01` Decode | `Word 0 = read, Word 1 = TDC` | `*w0 = read; *w1 = 0;` (2 bytes consumed) | Identical |
| Tag `10` Decode | `Word 0 = TDC, Word 1 = read` | `*w0 = 0; *w1 = read;` (2 bytes consumed) | Identical |
| Tag `00` Decode | Both words read from stream | `*w0 = read; *w1 = read;` (4 bytes consumed) | Identical |
| 128-byte Boundary | 8 blocks $\times$ 8 words = 64 words | `TOTAL_CONFIG_BLOCKS * WORDS_PER_BLOCK` | Identical |
| Post-Decompress Commit | `JMP $A16E` (`palette_cgram_buffer_commit`) | `palette_cgram_buffer_commit(0x7321)` | Identical |
