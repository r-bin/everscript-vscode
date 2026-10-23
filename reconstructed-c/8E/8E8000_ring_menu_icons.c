/*
 * Routine: $8E8000 (ring_menu_icons)
 * Bank: $8E (ROM Offset: $0E8000)
 * Source: docs/disassembly/ui/ring-menu-icons.md
 */

typedef struct {
    uint16_t item_count;       // +0x00: Total items available in this category
    uint16_t active_index;     // +0x02: Currently highlighted item index
    uint16_t item_ids[];       // +0x04: Array of item IDs in ring order
} RingCategoryHeader;
