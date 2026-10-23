/*
 * Routine: $90CD80 (palette_allocator)
 * Bank: $90 (ROM Offset: $10CD80)
 * Source: docs/disassembly/entities/palette-allocator.md
 */

#include <stdint.h>
#include <stdbool.h>

#define TOTAL_SPRITE_PALETTES 8
#define DYNAMIC_PALETTE_START 2 // Slots 0 and 1 are pinned for Boy & Dog
#define STOLEN_PALETTE_SLOT   4

typedef struct {
    uint16_t asset_id;      // Unique palette identifier
    uint16_t ref_count;     // Active entities using this palette
    uint32_t last_used_age; // LRU eviction timestamp
} PaletteSlot;

extern PaletteSlot g_sprite_palettes[TOTAL_SPRITE_PALETTES]; // $7E:0DE0
extern uint32_t g_palette_frame_counter;                     // $7E:0DF8

extern void queue_cgram_palette_dma(uint8_t slot_idx, uint16_t asset_id); // $80:8640

/**
 * Searches for an existing loaded palette or a completely free slot.
 * Corresponds to $90:CDAF.
 */
static int8_t palette_free_slot_search(uint16_t asset_id) {
    // Pass 1: Deduplication search for identical loaded palette
    for (int i = DYNAMIC_PALETTE_START; i < TOTAL_SPRITE_PALETTES; i++) {
        if (g_sprite_palettes[i].asset_id == asset_id) {
            g_sprite_palettes[i].ref_count++;
            g_sprite_palettes[i].last_used_age = g_palette_frame_counter;
            return i;
        }
    }

    // Pass 2: Search for empty slot (ref_count == 0)
    for (int i = DYNAMIC_PALETTE_START; i < TOTAL_SPRITE_PALETTES; i++) {
        if (g_sprite_palettes[i].ref_count == 0) {
            g_sprite_palettes[i].asset_id = asset_id;
            g_sprite_palettes[i].ref_count = 1;
            g_sprite_palettes[i].last_used_age = g_palette_frame_counter;
            queue_cgram_palette_dma(i, asset_id);
            return i;
        }
    }

    return -1; // No free slots available
}

/**
 * Steals slot 4 (or oldest LRU slot) when palette capacity is exceeded.
 * Corresponds to $90:CE92.
 */
static uint8_t palette_steal_slot_4(uint16_t asset_id) {
    uint8_t slot = STOLEN_PALETTE_SLOT;

    g_sprite_palettes[slot].asset_id = asset_id;
    g_sprite_palettes[slot].ref_count = 1;
    g_sprite_palettes[slot].last_used_age = g_palette_frame_counter;

    queue_cgram_palette_dma(slot, asset_id);
    return slot;
}

/**
 * Dynamic sprite palette allocator: deduplicates, allocates, or evicts.
 * Corresponds to $90:CD80.
 */
uint8_t sprite_palette_allocator(uint16_t asset_id) {
    int8_t slot = palette_free_slot_search(asset_id);
    if (slot >= 0) {
        return (uint8_t)slot;
    }

    // All dynamic slots exhausted: steal slot 4
    return palette_steal_slot_4(asset_id);
}
