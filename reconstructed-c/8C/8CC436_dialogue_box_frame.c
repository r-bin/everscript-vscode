/*
 * Routine: $8CC436 (dialogue_box_frame)
 * Bank: $8C (ROM Offset: $0CC436)
 * Source: docs/disassembly/ui/dialogue-box-frame.md
 */

#include <stdint.h>
#include <stdbool.h>

#define QUEUE_MAX_OFFSET 24 // 8 entries * 3 bytes
#define QUEUE_WRAP_OFFSET 24

extern WindowDescriptor g_dialogue_window; // $034D
extern uint16_t g_dialogue_timer;          // $0B2B
extern uint16_t g_queue_read_ptr;          // $0B2F
extern uint16_t g_queue_write_ptr;         // $0B31
extern DialogueQueueEntry g_queue_buf[8];  // $0DFB
extern uint16_t g_joypad_state;            // $0B79

extern void window_open_setup(WindowDescriptor* win);   // $8C:AC8A
extern void window_close(WindowDescriptor* win);        // $8C:ADE5
extern void window_render_text(WindowDescriptor* win);  // $8C:9E03
extern void vram_queue_dma_transfer(uint16_t src_addr, uint8_t src_bank,
                                    uint16_t vram_word_addr, uint16_t byte_len); // $80:8650

/**
 * $8C:C521 - dialogue_queue_push_message
 * Pushes a 24-bit far text pointer into the circular message queue.
 */
void dialogue_queue_push_message(uint16_t ptr_low, uint8_t ptr_bank) {
    uint16_t tail = g_queue_write_ptr;
    uint16_t next_tail;

    if (tail == QUEUE_WRAP_OFFSET) {
        next_tail = 0;
    } else {
        next_tail = tail + 3;
    }
    g_queue_write_ptr = next_tail;

    uint16_t slot_idx = tail / 3;
    g_queue_buf[slot_idx].text_ptr_low = ptr_low;
    g_queue_buf[slot_idx].text_ptr_bank = ptr_bank;
}

/**
 * $8C:C436 - dialogue_queue_tick
 * Per-frame update for dialogue window display timer and queue stepping.
 */
void dialogue_queue_tick(void) {
    // Return immediately if queue is empty
    if (g_queue_read_ptr == g_queue_write_ptr) {
        return;
    }

    // Return if display timer is paused (bit 15 set)
    if ((int16_t)g_dialogue_timer < 0) {
        return;
    }

    // If timer reached zero, open the next pending message
    if (g_dialogue_timer == 0) {
        dialogue_window_open_next();
        return;
    }

    // Countdown active message display duration
    g_dialogue_timer--;
    if (g_dialogue_timer != 0) {
        return;
    }

    // Message expired: advance read pointer
    uint16_t head = g_queue_read_ptr;
    if (head == QUEUE_WRAP_OFFSET) {
        g_queue_read_ptr = 0;
    } else {
        g_queue_read_ptr = head + 3;
    }

    // Close on-screen dialogue window
    window_close(&g_dialogue_window);
}

/**
 * $8C:C463 - dialogue_window_open_next
 * Configures dialogue geometry, calculates queue backlog pacing, and opens window.
 */
void dialogue_window_open_next(void) {
    uint16_t slot_idx = g_queue_read_ptr / 3;
    uint16_t text_low = g_queue_buf[slot_idx].text_ptr_low;
    uint8_t  text_bank = g_queue_buf[slot_idx].text_ptr_bank;

    // Calculate queue depth with circular wrap compensation
    int16_t depth = (int16_t)g_queue_write_ptr - (int16_t)g_queue_read_ptr;
    if (depth < 0) {
        depth += 24;
    }

    // Dynamic pacing: if 3 or more messages queued, accelerate timer
    if (depth >= 9) {
        g_dialogue_timer = 60;   // 1.0 second fast scroll
    } else {
        g_dialogue_timer = 120;  // 2.0 seconds normal read
    }

    // Configure window geometry for bottom dialogue box
    g_dialogue_window.cursor_x       = 0;
    g_dialogue_window.cursor_y       = 0;
    g_dialogue_window.window_type    = 4;      // Dialogue box type
    g_dialogue_window.border_style   = 1;      // Standard single-line border
    g_dialogue_window.bg_palette     = 0;      // Default palette
    g_dialogue_window.text_col       = 1;      // 1-tile left border margin
    g_dialogue_window.text_row       = 20;     // Scanline row 20 (bottom screen)
    g_dialogue_window.width_tiles    = 30;     // 30 tiles wide (240 pixels)
    g_dialogue_window.height_tiles   = 2;      // 2 tiles high (16 pixels)
    g_dialogue_window.line_stride    = 16;     // 16-pixel line spacing
    g_dialogue_window.vram_base_tile = 0x1924; // VRAM character base pattern

    // Open window frame and stage text
    window_open_setup(&g_dialogue_window);
    g_dialogue_window.flags |= 0x0010;
    window_render_text(&g_dialogue_window);
}

/**
 * $8C:C4F6 - dialogue_queue_reset
 * Closes any active window and purges pending messages.
 */
void dialogue_queue_reset(void) {
    if ((g_dialogue_timer & 0x7FFF) != 0) {
        window_close(&g_dialogue_window);
    }
    g_queue_read_ptr = 0;
    g_queue_write_ptr = 0;
    g_dialogue_timer &= 0x8000; // Preserve pause state, clear timer duration
}

/**
 * $8C:C543 - dialogue_queue_pause
 * Freezes the active dialogue display and sets pause flag.
 */
void dialogue_queue_pause(void) {
    if ((g_dialogue_timer & 0x7FFF) != 0) {
        window_close(&g_dialogue_window);
    }
    g_dialogue_timer |= 0x8000; // Set pause bit
}

/**
 * $8C:C55D - dialogue_queue_unpause
 * Unfreezes dialogue queue, re-opening active message if timer was pending.
 */
void dialogue_queue_unpause(void) {
    g_dialogue_timer &= 0x7FFF; // Clear pause bit
    if (g_dialogue_timer == 0) {
        return;
    }

    // Re-open dialogue window
    dialogue_window_open_next();
}

/**
 * $8C:ACD0 - window_tilemap_dma_commit
 * Writes tilemap words into shadow RAM at $7F:C800 and queues VRAM DMA uploads.
 */
void window_tilemap_dma_commit(WindowDescriptor* win) {
    uint16_t row_tiles = win->text_row;
    uint16_t col_tiles = win->text_col;
    uint16_t width     = win->width_tiles;
    uint16_t height    = win->height_tiles;

    // SNES hardware multiply: row * 64 bytes/row
    uint16_t shadow_offset = (row_tiles * 64) + (col_tiles * 2);
    uint16_t base_tile_word = (win->vram_base_tile >> 3) | 0x2000;

    for (uint16_t r = 0; r < height; r++) {
        uint16_t cur_offset = shadow_offset;
        uint16_t row_end = cur_offset + (width * 2);

        // Fill row tile indices into $7F:C800
        while (cur_offset < row_end) {
            uint16_t vram_word = base_tile_word;
            *(uint16_t*)(0x7FC800 + cur_offset) = vram_word;
            cur_offset += 2;
            base_tile_word += win->line_stride;
        }

        // Commit row via DMA to VRAM: VRAM word address = (shadow_offset >> 1) + 0x0800
        uint16_t vram_word_dest = (shadow_offset >> 1) + 0x0800;
        vram_queue_dma_transfer(shadow_offset + 0xC800, 0x7F, vram_word_dest, width * 2);

        // Advance to next scanline tile row
        shadow_offset += 0x0040; // 64 bytes
        base_tile_word++;
    }
}
