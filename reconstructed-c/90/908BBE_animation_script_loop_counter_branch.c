/*
 * $90:8BBE animation_script_loop_counter_branch (knowledge/routines/animation_script_loop_counter_branch.md), RTS.
 *
 * Reads 8-bit offset from [<$5D] into Y, decrements 16-bit loop counter at (<$12),Y in record.
 * If zero: advances script PC <$5D by 3 bytes.
 * If non-zero: stores decremented counter back, advances <$5D by 1, and loads 16-bit branch target into <$5D.
 * Restores Y from <$12, sets M=1, X=0, and returns via RTS.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   animation_script_loop_counter_branch ($908BBE) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  21 instructions (38 bytes)
 * - Compiled C ASM:   266 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   12.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      f9c54841c4e25bce
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(animation_script_loop_counter_branch, 0x908BBE, RTS)
{
    SOE_AT(0x8BBE);
    DP16(r, 0x12) = r->y;

    SOE_AT(0x8BC0);
    // TDC: in 65816, transfers 16-bit D register to Accumulator
    r->a = r->d;

    SOE_AT(0x8BC1);
    uint8_t off = LONG8(SOE_DPPTR(r, 0x5D));
    r->a = (uint16_t)(((r->d & 0xFF00u)) | off);

    SOE_AT(0x8BC3);
    r->y = r->a;

    SOE_AT(0x8BC4);
    // REP #$31: clears M (0x20), X (0x10), and C (0x01)
    r->p &= (uint8_t)~(SOE_M | SOE_X | SOE_C);

    SOE_AT(0x8BC6);
    uint16_t base = DP16(r, 0x12);
    uint16_t count = ABSI16(r, base, r->y);

    SOE_AT(0x8BC8);
    count = (uint16_t)(count - 1u);
    r->a = count;

    if (count == 0) {
        SOE_AT(0x8BCB);
        uint16_t pc = DP16(r, 0x5D);
        r->a = soe_adc16(r, pc, 0x0003u);

        SOE_AT(0x8BD0);
        DP16(r, 0x5D) = r->a;

        SOE_AT(0x8BD2);
        r->y = DP16(r, 0x12);
        soe_nz16(r, r->y);

        SOE_AT(0x8BD4);
        r->p |= SOE_M;
        return;
    }

    SOE_AT(0x8BD7);
    ABSI16(r, base, r->y) = count;

    SOE_AT(0x8BD9);
    // In 16-bit mode (M=0), INC $5D increments 16-bit word at DP $5D
    uint16_t pc = (uint16_t)(DP16(r, 0x5D) + 1u);
    DP16(r, 0x5D) = pc;

    SOE_AT(0x8BDB);
    uint16_t target = LONG16(SOE_DPPTR(r, 0x5D));
    r->a = target;

    SOE_AT(0x8BDD);
    DP16(r, 0x5D) = target;

    SOE_AT(0x8BDF);
    r->y = DP16(r, 0x12);
    soe_nz16(r, r->y);

    SOE_AT(0x8BE1);
    r->p |= SOE_M;
}
