/*
 * $80:8FEE oam_finalize_and_blank_unused (knowledge/routines/oam_finalize_and_blank_unused.md), RTL, 16-bit A, X, Y.
 *
 * Finalizes OAM buffers for the current frame:
 * 1. Pushes DB, sets DB = $7E.
 * 2. Compares active OAM cursor DP $D3 with previous frame high-water mark at $1438.
 * 3. If $D3 < $1438, loops backwards filling unused OAM slots in $ABDE.. with $E0E0 (offscreen Y = 224).
 * 4. Updates $1438 with the new high-water mark.
 * 5. Clears dynamic tile DMA queues: $15D6 + $CB = 0, $163C + $CD = 0.
 * 6. Resets OAM state: DP $D3 = 0, DP $D5 = $01FF, DP $D7 = $40.
 * 7. Sets OAM frame-ready latch DP $D9 = 1 for NMI transfer.
 * 8. Restores entry DB.
 * Leaves A = 1, X = $40, N Z from restored DB.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   oam_finalize_and_blank_unused ($808FEE) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  33 instructions (68 bytes)
 * - Compiled C ASM:   334 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   10.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      a8affe61b23464d6
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(oam_finalize_and_blank_unused, 0x808FEE, RTL)
{
    uint8_t entry_db = r->db;
    uint16_t d3 = DP16(r, 0xD3);
    uint16_t high_water = ABS16(r, OAM_HIGH_WATER_MARK_ADDR);

    SOE_AT(0x8FEE);
    r->db = 0x7E;
    r->x = d3;
    soe_cmp16(r, d3, high_water);

    if (d3 < high_water) {
        SOE_AT(0x8FFB);
        r->x = high_water;
        r->a = 0xE0E0;
        soe_nz16(r, 0xE0E0);
        do {
            SOE_AT(0x9001);
            r->x = (uint16_t)(r->x - 2);
            ABS16(r, (uint16_t)(LOW_OAM_TABLE_BUF_ADDR + r->x)) = 0xE0E0;

            SOE_AT(0x9006);
            r->x = (uint16_t)(r->x - 2);
            ABS16(r, (uint16_t)(LOW_OAM_TABLE_BUF_ADDR + r->x)) = 0xE0E0;

            SOE_AT(0x900B);
            soe_cmp16(r, r->x, d3);
        } while (r->x != d3);
    }

    SOE_AT(0x900F);
    ABS16(r, OAM_HIGH_WATER_MARK_ADDR) = r->x;

    SOE_AT(0x9012);
    r->p |= SOE_X;
    r->y &= 0x00FF;

    SOE_AT(0x9014);
    r->x = DP8(r, 0xCB);
    soe_nz8(r, (uint8_t)r->x);
    ABS16(r, (uint16_t)(BG_TILEMAP_DMA_DEST_ADDR + r->x)) = 0;

    SOE_AT(0x9019);
    r->x = DP8(r, 0xCD);
    soe_nz8(r, (uint8_t)r->x);
    ABS16(r, (uint16_t)(VRAM_TILE_DMA_QUEUE_ADDR + r->x)) = 0;

    SOE_AT(0x901E);
    DP16(r, 0xD3) = 0;

    SOE_AT(0x9020);
    r->a = 0x01FF;
    soe_nz16(r, 0x01FF);
    DP16(r, 0xD5) = 0x01FF;

    SOE_AT(0x9025);
    r->x = 0x0040;
    soe_nz8(r, 0x40);
    DP8(r, 0xD7) = 0x40;

    SOE_AT(0x9029);
    r->p &= ~(SOE_M | SOE_X);

    SOE_AT(0x902B);
    r->a = 0x0001;
    soe_nz16(r, 0x0001);
    DP16(r, 0xD9) = 0x0001;

    r->db = entry_db;
    soe_nz8(r, entry_db);
}
