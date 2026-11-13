/**
 * Routine: $90:D020 (load_up_to_7_tile_families_from_map_palette)
 * Bank: $90 (ROM Offset: $10D020)
 * Calling convention: RTL
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   load_up_to_7_tile_families_from_map_palette ($90D020) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  65 instructions (132 bytes)
 * - Compiled C ASM:   396 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.1x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      5cd26a114de4028d
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

#define MAX_PALETTE_FAMILIES_PER_PASS 7u
#define TILE_FAMILY_BYTES             0x0020u
#define TILE_FAMILY_ROM_BASE          0xC322u
#define TILE_FAMILY_ROM_BANK          0x9Cu
#define TILE_FAMILY_WRAM_ADDR         0x61A7u
#define TILE_FAMILY_WRAM_BANK         0x7Eu
#define CGRAM_UPLOAD_WORDS            0x0010u
#define ROOM_HEADER_PTR_DP            0x8Bu

SOE_BIND(load_up_to_7_tile_families_from_map_palette, 0x90D020, RTL);

/**
 * Loads up to 7 palette families (32 bytes each from $9C:C322) into WRAM
 * $7E:61A7 via DMA ch1, and schedules the CGRAM palette upload via $80:85FA.
 */
void load_up_to_7_tile_families_from_map_palette_bind(soe_regs r) {
    uint16_t target_idx = RAM16(MAP_PALETTE_INDEX_ADDR);
    ABS16(r, LOADED_PALETTE_TAG_ADDR) = target_idx;

    uint16_t header_off = ABS16(r, ROOM_PALETTES_STREAM_PTR_ADDR);
    uint32_t room_hdr = SOE_DPPTR(r, ROOM_HEADER_PTR_DP);
    uint16_t total = (uint16_t)(LONG16(room_hdr + header_off) & 0x00FFu);

    soe_carry(r, true);
    uint16_t rem = soe_sbc16(r, total, target_idx);
    if ((rem == 0u) || (rem & 0x8000u)) {
        r->a = rem;
        r->y = header_off;
        return;
    }

    uint16_t count = (rem < 8u) ? rem : MAX_PALETTE_FAMILIES_PER_PASS;
    uint16_t y = (uint16_t)(header_off + (target_idx << 1) + 1u);

    ABS16(r, 0x2181u) = TILE_FAMILY_WRAM_ADDR;
    DP16(r, 0x26u) = TILE_FAMILY_WRAM_ADDR;
    ABS8(r, 0x2183u) = TILE_FAMILY_WRAM_BANK;
    DP8(r, 0x28u) = TILE_FAMILY_WRAM_BANK;

    for (uint16_t x = count; x != 0u; x--) {
        uint16_t fam_id = LONG16(room_hdr + y);
        y = (uint16_t)(y + 2u);
        uint16_t src_addr = (uint16_t)((fam_id << 5) + TILE_FAMILY_ROM_BASE);
        ABS16(r, 0x4312u) = src_addr;
        ABS16(r, 0x4315u) = TILE_FAMILY_BYTES;
        ABS16(r, 0x4310u) = 0x8000u;
        ABS8(r, 0x4314u) = TILE_FAMILY_ROM_BANK;
        ABS8(r, 0x420Bu) = 0x02u;
    }

    uint16_t total_pal = (uint16_t)(LONG16(room_hdr + header_off) & 0x00FFu);
    uint16_t cgram_off = (uint16_t)(total_pal << 4);
    r->y = cgram_off;
    r->x = (uint16_t)(cgram_off << 1);
    DP16(r, 0x2Eu) = CGRAM_UPLOAD_WORDS;
    r->a = CGRAM_UPLOAD_WORDS;
    soe_carry(r, (cgram_off & 0x8000u) != 0u);
    soe_nz16(r, r->x);

    soe_call_rtl(0x8085FAu, r);

    r->y = y;
    soe_nz16(r, y);
}
