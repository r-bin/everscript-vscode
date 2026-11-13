/**
 * Routine: $90:8260 (sub_908260)
 * Bank: $90 (ROM Offset: $108260)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_908260 ($908260) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  43 instructions (103 bytes)
 * - Compiled C ASM:   85 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   2.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      f7cac406344183cd
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_dp.h"

SOE_BIND(sub_908260, 0x908260, RTL);

/**
 * If parent entity ($4C) has zero movement state (+0x64 low byte), substitutes
 * fallback animation ID from A for X before tail-jumping into $90:8124.
 */
void sub_908260_bind(soe_regs r) {
    uint16_t fallback = r->a;
    DP16(r, 0x12u) = fallback;

    uint16_t entity = DP16(r, DP_PARENT_ENTITY);
    r->y = entity;

    uint16_t moving = (uint16_t)(ABS16(r, (uint16_t)(entity + 0x0064u)) & 0x00FFu);
    r->a = moving;
    soe_nz16(r, moving);
    if (moving == 0u) {
        r->x = fallback;
        soe_nz16(r, fallback);
    }
    soe_call_rtl(0x908124u, r);
}
