/*
 * Routine: $8EAE85 (ring_menu_sprites)
 * Bank: $8E (ROM Offset: $0EAE85)
 * Source: docs/disassembly/ui/ring-menu-sprites.md
 */

#include <stdint.h>
#include <stdbool.h>

#define REG_WRDIVL (*(volatile uint16_t*)0x4204)
#define REG_WRDIVB (*(volatile uint8_t*)0x4206)
#define REG_RDDIVL (*(volatile uint16_t*)0x4214)

extern RingMenuIconSlot g_ring_icon_slots[16]; // $7E:06A3
extern uint16_t g_ring_flags;                 // $7E:05AB
extern uint16_t g_ring_current_angle;         // $7E:061B
extern uint16_t g_ring_target_angle;          // $7E:061D

typedef struct RingInventoryHeader {
    uint16_t item_count;    // +$00
    uint16_t selected_idx;  // +$02
    uint16_t item_ids[16];  // +$04
} RingInventoryHeader;

extern RingInventoryHeader* g_active_ring;     // DP $95

extern uint16_t sprite_vram_alloc(uint16_t gfx_id); // $90:CEED
extern void     sprite_palette_bind(uint16_t pal_attr); // $90:80CE

/**
 * $8E:AEBC - ring_menu_load_item_icons
 * Loads sprite graphics and allocates VRAM for all items in the active ring menu.
 */
void ring_menu_load_item_icons(RingInventoryHeader* ring) {
    uint16_t count = ring->item_count;

    for (uint16_t i = 0; i < count; i++) {
        uint16_t item_id = ring->item_ids[i];

        // 1. Resolve item graphic sprite ID from ROM table at $8E:0004
        uint16_t gfx_id = *(const uint16_t*)(0x8E0004 + (item_id * 2));

        // 2. Allocate VRAM tile slot for 16x16 / 24x24 icon
        uint16_t vram_tile = sprite_vram_alloc(gfx_id);
        g_ring_icon_slots[i].vram_tile_base = vram_tile;
        g_ring_icon_slots[i].item_id = item_id;

        // 3. Bind item palette and OAM attributes from ROM table at $8E:0002
        uint16_t pal_attr = *(const uint16_t*)(0x8E0002 + (item_id * 2));
        sprite_palette_bind(pal_attr);
        g_ring_icon_slots[i].palette_attr = pal_attr;
    }
}

/**
 * $8E:B000 - ring_menu_calculate_icon_angles
 * Calculates the target angular position for each icon based on selected item and ring count.
 */
void ring_menu_calculate_icon_angles(RingInventoryHeader* ring) {
    uint16_t selected = ring->selected_idx;
    uint16_t count    = ring->item_count;

    if (count == 0) {
        return;
    }

    // Hardware division: target_angle = ((selected << 8) | 0x80) / count
    // Uses SNES hardware divider ($4204 / $4206)
    REG_WRDIVL = ((selected << 8) | 0x0080);
    REG_WRDIVB = (uint8_t)count;

    // Wait for division cycle (16 machine cycles)
    __asm__ volatile("nop; nop;");

    // Retrieve quotient from $4214
    g_ring_target_angle = REG_RDDIVL;

    // Check if rotation angle adjustment is required
    ring_menu_rotate_step();
}

/**
 * $8E:B076 - ring_menu_rotate_step
 * Performs angular interpolation to smoothly rotate the ring to the target icon.
 */
void ring_menu_rotate_step(void) {
    // Current angle with 4-unit lead offset
    uint8_t cur = (uint8_t)(g_ring_current_angle + 4);
    uint8_t target = (uint8_t)g_ring_target_angle;

    // Delta modulo 256
    uint8_t delta = (cur - target) & 0xFF;

    if (delta < 4) {
        // Snapped to target: complete rotation
        g_ring_current_angle = g_ring_target_angle;
        g_ring_flags &= ~0x0002; // Clear rotating flag
    } else if (delta < 128) {
        // Rotate clockwise (speed = 3 units/frame)
        g_ring_current_angle -= 3;
        g_ring_flags |= 0x0002;  // Set rotating flag
    } else {
        // Rotate counter-clockwise (speed = 3 units/frame)
        g_ring_current_angle += 3;
        g_ring_flags |= 0x0002;  // Set rotating flag
    }
}
