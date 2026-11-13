/*
 * $90:836C animation_script_store_scaled_duration (knowledge/routines/animation_script_store_scaled_duration.md), RTS, 8-bit A, 16-bit X, Y.
 *
 * Halves the low byte of X into animation record duration +$05,Y and stores the 16-bit script PC
 * from DP $5D..$5E into +$00..+$01,Y.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   animation_script_store_scaled_duration ($90836C) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  8 instructions (16 bytes)
 * - Compiled C ASM:   185 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   23.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      b4d9cf378af96b15
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(animation_script_store_scaled_duration, 0x90836C, RTS)
{
    SOE_AT(0x836C);
    uint8_t a = (uint8_t)r->x;
    soe_carry(r, (a & 0x01) != 0);
    a >>= 1;
    ABSI8(r, 0x0005, r->y) = a;
    a = DP8(r, 0x5D);
    ABSI8(r, 0x0000, r->y) = a;
    a = DP8(r, 0x5E);
    ABSI8(r, 0x0001, r->y) = a;
    soe_set_a8(r, a);
    soe_nz8(r, a);
}
