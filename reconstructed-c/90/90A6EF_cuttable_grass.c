/*
 * Routine: $90A6EF (cuttable_grass)
 * Bank: $90 (ROM Offset: $10A6EF)
 * Source: docs/disassembly/maps/cuttable-grass.md
 */

#include <stdint.h>
#include <stdbool.h>

/** Maximum number of concurrent grass cut animation slots. */
#define CUTTABLE_GRASS_MAX_SLOTS        24
/** Number of slots drained per execution tick (1 frame). */
#define CUTTABLE_GRASS_BATCH_SIZE       4
/** Ring buffer capacity of the VRAM DMA staging queue (in entries). */
#define VRAM_STAGING_BUFFER_CAPACITY    64
/** Layer 2 screen tilemap base word offset. */
#define VRAM_LAYER_2_OFFSET_BIT         0x0400

/** Viewport bounding box for on-screen tile updates. */
typedef struct {
    uint16_t y_min;
    uint16_t y_max;
    uint16_t x_min;
    uint16_t x_max;
} ViewportBounds;

/** Live engine context for map metatiles and VRAM updates. */
typedef struct {
    /* Queue state */
    uint16_t batch_cursor;                                  /* $7E:0FD0 */
    uint16_t sequence_cursor[CUTTABLE_GRASS_MAX_SLOTS];     /* $7E:0FD2 */
    uint16_t grid_offset[CUTTABLE_GRASS_MAX_SLOTS];         /* $7E:1002 */
    uint16_t packed_coords[CUTTABLE_GRASS_MAX_SLOTS];       /* $7E:1032: (Y << 8) | X */

    /* Viewport bounds */
    ViewportBounds l1_bounds;                               /* $7E:0F8C..$7E:0F92 */
    ViewportBounds l2_bounds;                               /* $7E:0F94..$7E:0F9A */

    /* VRAM DMA tile update staging queue */
    uint16_t vram_staging_cursor;                           /* $7E:1170 (byte offset) */
    uint16_t vram_staged_tiles[VRAM_STAGING_BUFFER_CAPACITY];   /* $7E:1174 */
    uint16_t vram_staged_targets[VRAM_STAGING_BUFFER_CAPACITY]; /* $7E:11F4 */

    /* Room and Map Buffers */
    const uint8_t *room_blob_base;                          /* [$8B] long pointer */
    uint16_t *metatile_wram_base;                           /* $7F:0000 pointer */
} CuttableGrassEngine;

/**
 * @brief Subroutine $90:A739: Applies a single metatile mutation to the field grid
 *        and enqueues VRAM tile uploads for Layer 1 and Layer 2 if visible on screen.
 *
 * @param engine Pointer to the cuttable grass engine context.
 * @param new_metatile_id The replacement metatile ID to stamp into the map.
 * @param grid_byte_offset Byte offset into the live map grid ($7F:0000).
 * @param tile_x Horizontal tile cell coordinate on the map.
 * @param tile_y Vertical tile cell coordinate on the map.
 */
void cuttable_grass_apply_metatile_mutation(CuttableGrassEngine *engine,
                                           uint16_t new_metatile_id,
                                           uint16_t grid_byte_offset,
                                           uint8_t tile_x,
                                           uint8_t tile_y)
{
    uint16_t *map_grid = engine->metatile_wram_base;
    uint32_t grid_idx = grid_byte_offset / 2;

    /* 1. Retrieve old metatile ID and its constituent Layer 1/2 VRAM tile words */
    uint16_t old_metatile_id = map_grid[grid_idx];
    uint32_t old_def_idx = old_metatile_id / 2;
    uint16_t old_l1_tile = map_grid[old_def_idx + 0];
    uint16_t old_l2_tile = map_grid[old_def_idx + 1];

    /* 2. Stamp the new metatile ID into the live map grid */
    map_grid[grid_idx] = new_metatile_id;

    /* 3. Evaluate Layer 1 change and screen visibility */
    uint32_t new_def_idx = new_metatile_id / 2;
    uint16_t new_l1_tile = map_grid[new_def_idx + 0];

    if (new_l1_tile != old_l1_tile) {
        if (tile_x >= engine->l1_bounds.x_min && tile_x < engine->l1_bounds.x_max &&
            tile_y >= engine->l1_bounds.y_min && tile_y < engine->l1_bounds.y_max) {

            /* Calculate 32x32 VRAM screen offset: ((Y & 0x1F) << 5) | (X & 0x1F) */
            uint16_t vram_offset = ((uint16_t)(tile_y & 0x1F) << 5) | (tile_x & 0x1F);
            uint32_t stage_idx = (engine->vram_staging_cursor / 2) % VRAM_STAGING_BUFFER_CAPACITY;

            engine->vram_staged_targets[stage_idx] = vram_offset;
            engine->vram_staged_tiles[stage_idx] = new_l1_tile;

            engine->vram_staging_cursor += 2;
            if (engine->vram_staging_cursor >= (VRAM_STAGING_BUFFER_CAPACITY * 2)) {
                engine->vram_staging_cursor = 0;
            }
        }
    }

    /* 4. Evaluate Layer 2 change and screen visibility */
    uint16_t new_l2_tile = map_grid[new_def_idx + 1];

    if (new_l2_tile != old_l2_tile) {
        if (tile_x >= engine->l2_bounds.x_min && tile_x < engine->l2_bounds.x_max &&
            tile_y >= engine->l2_bounds.y_min && tile_y < engine->l2_bounds.y_max) {

            /* Layer 2 target adds offset bit 0x0400 */
            uint16_t vram_offset = ((uint16_t)(tile_y & 0x1F) << 5) | (tile_x & 0x1F) | VRAM_LAYER_2_OFFSET_BIT;
            uint32_t stage_idx = (engine->vram_staging_cursor / 2) % VRAM_STAGING_BUFFER_CAPACITY;

            engine->vram_staged_targets[stage_idx] = vram_offset;
            engine->vram_staged_tiles[stage_idx] = new_l2_tile;

            engine->vram_staging_cursor += 2;
            if (engine->vram_staging_cursor >= (VRAM_STAGING_BUFFER_CAPACITY * 2)) {
                engine->vram_staging_cursor = 0;
            }
        }
    }
}

/**
 * @brief Routine $90:A6EF: Drains pending grass cut animation slots in round-robin batches.
 *        Called once per frame from the map engine main update loop.
 *
 * @param engine Pointer to the cuttable grass engine context.
 */
void cuttable_grass_drain_pending_swaps(CuttableGrassEngine *engine)
{
    uint16_t slot = engine->batch_cursor / 2;

    for (int batch = 0; batch < CUTTABLE_GRASS_BATCH_SIZE; ++batch) {
        uint16_t seq_offset = engine->sequence_cursor[slot];

        if (seq_offset != 0) {
            /* Read next 16-bit word from room sequence */
            const uint16_t *seq_ptr = (const uint16_t *)(engine->room_blob_base + seq_offset);
            uint16_t new_metatile = *seq_ptr;

            if (new_metatile == 0x0000) {
                /* Sequence terminator reached: free this slot */
                engine->sequence_cursor[slot] = 0;
            } else {
                /* Advance cursor to next animation keyframe */
                engine->sequence_cursor[slot] = seq_offset + 2;

                uint16_t grid_offset = engine->grid_offset[slot];
                uint16_t coords = engine->packed_coords[slot];
                uint8_t tile_x = (uint8_t)(coords & 0x00FF);
                uint8_t tile_y = (uint8_t)((coords >> 8) & 0x00FF);

                /* Mutate field grid and stage VRAM changes */
                cuttable_grass_apply_metatile_mutation(engine,
                                                       new_metatile,
                                                       grid_offset,
                                                       tile_x,
                                                       tile_y);
            }
        }

        /* Advance to next slot */
        slot = (slot + 1) % CUTTABLE_GRASS_MAX_SLOTS;
    }

    /* Save updated round-robin cursor */
    engine->batch_cursor = slot * 2;
}
