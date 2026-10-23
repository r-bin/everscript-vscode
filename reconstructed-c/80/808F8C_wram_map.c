/*
 * Routine: $808F8C (wram_map)
 * Bank: $80 (ROM Offset: $008F8C)
 * Source: docs/disassembly/engine-core/wram-map.md
 */

#include <stdint.h>

/**
 * PPU Register Shadows located in low Direct Page / Bank $7E ($7E:0100 - $7E:013A)
 * Flushed to SNES PPU MMIO registers ($2100..$2133, $4200..$420D) during each NMI.
 */
typedef struct SnesPpuShadows {
    uint16_t frame_counter_lo;    /* $7E:0100 - Lower 16-bit NMI frame counter */
    uint16_t frame_counter_hi;    /* $7E:0102 - Upper 16-bit NMI frame counter */
    uint16_t joypad1_prev_raw;    /* $7E:0104 - Raw joypad state previous frame */
    uint16_t inidisp;             /* $7E:0106 - Shadow of $2100 (Screen display / brightness) */
    uint16_t htime;               /* $7E:0108 - Shadow of $4207 (HTIMEL / HTIMEH) */
    uint16_t vtime;               /* $7E:010A - Shadow of $4209 (VTIMEL / VTIMEH) */
    uint16_t reserved_010c;       /* $7E:010C */
    uint16_t bg4_scroll_x;        /* $7E:010E - Shadow of $210D (BG4HOFS) */
    uint16_t bg4_scroll_y;        /* $7E:0110 - Shadow of $210E (BG4VOFS) */
    uint16_t bg1_scroll_y;        /* $7E:0112 - Shadow of $210F (BG1VOFS) */
    uint16_t bg1_scroll_x;        /* $7E:0114 - Shadow of $2110 (BG1HOFS) */
    uint16_t bg2_scroll_y;        /* $7E:0116 - Shadow of $2111 (BG2VOFS) */
    uint16_t bg2_scroll_x;        /* $7E:0118 - Shadow of $2112 (BG2HOFS) */
    uint16_t bg3_scroll_y;        /* $7E:011A - Shadow of $2113 (BG3VOFS) */
    uint16_t bg3_scroll_x;        /* $7E:011C - Shadow of $2114 (BG3HOFS) */
    uint16_t window_shadow_1e;    /* $7E:011E */
    uint16_t window_shadow_20;    /* $7E:0120 */
    uint8_t  w12sel;              /* $7E:0122 - Shadow of $2123 (W12SEL) */
    uint8_t  w34sel;              /* $7E:0123 - Shadow of $2124 (W34SEL) */
    uint8_t  wobjsel;             /* $7E:0124 - Shadow of $2125 (WOBJSEL) */
    uint8_t  padding_0125;        /* $7E:0125 */
    uint8_t  reserved_0126[13];   /* $7E:0126..$7E:0132 */
    uint16_t rng_seed[4];         /* $7E:0133..$7E:013A - 64-bit PRNG state */
} SnesPpuShadows;

/**
 * Transient Frame Coordination Flags ($7E:0070 - $7E:00DF)
 */
typedef struct EngineFrameFlags {
    uint8_t  hdma_channel_mask;   /* $7E:0072 - Active HDMA channels copied to $420C */
    uint8_t  dma_queue_write_idx; /* $7E:00CB - Write cursor for frame VRAM transfer queue */
    uint8_t  frame_ready_d9;      /* $7E:00D9 - Non-zero when VRAM upload queue is ready */
} EngineFrameFlags;

/**
 * High-Level System and Map Mailboxes
 */
typedef struct EngineSystemMailbox {
    uint16_t current_room_id;     /* $7E:0ADB - Active map/room index */
    uint16_t active_save_slot;    /* $7E:0B3B - SRAM save slot index (0..3) */
    int16_t  pause_counter;       /* $7E:0E65 - Decremented at boot, paused when > 0 */
    uint8_t  nmitimen_mirror;     /* $7E:0E6B - Shadow mirror of $4200 (usually $81) */
    uint16_t joypad1_buttons;     /* $7E:0EC6 - Current Joypad 1 buttons held */
    uint16_t vram_queue_lock;     /* $7E:0F3A - If != 0, NMI skips VRAM uploads */
    uint16_t script_slot_mailbox; /* $7E:11F4 - Script thread synchronization word */
    uint16_t current_music_track; /* $7E:1274 - Active music sequence ID ($FFFF if none) */
    uint16_t system_state_flags;  /* $7E:22EA - Bit 2 (0x0004) = Fresh SRAM boot */
    uint16_t map_transition_flag; /* $7E:22EB - Bit 2 (0x0004) = Room transition requested */
} EngineSystemMailbox;
