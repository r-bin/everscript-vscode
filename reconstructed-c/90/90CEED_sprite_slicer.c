/*
 * Routine: $90CEED (sprite_slicer)
 * Bank: $90 (ROM Offset: $10CEED)
 * Source: docs/disassembly/entities/sprite-slicer.md
 */

#include <stdint.h>
#include <stdbool.h>

extern uint16_t g_sprite_vram_cache_slots[3]; // $1288, $128A, $128C
extern OAMSliceDescriptor g_oam_frame_slices[8]; // $7E:6289

extern void vram_dma_enqueue_transfer(uint16_t src_offset, uint8_t src_bank,
                                     uint16_t vram_word_dest, uint16_t byte_len); // $80:85FA

/**
 * $90:CEED - sprite_vram_3slot_cache_alloc
 * Queries 3-slot associative VRAM cache for sprite graphics; streams via DMA on miss.
 */
int16_t sprite_vram_3slot_cache_alloc(uint16_t asset_id) {
    // 1. Check for cache hit in slots 0, 1, or 2
    for (int16_t slot = 0; slot < 3; slot++) {
        if (g_sprite_vram_cache_slots[slot] == asset_id) {
            return slot * 2; // Return slot byte index: 0, 2, or 4
        }
    }

    // 2. Cache miss: find first unallocated slot
    for (int16_t slot = 0; slot < 3; slot++) {
        if (g_sprite_vram_cache_slots[slot] == 0) {
            g_sprite_vram_cache_slots[slot] = asset_id;

            // Enqueue VRAM DMA upload for new sprite graphics
            sprite_tile_vram_dma_enqueue(asset_id, slot * 2);

            return slot * 2;
        }
    }

    // All slots occupied
    return 0;
}

/**
 * $90:CF3A - sprite_slice_descriptor_composite
 * Assembles multi-tile slice definitions into active OAM frame buffer.
 */
void sprite_slice_descriptor_composite(const OAMSliceDescriptor* slice_src, uint16_t slot_idx) {
    uint16_t dest_idx = slot_idx << 4; // 16 bytes per slice slot
    OAMSliceDescriptor* dest = (OAMSliceDescriptor*)((uint8_t*)g_oam_frame_slices + dest_idx);

    dest->tile_pattern = slice_src->tile_pattern;
    dest->offset_x     = slice_src->offset_x;
    dest->offset_y     = slice_src->offset_y;
    dest->attr_flags   = slice_src->attr_flags;
    dest->size_flag    = slice_src->size_flag;
    dest->slot_link    = slice_src->slot_link;
}

/**
 * $90:CFB8 - sprite_tile_vram_dma_enqueue
 * Calculates ROM source address and target VRAM word address for DMA transfer.
 */
void sprite_tile_vram_dma_enqueue(uint16_t asset_id, uint16_t slot_idx) {
    // ROM source pattern in Bank $90
    uint16_t src_offset = asset_id;
    uint8_t  src_bank   = 0x90;

    // VRAM destination address: base offset + (slot_idx * 0x0800)
    uint16_t vram_word_addr = 0x4000 + ((slot_idx >> 1) * 0x0800);

    // Enqueue transfer of 512 bytes (16 tiles * 32 bytes/tile)
    vram_dma_enqueue_transfer(src_offset, src_bank, vram_word_addr, 0x0200);
}
