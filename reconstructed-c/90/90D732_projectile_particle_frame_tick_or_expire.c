/**
 * Routine: $90:D732 (projectile_particle_frame_tick_or_expire)
 * Bank: $90 (ROM Offset: $10D732)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   projectile_particle_frame_tick_or_expire ($90D732) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  12 instructions (23 bytes)
 * - Compiled C ASM:   181 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   15.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      acd1007a05df40fc
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(projectile_particle_frame_tick_or_expire, 0x90D732, RTS);

void projectile_particle_frame_tick_or_expire_bind(soe_regs r) {
    r->x = r->y;
    uint16_t frame = ABS16(r, 0x0100u);
    r->a = (uint16_t)(frame >> 1);
    soe_carry(r, (frame & 1u) != 0u);
    if (frame & 1u) {
        soe_nz16(r, r->a);
        soe_call_rtl(0x90D749u, r);
        soe_carry(r, false);
        return;
    }
    uint16_t ttl = (uint16_t)(ABSI16(r, 0x0ECFu, r->x) - 1u);
    ABSI16(r, 0x0ECFu, r->x) = ttl;
    soe_nz16(r, ttl);
    if ((ttl & 0x8000u) == 0u) {
        soe_call_rtl(0x90D749u, r);
        soe_carry(r, false);
        return;
    }
    ABSI16(r, 0x0ECAu, r->x) = 0u;
    soe_carry(r, false);
}
