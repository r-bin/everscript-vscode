/*
 * $8E:E5FC audio_master_volume_fade_tick (knowledge/rom/8ee5fc.md), RTL, 16-bit A.
 *
 * Moves the brightness/volume byte $0106 (DB-relative) one step toward the target byte $0B83 while
 * $0B83 is negative (a fade is running) and $0106 bit 7 is clear; reaching the target clears the
 * word $0B83. Leaves A and N Z C from the last load or compare.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   audio_master_volume_fade_tick ($8EE5FC) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  24 instructions (54 bytes)
 * - Compiled C ASM:   225 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      654994b16f02fb71
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(audio_master_volume_fade_tick, 0x8EE5FC, RTL)
{
    uint16_t a = ABS16(r, 0x0106);
    uint8_t target;

    soe_nz16(r, a);
    r->a = a;
    if (a & 0x0080) { r->p &= (uint8_t)~SOE_Z; return; }     /* BIT #$0080: Z clear */
    a = ABS16(r, 0x0B83);
    soe_nz16(r, a);
    r->a = a;
    if (!(a & 0x8000)) return;
    target = ABS8(r, 0x0B83);
    r->a = (uint16_t)((a & 0xFF00) | target);
    soe_cmp8(r, target, ABS8(r, 0x0106));
    if (!(r->p & SOE_Z)) {
        ABS8(r, 0x0106) = (uint8_t)(ABS8(r, 0x0106) + ((r->p & SOE_N) ? -1 : 1));
        soe_cmp8(r, target, ABS8(r, 0x0106));
        if (!(r->p & SOE_Z)) return;
    }
    ABS16(r, 0x0B83) = 0;
}