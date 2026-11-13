/*
 * $90:CBC8 cgram_dma_commit_15_palettes (knowledge/routines/cgram_dma_commit_15_palettes.md), RTL, 16-bit A, X, Y.
 *
 * Commits 480 bytes (15 palettes) via DMA channel 1 to CGRAM starting at color $10 and zeroes
 * palette animation timers and channel state $1278..$1290 and $13D2..$13F0.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   cgram_dma_commit_15_palettes ($90CBC8) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  32 instructions (82 bytes)
 * - Compiled C ASM:   355 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   11.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      053f91effaab7042
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(cgram_dma_commit_15_palettes, 0x90CBC8, RTL)
{
    SOE_AT(0xCBC8);
    r->y &= 0x00FF;
    ABS16(r, 0x4312) = 0x8000;
    ABS8(r, 0x4314) = 0x80;
    ABS8(r, 0x2121) = 0x10;
    ABS8(r, 0x4311) = 0x22;
    ABS16(r, 0x4315) = 0x01E0;
    ABS8(r, 0x4310) = 0x08;
    ABS8(r, 0x420B) = 0x02;
    r->p &= ~(SOE_M | SOE_X);
    r->a = 0x01E0;
    ABS16(r, CGRAM_DMA_QUEUE_HEAD_ADDR) = 0;
    ABS16(r, TILE_FAMILY_ANIM_TIMER_ADDR) = 0;
    ABS16(r, SOUND_COMMAND_MAILBOX_ADDR) = 0;
    ABS16(r, PALETTE_CYCLE_STEP_0_ADDR) = 0;
    ABS16(r, PALETTE_CYCLE_STEP_1_ADDR) = 0;
    ABS16(r, PALETTE_CYCLE_STEP_2_ADDR) = 0;
    ABS16(r, PALETTE_CYCLE_STEP_4_ADDR) = 0;
    ABS16(r, PALETTE_CYCLE_STEP_3_ADDR) = 0;
    ABS16(r, PALETTE_CYCLE_STEP_5_ADDR) = 0;
    ABS16(r, PALETTE_CYCLE_STEP_6_ADDR) = 0;
    r->x = 0x001E;
    do {
        SOE_AT(0xCC12);
        ABSI16(r, PALETTE_ANIM_RATE_ADDR, r->x) = 0;
        r->x = (uint16_t)(r->x - 2);
        soe_nz16(r, r->x);
    } while (!(r->p & SOE_N));
}
