/*
 * Routine: $8CC4F6 (cutscene_scheduler)
 * Bank: $8C (ROM Offset: $0CC4F6)
 * Source: docs/disassembly/script-vm/cutscene-scheduler.md
 */

#include <stdint.h>
#include <stdbool.h>

#define CUTSCENE_QUEUE_CAPACITY 8
#define CUTSCENE_STRIDE         3
#define CUTSCENE_QUEUE_BYTES    (CUTSCENE_QUEUE_CAPACITY * CUTSCENE_STRIDE)

#define PAUSE_GUARD_BIT         0x8000
#define WINDOW_ACTIVE_BIT       0x0010

typedef struct {
    uint8_t  pc_low;
    uint8_t  pc_mid;
    uint8_t  bank;
} ScriptPointerEntry;

typedef struct {
    uint16_t pad0[2];
    uint16_t margin_x;       // +0x04 ($0351)
    uint16_t margin_y;       // +0x06 ($0353)
    uint16_t pad1;           // +0x08 ($0355)
    uint16_t origin_x;       // +0x0A ($0357)
    uint16_t origin_y;       // +0x0C ($0359)
    uint16_t pad2[2];
    uint16_t width_tiles;    // +0x14 ($0361) = 20
    uint16_t pad3;           // +0x16 ($0363)
    uint16_t pad4[2];
    uint16_t height_tiles;   // +0x1C ($0369) = 30
    uint16_t palette;        // +0x1E ($036B) = 2
    uint16_t glyph_delay;    // +0x20 ($036D) = 16
    uint16_t pad5;           // +0x22 ($036F)
    uint16_t pad6;           // +0x24 ($0371)
    uint16_t tile_pattern;   // +0x26 ($0373) = 0x1924
    uint16_t pad7;           // +0x28 ($0375)
    uint16_t mode;           // +0x2A ($0377) = 1
} TextWindowDescriptor;

extern uint16_t g_cutscene_flags;        // $7E:0B2B
extern uint16_t g_queue_read_idx;        // $7E:0B2F
extern uint16_t g_queue_write_idx;       // $7E:0B31
extern uint8_t  g_script_queue[24];      // $7E:0DFB..$7E:0E12
extern TextWindowDescriptor g_window_0;  // $7E:034D
extern uint16_t g_window_active_mask;    // $7E:035F

extern void window_frame_construct(TextWindowDescriptor *win);
extern void window_clear(TextWindowDescriptor *win);
extern void text_stream_start(uint32_t script_address);

/**
 * Enqueues a 24-bit script instruction pointer into circular buffer.
 * Corresponds to $8C:C521.
 */
void cutscene_script_enqueue(uint32_t script_address) {
    uint16_t write_idx = g_queue_write_idx;

    // Wrap-around boundary check
    uint16_t next_idx = write_idx + CUTSCENE_STRIDE;
    if (next_idx >= CUTSCENE_QUEUE_BYTES) {
        next_idx = 0;
    }
    g_queue_write_idx = next_idx;

    // Store 24-bit pointer
    g_script_queue[write_idx + 0] = (uint8_t)(script_address & 0xFF);
    g_script_queue[write_idx + 1] = (uint8_t)((script_address >> 8) & 0xFF);
    g_script_queue[write_idx + 2] = (uint8_t)((script_address >> 16) & 0xFF);
}

/**
 * Activates cutscene pause lock and clears any open dialogue boxes.
 * Corresponds to $8C:C543.
 */
void cutscene_pause_activate(void) {
    if ((g_cutscene_flags & ~PAUSE_GUARD_BIT) != 0) {
        window_clear(&g_window_0);
    }
    g_cutscene_flags |= PAUSE_GUARD_BIT;
}

/**
 * Resets circular dialogue queue indices.
 * Corresponds to $8C:C4F6.
 */
void cutscene_dialogue_queue_reset(void) {
    if ((g_cutscene_flags & ~PAUSE_GUARD_BIT) != 0) {
        window_clear(&g_window_0);
    }
    g_queue_read_idx = 0;
    g_queue_write_idx = 0;
    g_cutscene_flags &= PAUSE_GUARD_BIT;
}

/**
 * Dequeues pending script and initializes full 20x30 text box.
 * Corresponds to $8C:C55D.
 */
void cutscene_dialogue_activate(void) {
    uint16_t flags = g_cutscene_flags & ~PAUSE_GUARD_BIT;
    g_cutscene_flags = flags;
    if (flags == 0) {
        return; // Nothing pending
    }

    uint16_t read_idx = g_queue_read_idx;
    uint32_t script_addr = (uint32_t)g_script_queue[read_idx + 0] |
                           ((uint32_t)g_script_queue[read_idx + 1] << 8) |
                           ((uint32_t)g_script_queue[read_idx + 2] << 16);

    // Initialize 20x30 standard dialogue layout
    g_window_0.origin_x     = 0;
    g_window_0.origin_y     = 0;
    g_window_0.margin_x     = 4;
    g_window_0.margin_y     = 1;
    g_window_0.width_tiles  = 20;
    g_window_0.height_tiles = 30;
    g_window_0.palette      = 2;
    g_window_0.glyph_delay  = 16;
    g_window_0.tile_pattern = 0x1924;
    g_window_0.mode         = 1;

    window_frame_construct(&g_window_0);
    g_window_active_mask |= WINDOW_ACTIVE_BIT;
    text_stream_start(script_addr);
}
