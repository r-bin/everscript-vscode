/*
 * Routine: $90D020 (palette_families)
 * Bank: $90 (ROM Offset: $10D020)
 * Source: docs/disassembly/maps/palette-families.md
 */

#include <stdint.h>
#include <stdbool.h>

#define MAX_TILE_FAMILIES        7
#define BYTES_PER_TILE_FAMILY   32
#define TILE_FAMILY_ROM_BASE    0xC322
#define TILE_FAMILY_ROM_BANK    0x9C

// WRAM state
extern uint16_t g_map_palette_id;        // $7E:2437 (MAP_PALETTE)
extern uint16_t g_loaded_map_palette_id; // $7E:0F8A
extern uint16_t g_tile_families_offset;  // $7E:0F9C
extern const uint8_t *g_current_room_header; // DP [$8B]
extern uint8_t g_tile_family_buffer[];   // $7E:61A7

// Subsystem functions
extern void dma_copy_rom_to_wram(uint8_t bank, uint16_t src, void *dst, uint16_t size);
extern void cgram_queue_palette_update(uint16_t offset, uint16_t param); // $80:85FA
extern void vram_refresh_tile_families(void);                             // $90:D55F
extern void map_recompute_tile_palettes(void);                           // $90:D481

/**
 * load_up_to_7_tile_families_from_map_palette ($90:D020)
 * Copies up to 7 tile families (32 bytes each) from ROM bank $9C into WRAM $7E:61A7,
 * and queues the corresponding CGRAM palette upload for the next VBLANK.
 */
void load_up_to_7_tile_families_from_map_palette(void) {
    // 1. Cache the new map palette ID
    g_loaded_map_palette_id = g_map_palette_id;

    // 2. Read number of tile families defined in room header
    uint16_t header_offset = g_tile_families_offset;
    uint16_t total_families = g_current_room_header[header_offset];

    if (total_families <= g_loaded_map_palette_id) {
        return; // No remaining families to load
    }

    int16_t remaining = total_families - g_loaded_map_palette_id;
    if (remaining <= 0) {
        return;
    }

    // Clamp to maximum 7 families
    uint16_t count = (remaining < MAX_TILE_FAMILIES) ? (uint16_t)remaining : MAX_TILE_FAMILIES;

    // 3. Setup source offset in room header
    const uint16_t *family_ids = (const uint16_t *)&g_current_room_header[header_offset + (g_loaded_map_palette_id * 2) + 1];
    uint8_t *dest = g_tile_family_buffer;

    // 4. DMA transfer each tile family from ROM Bank $9C into WRAM $7E:61A7
    for (uint16_t i = 0; i < count; i++) {
        uint16_t family_id = family_ids[i];
        uint16_t rom_source = TILE_FAMILY_ROM_BASE + (family_id * BYTES_PER_TILE_FAMILY);

        dma_copy_rom_to_wram(TILE_FAMILY_ROM_BANK, rom_source, dest, BYTES_PER_TILE_FAMILY);
        dest += BYTES_PER_TILE_FAMILY;
    }

    // 5. Queue CGRAM palette update
    uint16_t cgram_offset = (total_families * 16) * 2;
    cgram_queue_palette_update(cgram_offset, 0x0010);
}

/**
 * reload_families_when_a_script_changes_map_palett ($90:CBB3)
 * Checks if the script modified the MAP_PALETTE index, and reloads
 * families and graphics associations if changed.
 */
void reload_families_when_a_script_changes_map_palett(void) {
    // Only reload if the script actually selected a different palette
    if (g_map_palette_id != g_loaded_map_palette_id) {
        load_up_to_7_tile_families_from_map_palette();
    }

    // Refresh VRAM tile families and metatile palette mappings
    vram_refresh_tile_families();
    map_recompute_tile_palettes();
}
