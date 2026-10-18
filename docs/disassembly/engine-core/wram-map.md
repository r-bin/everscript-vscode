# Engine Core WRAM Memory Map & Struct Definitions

This document details all Working RAM (WRAM, Bank `$7E`) addresses identified and utilized by the **Secret of Evermore** reset handler, main loop scheduler, and NMI interrupt handler.

---

## 1. C Struct Definition: Engine Core State

```c
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
```

---

## 2. Address Catalog

| Address | Size | Identifier | Lifetime | Purpose & Behavior |
|---|---|---|---|---|
| `$7E:0072` | 1 byte | `HDMA_ENABLE_MASK` | Frame | Restored into `$420C` by the NMI handler at scanline 225. Main loop sets this to enable Mode 7 perspective or HDMA color gradients. |
| `$7E:00CB` | 1 byte | `DMA_QUEUE_INDEX` | Frame | Index offset into the frame VRAM upload buffer. Reset to 0 by `$80:8F8C` at the start of each frame. |
| `$7E:00D9` | 1 byte | `FRAME_READY_FLAG` | Frame | Set to non-zero when the main loop completes drawing. NMI checks this before uploading VRAM; cleared after upload. |
| `$7E:0100` | 2 bytes | `FRAME_COUNTER_LO` | Boot | Incremented every NMI interrupt (`$80:8462`). Polled by `wait_for_frame` (`$80:858C`) to synchronize 60 Hz frame pacing. |
| `$7E:0102` | 2 bytes | `FRAME_COUNTER_HI` | Boot | High word of 32-bit frame counter; increments when `$7E:0100` wraps from `$FFFF` to `$0000`. |
| `$7E:0104` | 2 bytes | `JOYPAD1_PREV_RAW` | Frame | Controller 1 state from the previous frame; used for button-down edge detection. |
| `$7E:0106` | 2 bytes | `INIDISP_SHADOW` | Frame | Shadow of SNES register `$2100`. Set to `$008F` (screen off) at boot, `$0000` (screen on, full brightness) during normal gameplay. |
| `$7E:0108` | 2 bytes | `HTIME_SHADOW` | Frame | Shadow of `$4207` (HTIMEL / HTIMEH) for raster IRQ horizontal position. |
| `$7E:010A` | 2 bytes | `VTIME_SHADOW` | Frame | Shadow of `$4209` (VTIMEL / VTIMEH) for raster IRQ scanline position. |
| `$7E:010E` | 2 bytes | `BG4HOFS_SHADOW` | Frame | BG4 Horizontal scroll offset; written twice to `$210D` during NMI. |
| `$7E:0110` | 2 bytes | `BG4VOFS_SHADOW` | Frame | BG4 Vertical scroll offset; written twice to `$210E` during NMI. |
| `$7E:0112` | 2 bytes | `BG1VOFS_SHADOW` | Frame | BG1 Vertical scroll offset; written twice to `$210F` during NMI. |
| `$7E:0114` | 2 bytes | `BG1HOFS_SHADOW` | Frame | BG1 Horizontal scroll offset; written twice to `$2110` during NMI. |
| `$7E:0116` | 2 bytes | `BG2VOFS_SHADOW` | Frame | BG2 Vertical scroll offset; written twice to `$2111` during NMI. |
| `$7E:0118` | 2 bytes | `BG2HOFS_SHADOW` | Frame | BG2 Horizontal scroll offset; written twice to `$2112` during NMI. |
| `$7E:011A` | 2 bytes | `BG3VOFS_SHADOW` | Frame | BG3 Vertical scroll offset; written twice to `$2113` during NMI. |
| `$7E:011C` | 2 bytes | `BG3HOFS_SHADOW` | Frame | BG3 Horizontal scroll offset; written twice to `$2114` during NMI. |
| `$7E:0122` | 1 byte | `W12SEL_SHADOW` | Frame | Window mask configuration for BG1 and BG2; written to `$2123`. |
| `$7E:0123` | 1 byte | `W34SEL_SHADOW` | Frame | Window mask configuration for BG3 and BG4; written to `$2124`. |
| `$7E:0124` | 1 byte | `WOBJSEL_SHADOW` | Frame | Window mask configuration for sprites; written to `$2125`. |
| `$7E:0133` | 2 bytes | `PRNG_SEED_0` | Boot | PRNG state word 0. Seeded at boot by latching PPU raster counters and XORing with `$DEAD` / `$63C7`. |
| `$7E:0135` | 2 bytes | `PRNG_SEED_1` | Boot | PRNG state word 1. XORed with `$BABE` / `$E294`. |
| `$7E:0137` | 2 bytes | `PRNG_SEED_2` | Boot | PRNG state word 2. XORed with `$BEEF` / `$5A0D`. |
| `$7E:0139` | 2 bytes | `PRNG_SEED_3` | Boot | PRNG state word 3. XORed with `$FACE` / `$18BF`. |
| `$7E:0ADB` | 2 bytes | `CURRENT_ROOM_ID` | Room | Active room / map ID. Initialized from `$92:8002` at boot; passed to `enter_room` (`$8E:E4E2`). |
| `$7E:0B3B` | 2 bytes | `ACTIVE_SAVE_SLOT` | Boot | SRAM save slot index (0..3), read from battery RAM `$30:6001`. |
| `$7E:0E65` | 2 bytes | `ENGINE_PAUSE_COUNTER` | Boot | Pause counter; decremented at boot. If > 0, engine skips actor simulation. |
| `$7E:0E6B` | 1 byte | `NMITIMEN_MIRROR` | Boot | Shadow copy of `$4200` (`$81` = NMI enabled, Auto-Joypad enabled). |
| `$7E:0EC6` | 2 bytes | `JOYPAD1_BUTTONS` | Frame | Joypad 1 held buttons (B, Y, Select, Start, Up, Down, Left, Right, A, X, L, R), read from `$4218`. |
| `$7E:0F3A` | 2 bytes | `VRAM_QUEUE_LOCK` | Room | Safety lock. When non-zero, NMI skips VRAM uploads. Used by camera scrolling (`$90:94AB`) and room resets (`$90:8E90`). |
| `$7E:11F4` | 2 bytes | `SCRIPT_SLOT_MAILBOX` | Room | Script thread communication mailbox; initialized to `$FFFF` at reset. |
| `$7E:1274` | 2 bytes | `CURRENT_MUSIC_TRACK` | Room | Active music track index; initialized to `$FFFF` at reset. |
| `$7E:22EA` | 2 bytes | `SYSTEM_STATE_FLAGS` | Save | Engine system flags. Bit 2 (`0x0004`) marks cold boot SRAM initialization. |
| `$7E:22EB` | 2 bytes | `ROOM_TRANSITION_FLAGS` | Room | Map flags. Bit 2 (`0x0004`) triggers a map enter script and room load. |

