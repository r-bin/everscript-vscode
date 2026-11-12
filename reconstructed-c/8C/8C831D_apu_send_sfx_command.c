/**
 * Routine: $8C:831D (apu_send_sfx_command)
 * Bank: $8C (ROM Offset: $0C831D)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   apu_send_sfx_command ($8C831D) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  4 instructions (11 bytes)
 * - Compiled C ASM:   43 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.8x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      141a94c710b156be
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(apu_send_sfx_command, 0x8C831D, RTL);

void apu_send_sfx_command_bind(soe_regs r) {
    r->y = ABS16(r, 0x0E4Fu);
    r->a = 0x0004u;
    soe_nz16(r, r->a);
    soe_call_rtl(0x8C81FDu, r);
}
