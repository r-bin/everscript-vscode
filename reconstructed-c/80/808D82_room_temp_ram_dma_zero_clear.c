/*
 * Routine: $808D82 (room_temp_ram_dma_zero_clear)
 * Bank: $80
 *
 * Clears the 200-byte ($00C8) room temporary RAM block at $7E:2834..$7E:28FB
 * using fixed-source DMA Channel 1 from $80:8000 to WMDATA ($2180).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   room_temp_ram_dma_zero_clear ($808D82) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  19 instructions (48 bytes)
 * - Compiled C ASM:   154 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      de243dec6930ea00
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(room_temp_ram_dma_zero_clear, 0x808D82, RTL) {
    ABS16(r, 0x4312) = 0x8000;
    ABS8(r, 0x4314) = 0x80;
    ABS16(r, 0x2181) = 0x2834;
    ABS8(r, 0x2183) = 0x7E;
    ABS8(r, 0x4311) = 0x80;
    ABS16(r, 0x4315) = 0x00C8;
    ABS8(r, 0x4310) = 0x08;
    ABS8(r, 0x420B) = 0x02;

    r->a = 0x00C8;
    r->x = 0x0002;
    r->y &= 0x00FF;
    r->p &= ~(SOE_M | SOE_X | SOE_N | SOE_Z);
}
