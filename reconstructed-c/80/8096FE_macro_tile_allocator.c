/*
 * Routine: $8096FE (macro_tile_allocator)
 * Bank: $80 (ROM Offset: $0096FE)
 * Source: docs/disassembly/engine-core/macro-tile-allocator.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_16X16_SLOTS      32
#define BYTES_PER_16X16      128 /* 4 tiles * 32 bytes */

/* VRAM base word address lookup table in ROM Bank $80 */
extern const uint16_t ROM_16X16_VRAM_ADDR_TABLE[MAX_16X16_SLOTS];

/* External graphics decompressors in Bank $80 */
extern void sparse_palette_stream_decompressor(uint16_t table_offset, uint8_t *dest_buffer);
extern void load_16x16_block_raw_copy(uint16_t table_offset, uint8_t *dest_buffer);
extern const uint8_t *rom_bank_ec_ptr(uint32_t offset);

/* WRAM State Structures */
typedef struct {
    uint16_t lru_head;
    uint16_t lru_tail;
    uint16_t forward_links[MAX_16X16_SLOTS];
    uint16_t backward_links[MAX_16X16_SLOTS];
    uint16_t block_to_slot[1024];      /* $7E:97A9 */
    uint16_t slot_to_block[MAX_16X16_SLOTS]; /* $7E:AA58 */
    uint16_t dma_vram_queue[64];       /* $7E:163C */
    uint16_t dma_queue_cursor;         /* DP $CD */
    uint8_t  staging_buffer[BYTES_PER_16X16]; /* $7E:72D1 */
} MacroTileCacheManager;

static MacroTileCacheManager g_macro_cache;

/**
 * Allocates a 16x16 macro-tile slot in VRAM, queues DMA transfer,
 * and initiates ROM unpacking.
 *
 * Address: $80:96FE - $80:9740
 *
 * @param block_id 16x16 sprite macro-block identifier (DP $DD)
 * @return Allocated cache slot index
 */
uint16_t obj_16x16_tile_allocate(uint16_t block_id) {
    /* 1. Take Least Recently Used slot from queue tail */
    uint16_t slot = g_macro_cache.lru_tail;
    g_macro_cache.lru_tail = g_macro_cache.forward_links[slot];

    /* 2. Relink slot as Most Recently Used at queue head */
    uint16_t old_head = g_macro_cache.lru_head;
    g_macro_cache.forward_links[slot] = old_head;
    g_macro_cache.backward_links[old_head] = slot;
    g_macro_cache.lru_head = slot;

    /* 3. Record bi-directional owner mappings */
    g_macro_cache.block_to_slot[block_id] = slot;
    g_macro_cache.slot_to_block[slot] = block_id;

    /* 4. Resolve target VRAM word address and queue for VBLANK DMA */
    uint16_t vram_dest = ROM_16X16_VRAM_ADDR_TABLE[slot];
    uint16_t q_idx = g_macro_cache.dma_queue_cursor;
    g_macro_cache.dma_vram_queue[q_idx / 2] = vram_dest;
    g_macro_cache.dma_queue_cursor += 2;

    /* 5. Read 24-bit pointer table in Bank $EC (block_id * 3) */
    uint32_t table_offset = block_id * 3;
    const uint8_t *entry = rom_bank_ec_ptr(table_offset);
    uint16_t descriptor_flags = *(const uint16_t *)(entry + 1);

    /* Bit 15 determines compressed stream vs raw 128-byte block */
    if (descriptor_flags & 0x8000) {
        sparse_palette_stream_decompressor((uint16_t)table_offset, g_macro_cache.staging_buffer);
    } else {
        load_16x16_block_raw_copy((uint16_t)table_offset, g_macro_cache.staging_buffer);
    }

    return slot;
}
