/*
 * Routine: sub_909A58 ($90:9A58)
 * Graphics/VRAM DMA queue: enqueues a 64-byte ($40) VRAM transfer into deferred DMA queue at $013D.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_909A58 ($909A58) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  17 instructions (41 bytes)
 * - Compiled C ASM:   143 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   8.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      ddf2a805a25c2782
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(sub_909A58, 0x909A58, RTS) {
    uint16_t x = RAM16(0x013Du);
    RAM16(0x0143u + x) = (uint16_t)(r->a | DP16(r, 0x04u));
    RAM16(0x013Fu + x) = r->y;
    RAM16(0x0141u + x) = 0x0009u;
    RAM16(0x0140u + x) = DP16(r, 0x2Eu);
    RAM16(0x0145u + x) = 0x0040u;
    soe_carry(r, false);
    uint16_t sum = soe_adc16(r, x, 0x0008u);
    uint16_t res = (uint16_t)(sum & 0x01FFu);
    RAM16(0x013Du) = res;
    r->x = x;
    r->a = res;
    soe_nz16(r, res);
}
