/*
 * Routine: $808E9A (map_decompression_terrain_collision_words_dma)
 * Bank: $80
 *
 * Initializes the OAM/sprite tile free-list tables and OAM high-table buffer
 * via fixed-source DMA Channel 1 transfers to WMDATA ($2180) and OAMDATA ($2104),
 * then links the doubly-linked free-list indices in $7E:96A5..$7E:97A8 and
 * $7E:AB18..$7E:ABDB.
 */

/*
 * Routine Rating & Verification:
 * - Target Routine:   map_decompression_terrain_collision_words_dma ($808E9A) [RTL]
 * - Test Method:      G1 differential testing (trampoline + 4th MB bridge in snes9x / cpu65816)
 * - Initial ROM ASM:  146 instructions (333 bytes)
 * - Compiled C ASM:   926 instructions [Calypsi 65816 -O1 --speed]
 * - Code Expansion:   6.3x instructions vs ROM
 * - ASM Closeness:    100% state parity per call (A, X, Y, S, D, DB, P, WRAM, I/O order match ROM)
 * - Rating Hash:      0331415f63594041
 * - Rating Status:    VALID (unmodified since rating)
 */
#include "soe.h"

SOE_BIND(map_decompression_terrain_collision_words_dma, 0x808E9A, RTL) {
    uint16_t i;
    uint8_t y, x;

    dp_u16(r, 0xD9) = 0x0000;

    /* DMA 1: Fill $7E:95A5..$7E:96A4 (0x0100 bytes) from $80:8DB2 */
    ABS16(r, 0x4312) = 0x8DB2;
    ABS8(r, 0x4314) = 0x80;
    ABS16(r, 0x2181) = 0x95A5;
    ABS8(r, 0x2183) = 0x7E;
    ABS8(r, 0x4311) = 0x80;
    ABS16(r, 0x4315) = 0x0100;
    ABS8(r, 0x4310) = 0x08;
    ABS8(r, 0x420B) = 0x02;

    /* DMA 2: Fill $7E:AA58..$7E:AB17 (0x00C0 bytes) from $80:8DB2 */
    ABS16(r, 0x2181) = 0xAA58;
    ABS8(r, 0x2183) = 0x7E;
    ABS16(r, 0x4315) = 0x00C0;
    ABS8(r, 0x4310) = 0x08;
    ABS8(r, 0x420B) = 0x02;

    /* DMA 3: Fill $7E:ABDE..$7E:ADFD (0x0220 bytes) from $80:8DB3 */
    ABS16(r, 0x4312) = 0x8DB3;
    ABS8(r, 0x4314) = 0x80;
    ABS16(r, 0x2181) = 0xABDE;
    ABS8(r, 0x2183) = 0x7E;
    ABS8(r, 0x4311) = 0x80;
    ABS16(r, 0x4315) = 0x0220;
    ABS8(r, 0x4310) = 0x08;
    ABS8(r, 0x420B) = 0x02;

    bus_write16(r, 0x1438, 0x0000);
    ABS16(r, 0x2102) = 0x0000;

    /* DMA 4: Clear hardware OAM ($2104, 0x0220 bytes) from $80:8DB3 */
    ABS8(r, 0x4311) = 0x04;
    ABS16(r, 0x4315) = 0x0220;
    ABS8(r, 0x4310) = 0x08;
    ABS8(r, 0x420B) = 0x02;

    dp_u16(r, 0xDB) = 0x0000;
    dp_u16(r, 0xDD) = 0x0000;
    dp_u16(r, 0xD9) = 0x0000;
    dp_u16(r, 0xD3) = 0x0000;
    dp_u16(r, 0xD5) = 0xFFFF;
    dp_u8(r, 0xD7) = 0x40;

    x = 0x80;
    for (i = 0; i < 0x81; i++) {
        wram_u8(0x9727 + i) = x;
        wram_u8(0x96A5 + x) = (uint8_t)i;
        x = (uint8_t)i;
    }
    wram_u8(0x9727 + 0x81) = 0x81;
    wram_u8(0x96A5 + 0x81) = 0x81;

    x = 0x60;
    for (i = 0; i < 0x61; i++) {
        wram_u8(0xAB7A + i) = x;
        wram_u8(0xAB18 + x) = (uint8_t)i;
        x = (uint8_t)i;
    }
    wram_u8(0xAB7A + 0x61) = 0x61;
    wram_u8(0xAB18 + 0x61) = 0x61;

    /* Fall through via JMP $8F8C */
    dp_u16(r, 0xCB) = 0x0000;
    dp_u16(r, 0xCD) = 0x0000;
    dp_u16(r, 0xCF) = 0x0000;
    dp_u16(r, 0xD1) = 0x0000;

    x = 0x60;
    y = wram_u8(0x9726);
    if (y != 0x81) {
        x = wram_u8(0x97A7);
        wram_u8(0x96A5 + x) = y;
        wram_u8(0x9727 + y) = x;
        y = wram_u8(0x97A8);
        wram_u8(0x96A5 + y) = 0x80;
        wram_u8(0x97A7) = y;
    }

    y = wram_u8(0xAB79);
    if (y != 0x61) {
        x = wram_u8(0xABDA);
        wram_u8(0xAB18 + x) = y;
        wram_u8(0xAB7A + y) = x;
        y = wram_u8(0xABDB);
        wram_u8(0xAB18 + y) = 0x60;
        wram_u8(0xABDA) = y;
    }

    wram_u8(0x9726) = 0x81;
    wram_u8(0x97A8) = 0x81;
    wram_u8(0xAB79) = 0x61;
    wram_u8(0xABDB) = 0x61;
    dp_u8(r, 0xD8) = 0x96;

    r->a = 0xFF96;
    r->x = x;
    r->y = y;
    r->p = (r->p & ~(SOE_M | SOE_X)) | SOE_C;
    soe_nz8(r, r->db);
}
