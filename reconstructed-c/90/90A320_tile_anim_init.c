/*
 * Routine: map_tile_anim_and_cuttable_terrain_init ($90:A320)
 * Reset terrain mutation / VRAM tile queue state ($0FB0, $B0, $1170, $1172),
 * then clear $7E107E-$7E111D (160 zero bytes from $808000) and fill
 * $7E111E-$7E116D (80 bytes of $FF from $808DB2) via fixed-source DMA ch 1.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   map_tile_anim_and_cuttable_terrain_init ($90A320) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  29 instructions (77 bytes)
 * - Compiled C ASM:   273 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   9.4x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      d3fe4b0ce76ec44b
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"
#include "soe_ram.h"

SOE_BIND(map_tile_anim_and_cuttable_terrain_init, 0x90A320, RTL) {
    ABS16(r, TERRAIN_MUT_ACTIVE_ADDR) = 0x0000u;
    DP16(r, 0xB0u) = 0x0000u;
    ABS16(r, VRAM_SINGLE_TILE_QUEUE_TAIL_ADDR) = 0x0000u;
    ABS16(r, VRAM_SINGLE_TILE_QUEUE_HEAD_ADDR) = 0x0000u;

    /* SEP #$20: DMA channel 1 fixed-source copy of 160 zeros ($80:8000 -> $2180) */
    ABS16(r, 0x4315u) = 0x00A0u;
    ABS16(r, 0x4310u) = 0x8008u;
    ABS16(r, 0x4312u) = 0x8000u;
    ABS8(r, 0x4314u) = 0x80u;
    ABS16(r, 0x2181u) = 0x107Eu;
    ABS8(r, 0x2183u) = 0x00u;
    ABS8(r, 0x420Bu) = 0x02u;

    /* Reuse WRAM pointer (now at $7E:111E) to fill 80 bytes of $FF ($80:8DB2) */
    ABS16(r, 0x4315u) = 0x0050u;
    ABS16(r, 0x4312u) = 0x8DB2u;
    ABS8(r, 0x4314u) = 0x80u;
    ABS8(r, 0x420Bu) = 0x02u;

    r->x = 0x8DB2u;
    soe_set_a8(r, 0x02u);
    soe_nz8(r, 0x02u);
    r->p &= (uint8_t)~SOE_M;
}
