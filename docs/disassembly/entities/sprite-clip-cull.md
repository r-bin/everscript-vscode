# Character Sprite Slice Clipping, Viewport Culling, and OAM Blitter ($80:9033 – $80:92EB)

## 1. Subsystem Architecture Overview

The low-level sprite rendering engine in Bank `$80` (`direct_sprite_draw_oam`) composites animated multi-part character and entity sprites into the SNES hardware OAM buffers (`$7E:ABDE` and `$7E:ADDE`). It features a 2-stage hierarchical clipping pipeline that rejects off-screen sprites and slices with minimal CPU overhead:

1. **Stage 1: Overall Sprite Bounding Box Culling (`$80:9040` – `$80:90F5`)**:
   - Reads the sprite descriptor header from `[$26]`:
     - Byte 0: Slice count $N$ (`$7E:00E0`).
     - Byte 2: Signed horizontal origin offset $\Delta x$.
     - Byte 3: Signed vertical origin offset $\Delta y$.
     - Byte 4: Bounding box width $W$.
     - Byte 5: Bounding box height $H$.
   - Computes screen coordinates:
     - $X_{box} = \text{ScreenX} (\text{DP } \$02) + \Delta x$
     - $Y_{box} = \text{ScreenY} (\text{DP } \$04) + \Delta y$
   - Evaluates screen bounds ($256 \times 224$ pixels):
     - If $X_{box} \ge 256$, tests if right edge is offscreen ($X_{box} + W < 0$).
     - If $Y_{box} \ge 224$, tests if bottom edge is offscreen ($Y_{box} + H < 0$).
   - If completely outside the viewport, immediately aborts rendering via `loc_C090F2` (`PLB; REP #$30; RTL`).

2. **Stage 2: Per-Slice Geometry Clipping & Coordinate Wrapping (`$80:90F8` – `$80:91FD`)**:
   - Iterates through all $N$ slices (`loc_C09101` loop):
     - Reads 4-byte slice descriptor:
       - Byte 0 (`$DF`): Attribute flags (Bit 0 selects tile size: 0 for 8x8, 1 for 16x16).
       - Byte 1: Signed relative X offset $\delta x$.
       - Byte 2: Signed relative Y offset $\delta y$.
       - Byte 3: Relative tile ID $\tau$.
     - Computes slice screen position:
       - $X_{slice} = \text{ScreenX} + \delta x$ (`DP $16`)
       - $Y_{slice} = \text{ScreenY} + \delta y$ (`DP $18`)
     - Individual slice clipping boundaries:
       - **8x8 Slices**: Valid if $X_{slice} \in [-7, 255]$ and $Y_{slice} \in [-7, 223]$.
       - **16x16 Slices**: Valid if $X_{slice} \in [-15, 255]$ and $Y_{slice} \in [-15, 223]$.
     - If outside, skips slice and advances by 4 bytes.

3. **Stage 3: Dynamic OBJ VRAM LRU Cache Lookup & Allocation (`$80:912D` – `$80:919E`)**:
   - Queries 8x8 tile LRU cache `$7E:7D51` or 16x16 cache `$7E:97A9`.
   - On cache hit: updates LRU age tags in `$7E:96A5` / `$7E:9727` and retrieves allocated VRAM tile index `$DB`.
   - On cache miss: calls dynamic allocator `obj_tile_allocate` (`$80:A2E0`) or `obj_16x16_tile_allocate` (`$80:A429`).

4. **Stage 4: Low & High OAM Buffer Packing (`$80:91B6` – `$80:92EB`)**:
   - **Low OAM (`$7E:ABDE + X`)** (4 bytes per sprite):
     - Byte 0: Screen X coordinate (bits 7..0).
     - Byte 1: Screen Y coordinate.
     - Byte 2: Allocated VRAM tile index.
     - Byte 3: Palette, priority, and flip bits.
   - **High OAM (`$7E:ADDE + X`)** (2 bits per sprite):
     - Packs Bit 0 (9th bit of X coordinate for negative / offscreen wrapping) and Bit 1 (tile size: 8x8 vs 16x16) into four 2-bit fields per byte.

---

## 2. 65816 Disassembly Analysis

> **Interactive 65816 Assembly**:
> Centralized comments infused at runtime.
> [View in VFS: soe://rom/code/809033](soe://rom/code/809033?asm=1&c=0)


---

## 3. Clean C Reconstructed Implementation

> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/80/809033_sprite_clip_cull.c`](../../../reconstructed-c/80/809033_sprite_clip_cull.c).
> [View in VFS: soe://rom/code/809033](soe://rom/code/809033?c=1&asm=0)


---

## 4. Architectural Invariants & Memory Anchors

- **Coordinate Offsets & Negative Wrapping**:
  - The SNES PPU renders sprites with $X \in [-15, -1]$ by asserting the 9th X-coordinate bit in the high OAM table while placing $X + 256$ in the low OAM table.
  - The culler explicitly handles negative screen coordinates down to $-7$ (for 8x8 slices) and $-15$ (for 16x16 slices), ensuring smooth entry and exit at the left and top screen boundaries without sprite pop-in.
- **Two-Tier Hierarchical Culling**:
  - By performing a coarse bounding box check on descriptors with 3 or more slices, the engine avoids iterating over dozens of slice definitions for off-screen enemies and large boss entities.
- **Dynamic OBJ VRAM Cache Integration**:
  - Unlike games that statically map sprite sheets, Evermore dynamically streams required slices into VRAM on demand, checking LRU cache residence before queuing DMA transfers.
