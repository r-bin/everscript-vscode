/*
 * $8C:81D4 apu_wait_ready_timeout (knowledge/routines/apu_wait_ready_timeout.md), RTS.
 *
 * SPC700 ready state polling loop with 65,536-cycle timeout recovery.
 * Polls APU port $2142 against sequence byte DP $9F.
 * Saves and clears APU communication lock $0E65 during polling, then restores it.
 * Re-synchronizes DP $9F on timeout.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   apu_wait_ready_timeout ($8C81D4) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  22 instructions (41 bytes)
 * - Compiled C ASM:   184 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      ed37cca5dfe13a1c
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(apu_wait_ready_timeout, 0x8C81D4, RTS)
{
    uint16_t lock = ABS16(r, 0x0E65u);
    ABS8(r, 0x0E65u) = 0x00u;

    uint8_t seq = DP8(r, 0x9Fu);
    soe_set_a8(r, seq);

    uint16_t iter = 0u;
    bool matched = false;
    do {
        uint8_t port2 = ABS8(r, 0x2142u);
        if (seq == port2) {
            matched = true;
            break;
        }
        iter--;
    } while (iter != 0u);

    if (!matched) {
        seq = ABS8(r, 0x2142u);
        DP8(r, 0x9Fu) = seq;
        soe_set_a8(r, seq);
    }

    r->x = lock;
    soe_nz16(r, r->x);
    ABS16(r, 0x0E65u) = lock;

    r->p |= SOE_C;
    r->p &= ~(SOE_M | SOE_X);
}
