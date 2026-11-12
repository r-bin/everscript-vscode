/**
 * Routine: $90:885A (animation_script_bind_palette_resource)
 * Bank: $90 (ROM Offset: $10885A)
 * Calling convention: RTS
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   animation_script_bind_palette_resource ($90885A) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  10 instructions (19 bytes)
 * - Compiled C ASM:   107 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      f869952f4f4ce669
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(animation_script_bind_palette_resource, 0x90885A, RTS);

void animation_script_bind_palette_resource_bind(soe_regs r) {
    r->p &= (uint8_t)~SOE_M;
    uint16_t pal_id = LONG16(SOE_DPPTR(r, 0x5Du));
    r->a = pal_id;
    soe_nz16(r, pal_id);
    soe_call_rtl(0x90CD5Cu, r);
    r->y = DP16(r, 0x4Cu);
    uint16_t pc = (uint16_t)(DP16(r, 0x5Du) + 2u);
    r->x = pc;
    DP16(r, 0x5Du) = pc;
    soe_nz16(r, pc);
    r->p |= SOE_M;
}
