/*
 * $90:A650 minimap_poi_blip_project (knowledge/routines/minimap_poi_blip_project.md), RTL.
 *
 * Scans dynamic POI blips from $90:0000, offsets world coordinates by $0FCC/$0FCE,
 * downsamples 16:1 via LSR #4 into radar cell candidate coordinates DP $46/$48,
 * validates against map dimensions ($08EE/$08F0), indexes map metatile array at $7F:0000,
 * and if below tile property threshold $0FC8, matches POI type table [$8B] to allocate
 * and commit a tracking slot ($0FD2, $1002, $1032).
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   minimap_poi_blip_project ($90A650) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  81 instructions (159 bytes)
 * - Compiled C ASM:   588 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   7.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      fb18c96312781fc8
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(minimap_poi_blip_project, 0x90A650, RTL)
{
    uint16_t x = ABS16(r, 0x0FCAu);
    if (x == 0u) {
        r->x = 0u;
        soe_nz16(r, 0u);
        return;
    }

    uint16_t w0 = LONG16(0x900000UL | x);
    if (w0 == 0x8000u) {
        ABS16(r, 0x0FCAu) = 0u;
        r->a = 0x8000u;
        soe_carry(r, true);
        soe_nz16(r, 0u);
        return;
    }

    uint16_t c_x = (uint16_t)(((w0 + ABS16(r, 0x0FCCu)) >> 4) & 0x00FFu);
    DP16(r, 0x46u) = c_x;

    uint16_t w2 = LONG16(0x900000UL | (uint16_t)(x + 2u));
    uint16_t c_y = (uint16_t)(((w2 + ABS16(r, 0x0FCEu)) >> 4) & 0x00FFu);
    DP16(r, 0x48u) = c_y;

    x = (uint16_t)(x + 4u);
    ABS16(r, 0x0FCAu) = x;

    uint16_t map_w = ABS16(r, 0x08EEu);
    if (c_x >= map_w) {
        r->a = c_x;
        soe_cmp16(r, c_x, map_w);
        return;
    }

    uint16_t map_h = ABS16(r, 0x08F0u);
    if (c_y >= map_h) {
        r->a = c_y;
        soe_cmp16(r, c_y, map_h);
        return;
    }

    uint16_t prod = (uint16_t)((uint32_t)(map_w & 0x00FFu) * (uint32_t)c_y);
    uint16_t tile_off = (uint16_t)((c_x + prod) << 1);
    r->x = tile_off;

    uint16_t tile = LONG16(0x7F0000UL | tile_off);
    r->a = tile;
    uint16_t thresh = ABS16(r, 0x0FC8u);
    soe_cmp16(r, tile, thresh);
    if (tile >= thresh) {
        return;
    }

    DP16(r, 0x04u) = tile_off;
    uint32_t ptr_8b = SOE_DPPTR(r, 0x8Bu);
    uint16_t table_y = (uint16_t)(ABS16(r, 0x0FC6u) + 1u);

    for (int iter = 0; iter < 1000; iter++) {
        table_y = (uint16_t)(table_y + 1u);
        uint16_t entry = LONG16(ptr_8b + table_y);
        if (tile == entry) {
            break;
        }
        for (int skip = 0; skip < 1000; skip++) {
            table_y = (uint16_t)(table_y + 2u);
            if (LONG16(ptr_8b + table_y) == 0u) {
                break;
            }
        }
        table_y = (uint16_t)(table_y + 2u);
    }

    uint16_t slot_base = ABS16(r, 0x0FD0u);
    int free_slot = -1;
    for (int i = 0; i < 4; i++) {
        uint16_t slot_x = (uint16_t)(slot_base + (uint16_t)(i * 2));
        if (ABS16(r, 0x0FD2u + slot_x) == 0u) {
            free_slot = slot_x;
            break;
        }
    }

    if (free_slot < 0) {
        r->y = table_y;
        soe_nz16(r, table_y);
        return;
    }

    ABS16(r, 0x0FD2u + (uint16_t)free_slot) = table_y;
    uint16_t packed_coords = (uint16_t)(c_x | (c_y << 8));
    ABS16(r, 0x1032u + (uint16_t)free_slot) = packed_coords;
    ABS16(r, 0x1002u + (uint16_t)free_slot) = tile_off;
    r->a = tile_off;
    soe_nz16(r, tile_off);
}
