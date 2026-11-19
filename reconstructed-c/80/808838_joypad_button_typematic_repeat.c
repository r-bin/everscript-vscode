/*
 * $80:8838 joypad_button_typematic_repeat (knowledge/routines/joypad_button_typematic_repeat.md), RTL, 16-bit A.
 *
 * Processes joypad button input with typematic auto-repeat acceleration:
 * - When A is 0, or (A & $0345) is 0:
 *   Stores A to $0345 (held buttons), initializes timer $0343 from $0347 (initial delay),
 *   and reloads A from $0345.
 * - When buttons are held ((A & $0345) != 0):
 *   Decrements timer $0343. If timer reaches 0, reloads timer from $0349 (sustained rate)
 *   and returns A. If timer is not 0, returns A = 0 (suppress).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   joypad_button_typematic_repeat ($808838) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  17 instructions (38 bytes)
 * - Compiled C ASM:   236 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   13.9x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      1e07c77046e071c1
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(joypad_button_typematic_repeat, 0x808838, RTL)
{
    SOE_AT(0x8838);
    if (r->p & SOE_Z) {
        goto L_808851;
    }

    SOE_AT(0x883A);
    uint16_t held = ABS16(r, 0x0345);
    r->p = (uint8_t)((r->p & ~(SOE_N | SOE_V | SOE_Z))
           | ((held & 0x8000) ? SOE_N : 0)
           | ((held & 0x4000) ? SOE_V : 0)
           | (((r->a & held) == 0) ? SOE_Z : 0));

    SOE_AT(0x883D);
    if (r->p & SOE_Z) {
        goto L_808851;
    }

    SOE_AT(0x883F);
    uint16_t timer = (uint16_t)(ABS16(r, 0x0343) - 1);
    ABS16(r, 0x0343) = timer;
    soe_nz16(r, timer);

    SOE_AT(0x8842);
    if (r->p & SOE_Z) {
        SOE_AT(0x8848);
        ABS16(r, 0x0343) = ABS16(r, 0x0349);
        soe_nz16(r, r->a);
        return;
    }

    SOE_AT(0x8844);
    r->a = 0;
    soe_nz16(r, 0);
    return;

L_808851:
    SOE_AT(0x8851);
    ABS16(r, 0x0345) = r->a;
    ABS16(r, 0x0343) = ABS16(r, 0x0347);
    r->a = ABS16(r, 0x0345);
    soe_nz16(r, r->a);
}

