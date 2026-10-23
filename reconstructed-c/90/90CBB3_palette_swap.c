/*
 * Routine: $90CBB3 (palette_swap)
 * Bank: $90 (ROM Offset: $10CBB3)
 * Source: docs/disassembly/maps/palette-swap.md
 */

#include <stdint.h>
#include <stdbool.h>

#define CGRAM_DMA_BYTES           480 // 15 palettes * 16 colors * 2 bytes
#define CGRAM_PALETTE_1_OFFSET    0x10 // CGADD address for Palette 1 Color 0
#define NUM_TILE_FAMILIES         8
#define ANIM_CHANNEL_BUFFER_WORDS 16

typedef struct {
    uint16_t map_palette_req;       // $7E:2437 (MAP_PALETTE)
    uint16_t loaded_palette_id;     // $7E:0F8A
    uint16_t anim_channel_timer_0;  // $7E:128E
    uint16_t anim_channel_timer_1;  // $7E:1290
    uint16_t anim_cycle_state;      // $7E:1278
    uint16_t anim_cycle_step;       // $7E:127A
    uint16_t anim_registers[6];     // $7E:127C..$7E:1286
    uint16_t anim_channel_state[ANIM_CHANNEL_BUFFER_WORDS]; // $7E:13D2..$7E:13F0
    uint16_t family_anim_offsets[NUM_TILE_FAMILIES];        // $7E:62A5..$7E:6385
    uint16_t frame_hold_timer;      // $7E:1432
    uint16_t char_palette_ptr_0;    // $7E:0A2F
    uint16_t char_palette_ptr_1;    // $7E:0A79
} PaletteSubsystemState;

extern PaletteSubsystemState g_palette_subsystem;
extern const uint8_t g_cgram_staging_buffer[512]; // Bank $80:$8000

extern void load_up_to_7_tile_families_from_map_palette(void); // $90:D020
extern void refresh_vram_tile_family_graphics(void);           // $90:D55F
extern void recompute_metatile_palette_mappings(void);         // $90:D481
extern void load_sprite_palette(uint16_t channel_idx, uint16_t palette_addr); // $90:CF3A
extern void snes_dma1_transfer_to_cgram(const void *src, uint8_t cgadd, uint16_t size);

/**
 * Triggers tile family reload and metatile reassignment if MAP_PALETTE changed.
 * Corresponds to $90:CBB3.
 */
void reload_families_when_a_script_changes_map_palette(void) {
    if (g_palette_subsystem.map_palette_req != g_palette_subsystem.loaded_palette_id) {
        // Load up to 7 tile families from Bank $9C
        load_up_to_7_tile_families_from_map_palette();
    }

    // Refresh VRAM graphics and recompute metatile palette assignments
    refresh_vram_tile_family_graphics();
    recompute_metatile_palette_mappings();
}

/**
 * Commits 15 palettes (480 bytes) from $80:8000 into CGRAM via DMA1
 * and resets all palette animation timers and channel state buffers.
 * Corresponds to $90:CBC8.
 */
void cgram_dma_commit_15_palettes(void) {
    // 1. Perform 480-byte hardware DMA Channel 1 transfer into CGRAM ($2122)
    snes_dma1_transfer_to_cgram(&g_cgram_staging_buffer[0], CGRAM_PALETTE_1_OFFSET, CGRAM_DMA_BYTES);

    // 2. Clear palette animation timers
    g_palette_subsystem.anim_channel_timer_0 = 0;
    g_palette_subsystem.anim_channel_timer_1 = 0;
    g_palette_subsystem.anim_cycle_state = 0;
    g_palette_subsystem.anim_cycle_step = 0;

    for (int i = 0; i < 6; i++) {
        g_palette_subsystem.anim_registers[i] = 0;
    }

    // 3. Clear 16-word channel state buffers ($7E:13D2..$7E:13F0)
    for (int w = 0; w < ANIM_CHANNEL_BUFFER_WORDS; w++) {
        g_palette_subsystem.anim_channel_state[w] = 0;
    }
}

/**
 * Clears tile family animation offsets and re-initializes sprite palette channels.
 * Corresponds to $90:CC1A.
 */
void tile_family_animation_reset_and_init(void) {
    // 1. Reset tile family animation offsets for families 0..7
    for (int f = 0; f < NUM_TILE_FAMILIES; f++) {
        g_palette_subsystem.family_anim_offsets[f] = 0;
    }
    g_palette_subsystem.frame_hold_timer = 0;

    // 2. Clear cycle step pointers
    g_palette_subsystem.anim_cycle_state = 0;
    g_palette_subsystem.anim_cycle_step = 0;
    for (int i = 0; i < 4; i++) {
        g_palette_subsystem.anim_registers[i] = 0;
    }

    // 3. Re-initialize Channel 12 (Boy palette) and Channel 14 (Dog palette)
    g_palette_subsystem.anim_registers[4] = g_palette_subsystem.char_palette_ptr_0;
    load_sprite_palette(0x0C, g_palette_subsystem.char_palette_ptr_0);

    g_palette_subsystem.anim_registers[5] = g_palette_subsystem.char_palette_ptr_1;
    load_sprite_palette(0x0E, g_palette_subsystem.char_palette_ptr_1);
}
