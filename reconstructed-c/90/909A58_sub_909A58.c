/*
 * Routine: sub_909A58 ($90:9A58)
 * Graphics/VRAM DMA queue: enqueues a 64-byte ($40) VRAM transfer into deferred DMA queue at $013D.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   sub_9099CE ($9099CE) [RTS]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  42 instructions (85 bytes)
 * - Compiled C ASM:   238 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   5.7x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      da9925a266be37f7
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

SOE_BIND(sub_9099CE, 0x9099CE, RTS) {
    uint32_t ptr_26 = SOE_DPPTR(r, 0x26u);
    while (1) {
        uint16_t tile_idx = LONG16(0x7F0000u | r->x);
        uint16_t word = LONG16(ptr_26 + tile_idx);
        ABS16(r, r->y) = word;
        uint16_t d12 = (uint16_t)(DP16(r, 0x12u) - 1u);
        DP16(r, 0x12u) = d12;
        soe_nz16(r, d12);
        if (d12 == 0u) break;
        r->x = (uint16_t)(r->x + 2u);
        r->y = (uint16_t)(r->y + 2u);
        soe_cmp16(r, r->y, DP16(r, 0x30u));
        if (r->y == DP16(r, 0x30u)) {
            r->y = DP16(r, 0x2Eu);
            soe_nz16(r, r->y);
        }
    }
    uint16_t a = (uint16_t)((DP16(r, 0x02u) & 0x001Fu) << 5);
    r->a = a;
    r->y = 0x0080u;
    sub_909A58_bind(r);
}
