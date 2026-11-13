/**
 * Routine: $8F:C06D (calc_damage_with_defense_and_variance)
 * Bank: $8F (ROM Offset: $0FC06D)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   calc_damage_with_defense_and_variance ($8FC06D) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  24 instructions (45 bytes)
 * - Compiled C ASM:   101 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   4.2x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      55339da10c8660f5
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(calc_damage_with_defense_and_variance, 0x8FC06D, RTL);

void calc_damage_with_defense_and_variance_bind(soe_regs r) {
    DP16(r, 0x12u) = r->a;
    r->x = ABSI16(r, 0x0060u, r->y);
    uint16_t def = (uint16_t)(ROM16(0x8E001Bu + r->x) >> 2);
    r->p &= (uint8_t)~SOE_C;
    uint16_t net = (uint16_t)(soe_sbc16(r, def, DP16(r, 0x12u)) ^ 0xFFFFu);
    r->a = net;
    soe_call_rtl(0x8FC07Eu, r);
}
