/**
 * Routine: $8C:E420 (add_entity_hp)
 * Bank: $8C (ROM Offset: $0CE420)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   add_entity_hp ($8CE420) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  6 instructions (16 bytes)
 * - Compiled C ASM:   54 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      1049eef65f0eb880
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(add_entity_hp, 0x8CE420, RTS);

void add_entity_hp_bind(soe_regs r) {
    soe_call_rtl(0x8CEC8Eu, r);
    soe_call_rtl(0x8CEA43u, r);
    r->y = DP16(r, 0x4Cu);
    soe_nz16(r, r->y);
    soe_call_rtl(0x8FC0A5u, r);
    soe_carry(r, true);
}
