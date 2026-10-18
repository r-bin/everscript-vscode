# Ring Menu Orbit Physics & Interactive Continuous Rotation

## Overview
When navigating the ring menu in Secret of Evermore, pressing Left or Right on the D-Pad triggers an orbital rotation. Rather than instantly snapping to the newly selected item, the engine calculates the target angle using SNES hardware math registers, steps the visual angle by 4 angular units per frame, synchronizes rendering with VBlank, plays tick audio cues, and handles continuous auto-rotation if the directional button remains held down.

---

## Memory Map & Hardware Registers

### WRAM Variables
- `$7E:061B`: `current_orbit_angle` (Visual orbital angle, 0x00 - 0xFF)
- `$7E:061D`: `target_orbit_angle` (Destination angle calculated for the active item)
- `$7E:05AB`: `ring_active_modal` (Bit 0: circular window clipping active)
- `$7E:0104`: `controller_hold` (Bit 8: Left D-pad, Bit 9: Right D-pad)
- `DP $95`: Pointer to current `RingCategoryHeader`
  - `+0x00`: `item_count`
  - `+0x02`: `active_index`

### SNES Hardware Registers
- `$00:4202`: `WRNUMA` (8-bit multiplier input A)
- `$00:4204`: `WRDIVL` (16-bit dividend input)
- `$00:4206`: `WRDIVB` (8-bit divisor input)
- `$00:4214`: `RDDIVL` (16-bit quotient output)
- `$00:4216`: `RDMPY` / `RDMOD` (16-bit remainder / multiplication product)

---

## Decompiled C Code

```c
#include <stdint.h>
#include <stdbool.h>

typedef struct {
    uint16_t item_count;       // +0x00: Total items in this category
    uint16_t active_index;     // +0x02: Current selected item index
    uint16_t item_ids[];       // +0x04: Array of item IDs
} RingCategoryHeader;

#define WRAM_CURRENT_ANGLE   (*(volatile uint16_t*)0x7E061B)
#define WRAM_TARGET_ANGLE    (*(volatile uint16_t*)0x7E061D)
#define WRAM_RING_ACTIVE     (*(volatile uint16_t*)0x7E05AB)
#define WRAM_CONTROLLER_HELD (*(volatile uint16_t*)0x7E0104)

// External Subroutines
extern void vram_free_window_buffer(uint16_t id);   // $90:80D2
extern void ring_menu_reset_audio_state(void);      // $8E:B520
extern void ring_menu_restore_sprites(void);        // $8E:B33D
extern void render_layer_sync(void);                // $80:96BB
extern void entity_physics_resume(void);            // $8F:C61E
extern void dma_buffer_flush(void);                 // $80:8FEE
extern void vblank_nmi_sync(void);                  // $80:858C
extern void apu_play_sfx_direct(uint16_t sfx_id);   // $8C:82DC

/**
 * Calculates target angle using SNES hardware division:
 * target_angle = ((item_index << 8) | 0x80) * 2 / item_count
 */
static inline uint16_t ring_calculate_target_angle(uint16_t item_index, uint16_t item_count) {
    if (item_count == 0) return 0;
    uint32_t dividend = (((uint32_t)item_index << 8) | 0x80) * 2;
    return (uint16_t)((dividend / item_count) & 0x00FF);
}

/**
 * Shared per-frame screen update and VBlank synchronizer for menu rotation.
 */
static void ring_menu_frame_sync(void) {
    if (WRAM_RING_ACTIVE & 0x0001) {
        vram_free_window_buffer(0x0DEB);
        vram_free_window_buffer(0x0DDB);
    }
    ring_menu_reset_audio_state();
    ring_menu_restore_sprites();
    render_layer_sync();
    entity_physics_resume();
    render_layer_sync();
    dma_buffer_flush();
    vblank_nmi_sync();
}

/**
 * $8E:AF1E / $8E:AFB1 - Rotates ring menu counter-clockwise (Left D-Pad).
 * Continuously steps angle towards target until reached or new input arrives.
 */
void ring_menu_rotate_previous_item(RingCategoryHeader *category) {
    if (!category || category->item_count == 0) return;

    // Decrement item index with wraparound
    int16_t new_index = (int16_t)category->active_index - 1;
    if (new_index < 0) {
        new_index = (int16_t)category->item_count - 1;
    }
    category->active_index = (uint16_t)new_index;

    // Calculate target angle
    WRAM_TARGET_ANGLE = ring_calculate_target_angle((uint16_t)new_index, category->item_count);

    // Continuous stepping loop ($8E:AF54)
    while (true) {
        ring_menu_frame_sync();

        // Step visual angle by 4 units
        uint16_t next_angle = (WRAM_CURRENT_ANGLE - 4) & 0x00FF;

        // Check distance to target angle
        uint16_t delta = (WRAM_TARGET_ANGLE - next_angle) & 0x00FF;
        if (delta >= 4) {
            WRAM_CURRENT_ANGLE = next_angle;
            continue; // Continue rotation interpolation
        }

        // Target angle reached: play selection tick SFX (0x03)
        apu_play_sfx_direct(0x0003);

        // Check if Left D-Pad (0x0100) is still being held down
        if (WRAM_CONTROLLER_HELD & 0x0100) {
            new_index = (int16_t)category->active_index - 1;
            if (new_index < 0) {
                new_index = (int16_t)category->item_count - 1;
            }
            category->active_index = (uint16_t)new_index;
            WRAM_TARGET_ANGLE = ring_calculate_target_angle((uint16_t)new_index, category->item_count);
            WRAM_CURRENT_ANGLE = next_angle;
            continue; // Keep rotating seamlessly
        }

        // Snap to target angle and stop
        WRAM_CURRENT_ANGLE = WRAM_TARGET_ANGLE;
        break;
    }
}

/**
 * $8E:AFF4 / $8E:B085 - Rotates ring menu clockwise (Right D-Pad).
 * Continuously steps angle towards target until reached or new input arrives.
 */
void ring_menu_rotate_next_item(RingCategoryHeader *category) {
    if (!category || category->item_count == 0) return;

    // Increment item index with wraparound
    uint16_t new_index = category->active_index + 1;
    if (new_index >= category->item_count) {
        new_index = 0;
    }
    category->active_index = new_index;

    // Calculate target angle
    WRAM_TARGET_ANGLE = ring_calculate_target_angle(new_index, category->item_count);

    // Continuous stepping loop ($8E:B02C)
    while (true) {
        ring_menu_frame_sync();

        // Step visual angle by +4 units
        uint16_t next_angle = (WRAM_CURRENT_ANGLE + 4) & 0x00FF;

        // Check distance to target angle
        uint16_t delta = (next_angle - WRAM_TARGET_ANGLE) & 0x00FF;
        if (delta >= 4) {
            WRAM_CURRENT_ANGLE = next_angle;
            continue; // Continue rotation interpolation
        }

        // Target angle reached: play selection tick SFX (0x03)
        apu_play_sfx_direct(0x0003);

        // Check if Right D-Pad (0x0200) is still being held down
        if (WRAM_CONTROLLER_HELD & 0x0200) {
            new_index = category->active_index + 1;
            if (new_index >= category->item_count) {
                new_index = 0;
            }
            category->active_index = new_index;
            WRAM_TARGET_ANGLE = ring_calculate_target_angle(new_index, category->item_count);
            WRAM_CURRENT_ANGLE = next_angle;
            continue; // Keep rotating seamlessly
        }

        // Snap to target angle and stop
        WRAM_CURRENT_ANGLE = WRAM_TARGET_ANGLE;
        break;
    }
}
```
