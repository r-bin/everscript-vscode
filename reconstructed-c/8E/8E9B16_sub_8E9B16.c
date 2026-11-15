/*
 * Routines: sub_8E9AC3, sub_8E9B16 ($8E:9AC3, $8E:9B16)
 * Sound/Audio subsystem: scans audio table in WRAM $7E0000+X and updates audio queue pointers and counters.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8E9B16 ($8E9B16) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  15 instructions (36 bytes)
 * - Compiled C ASM:   201 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   13.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      1075cee75ed0202f
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_8E9B16, 0x8E9B16, RTL) {
    for (;;) {
        uint16_t val = RAM16(r->x);
        if (val != 0u) {
            RAM16(0x0842u) = 0x0020u;
            RAM16(0x0834u) = (uint16_t)(RAM16(0x0834u) + 1u);
            break;
        }
        if (r->x == 0x2343u) {
            break;
        }
        r->x = (uint16_t)(r->x + 1u);
    }
    uint16_t cnt = (uint16_t)(RAM16(0x0834u) - 1u);
    r->a = cnt;
    soe_cmp16(r, cnt, RAM16(0x0836u));
    if ((r->p & SOE_N) != 0u) {
        RAM16(0x0836u) = 0u;
    }
}

SOE_BIND(sub_8E9AC3, 0x8E9AC3, RTL) {
    uint16_t x = r->x;
    uint16_t y = r->y;
    for (;;) {
        uint16_t val = RAM16(x);
        if (val != 0u) {
            RAM16(0x0814u + y) = 0x0020u;
            y = (uint16_t)(y + 2u);
            break;
        }
        if (x == 0x233Fu) {
            break;
        }
        x = (uint16_t)(x + 1u);
    }
    RAM16(0x0814u + y) = 0x0026u;
    y = (uint16_t)(y + 2u);
    r->y = y;

    uint16_t a = (uint16_t)(y >> 1);
    RAM16(0x0810u) = a;
    a = (uint16_t)(a - 1u);
    soe_cmp16(r, a, RAM16(0x0812u));
    if ((r->p & SOE_N) != 0u) {
        RAM16(0x0812u) = 0u;
    }

    RAM16(0x0834u) = 0x0005u;
    RAM16(0x0838u) = 0x0018u;
    RAM16(0x083Au) = 0x001Au;
    RAM16(0x083Cu) = 0x001Cu;
    RAM16(0x083Eu) = 0x001Eu;
    RAM16(0x0840u) = 0x0022u;

    r->x = 0x2341u;
    sub_8E9B16_bind(r);
}

