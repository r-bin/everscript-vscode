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

```assembly
; ==============================================================================
; direct_sprite_draw_oam ($80:9033 - $80:90F5)
; Master Sprite Bounding Box Culler & Viewport Clipper
; Input: DP $02 = entity screen X, DP $04 = entity screen Y, [$26] = sprite descriptor
; ==============================================================================
$80:9033  E2 30        SEP #$30            ; 8-bit registers
$80:9035  A9 CE        LDA #$CE
$80:9037  85 07        STA $07
$80:9039  A7 26        LDA [$26]           ; Read slice count N from descriptor
$80:903B  D0 0D        BNE $80904A         ; If N != 0, begin culling check
$80:903D  C2 30        REP #$30
$80:903F  6B           RTL                 ; Empty descriptor, return

$80:904A  85 E0        STA $E0             ; DP $E0 = remaining slice count
$80:904C  8B           PHB
$80:904D  A2 7E        LDX #$7E
$80:904F  DA           PHX
$80:9050  AB           PLB                 ; Set Data Bank = $7E
$80:9051  C9 03        CMP #$03            ; If slice count < 3, bypass bounding box check
$80:9053  B0 03        BCS $809058
$80:9055  4C F8 90     JMP $8090F8

; Bounding box viewport test:
$80:9058  C2 21        REP #$21            ; 16-bit A, clear carry
$80:905A  A0 02        LDY #$02
$80:905C  B7 26        LDA [$26],Y         ; Relative X offset
$80:905E  09 00 FF     ORA #$FF00          ; Sign extend
$80:9061  89 80 00     BIT #$0080
$80:9064  D0 03        BNE $809069
$80:9066  29 FF 00     AND #$00FF
$80:9069  65 02        ADC $02             ; Box X = ScreenX + rel_x
$80:906B  85 12        STA $12             ; DP $12 = Box X
$80:906D  C9 00 01     CMP #$0100          ; Compare with 256
$80:9070  90 37        BCC $8090A9         ; If X < 256, test width
$80:9072  10 7E        BPL $8090F2         ; If >= 256, offscreen!
$80:9074  A0 04        LDY #$04
$80:9076  B7 26        LDA [$26],Y         ; Bounding box width
$80:9078  29 FF 00     AND #$00FF
$80:907B  18           CLC
$80:907C  65 12        ADC $12             ; Box X + width
$80:907E  30 72        BMI $8090F2         ; If right edge < 0, completely offscreen!

; Test Y Bounding Box:
$80:9080  A0 03        LDY #$03
$80:9082  B7 26        LDA [$26],Y         ; Relative Y offset
$80:9084  09 00 FF     ORA #$FF00
$80:9087  89 80 00     BIT #$0080
$80:908A  D0 03        BNE $80908F
$80:908C  29 FF 00     AND #$00FF
$80:908F  18           CLC
$80:9090  65 04        ADC $04             ; Box Y = ScreenY + rel_y
$80:9092  85 14        STA $14             ; DP $14 = Box Y
$80:9094  C9 E0 00     CMP #$00E0          ; Compare with 224 (SNES screen height)
$80:9097  90 5D        BCC $8090F6         ; If Y < 224, visible!
$80:9099  10 57        BPL $8090F2         ; Offscreen!
$80:909B  A0 05        LDY #$05
$80:909D  B7 26        LDA [$26],Y         ; Bounding box height
$80:909F  29 FF 00     AND #$00FF
$80:90A2  18           CLC
$80:90A3  65 14        ADC $14             ; Box Y + height
$80:90A5  30 4B        BMI $8090F2         ; If bottom edge < 0, completely offscreen!
$80:90A7  80 4D        BRA $8090F6

; Bounding box culled exit:
$80:90F2  AB           PLB
$80:90F3  C2 30        REP #$30
$80:90F5  6B           RTL

; ==============================================================================
; Per-Slice Processing & Coordinate Packing ($80:90F8 - $80:91FD)
; ==============================================================================
$80:90F6  E2 30        SEP #$30
$80:90F8  A0 01        LDY #$01
$80:90FA  B7 26        LDA [$26],Y         ; Slice descriptor base offset
$80:90FC  85 E1        STA $E1             ; DP $E1 = descriptor byte cursor
$80:90FE  A8           TAY
$80:90FF  80 0D        BRA $80910E

; Next Slice Loop:
$80:9101  E2 31        SEP #$31
$80:9103  C6 E0        DEC $E0             ; Decrement remaining slice counter
$80:9105  F0 EB        BEQ $8090F2         ; All slices done, return!
$80:9107  A5 E1        LDA $E1
$80:9109  69 04        ADC #$04            ; Advance descriptor cursor by 4 bytes
$80:910B  A8           TAY
$80:910C  84 E1        STY $E1

$80:910E  A5 D4        LDA $D4             ; OAM slot limit check
$80:9110  89 FE        BIT #$FE
$80:9112  D0 DE        BNE $8090F2         ; OAM table full, abort

$80:9114  B7 26        LDA [$26],Y         ; Byte 0: Flags (Bit 0 = 16x16 size bit)
$80:9116  85 DF        STA $DF             ; DP $DF = slice attribute byte
$80:9118  6A           ROR A
$80:9119  90 03        BCC $80911E         ; If size == 0, 8x8 slice
$80:911B  4C FD 91     JMP $8091FD         ; If size == 1, 16x16 slice

; 8x8 Slice Coordinates:
$80:911E  C8           INY
$80:911F  B7 26        LDA [$26],Y         ; Byte 1: Relative X offset
$80:9121  C2 31        REP #$31
$80:9123  30 05        BMI $80912A
$80:9125  29 FF 00     AND #$00FF
$80:9128  80 03        BRA $80912D
$80:912A  09 00 FF     ORA #$FF00
$80:912D  65 02        ADC $02             ; Slice X = ScreenX + rel_x
$80:912F  C9 F9 FF     CMP #$FFF9          ; X >= -7?
$80:9132  30 CD        BMI $809101         ; Culled left
$80:9134  C9 00 01     CMP #$0100          ; X < 256?
$80:9137  10 C8        BPL $809101         ; Culled right
$80:9139  85 16        STA $16             ; DP $16 = Slice X

$80:913B  C8           INY
$80:913C  B7 26        LDA [$26],Y         ; Byte 2: Relative Y offset
$80:913E  09 00 FF     ORA #$FF00
$80:9141  89 80 00     BIT #$0080
$80:9144  D0 03        BNE $809149
$80:9146  29 FF 00     AND #$00FF
$80:9149  18           CLC
$80:914A  65 04        ADC $04             ; Slice Y = ScreenY + rel_y
$80:914C  C9 F9 FF     CMP #$FFF9          ; Y >= -7?
$80:914F  30 B0        BMI $809101         ; Culled top
$80:9151  C9 E0 00     CMP #$00E0          ; Y < 224?
$80:9154  10 AB        BPL $809101         ; Culled bottom
$80:9156  85 18        STA $18             ; DP $18 = Slice Y

; Commit to Low OAM:
$80:91B6  A6 D3        LDX $D3             ; Low OAM byte index ($7E:ABDE,X)
$80:91B8  A5 16        LDA $16             ; Slice X coordinate
$80:91BA  9F DE AB 7E  STA $7EABDE,X       ; OAM X
$80:91BE  A5 18        LDA $18             ; Slice Y coordinate
$80:91C0  9F DF AB 7E  STA $7EABDF,X       ; OAM Y
$80:91C4  A5 DB        LDA $DB             ; Allocated VRAM tile ID
$80:91C6  9F E0 AB 7E  STA $7EABE0,X       ; OAM Tile ID
$80:91CA  A5 DF        LDA $DF             ; Attributes
$80:91CC  29 07        AND #$07
$80:91CE  18           CLC
$80:91CF  65 06        ADC $06             ; Add entity base palette
$80:91D1  9F E1 AB 7E  STA $7EABE1,X       ; OAM Attributes
$80:91D5  E8 E8 E8 E8  INX : INX : INX : INX
$80:91D9  86 D3        STX $D3             ; Update OAM cursor

; High OAM Bit Packing ($80:91DB - $80:91FA):
; Packs size bit (0=8x8, 1=16x16) and 9th X bit into $7E:ADDE
```

---

## 3. Clean C Reconstructed Implementation

```c
#include <stdint.h>
#include <stdbool.h>

#define SNES_SCREEN_WIDTH   256
#define SNES_SCREEN_HEIGHT  224
#define MAX_OAM_SPRITES     128

/* Low OAM Entry (4 bytes) */
typedef struct {
    uint8_t x_coord;     /* Screen X (bits 7..0) */
    uint8_t y_coord;     /* Screen Y */
    uint8_t tile_id;     /* VRAM Tile Index */
    uint8_t attributes;  /* Palette (bits 3..1), Priority (bits 5..4), H/V Flip (bits 6..7) */
} OamSpriteEntry;

/* Packed Slice Descriptor (4 bytes) */
typedef struct {
    uint8_t flags;       /* Bit 0: size (0=8x8, 1=16x16), bits 3..1: palette override */
    int8_t  rel_x;       /* Signed relative horizontal offset */
    int8_t  rel_y;       /* Signed relative vertical offset */
    uint8_t tile_index;  /* Source tile index within sprite sheet */
} SpriteSliceDescriptor;

/* Master Multi-Part Sprite Descriptor */
typedef struct {
    uint8_t slice_count;        /* Byte 0: total slices in animation frame */
    uint8_t first_slice_offset; /* Byte 1: byte offset to first slice */
    int8_t  bbox_rel_x;         /* Byte 2: bounding box relative X */
    int8_t  bbox_rel_y;         /* Byte 3: bounding box relative Y */
    uint8_t bbox_width;         /* Byte 4: bounding box width */
    uint8_t bbox_height;        /* Byte 5: bounding box height */
    SpriteSliceDescriptor slices[];
} MultiPartSpriteHeader;

/* Rendering State */
typedef struct {
    OamSpriteEntry low_oam[MAX_OAM_SPRITES]; /* $7E:ABDE */
    uint8_t high_oam[32];                    /* $7E:ADDE: 2 bits per sprite */
    uint8_t oam_cursor;                      /* $7E:00D3 / 4 */
    uint8_t high_oam_byte_cursor;            /* $7E:00D5 */
    uint8_t high_oam_bit_mask;               /* $7E:00D7 */
    uint8_t active_sprites_count;            /* $7E:00D4 */
} OamRenderState;

extern OamRenderState g_oam_state;

/* VRAM Dynamic OBJ Allocators */
extern uint8_t obj_vram_alloc_8x8(uint8_t tile_id);   /* $80:A2E0 */
extern uint8_t obj_vram_alloc_16x16(uint8_t tile_id); /* $80:A429 */

/**
 * Emits high OAM bits (9th X coordinate bit and tile size bit).
 */
static void oam_pack_high_bits(bool x_bit_9, bool is_16x16) {
    uint8_t bits = (x_bit_9 ? 0x01 : 0x00) | (is_16x16 ? 0x02 : 0x00);
    uint8_t shift = (g_oam_state.oam_cursor % 4) * 2;
    uint8_t byte_idx = g_oam_state.oam_cursor / 4;

    g_oam_state.high_oam[byte_idx] |= (bits << shift);
}

/**
 * Direct Sprite Drawing, Viewport Culler, and OAM Blitter.
 * Corresponds to native routine $80:9033.
 *
 * @param screen_x Entity origin screen X coordinate.
 * @param screen_y Entity origin screen Y coordinate.
 * @param palette_base Entity base palette offset.
 * @param sprite Pointer to multi-part sprite descriptor.
 */
void direct_sprite_draw_oam(int16_t screen_x, int16_t screen_y, uint8_t palette_base, const MultiPartSpriteHeader *sprite) {
    if (sprite == NULL || sprite->slice_count == 0) {
        return;
    }

    // Stage 1: Overall Bounding Box Viewport Culling
    if (sprite->slice_count >= 3) {
        int16_t box_x = screen_x + sprite->bbox_rel_x;
        int16_t box_y = screen_y + sprite->bbox_rel_y;

        // Horizontal culling
        if (box_x >= SNES_SCREEN_WIDTH || (box_x + sprite->bbox_width) < 0) {
            return; // Completely offscreen horizontally
        }

        // Vertical culling
        if (box_y >= SNES_SCREEN_HEIGHT || (box_y + sprite->bbox_height) < 0) {
            return; // Completely offscreen vertically
        }
    }

    // Stage 2: Per-Slice Processing & Coordinate Packing
    for (uint8_t i = 0; i < sprite->slice_count; i++) {
        if (g_oam_state.oam_cursor >= MAX_OAM_SPRITES) {
            break; // OAM capacity exhausted
        }

        const SpriteSliceDescriptor *slice = &sprite->slices[i];
        bool is_16x16 = (slice->flags & 0x01) != 0;
        int16_t slice_x = screen_x + slice->rel_x;
        int16_t slice_y = screen_y + slice->rel_y;

        // Individual slice clipping thresholds
        int16_t min_x = is_16x16 ? -15 : -7;
        int16_t min_y = is_16x16 ? -15 : -7;

        if (slice_x < min_x || slice_x >= SNES_SCREEN_WIDTH) {
            continue; // Slice culled horizontally
        }
        if (slice_y < min_y || slice_y >= SNES_SCREEN_HEIGHT) {
            continue; // Slice culled vertically
        }

        // Stage 3: Allocate / Resolve VRAM Tile Index
        uint8_t vram_tile;
        if (is_16x16) {
            vram_tile = obj_vram_alloc_16x16(slice->tile_index);
        } else {
            vram_tile = obj_vram_alloc_8x8(slice->tile_index);
        }

        // Stage 4: Commit to Low OAM
        uint8_t cursor = g_oam_state.oam_cursor;
        OamSpriteEntry *entry = &g_oam_state.low_oam[cursor];

        entry->x_coord = (uint8_t)(slice_x & 0xFF);
        entry->y_coord = (uint8_t)(slice_y & 0xFF);
        entry->tile_id = vram_tile;
        entry->attributes = (slice->flags & 0xF0) | ((slice->flags & 0x0E) + palette_base);

        // Pack High OAM Bits
        bool x_bit_9 = (slice_x < 0) || (slice_x >= 256);
        oam_pack_high_bits(x_bit_9, is_16x16);

        g_oam_state.oam_cursor++;
    }
}
```

---

## 4. Architectural Invariants & Memory Anchors

- **Coordinate Offsets & Negative Wrapping**:
  - The SNES PPU renders sprites with $X \in [-15, -1]$ by asserting the 9th X-coordinate bit in the high OAM table while placing $X + 256$ in the low OAM table.
  - The culler explicitly handles negative screen coordinates down to $-7$ (for 8x8 slices) and $-15$ (for 16x16 slices), ensuring smooth entry and exit at the left and top screen boundaries without sprite pop-in.
- **Two-Tier Hierarchical Culling**:
  - By performing a coarse bounding box check on descriptors with 3 or more slices, the engine avoids iterating over dozens of slice definitions for off-screen enemies and large boss entities.
- **Dynamic OBJ VRAM Cache Integration**:
  - Unlike games that statically map sprite sheets, Evermore dynamically streams required slices into VRAM on demand, checking LRU cache residence before queuing DMA transfers.
