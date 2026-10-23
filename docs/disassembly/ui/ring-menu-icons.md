# Ring Menu Icon VRAM Streaming & Cache Subsystem

## Overview
When the player or companion opens the ring menu or navigates between categories (Weapons, Alchemy Formulas, Consumable Items, Rare Key Items), the UI engine dynamically streams 16x16 pixel icon graphics and allocates palettes into CGRAM.

The ring menu display slots reside in WRAM starting at `$7E:06A3`. Each item slot is 16 (`0x10`) bytes long, tracking the item ID, target coordinate vectors, animation angles, and CGRAM palette attribute index (`+0x0C`).

## Memory Map & Data Structures

### Ring Menu Item Display Slot (`WRAM $7E:06A3`)
> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8E/8E8000_ring_menu_icons.c`](../../../reconstructed-c/8E/8E8000_ring_menu_icons.c).
> [View in VFS: soe://rom/code/8E8000](soe://rom/code/8E8000?c=1&asm=0)


### Ring Menu Category Descriptor (`DP $95`)
> **Reconstructed C Decompilation**:
> Source moved to [`reconstructed-c/8E/8E8000_ring_menu_icons.c`](../../../reconstructed-c/8E/8E8000_ring_menu_icons.c).
> [View in VFS: soe://rom/code/8E8000](soe://rom/code/8E8000?c=1&asm=0)


### Item Master Definition Header (`ROM $8E:8000 + (ID * 2)`)
Each item points to an item descriptor in bank `$8E`:
- `+0x00`: Item type flags / target suitability
- `+0x02`: VRAM icon graphics tile index (decompressed 4bpp 16x16 icon)
- `+0x04`: CGRAM palette ID

---

## Decompiled C Code

```c
#include <stdint.h>
#include <stdbool.h>

#define RING_SLOT_DISPLAY_BASE ((RingSlotDisplay*)0x7E06A3)
#define WRAM_RING_ACTIVE_FLAG  (*(volatile uint16_t*)0x7E05AB)
#define WRAM_CURRENT_CHAR_IDX  (*(volatile uint16_t*)0x7E05A7)
#define WRAM_CONTROLLER_PRESS  (*(volatile uint16_t*)0x7E0104)
#define WRAM_RING_ICON_CACHED  (*(volatile uint16_t*)0x7E0BF9)

#define CHAR_STATUS_FLAG(idx)  (*(volatile uint16_t*)(0x7E0010 + ((idx) ^ 0x01BE)))

// External ROM Subroutines
extern void palette_allocate_cgram(uint16_t palette_id);       // $90:CEED
extern void vram_stream_icon_tiles(uint16_t icon_tile_id);      // $90:80CE
extern void vram_free_window_buffer(uint16_t buffer_id);        // $90:80D2
extern void screen_hdma_restore_window(void);                  // $90:9876
extern void ring_menu_reset_audio_state(void);                 // $8E:B520
extern void ring_menu_restore_sprites(void);                   // $8E:B33D
extern void render_layer_sync(void);                           // $80:96BB
extern void entity_physics_resume(void);                       // $8F:C61E
extern void dma_buffer_flush(void);                            // $80:8FEE
extern void vblank_nmi_sync(void);                             // $80:858C
extern void ui_sound_trigger_switch(void);                     // $80:8597

/**
 * $8E:AEBC - Streams 16x16 icons and assigns palettes for all items in the category.
 */
void ring_menu_load_category_icons(const RingCategoryHeader *category) {
    uint16_t count = category->item_count;
    if (count == 0) return;

    RingSlotDisplay *slot = RING_SLOT_DISPLAY_BASE;
    const uint16_t *item_id_ptr = category->item_ids;

    while (count > 0) {
        uint16_t item_id = *item_id_ptr++;
        
        // Read item definition pointer from master table $8E:8000
        const uint8_t *item_desc = (const uint8_t*)(*(const uint16_t*)(0x8E8000 + (item_id * 2)));

        // +0x04: Read palette ID and allocate dynamic CGRAM slot
        uint16_t palette_id = *(const uint16_t*)(item_desc + 0x04);
        uint16_t allocated_palette = palette_allocate_cgram(palette_id);
        slot->palette_attr = allocated_palette;

        // +0x02: Read icon graphic index and stream 16x16 tile data to VRAM
        uint16_t icon_tile_id = *(const uint16_t*)(item_desc + 0x02);
        vram_stream_icon_tiles(icon_tile_id);

        // Advance to next 16-byte display slot
        slot++;
        count--;
    }

    // Set cache flag to indicate VRAM icon ring is fully prepared
    WRAM_RING_ICON_CACHED = 0xFFFF;
}

/**
 * $8E:AEFD - Pre-allocates CGRAM palettes for companion category items.
 */
void ring_menu_cache_item_palettes(const RingCategoryHeader *category) {
    uint16_t count = category->item_count;
    if (count == 0) return;

    const uint16_t *item_id_ptr = category->item_ids;

    while (count > 0) {
        uint16_t item_id = *item_id_ptr++;
        const uint8_t *item_desc = (const uint8_t*)(*(const uint16_t*)(0x8E8000 + (item_id * 2)));

        uint16_t palette_id = *(const uint16_t*)(item_desc + 0x04);
        palette_allocate_cgram(palette_id);

        count--;
    }
}

/**
 * $8E:AE59 - Check controller input for switching ring menu to the companion.
 * Returns true if a character switch was initiated.
 */
bool ring_menu_check_companion_toggle(void) {
    // Check if ring menu is in active modal state
    if (WRAM_RING_ACTIVE_FLAG & 0x0001) {
        return false;
    }

    // Determine alternate character: XOR 0x01BE swaps between Boy and Dog structs
    uint16_t alt_char_status = CHAR_STATUS_FLAG(WRAM_CURRENT_CHAR_IDX);

    // If alternate character is incapacitated (0x1000), dead (0x0001), or frozen (0x0020), forbid switch
    if (alt_char_status & 0x1021) {
        return false;
    }

    // Check if Select or X button was pressed (bit 6 = 0x0040)
    if (WRAM_CONTROLLER_PRESS & 0x0040) {
        ui_sound_trigger_switch();
        return true; // Action code 0x0020 (switch character ring)
    }

    return false;
}

/**
 * $8E:AE85 - Close the ring menu, deallocate VRAM window buffers, and restore display.
 */
void ring_menu_close_and_restore_screen(void) {
    if (WRAM_RING_ACTIVE_FLAG & 0x0001) {
        // Free ring geometry window masking buffers
        vram_free_window_buffer(0x0DEB);
        vram_free_window_buffer(0x0DDB);
    }

    // Restore screen HDMA gradient and window clip registers
    screen_hdma_restore_window();

    // Reset audio channels and restore sprite OAM allocations
    ring_menu_reset_audio_state();
    ring_menu_restore_sprites();
    render_layer_sync();

    // Resume world physics and entity integration
    entity_physics_resume();
    render_layer_sync();

    // Flush DMA and synchronize with VBlank
    dma_buffer_flush();
    vblank_nmi_sync();
}
```
