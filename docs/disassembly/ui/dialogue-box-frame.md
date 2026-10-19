# Dialogue Window Frame & Message Queue Manager

**Addresses**:
- `dialogue_queue_tick`: `$8C:C436` – `$8C:C462`
- `dialogue_window_open_next`: `$8C:C463` – `$8C:C4F5`
- `dialogue_queue_reset`: `$8C:C4F6` – `$8C:C520`
- `dialogue_queue_push_message`: `$8C:C521` – `$8C:C542`
- `dialogue_queue_pause`: `$8C:C543` – `$8C:C55C`
- `dialogue_queue_unpause`: `$8C:C55D` – `$8C:C5E1`
- `window_frame_synthesize_tilemap`: `$8C:AC8A` – `$8C:ACCF`
- `window_tilemap_dma_commit`: `$8C:ACD0` – `$8C:AD9D`

**ROM Source**: Bank `$8C` (US 1.0)
**Subsystem**: User Interface / Text Window Engine

---

## 1. Overview & Architectural Role

The Secret of Evermore text presentation system uses a circular FIFO message queue to decouple game script execution from on-screen dialogue presentation. Script opcodes (such as opcode `0x52` `message`) push 24-bit far text pointers into this circular queue without blocking the script interpreter.

A dedicated frame stepper (`dialogue_queue_tick`) polls the queue each V-Blank / game loop iteration:
1. **Dynamic Pacing**: When the message queue accumulates 3 or more pending messages (queue depth $\ge 9$ bytes), the display timer accelerates from 120 frames (2.0 seconds at 60 Hz) to 60 frames (1.0 second) to prevent message overflow and backpressure.
2. **Window Frame Geometry**: Configures a 30-column by 2-row border window at scanline row 20 (`$14`) using base tile attribute `$1924`.
3. **Shadow VRAM Tilemap**: Synthesizes the 9-slice window border and background tiles directly into shadow RAM at `$7F:C800`, computing line strides (64 bytes = 32 tiles/row) and queueing synchronous VRAM DMA transfers via `$80:8650`.

---

## 2. Data Structures & Memory Layout

```c
// Window control block at $034D in WRAM
typedef struct WindowDescriptor {
    uint16_t x_pos;            // +$00 ($034D): Window X coordinate (pixels)
    uint16_t y_pos;            // +$02 ($034F): Window Y coordinate (pixels)
    uint16_t window_type;      // +$04 ($0351): Mode/style (4 = dialogue box)
    uint16_t border_style;     // +$06 ($0353): Border frame style (1 = standard)
    uint16_t bg_palette;       // +$08 ($0355): Background color / palette slot
    uint16_t cursor_x;         // +$0A ($0357): Current text cursor column
    uint16_t cursor_y;         // +$0C ($0359): Current text cursor row
    uint16_t flags;            // +$12 ($035F): Window state flags ($10 = visible/staged)
    uint16_t text_row;         // +$14 ($0361): Screen tile row (20 = bottom bar)
    uint16_t text_col;         // +$16 ($0363): Screen tile column (1 = margin)
    uint16_t width_tiles;      // +$1C ($0369): Width in 8x8 tiles (30 = 240px)
    uint16_t height_tiles;     // +$1E ($036B): Height in 8x8 tiles (2 = 16px)
    uint16_t line_stride;      // +$20 ($036D): Tilemap stride attribute ($10)
    uint16_t vram_base_tile;   // +$26 ($0373): Tilemap base pattern ($1924)
} WindowDescriptor;

// Circular Message Queue Header in WRAM
// $7E:0B2B - Active display countdown timer (frames). Bit 15 set ($8000) = paused.
// $7E:0B2F - Queue read pointer (head offset in bytes, 0..21 step 3)
// $7E:0B31 - Queue write pointer (tail offset in bytes, 0..21 step 3)
// $7E:0DFB..$7E:0E12 - Queue entry buffer (8 entries of 3 bytes = 24 bytes)
typedef struct DialogueQueueEntry {
    uint16_t text_ptr_low;     // Word pointer to text string
    uint8_t  text_ptr_bank;    // Bank byte of text string
} DialogueQueueEntry;
```

---

## 3. Clean C Decompilation

```c
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
```

---

## 4. Verification & Behavioral Equivalence

1. **Circular Queue Indexing**: Matches 3-byte entry layout (`uint16_t text_ptr_low`, `uint8_t text_ptr_bank`) wrapped at 24 bytes (`0x18`).
2. **Speed-Up Heuristic**: Verified against assembly `$8C:C47C` (`CMP #$0009`): 3 or more queued messages accurately trigger 60-frame countdown instead of 120 frames.
3. **Hardware Multiply & Stride**: Matches hardware registers `$4202` / `$4216` used to compute 64-byte row strides into `$7F:C800` shadow VRAM buffer and VRAM target address offset `+0x0800`.

