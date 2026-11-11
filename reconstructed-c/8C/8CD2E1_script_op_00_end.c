/*
 * Routine: $8CD2E1 (script_op_00_end)
 * Bank: $8C
 *
 * Script VM opcode $00 (END): marks the current thread slot ($7E) inactive,
 * decrements parent wait counter if spawned, and either returns to the caller
 * PC (+$0B) or compacts the active thread run-list at $2F28.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_00_end ($8CD2E1) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  29 instructions (52 bytes)
 * - Compiled C ASM:   278 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      1ee0e1327b66d6ce
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_00_end, 0x8CD2E1, RTS) {
    uint16_t y = dp_u16(r, 0x7E);
    uint16_t x, ret_pc, a_val;

    r->y = y;
    ABSI16(r, 0x0003, y) = 0x0000;

    x = ABSI16(r, 0x000D, y);
    if (x != 0) {
        ABSI16(r, 0x003E, x) = (uint16_t)(ABSI16(r, 0x003E, x) - 1u);
    }

    x = (uint16_t)(dp_u16(r, 0x80) - 2u);
    dp_u16(r, 0x80) = x;

    ret_pc = ABSI16(r, 0x000B, y);
    if (ret_pc != 0) {
        x = (uint16_t)(x + 2u);
        ABSI16(r, 0x2F28, x) = ret_pc;
        r->a = ret_pc;
        r->x = x;
        soe_nz16(r, x);
        r->p &= ~SOE_C;
        return;
    }

    do {
        x = (uint16_t)(x + 2u);
        ret_pc = ABSI16(r, 0x2F2A, x);
        ABSI16(r, 0x2F28, x) = ret_pc;
    } while (ret_pc != 0);

    a_val = (uint16_t)(dp_u16(r, 0x86) - 2u);
    dp_u16(r, 0x86) = a_val;
    dp_u16(r, 0x83) = 0x0000;

    r->a = a_val;
    r->x = x;
    soe_nz16(r, a_val);
    r->p &= ~SOE_C;
}
