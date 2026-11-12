/**
 * Routine: $8C:DB67 (script_op_freeze_entity)
 * Bank: $8C (ROM Offset: $0CDB67)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   script_op_freeze_entity ($8CDB67) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  4 instructions (10 bytes)
 * - Compiled C ASM:   31 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      3e673baed445709b
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(script_op_freeze_entity, 0x8CDB67, RTS);

void script_op_freeze_entity_bind(soe_regs r) {
    soe_call_rtl(0x8CEC8Eu, r);
    soe_call_rtl(0x8FCD78u, r);
    soe_carry(r, true);
}
