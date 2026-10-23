/*
 * Routine: $80A4B5 (obj_tile_allocator)
 * Bank: $80 (ROM Offset: $00A4B5)
 * Source: docs/disassembly/entities/obj-tile-allocator.md
 */

#include <stdint.h>
#include <stdbool.h>

#define VRAM_OBJ_BASE_WORD 0x6000
#define TILE_4BPP_BYTES    32
#define TILE_4BPP_WORDS    16

// WRAM Global State
extern uint16_t g_lru_next_slot[128];       // $7E:96A5
extern uint16_t g_lru_prev_slot[128];       // $7E:9725
extern uint16_t g_lru_head_slot;            // $7E:9726
extern uint16_t g_lru_tail_slot;            // $7E:9727
extern uint8_t  g_tile_owner_slot[1024];    // $7E:7D51 (tile_id -> slot)
extern uint16_t g_slot_owner_tile[128];     // $7E:95A5 (slot -> tile_id)

extern uint16_t g_vram_queue_words[128];    // $7E:15D6
extern uint16_t g_vram_queue_offset;        // DP $CB

extern uint8_t  g_vram_staging_dma[2048];   // $7E:6C91
extern uint16_t g_vram_staging_offset;      // DP $CF

// ROM Tables
typedef struct {
    uint8_t low;
    uint8_t mid;
    uint8_t bank;
} RomFarPointer24;

extern const RomFarPointer24 g_sprite_tile_ptrs[]; // $D8:0000

/**
 * Decompresses a 4bpp sprite tile by expanding compressed zero bitplanes.
 */
extern void decompress_4bpp_tile(const uint8_t *src, uint8_t *dst); // $80:A55E

/**
 * obj_tile_allocate ($80:A4B5)
 * Allocates a dynamic OBJ VRAM slot for a requested sprite tile, queues its
 * VRAM destination address, and copies or decompresses its graphic data.
 * 
 * @param lru_slot LRU candidate slot index chosen by sprite cache manager.
 * @param tile_id Global sprite tile graphic ID to load.
 * @return Target VRAM word address for rendering OAM tiles.
 */
uint16_t obj_tile_allocate(uint8_t lru_slot, uint16_t tile_id) {
    // 1. Relink slot to the head of the LRU cache list
    uint16_t prev_head = g_lru_head_slot;
    g_lru_next_slot[lru_slot] = prev_head;
    g_lru_prev_slot[prev_head] = lru_slot;
    g_lru_head_slot = lru_slot;

    // 2. Update forward and reverse owner lookup mappings
    g_tile_owner_slot[tile_id] = lru_slot;
    g_slot_owner_tile[lru_slot] = tile_id;

    // 3. Compute VRAM destination word address: slot * 16 + 0x6000
    uint16_t vram_dest = (lru_slot * TILE_4BPP_WORDS) + VRAM_OBJ_BASE_WORD;

    // 4. Queue VRAM destination address for vertical blank DMA transfer
    g_vram_queue_words[g_vram_queue_offset >> 1] = vram_dest;
    g_vram_queue_offset += 2;

    // 5. Locate tile graphic data in ROM
    RomFarPointer24 far_ptr = g_sprite_tile_ptrs[tile_id];
    uint32_t rom_addr = ((uint32_t)far_ptr.bank << 16) |
                        ((uint32_t)far_ptr.mid << 8) |
                        far_ptr.low;
    const uint8_t *tile_data = (const uint8_t *)(uintptr_t)rom_addr;

    // 6. Allocate 32 bytes in VRAM DMA staging buffer
    uint8_t *staging_dest = &g_vram_staging_dma[g_vram_staging_offset];
    g_vram_staging_offset += TILE_4BPP_BYTES;

    // 7. Check compression header
    uint8_t header = tile_data[0];
    if (header == 0) {
        // Raw uncompressed 4bpp tile: 32 bytes copy (words 0..15)
        for (int i = 0; i < TILE_4BPP_BYTES; i++) {
            staging_dest[i] = tile_data[1 + i];
        }
    } else {
        // Compressed 4bpp tile: expand bitplane mask
        decompress_4bpp_tile(tile_data, staging_dest);
    }

    return vram_dest;
}
