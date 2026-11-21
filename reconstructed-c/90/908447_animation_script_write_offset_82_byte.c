/*
 * $90:8447 animation_script_write_offset_82_byte (knowledge/routines/animation_script_write_offset_82_byte.md), RTS.
 *
 * Reads byte operand from script stream [<$5D] and stores into animation record field +$82,Y,
 * advancing 24-bit pointer <$5D..$5E by 1 byte.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   animation_script_write_offset_82_byte ($908447) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  6 instructions (12 bytes)
 * - Compiled C ASM:   129 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   21.5x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      193ed1e86e9147f4
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(animation_script_write_offset_82_byte, 0x908447, RTS)
{
    SOE_AT(0x8447);
    uint8_t byte = LONG8(SOE_DPPTR(r, 0x5D));
    soe_set_a8(r, byte);

    SOE_AT(0x8449);
    ABSI8(r, 0x0082, r->y) = byte;

    SOE_AT(0x844C);
    uint8_t lo = (uint8_t)(DP8(r, 0x5D) + 1u);
    DP8(r, 0x5D) = lo;
    if (lo != 0) {
        SOE_AT(0x844E);
        soe_nz8(r, lo);
        return;
    }

    SOE_AT(0x8450);
    uint8_t hi = (uint8_t)(DP8(r, 0x5E) + 1u);
    DP8(r, 0x5E) = hi;
    soe_nz8(r, hi);
}
