/*
 * $80:8507 enable_nmi_auto_joypad (knowledge/routines/enable_nmi_auto_joypad.md), RTL, 16-bit A, X, Y.
 *
 * Enables VBlank NMI and automatic joypad read ($4200 = $81, mirrored at $0E6B) and installs
 * the default dummy IRQ vector ($80:858B) at $012B..$012E while preserving processor status P.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   enable_nmi_auto_joypad ($808507) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  13 instructions (28 bytes)
 * - Compiled C ASM:   86 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.6x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      09fe495d1d9f8d79
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(enable_nmi_auto_joypad, 0x808507, RTL)
{
    SOE_AT(0x8507);
    uint8_t saved_p = r->p;
    ABS8(r, 0x4200) = 0x81;
    ABS8(r, NMITIMEN_MIRROR_ADDR) = 0x81;
    r->x = 0x858B;
    r->a = 0x0080;
    ABS16(r, 0x012D) = 0x0080;
    ABS16(r, IRQ_USER_HOOK_FAR_PTR_ADDR) = 0x858B;
    r->p = saved_p;
}
