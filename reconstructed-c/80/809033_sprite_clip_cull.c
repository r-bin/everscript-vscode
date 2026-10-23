/*
 * Routine: $809033 (sprite_clip_cull)
 * Bank: $80 (ROM Offset: $009033)
 * Source: docs/disassembly/entities/sprite-clip-cull.md
 */

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
