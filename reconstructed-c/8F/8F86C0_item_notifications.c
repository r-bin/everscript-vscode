/*
 * Routine: $8F86C0 (item_notifications)
 * Bank: $8F (ROM Offset: $0F86C0)
 * Source: docs/disassembly/entities/item-notifications.md
 */

#include <stdint.h>
#include <stdbool.h>

extern void render_floating_banner(uint32_t string_key, uint16_t anchor);
extern void format_notification_string(uint16_t anchor_offset);
extern void cutscene_script_enqueue(uint32_t script_address);

/**
 * Renders the "Received <item>" floating banner above character
 * and enqueues event callback back into the script VM.
 * Corresponds to $8F:86C0.
 */
void item_received_notification_banner(uint16_t anchor_pos, uint32_t return_script_addr) {
    // 1. Render primary item name banner
    render_floating_banner(0x8F86FA, anchor_pos);

    // 2. Format notification string in WRAM buffer
    format_notification_string(anchor_pos);

    // 3. Render "Received " prefix banner
    render_floating_banner(0x8F86FA, anchor_pos + 0x0020);

    // 4. Return to calling script thread via circular FIFO
    cutscene_script_enqueue(return_script_addr);
}
