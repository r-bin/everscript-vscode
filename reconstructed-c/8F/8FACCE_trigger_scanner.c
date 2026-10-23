/*
 * Routine: $8FACCE (trigger_scanner)
 * Bank: $8F (ROM Offset: $0FACCE)
 * Source: docs/disassembly/maps/trigger-scanner.md
 */

#include <stdint.h>
#include <stdbool.h>

#pragma pack(push, 1)
typedef struct {
    uint8_t  y1;        // +0x00: Top cell coordinate bound
    uint8_t  x1;        // +0x01: Left cell coordinate bound
    uint8_t  y2;        // +0x02: Bottom cell coordinate bound (exclusive)
    uint8_t  x2;        // +0x03: Right cell coordinate bound (exclusive)
    uint16_t script_id; // +0x04: Index into script pointer table
} MapTriggerEntry;
#pragma pack(pop)

typedef struct {
    uint16_t origin_x;        // $7E:0F86
    uint16_t origin_y;        // $7E:0F88
    uint16_t last_trigger_id; // $7E:2429
    uint16_t entity_x;        // $7E:2421
    uint16_t entity_y;        // $7E:2423
    uint16_t entity_facing;   // $7E:2425
    uint16_t run_list_tail;   // DP $86
    uint16_t run_list[32];    // $7E:2F28
} TriggerSystemContext;

extern TriggerSystemContext g_triggers;
extern const uint8_t        g_rom[0x400000];

extern uint16_t script_vm_alloc_slot(uint32_t script_addr);

/**
 * Spawns a new script thread in the VM for a triggered event.
 * Corresponds to $8C:CE5C.
 */
void launch_trigger_script(uint16_t script_id, uint16_t entity_slot) {
    // Read script pointer table offset from bank header $92:8000
    uint16_t table_base = (uint16_t)(g_rom[0x128000] | (g_rom[0x128001] << 8));
    uint32_t entry_addr = 0x128000 + table_base + script_id;

    // Packed 24-bit pointer
    uint32_t script_addr = (uint32_t)g_rom[entry_addr] |
                          ((uint32_t)g_rom[entry_addr + 1] << 8) |
                          ((uint32_t)g_rom[entry_addr + 2] << 16);

    // Allocate a VM thread slot
    uint16_t slot_offset = script_vm_alloc_slot(script_addr);

    // Append to active run-list
    uint16_t idx = g_triggers.run_list_tail;
    g_triggers.run_list[idx >> 1] = slot_offset;
    g_triggers.run_list[(idx >> 1) + 1] = 0; // Null terminator
    g_triggers.run_list_tail += 2;
}

/**
 * Scans active room triggers against entity pixel coordinates.
 * Corresponds to $8F:ACCE.
 */
bool scan_room_triggers(uint16_t pixel_x, uint16_t pixel_y, 
                        const MapTriggerEntry *table, uint16_t entry_count, 
                        uint16_t entity_slot, uint8_t facing) {
    // Convert 16px metatile cell coordinates
    uint8_t cell_x = (uint8_t)((pixel_x >> 4) + g_triggers.origin_x);
    uint8_t cell_y = (uint8_t)((pixel_y >> 4) + g_triggers.origin_y);

    for (uint16_t i = 0; i < entry_count; i++) {
        const MapTriggerEntry *t = &table[i];

        // Bounding box test: y1 <= cell_y < y2 && x1 <= cell_x < x2
        if (cell_y >= t->y1 && cell_y < t->y2 &&
            cell_x >= t->x1 && cell_x < t->x2) {
            
            // Prevent immediate re-triggering of the same active trigger
            if (t->script_id == g_triggers.last_trigger_id) {
                return false;
            }
            g_triggers.last_trigger_id = t->script_id;

            // Record activation context
            g_triggers.entity_x      = pixel_x;
            g_triggers.entity_y      = pixel_y;
            g_triggers.entity_facing = (facing & 0x30) >> 4;

            // Launch script thread!
            launch_trigger_script(t->script_id, entity_slot);
            return true;
        }
    }

    return false;
}
