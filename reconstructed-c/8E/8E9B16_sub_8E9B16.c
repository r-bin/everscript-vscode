/*
 * Routine: sub_8E9B16 ($8E:9B16)
 * Sound/Audio subsystem: scans audio table in WRAM $7E0000+X and updates counter $0834/$0836.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_8E9B16 ($8E9B16) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  15 instructions (36 bytes)
 * - Compiled C ASM:   94 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      d605a1907381d1c4
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

