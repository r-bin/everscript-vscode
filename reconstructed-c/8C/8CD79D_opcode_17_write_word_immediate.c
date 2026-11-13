/*
 * $8C:D79D script_op_17_write_word_immediate (knowledge/routines/script_op_17_write_word_immediate.md), RTS.
 *
 * Reads a 16-bit offset into the $2258 state block and a 16-bit immediate value from [$82],
 * writes the value to DB:($2258 + offset), and returns C=1.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_17_write_word_immediate ($8CD79D) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  12 instructions (22 bytes)
 * - Compiled C ASM:   161 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   13.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      1ed74596d5ac031f
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(script_op_17_write_word_immediate, 0x8CD79D, RTS)
{
    uint16_t off = LONG16(SOE_DPPTR(r, 0x82));
    uint16_t ptr;
    uint16_t x;
    uint16_t val;

    soe_carry(r, false);
    x = soe_adc16(r, ALCHEMY_KNOWN_FLAGS_ADDR, off);
    DP16(r, 0x82) = (uint16_t)(DP16(r, 0x82) + 2u);

    val = LONG16(SOE_DPPTR(r, 0x82));
    ptr = (uint16_t)(DP16(r, 0x82) + 2u);
    DP16(r, 0x82) = ptr;

    ABSI16(r, 0x0000, x) = val;
    r->a = val;
    r->x = x;
    /* Final two INC $82 instructions set N/Z from ptr; SEC sets C */
    soe_nz16(r, ptr);
    r->p |= SOE_C;
}
