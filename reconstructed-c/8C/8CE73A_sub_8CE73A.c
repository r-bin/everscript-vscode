/*
 * Routine: sub_8CE73A ($8C:E73A)
 * Script/Entity subsystem: sets bit $4000 on status word $0010,Y, clears field $0076,Y,
 * masks status word $0012,Y with $FB87, and sets Carry.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8CE73A ($8CE73A) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  10 instructions (24 bytes)
 * - Compiled C ASM:   140 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   14.0x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      603f837961ed300d
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_8CE73A, 0x8CE73A, RTS) {
    ABSI16(r, 0x0010u, r->y) |= 0x4000u;
    ABSI16(r, 0x0076u, r->y) = r->d;
    uint16_t a = (uint16_t)(ABSI16(r, 0x0012u, r->y) & 0xFB87u);
    ABSI16(r, 0x0012u, r->y) = a;
    r->a = a;
    soe_nz16(r, a);
    r->p |= SOE_C;
}

