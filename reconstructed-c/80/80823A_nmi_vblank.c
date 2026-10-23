/*
 * Routine: $80823A (nmi_vblank)
 * Bank: $80 (ROM Offset: $00823A)
 * Source: docs/disassembly/engine-core/nmi-vblank.md
 */

#include <stdint.h>
#include <stdbool.h>

extern uint8_t  snes_rdnmi;      /* $4210 */
extern uint8_t  snes_hdmaen;     /* $420C */
extern uint8_t  snes_inidisp;    /* $2100 */
extern uint8_t  snes_hvbjoy;     /* $4212 */
extern uint16_t snes_joy1;       /* $4218 */

extern uint16_t g_ppu_shadow_0106; /* $7E:0106 */
extern uint16_t g_vram_lock_0f3a;  /* $7E:0F3A */
extern uint8_t  g_frame_ready_d9;  /* $7E:00D9 */
extern uint16_t g_frame_counter_lo;/* $7E:0100 */
extern uint16_t g_frame_counter_hi;/* $7E:0102 */
extern uint8_t  g_hdma_enable_72;  /* $7E:0072 */
extern uint16_t g_joypad1_current; /* $7E:0EC6 */
extern uint16_t g_joypad1_prev;    /* $7E:0104 */

void process_vram_upload_queue(void);
void flush_ppu_shadow_registers(void);

void nmi_handler(void) {
    /* 1. Acknowledge NMI interrupt */
    volatile uint8_t rdnmi = snes_rdnmi;
    (void)rdnmi;

    /* 2. Disable HDMA transfers during VBLANK */
    snes_hdmaen = 0x00;

    /* 3. Flush INIDISP screen brightness / display state */
    snes_inidisp = (uint8_t)g_ppu_shadow_0106;

    /* 4. Process VRAM DMA uploads only if lock is inactive and frame is ready */
    if (g_vram_lock_0f3a == 0 && g_frame_ready_d9 != 0) {
        process_vram_upload_queue(); /* $80:834A */
    }

    /* 5. Flush PPU scroll, window, and math register shadows */
    flush_ppu_shadow_registers(); /* $80:830C */

    /* 6. Increment 32-bit frame counter */
    g_frame_counter_lo++;
    if (g_frame_counter_lo == 0) {
        g_frame_counter_hi++;
    }

    /* 7. Re-enable HDMA channels for the upcoming frame */
    snes_hdmaen = g_hdma_enable_72;

    /* 8. Spin until auto-joypad read completes (HVBJOY bit 0) */
    while (snes_hvbjoy & 0x01) {
        /* Wait for SNES auto-joypad cycle (typically 3-4 scanlines) */
    }

    /* 9. Read controller 1 button states */
    g_joypad1_prev = g_joypad1_current;
    g_joypad1_current = snes_joy1;
}
