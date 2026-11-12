/**
 * Routine: $8C:E08E (write_word_to_expression_address)
 * Bank: $8C (ROM Offset: $0CE08E)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   write_word_to_expression_address ($8CE08E) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  7 instructions (15 bytes)
 * - Compiled C ASM:   67 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      a294aef4e92b3727
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(write_word_to_expression_address, 0x8CE08E, RTS);

void write_word_to_expression_address_bind(soe_regs r) {
    soe_call_rtl(0x8CEA43u, r);
    uint16_t val = r->a;
    soe_call_rtl(0x8CEA43u, r);
    r->x = val;
    soe_nz16(r, val);
    ABSI16(r, 0x0000u, r->x) = r->a;
    soe_carry(r, true);
}
