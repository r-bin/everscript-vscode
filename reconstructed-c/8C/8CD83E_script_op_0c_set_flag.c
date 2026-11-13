/*
 * $8C:D83E script_op_0c_set_flag (knowledge/routines/script_op_0c_set_flag.md), RTS, 16-bit A, X, Y.
 *
 * Reads a 16-bit bit index from [$82], evaluates the boolean expression via $8C:EA43, and sets or clears
 * the corresponding bit in $2258+.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_0c_set_flag ($8CD83E) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  33 instructions (62 bytes)
 * - Compiled C ASM:   228 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      be9d7f3b58fee31e
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(script_op_0c_set_flag, 0x8CD83E, RTS)
{
    SOE_AT(0xD83E);
    uint16_t raw = LONG16(SOE_DPPTR(r, 0x82));
    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 2);
    r->y = raw;
    r->p &= ~SOE_C;
    uint16_t byte_addr = soe_adc16(r, (uint16_t)(raw >> 3), 0x2258);
    uint16_t bit_idx = (uint16_t)(raw & 0x0007);
    r->a = bit_idx;
    soe_nz16(r, bit_idx);
    soe_call_rtl(0x8CEA43, r);
    if (!(r->p & SOE_Z)) {
        SOE_AT(0xD858);
        r->x = byte_addr;
        uint8_t v = (uint8_t)(ROM8(0x80A87FUL + bit_idx) | ABSI8(r, 0x0000, byte_addr));
        ABSI8(r, 0x0000, byte_addr) = v;
        soe_set_a8(r, v);
        soe_nz8(r, v);
    } else {
        SOE_AT(0xD86A);
        r->x = byte_addr;
        uint8_t v = (uint8_t)(ROM8(0x80A887UL + bit_idx) & ABSI8(r, 0x0000, byte_addr));
        ABSI8(r, 0x0000, byte_addr) = v;
        soe_set_a8(r, v);
        soe_nz8(r, v);
    }
    r->p = (uint8_t)((r->p & ~SOE_M) | SOE_C);
}
