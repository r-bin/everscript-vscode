/**
 * Routine: $8C:831D (apu_send_sfx_command)
 * Bank: $8C (ROM Offset: $0C831D)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8C82DC ($8C82DC) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  7 instructions (18 bytes)
 * - Compiled C ASM:   26 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   3.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      0cb1f3f66bc547ca
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(apu_send_sfx_command, 0x8C831D, RTL);
SOE_BIND(sub_8C82DC, 0x8C82DC, RTL);

void apu_send_sfx_command_bind(soe_regs r) {
    r->y = ABS16(r, 0x0E4Fu);
    r->a = 0x0004u;
    soe_nz16(r, r->a);
    soe_call_rtl(0x8C81FDu, r);
}

void sub_8C82DC_bind(soe_regs r) {
    r->p &= (uint8_t)~(SOE_M | SOE_X);
    ABS16(r, 0x0E4Fu) = r->a;
    apu_send_sfx_command_bind(r);
}
