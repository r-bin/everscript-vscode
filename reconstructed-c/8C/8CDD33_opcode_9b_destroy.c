/**
 * Routine: $8C:DD33 (release_entity_reference)
 * Bank: $8C (ROM Offset: $0CDD33)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   release_entity_reference ($8CDD33) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  6 instructions (14 bytes)
 * - Compiled C ASM:   90 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   15.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      8bc87582edcb024e
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(release_entity_reference, 0x8CDD33, RTS);

void release_entity_reference_bind(soe_regs r) {
    soe_call_rtl(0x8CEC8Eu, r);
    r->x = r->y;
    ABSI16(r, 0x003Eu, r->x) = (uint16_t)(ABSI16(r, 0x003Eu, r->x) - 1u);
    soe_call_rtl(0x8FB2DEu, r);
    soe_carry(r, true);
}
