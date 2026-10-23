/*
 * Routine: $80919E (oam_builder)
 * Bank: $80 (ROM Offset: $00919E)
 * Source: docs/disassembly/entities/oam-builder.md
 */

#include <stdint.h>
#include <stdbool.h>

#define OAM_LOW_TABLE_BASE   0xABDE
#define OAM_HIGH_TABLE_BASE  (0xABDE + 512)
#define VRAM_TILE_BUDGET_COST 3

// Direct page registers
extern uint8_t  g_oam_screen_x;            // DP $16
extern uint8_t  g_oam_x_bit8_and_size;     // DP $17 (bit 7 = X bit 8, bit 6 = 16x16 size)
extern uint8_t  g_oam_screen_y;            // DP $18
extern uint8_t  g_oam_tile_slot;           // DP $DB
extern uint8_t  g_oam_attr_flags;          // DP $DF
extern uint8_t  g_oam_palette_base;        // DP $06
extern uint16_t g_oam_low_write_offset;    // DP $D3
extern uint16_t g_oam_high_write_offset;   // DP $D5
extern uint8_t  g_oam_high_pack_mask;      // DP $D7
extern uint8_t  g_vram_upload_budget;      // DP $D8

// WRAM buffers
extern uint8_t  g_oam_low_buffer[512];     // $7E:ABDE
extern uint8_t  g_oam_high_buffer[32];     // $7E:ABDE + 512
extern uint8_t  g_lru_candidate_slot;      // $7E:9725

// Dynamic tile allocator routine
extern uint16_t obj_tile_allocate(uint8_t lru_slot, uint16_t tile_id); // $80:A4B5

/**
 * oam_sprite_entry_emit ($80:919E)
 * Validates the per-frame VRAM streaming budget, allocates or updates dynamic
 * OBJ tile cache, emits a 4-byte record to low OAM, and packs the high 2 bits.
 * 
 * @param tile_id Global sprite tile ID being drawn.
 * @return True if sprite entry was successfully emitted, false if dropped.
 */
bool oam_sprite_entry_emit(uint16_t tile_id) {
    // 1. Check per-frame upload budget
    if (g_vram_upload_budget < VRAM_TILE_BUDGET_COST) {
        return false; // Budget exhausted: drop tile to prevent frame lag
    }

    uint8_t lru_slot = g_lru_candidate_slot;
    if (lru_slot >= 0x80) {
        return false; // Cache table full
    }

    // Deduct cost from per-frame budget
    g_vram_upload_budget -= VRAM_TILE_BUDGET_COST;
    g_oam_tile_slot = lru_slot;

    // Allocate / stream tile into VRAM staging buffer
    obj_tile_allocate(lru_slot, tile_id);

    // 2. Emit 4-byte low OAM record
    uint16_t low_idx = g_oam_low_write_offset;
    g_oam_low_buffer[low_idx + 0] = g_oam_screen_x;
    g_oam_low_buffer[low_idx + 1] = g_oam_screen_y;
    g_oam_low_buffer[low_idx + 2] = g_oam_tile_slot;
    g_oam_low_buffer[low_idx + 3] = (g_oam_attr_flags & 0x07) + g_oam_palette_base;

    // Advance low OAM offset by 4 bytes
    g_oam_low_write_offset += 4;

    // 3. Pack 2-bit high OAM bits (X bit 8 and size flag)
    uint8_t shift_mask = g_oam_high_pack_mask << 2;
    if (shift_mask == 0) {
        // Advanced to next byte in high OAM
        g_oam_high_write_offset += 1;
        shift_mask = 0x01;
    }
    g_oam_high_pack_mask = shift_mask;

    // If coordinate X has bit 8 set, assert bit in high OAM
    if (g_oam_x_bit8_and_size & 0x80) {
        g_oam_high_buffer[g_oam_high_write_offset] |= shift_mask;
    }

    // If sprite size is 16x16, assert size bit (shift_mask << 1)
    if (g_oam_x_bit8_and_size & 0x40) {
        g_oam_high_buffer[g_oam_high_write_offset] |= (shift_mask << 1);
    }

    return true;
}
