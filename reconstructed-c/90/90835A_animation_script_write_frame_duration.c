/*
 * $90:835A animation_script_write_frame_duration (knowledge/routines/animation_script_write_frame_duration.md), RTS.
 *
 * Stores frame duration byte operand from [<$5D] into +$05,Y,
 * updates script pointer +$00,Y and <$5D past duration operand by 1 byte.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   animation_script_write_frame_duration ($90835A) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  9 instructions (18 bytes)
 * - Compiled C ASM:   208 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   23.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      d1f7e75ba1842c3c
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(animation_script_write_frame_duration, 0x90835A, RTS)
{
    SOE_AT(0x835A);
    if ((r->p & SOE_M) != 0u) {
        uint8_t duration = LONG8(SOE_DPPTR(r, 0x5D));
        soe_set_a8(r, duration);

        SOE_AT(0x835C);
        ABSI8(r, 0x0005, r->y) = duration;
    } else {
        uint16_t duration = LONG16(SOE_DPPTR(r, 0x5D));
        r->a = duration;

        SOE_AT(0x835C);
        ABSI16(r, 0x0005, r->y) = duration;
    }

    SOE_AT(0x835F);
    r->p &= (uint8_t)~SOE_M;

    SOE_AT(0x8361);
    uint16_t next_pc = (uint16_t)(DP16(r, 0x5D) + 1u);
    r->a = next_pc;

    SOE_AT(0x8364);
    DP16(r, 0x5D) = next_pc;

    SOE_AT(0x8366);
    ABSI16(r, 0x0000, r->y) = next_pc;

    SOE_AT(0x8369);
    soe_nz16(r, next_pc);
    r->p |= SOE_M;
}
