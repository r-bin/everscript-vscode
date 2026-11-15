/*
 * $80:8F8C vram_tile_lru_queues_reset, RTL.
 *
 * Resets the dynamic sprite tile LRU cache queue ($7E:9726 / $7E:96A5 / $7E:97A7 / $7E:97A8)
 * and the 16x16 macro-tile allocator LRU queue ($7E:AB79 / $7E:AB18 / $7E:AB7A / $7E:ABDA / $7E:ABDB),
 * zeroes direct page $CB..$D2, sets direct page $D8 to 0x96, and returns with 16-bit A/X/Y.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   vram_tile_lru_queues_reset ($808F8C) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  44 instructions (98 bytes)
 * - Compiled C ASM:   279 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      9ba9fa29b0d0ab66
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(vram_tile_lru_queues_reset, 0x808F8C, RTL)
{
    DP16(r, 0xCB) = 0;
    DP16(r, 0xCD) = 0;
    DP16(r, 0xCF) = 0;
    DP16(r, 0xD1) = 0;

    uint8_t x = (uint8_t)r->x;
    uint8_t y = RAM8(0x9726);
    if (y != 0x81) {
        x = RAM8(0x97A7);
        RAM8(0x96A5 + x) = y;
        RAM8(0x9727 + y) = x;
        y = RAM8(0x97A8);
        RAM8(0x96A5 + y) = 0x80;
        RAM8(0x97A7) = y;
    }

    uint8_t y2 = RAM8(0xAB79);
    bool carry = (y2 >= 0x61);
    if (y2 != 0x61) {
        x = RAM8(0xABDA);
        RAM8(0xAB18 + x) = y2;
        RAM8(0xAB7A + y2) = x;
        y2 = RAM8(0xABDB);
        RAM8(0xAB18 + y2) = 0x60;
        RAM8(0xABDA) = y2;
    }

    RAM8(0x9726) = 0x81;
    RAM8(0x97A8) = 0x81;
    RAM8(0xAB79) = 0x61;
    RAM8(0xABDB) = 0x61;
    DP8(r, 0xD8) = 0x96;

    soe_set_a8(r, 0x96);
    r->x = x;
    r->y = y2;
    r->p = (uint8_t)((r->p & ~(SOE_M | SOE_X | SOE_Z | SOE_C)) | SOE_N | (carry ? SOE_C : 0));
}
