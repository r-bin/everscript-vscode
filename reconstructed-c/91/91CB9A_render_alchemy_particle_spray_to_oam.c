/**
 * Routine: $91:CB9A (render_alchemy_particle_spray_to_oam)
 * Bank: $91 (ROM Offset: $11CB9A)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   render_alchemy_particle_spray_to_oam ($91CB9A) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  9 instructions (23 bytes)
 * - Compiled C ASM:   57 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      9e66c3cd3d4fa3bf
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(render_alchemy_particle_spray_to_oam, 0x91CB9A, RTL);

void render_alchemy_particle_spray_to_oam_bind(soe_regs r) {
    DP16(r, 0x2Eu) = 0x059Eu;
    r->a = 0x00C8u;
    soe_nz16(r, r->a);
    DP16(r, 0x30u) = r->a;
    for (;;) {
        soe_call_rtl(0x91CBB1u, r);
        if (!(r->p & SOE_C)) {
            break;
        }
        soe_call_rtl(0x809033u, r);
    }
}
