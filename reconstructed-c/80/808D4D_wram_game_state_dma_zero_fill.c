/*
 * Routine: $808D4D (wram_game_state_dma_zero_fill)
 * Bank: $80
 *
 * Zero-fills the 769-byte ($0301) persistent game state block at $7E:2258..$7E:2558
 * via fixed-source DMA Channel 1 from $80:8000 to WMDATA ($2180), then clears
 * the script active thread run-list head ($2F28) and thread count ($86).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   wram_game_state_dma_zero_fill ($808D4D) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  21 instructions (53 bytes)
 * - Compiled C ASM:   178 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      7efd298eef99f48d
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(wram_game_state_dma_zero_fill, 0x808D4D, RTL) {
    ABS16(r, 0x4312) = 0x8000;
    ABS8(r, 0x4314) = 0x80;
    ABS16(r, 0x2181) = 0x2258;
    ABS8(r, 0x2183) = 0x7E;
    ABS8(r, 0x4311) = 0x80;
    ABS16(r, 0x4315) = 0x0301;
    ABS8(r, 0x4310) = 0x08;
    ABS8(r, 0x420B) = 0x02;

    bus_write16(r, 0x2F28, 0x0000);
    dp_u16(r, 0x86) = 0x0000;

    r->a = 0x0301;
    r->x = 0x0002;
    r->y &= 0x00FF;
    r->p &= ~(SOE_M | SOE_X | SOE_N | SOE_Z);
}
