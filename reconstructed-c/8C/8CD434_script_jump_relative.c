/*
 * $8C:D434 script_jump_relative (knowledge/rom/8cd434.md), RTS, enters with a 16-bit A.
 *
 * Reads a signed 16-bit offset at the 24-bit script pointer DP $82..$84 (two byte reads; the low
 * byte of the pointer steps by one in between, carrying into $83), then pointer = pointer + offset + 1.
 * Crossing out of the upper bank half moves to the bank before (backward) or after (forward) and
 * sets $8000 again. Leaves C = 1, A = the new pointer low word, a 16-bit accumulator.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_jump_relative ($8CD434) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  27 instructions (49 bytes)
 * - Compiled C ASM:   265 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      e94cab9e1e0f8b1a
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

void soe_script_jump_back_tail(soe_regs r, uint16_t a);

SOE_BIND(script_jump_relative, 0x8CD434, RTS)
{
    uint8_t lo, hi;
    uint16_t a;

    lo = LONG8(SOE_DPPTR(r, 0x82));
    DP8(r, 0x82) = (uint8_t)(DP8(r, 0x82) + 1);              /* 8-bit INC $82, carry into $83 */
    if (DP8(r, 0x82) == 0) DP8(r, 0x83) = (uint8_t)(DP8(r, 0x83) + 1);
    hi = LONG8(SOE_DPPTR(r, 0x82));
    a = (uint16_t)(hi << 8 | lo);
    soe_cmp16(r, a, 0x0000);
    soe_carry(r, true);
    if (a & 0x8000) {
        soe_script_jump_back_tail(r, a);
        return;
    }
    /* $8C:D457 */
    a = soe_adc16(r, a, DP16(r, 0x82));
    if (!(a & 0x8000)) {
        uint16_t bank;
        a |= 0x8000;
        bank = (uint16_t)(DP16(r, 0x84) + 1);
        DP16(r, 0x84) = bank;
        soe_nz16(r, bank);
    }
    DP16(r, 0x82) = a;
    soe_carry(r, true);
    r->a = a;
}